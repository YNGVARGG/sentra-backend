const pool = require('../config/database');
const logger = require('../config/logger');
const EmergencyService = require('../services/emergencyService');

const triggerEmergency = async (req, res) => {
  try {
    const { device_id, severity, type, description, location_data } = req.body;
    const customerId = req.customer.id;

    if (device_id) {
      const deviceCheck = await pool.query(
        'SELECT id FROM devices WHERE id = $1 AND customer_id = $2',
        [device_id, customerId]
      );

      if (deviceCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Device not found or not owned by customer' });
      }
    }

    const emergency = await EmergencyService.processEmergency({
      customerId,
      deviceId: device_id,
      severity,
      type,
      description,
      locationData: location_data
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('EMERGENCY_TRIGGERED', {
        emergency_id: emergency.id,
        type: emergency.type,
        severity: emergency.severity,
        timestamp: emergency.created_at
      });

      io.to('operators').emit('NEW_EMERGENCY', {
        emergency_id: emergency.id,
        customer_id: customerId,
        type: emergency.type,
        severity: emergency.severity,
        timestamp: emergency.created_at
      });
    }

    logger.warn(`Emergency triggered: ${emergency.id} by customer: ${customerId}`);

    res.status(201).json({
      emergency_id: emergency.id,
      status: emergency.status,
      message: 'Emergency alert created successfully',
      estimated_response_time: '< 60 seconds'
    });
  } catch (error) {
    logger.error('Trigger emergency error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getEmergencyHistory = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const emergencies = await pool.query(
      `SELECT e.*, d.type as device_type, d.location as device_location,
              COUNT(er.id) as response_count
       FROM emergencies e
       LEFT JOIN devices d ON e.device_id = d.id
       LEFT JOIN emergency_responses er ON e.id = er.emergency_id
       WHERE e.customer_id = $1
       GROUP BY e.id, d.type, d.location
       ORDER BY e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [customerId, limit, offset]
    );

    const totalCount = await pool.query(
      'SELECT COUNT(*) FROM emergencies WHERE customer_id = $1',
      [customerId]
    );

    res.json({
      emergencies: emergencies.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalCount.rows[0].count / limit),
        total_count: parseInt(totalCount.rows[0].count),
        has_more: offset + emergencies.rows.length < totalCount.rows[0].count
      }
    });
  } catch (error) {
    logger.error('Get emergency history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getEmergencyDetails = async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const customerId = req.customer.id;

    const emergency = await pool.query(
      'SELECT * FROM emergencies WHERE id = $1 AND customer_id = $2',
      [emergencyId, customerId]
    );

    if (emergency.rows.length === 0) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    const emergencyStatus = await EmergencyService.getEmergencyStatus(emergencyId);

    res.json(emergencyStatus);
  } catch (error) {
    logger.error('Get emergency details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const resolveEmergency = async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const { notes } = req.body;
    const customerId = req.customer.id;

    const emergency = await pool.query(
      'SELECT * FROM emergencies WHERE id = $1 AND customer_id = $2',
      [emergencyId, customerId]
    );

    if (emergency.rows.length === 0) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    if (emergency.rows[0].status === 'resolved') {
      return res.status(400).json({ error: 'Emergency already resolved' });
    }

    await EmergencyService.resolveEmergency(emergencyId, null, notes);

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('EMERGENCY_RESOLVED', {
        emergency_id: emergencyId,
        resolved_at: new Date().toISOString(),
        resolved_by: 'customer'
      });

      io.to('operators').emit('EMERGENCY_RESOLVED', {
        emergency_id: emergencyId,
        customer_id: customerId,
        resolved_at: new Date().toISOString(),
        resolved_by: 'customer'
      });
    }

    logger.info(`Emergency ${emergencyId} resolved by customer ${customerId}`);

    res.json({ 
      message: 'Emergency resolved successfully',
      emergency_id: emergencyId,
      resolved_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Resolve emergency error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const cancelEmergency = async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const customerId = req.customer.id;

    const emergency = await pool.query(
      'SELECT * FROM emergencies WHERE id = $1 AND customer_id = $2',
      [emergencyId, customerId]
    );

    if (emergency.rows.length === 0) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    if (emergency.rows[0].status === 'resolved') {
      return res.status(400).json({ error: 'Cannot cancel resolved emergency' });
    }

    await pool.query(
      'UPDATE emergencies SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['cancelled', emergencyId]
    );

    await pool.query(
      'INSERT INTO emergency_responses (emergency_id, action, notes) VALUES ($1, $2, $3)',
      [emergencyId, 'cancelled', 'Emergency cancelled by customer']
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('EMERGENCY_CANCELLED', {
        emergency_id: emergencyId,
        cancelled_at: new Date().toISOString()
      });

      io.to('operators').emit('EMERGENCY_CANCELLED', {
        emergency_id: emergencyId,
        customer_id: customerId,
        cancelled_at: new Date().toISOString()
      });
    }

    logger.info(`Emergency ${emergencyId} cancelled by customer ${customerId}`);

    res.json({ 
      message: 'Emergency cancelled successfully',
      emergency_id: emergencyId,
      cancelled_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cancel emergency error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  triggerEmergency,
  getEmergencyHistory,
  getEmergencyDetails,
  resolveEmergency,
  cancelEmergency
};