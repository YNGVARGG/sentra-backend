const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const logger = require('../config/logger');
const { redisClient } = require('../config/redis');

class SocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://sentra-dashboard.com', 'https://app.sentra.com']
          : ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6,
      allowEIO3: true
    });

    this.connectedClients = new Map();
    this.operatorSockets = new Map();
    this.deviceSockets = new Map();
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.type !== 'access') {
          return next(new Error('Invalid token type'));
        }

        const customerResult = await pool.query(
          'SELECT id, phone, name, subscription_status FROM customers WHERE id = $1',
          [decoded.customerId]
        );

        if (customerResult.rows.length === 0) {
          return next(new Error('Customer not found'));
        }

        const customer = customerResult.rows[0];
        
        if (customer.subscription_status !== 'active') {
          return next(new Error('Account is not active'));
        }

        socket.customerId = customer.id;
        socket.customerData = customer;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const customerId = socket.customerId;
    
    logger.info(`Customer ${customerId} connected via WebSocket`);

    this.connectedClients.set(customerId, socket);

    socket.join(`customer:${customerId}`);

    socket.emit('CONNECTION_ESTABLISHED', {
      customer_id: customerId,
      timestamp: new Date().toISOString(),
      message: 'Connected to Sentra Security System'
    });

    this.handleCustomerEvents(socket);
    this.handleDeviceEvents(socket);
    this.handleEmergencyEvents(socket);
    this.handleSystemEvents(socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Customer ${customerId} disconnected: ${reason}`);
      this.connectedClients.delete(customerId);
      socket.leave(`customer:${customerId}`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for customer ${customerId}:`, error);
    });
  }

  handleCustomerEvents(socket) {
    const customerId = socket.customerId;

    socket.on('CUSTOMER_STATUS_UPDATE', async (data) => {
      try {
        await redisClient.setEx(`customer:${customerId}:status`, 300, JSON.stringify({
          status: data.status || 'online',
          last_activity: new Date().toISOString()
        }));

        socket.emit('CUSTOMER_STATUS_UPDATED', {
          status: data.status || 'online',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Customer status update error:', error);
      }
    });

    socket.on('REQUEST_SYSTEM_STATUS', async () => {
      try {
        const systemStatus = await redisClient.get(`system:${customerId}:armed`);
        
        const devicesResult = await pool.query(
          'SELECT id, type, location, status, battery_level FROM devices WHERE customer_id = $1',
          [customerId]
        );

        socket.emit('SYSTEM_STATUS_RESPONSE', {
          system_status: systemStatus ? JSON.parse(systemStatus) : { status: 'disarmed' },
          devices: devicesResult.rows,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('System status request error:', error);
      }
    });
  }

  handleDeviceEvents(socket) {
    const customerId = socket.customerId;

    socket.on('DEVICE_SENSOR_TRIGGER', async (data) => {
      try {
        const { device_id, sensor_type, trigger_data } = data;

        const deviceResult = await pool.query(
          'SELECT * FROM devices WHERE id = $1 AND customer_id = $2',
          [device_id, customerId]
        );

        if (deviceResult.rows.length === 0) {
          socket.emit('ERROR', { message: 'Device not found' });
          return;
        }

        const device = deviceResult.rows[0];

        await pool.query(
          'UPDATE devices SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1',
          [device_id]
        );

        const systemStatus = await redisClient.get(`system:${customerId}:armed`);
        
        if (systemStatus) {
          const EmergencyService = require('./emergencyService');
          await EmergencyService.processEmergency({
            customerId,
            deviceId: device_id,
            severity: this.getSeverityBySensorType(sensor_type),
            type: this.getEmergencyTypeBySensorType(sensor_type),
            description: `${sensor_type} sensor triggered on ${device.type} at ${device.location}`,
            locationData: trigger_data
          });
        }

        this.io.to(`customer:${customerId}`).emit('SENSOR_TRIGGERED', {
          device_id: device_id,
          device_type: device.type,
          location: device.location,
          sensor_type: sensor_type,
          trigger_data: trigger_data,
          timestamp: new Date().toISOString()
        });

        logger.info(`Sensor triggered - Device: ${device_id}, Type: ${sensor_type}, Customer: ${customerId}`);
      } catch (error) {
        logger.error('Device sensor trigger error:', error);
        socket.emit('ERROR', { message: 'Failed to process sensor trigger' });
      }
    });

    socket.on('DEVICE_HEARTBEAT', async (data) => {
      try {
        const { device_id, status, battery_level } = data;

        await pool.query(
          'UPDATE devices SET status = $1, battery_level = $2, last_heartbeat = CURRENT_TIMESTAMP WHERE id = $3 AND customer_id = $4',
          [status || 'online', battery_level, device_id, customerId]
        );

        await redisClient.setEx(`device:${device_id}:heartbeat`, 300, JSON.stringify({
          timestamp: new Date().toISOString(),
          status: status || 'online',
          battery_level: battery_level
        }));

        socket.emit('HEARTBEAT_ACKNOWLEDGED', {
          device_id: device_id,
          timestamp: new Date().toISOString()
        });

        if (battery_level <= 20) {
          this.io.to(`customer:${customerId}`).emit('BATTERY_LOW', {
            device_id: device_id,
            battery_level: battery_level,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('Device heartbeat error:', error);
      }
    });
  }

  handleEmergencyEvents(socket) {
    const customerId = socket.customerId;

    socket.on('EMERGENCY_UPDATE', async (data) => {
      try {
        const { emergency_id, status, notes } = data;

        await pool.query(
          'INSERT INTO emergency_responses (emergency_id, action, notes) VALUES ($1, $2, $3)',
          [emergency_id, `customer_${status}`, notes || '']
        );

        this.io.to(`customer:${customerId}`).emit('EMERGENCY_UPDATED', {
          emergency_id: emergency_id,
          status: status,
          timestamp: new Date().toISOString()
        });

        this.io.to('operators').emit('EMERGENCY_CUSTOMER_UPDATE', {
          emergency_id: emergency_id,
          customer_id: customerId,
          status: status,
          notes: notes,
          timestamp: new Date().toISOString()
        });

        logger.info(`Emergency ${emergency_id} updated by customer ${customerId}: ${status}`);
      } catch (error) {
        logger.error('Emergency update error:', error);
      }
    });
  }

  handleSystemEvents(socket) {
    const customerId = socket.customerId;

    socket.on('SYSTEM_ARM_REQUEST', async (data) => {
      try {
        const { mode = 'full', delay = 30 } = data;

        socket.emit('SYSTEM_ARM_COUNTDOWN', {
          mode: mode,
          delay: delay,
          timestamp: new Date().toISOString()
        });

        setTimeout(async () => {
          await redisClient.setEx(`system:${customerId}:armed`, 3600, JSON.stringify({
            status: 'armed',
            mode: mode,
            timestamp: new Date().toISOString(),
            armed_by: customerId
          }));

          this.io.to(`customer:${customerId}`).emit('SYSTEM_ARMED', {
            mode: mode,
            timestamp: new Date().toISOString()
          });
        }, delay * 1000);
      } catch (error) {
        logger.error('System arm request error:', error);
      }
    });

    socket.on('SYSTEM_DISARM_REQUEST', async () => {
      try {
        await redisClient.del(`system:${customerId}:armed`);

        this.io.to(`customer:${customerId}`).emit('SYSTEM_DISARMED', {
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('System disarm request error:', error);
      }
    });
  }

  getSeverityBySensorType(sensorType) {
    const severityMap = {
      'panic': 'critical',
      'fire': 'critical',
      'smoke': 'critical',
      'intrusion': 'high',
      'door': 'medium',
      'window': 'medium',
      'motion': 'low',
      'glass_break': 'high'
    };
    return severityMap[sensorType] || 'medium';
  }

  getEmergencyTypeBySensorType(sensorType) {
    const typeMap = {
      'panic': 'panic',
      'fire': 'fire',
      'smoke': 'fire',
      'intrusion': 'intrusion',
      'door': 'intrusion',
      'window': 'intrusion',
      'motion': 'intrusion',
      'glass_break': 'intrusion'
    };
    return typeMap[sensorType] || 'other';
  }

  broadcastToCustomer(customerId, event, data) {
    this.io.to(`customer:${customerId}`).emit(event, data);
  }

  broadcastToOperators(event, data) {
    this.io.to('operators').emit(event, data);
  }

  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  getConnectedCustomers() {
    return Array.from(this.connectedClients.keys());
  }

  getConnectionCount() {
    return this.connectedClients.size;
  }
}

module.exports = SocketService;