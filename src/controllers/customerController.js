const pool = require('../config/database');
const logger = require('../config/logger');
const { redisClient } = require('../config/redis');

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, phone, name, address, emergency_contacts, medical_alerts, subscription_status, created_at FROM customers WHERE id = $1',
      [req.customer.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];
    res.json({
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      address: customer.address,
      emergency_contacts: customer.emergency_contacts,
      medical_alerts: customer.medical_alerts,
      subscription_status: customer.subscription_status,
      created_at: customer.created_at
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, address, emergency_contacts, medical_alerts } = req.body;
    const customerId = req.customer.id;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (address !== undefined) {
      updateFields.push(`address = $${paramCount}`);
      values.push(address);
      paramCount++;
    }

    if (emergency_contacts !== undefined) {
      updateFields.push(`emergency_contacts = $${paramCount}`);
      values.push(JSON.stringify(emergency_contacts));
      paramCount++;
    }

    if (medical_alerts !== undefined) {
      updateFields.push(`medical_alerts = $${paramCount}`);
      values.push(JSON.stringify(medical_alerts));
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    values.push(customerId);

    const query = `
      UPDATE customers 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, phone, name, address, emergency_contacts, medical_alerts, subscription_status
    `;

    const result = await pool.query(query, values);
    const customer = result.rows[0];

    logger.info(`Customer profile updated: ${customerId}`);

    res.json({
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      address: customer.address,
      emergency_contacts: customer.emergency_contacts,
      medical_alerts: customer.medical_alerts,
      subscription_status: customer.subscription_status
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getDevices = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, type, location, status, battery_level, last_heartbeat, created_at FROM devices WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.customer.id]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Get devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const armSystem = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { mode = 'full' } = req.body; // full, partial, away

    await redisClient.setEx(`system:${customerId}:armed`, 3600, JSON.stringify({
      status: 'armed',
      mode: mode,
      timestamp: new Date().toISOString(),
      armed_by: customerId
    }));

    await pool.query(
      'UPDATE devices SET status = $1 WHERE customer_id = $2 AND status = $3',
      ['armed', customerId, 'online']
    );

    logger.info(`System armed by customer: ${customerId}, mode: ${mode}`);

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('SYSTEM_ARMED', {
        mode: mode,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ 
      message: 'System armed successfully',
      mode: mode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Arm system error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const disarmSystem = async (req, res) => {
  try {
    const customerId = req.customer.id;

    await redisClient.del(`system:${customerId}:armed`);

    await pool.query(
      'UPDATE devices SET status = $1 WHERE customer_id = $2 AND status = $3',
      ['online', customerId, 'armed']
    );

    logger.info(`System disarmed by customer: ${customerId}`);

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('SYSTEM_DISARMED', {
        timestamp: new Date().toISOString()
      });
    }

    res.json({ 
      message: 'System disarmed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Disarm system error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSystemStatus = async (req, res) => {
  try {
    const customerId = req.customer.id;

    const systemStatus = await redisClient.get(`system:${customerId}:armed`);
    
    const devicesResult = await pool.query(
      'SELECT COUNT(*) as total, status FROM devices WHERE customer_id = $1 GROUP BY status',
      [customerId]
    );

    const deviceStats = devicesResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.total);
      return acc;
    }, {});

    res.json({
      system_status: systemStatus ? JSON.parse(systemStatus) : { status: 'disarmed' },
      device_stats: deviceStats,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get system status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getDevices,
  armSystem,
  disarmSystem,
  getSystemStatus
};