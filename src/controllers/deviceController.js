const pool = require('../config/database');
const logger = require('../config/logger');
const { redisClient } = require('../config/redis');

const getDeviceStatus = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { device_id } = req.params;

    let query = 'SELECT * FROM devices WHERE customer_id = $1';
    let params = [customerId];

    if (device_id) {
      query += ' AND id = $2';
      params.push(device_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    if (device_id && result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const devices = result.rows.map(device => ({
      id: device.id,
      type: device.type,
      location: device.location,
      status: device.status,
      battery_level: device.battery_level,
      last_heartbeat: device.last_heartbeat,
      created_at: device.created_at
    }));

    res.json(device_id ? devices[0] : devices);
  } catch (error) {
    logger.error('Get device status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateDeviceHeartbeat = async (req, res) => {
  try {
    const { device_id } = req.params;
    const { status = 'online', battery_level } = req.body;
    const customerId = req.customer.id;

    const deviceCheck = await pool.query(
      'SELECT id FROM devices WHERE id = $1 AND customer_id = $2',
      [device_id, customerId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const updateFields = ['last_heartbeat = CURRENT_TIMESTAMP'];
    const values = [];
    let paramCount = 1;

    if (status) {
      updateFields.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (battery_level !== undefined) {
      updateFields.push(`battery_level = $${paramCount}`);
      values.push(battery_level);
      paramCount++;
    }

    values.push(device_id);

    const query = `
      UPDATE devices 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    const device = result.rows[0];

    await redisClient.setEx(`device:${device_id}:heartbeat`, 300, JSON.stringify({
      timestamp: new Date().toISOString(),
      status: device.status,
      battery_level: device.battery_level
    }));

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('HEARTBEAT_RECEIVED', {
        device_id: device.id,
        status: device.status,
        battery_level: device.battery_level,
        timestamp: new Date().toISOString()
      });

      if (device.battery_level <= 20) {
        io.to(`customer:${customerId}`).emit('BATTERY_LOW', {
          device_id: device.id,
          battery_level: device.battery_level,
          device_type: device.type,
          location: device.location
        });
      }
    }

    res.json({
      message: 'Device heartbeat updated successfully',
      device: {
        id: device.id,
        status: device.status,
        battery_level: device.battery_level,
        last_heartbeat: device.last_heartbeat
      }
    });
  } catch (error) {
    logger.error('Update device heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateDeviceBattery = async (req, res) => {
  try {
    const { device_id } = req.params;
    const { battery_level } = req.body;
    const customerId = req.customer.id;

    if (battery_level < 0 || battery_level > 100) {
      return res.status(400).json({ error: 'Battery level must be between 0 and 100' });
    }

    const result = await pool.query(
      'UPDATE devices SET battery_level = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND customer_id = $3 RETURNING *',
      [battery_level, device_id, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = result.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('DEVICE_STATUS_CHANGED', {
        device_id: device.id,
        battery_level: device.battery_level,
        device_type: device.type,
        location: device.location
      });

      if (battery_level <= 20) {
        io.to(`customer:${customerId}`).emit('BATTERY_LOW', {
          device_id: device.id,
          battery_level: device.battery_level,
          device_type: device.type,
          location: device.location
        });
      }
    }

    logger.info(`Device ${device_id} battery updated to ${battery_level}%`);

    res.json({
      message: 'Device battery level updated successfully',
      device: {
        id: device.id,
        battery_level: device.battery_level,
        type: device.type,
        location: device.location
      }
    });
  } catch (error) {
    logger.error('Update device battery error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const addDevice = async (req, res) => {
  try {
    const { type, location, battery_level = 100 } = req.body;
    const customerId = req.customer.id;

    const result = await pool.query(
      'INSERT INTO devices (customer_id, type, location, battery_level) VALUES ($1, $2, $3, $4) RETURNING *',
      [customerId, type, location, battery_level]
    );

    const device = result.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('DEVICE_CONNECTED', {
        device_id: device.id,
        type: device.type,
        location: device.location,
        status: device.status,
        battery_level: device.battery_level
      });
    }

    logger.info(`New device added: ${device.id} for customer: ${customerId}`);

    res.status(201).json({
      message: 'Device added successfully',
      device: {
        id: device.id,
        type: device.type,
        location: device.location,
        status: device.status,
        battery_level: device.battery_level,
        created_at: device.created_at
      }
    });
  } catch (error) {
    logger.error('Add device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeDevice = async (req, res) => {
  try {
    const { device_id } = req.params;
    const customerId = req.customer.id;

    const result = await pool.query(
      'DELETE FROM devices WHERE id = $1 AND customer_id = $2 RETURNING *',
      [device_id, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = result.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('DEVICE_DISCONNECTED', {
        device_id: device.id,
        type: device.type,
        location: device.location
      });
    }

    logger.info(`Device removed: ${device.id} for customer: ${customerId}`);

    res.json({
      message: 'Device removed successfully',
      device_id: device.id
    });
  } catch (error) {
    logger.error('Remove device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateDeviceLocation = async (req, res) => {
  try {
    const { device_id } = req.params;
    const { location } = req.body;
    const customerId = req.customer.id;

    const result = await pool.query(
      'UPDATE devices SET location = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND customer_id = $3 RETURNING *',
      [location, device_id, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = result.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${customerId}`).emit('DEVICE_STATUS_CHANGED', {
        device_id: device.id,
        location: device.location,
        device_type: device.type
      });
    }

    logger.info(`Device ${device_id} location updated to: ${location}`);

    res.json({
      message: 'Device location updated successfully',
      device: {
        id: device.id,
        location: device.location,
        type: device.type
      }
    });
  } catch (error) {
    logger.error('Update device location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getDeviceStatus,
  updateDeviceHeartbeat,
  updateDeviceBattery,
  addDevice,
  removeDevice,
  updateDeviceLocation
};