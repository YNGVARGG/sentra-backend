const pool = require('../config/database');
const logger = require('../config/logger');
const { redisClient } = require('../config/redis');

class EmergencyService {
  static async processEmergency(emergencyData) {
    try {
      const { customerId, deviceId, severity, type, description, locationData } = emergencyData;

      logger.warn(`Emergency triggered - Customer: ${customerId}, Device: ${deviceId}, Type: ${type}, Severity: ${severity}`);

      const emergency = await pool.query(
        'INSERT INTO emergencies (customer_id, device_id, severity, type, description, location_data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [customerId, deviceId, severity, type, description, locationData ? JSON.stringify(locationData) : null]
      );

      const emergencyId = emergency.rows[0].id;

      await redisClient.setEx(`emergency:${emergencyId}:processing`, 3600, JSON.stringify({
        status: 'processing',
        started_at: new Date().toISOString(),
        priority: this.getPriority(severity)
      }));

      await this.notifyOperators(emergency.rows[0]);

      await this.getCustomerInfo(customerId);

      if (severity === 'critical' || severity === 'high') {
        await this.autoDispatch(emergency.rows[0]);
      }

      return emergency.rows[0];
    } catch (error) {
      logger.error('Emergency processing error:', error);
      throw error;
    }
  }

  static async notifyOperators(emergency) {
    try {
      const availableOperators = await pool.query(
        'SELECT id, name, center_location FROM operators WHERE id NOT IN (SELECT operator_id FROM emergency_responses WHERE emergency_id IN (SELECT id FROM emergencies WHERE status = $1)) ORDER BY RANDOM() LIMIT 5',
        ['in_progress']
      );

      if (availableOperators.rows.length === 0) {
        logger.warn('No available operators for emergency:', emergency.id);
        return;
      }

      const operator = availableOperators.rows[0];
      
      await pool.query(
        'INSERT INTO emergency_responses (emergency_id, operator_id, action, notes) VALUES ($1, $2, $3, $4)',
        [emergency.id, operator.id, 'assigned', 'Operator auto-assigned to emergency']
      );

      await pool.query(
        'UPDATE emergencies SET status = $1 WHERE id = $2',
        ['in_progress', emergency.id]
      );

      logger.info(`Emergency ${emergency.id} assigned to operator ${operator.id}`);
    } catch (error) {
      logger.error('Operator notification error:', error);
    }
  }

  static async getCustomerInfo(customerId) {
    try {
      const customer = await pool.query(
        'SELECT name, phone, address, emergency_contacts, medical_alerts FROM customers WHERE id = $1',
        [customerId]
      );

      if (customer.rows.length > 0) {
        const customerData = customer.rows[0];
        
        await redisClient.setEx(`customer:${customerId}:emergency_info`, 3600, JSON.stringify({
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address,
          emergency_contacts: customerData.emergency_contacts,
          medical_alerts: customerData.medical_alerts
        }));
      }
    } catch (error) {
      logger.error('Customer info retrieval error:', error);
    }
  }

  static async autoDispatch(emergency) {
    try {
      const dispatchActions = [];

      switch (emergency.type) {
        case 'fire':
          dispatchActions.push('contact_fire_department');
          break;
        case 'medical':
          dispatchActions.push('contact_ambulance');
          break;
        case 'intrusion':
          dispatchActions.push('contact_security');
          break;
        case 'panic':
          dispatchActions.push('contact_customer', 'contact_emergency_contacts');
          break;
        default:
          dispatchActions.push('contact_customer');
      }

      for (const action of dispatchActions) {
        await pool.query(
          'INSERT INTO emergency_responses (emergency_id, action, response_time, notes) VALUES ($1, $2, $3, $4)',
          [emergency.id, action, this.calculateResponseTime(emergency.created_at), 'Auto-dispatched by system']
        );
      }

      logger.info(`Auto-dispatch completed for emergency ${emergency.id}`);
    } catch (error) {
      logger.error('Auto-dispatch error:', error);
    }
  }

  static getPriority(severity) {
    const priorities = {
      'critical': 1,
      'high': 2,
      'medium': 3,
      'low': 4
    };
    return priorities[severity] || 4;
  }

  static calculateResponseTime(createdAt) {
    return Math.floor((new Date() - new Date(createdAt)) / 1000);
  }

  static async resolveEmergency(emergencyId, operatorId, notes) {
    try {
      await pool.query(
        'UPDATE emergencies SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['resolved', emergencyId]
      );

      await pool.query(
        'INSERT INTO emergency_responses (emergency_id, operator_id, action, notes) VALUES ($1, $2, $3, $4)',
        [emergencyId, operatorId, 'resolved', notes || 'Emergency resolved']
      );

      await redisClient.del(`emergency:${emergencyId}:processing`);

      logger.info(`Emergency ${emergencyId} resolved by operator ${operatorId}`);
    } catch (error) {
      logger.error('Emergency resolution error:', error);
      throw error;
    }
  }

  static async getEmergencyStatus(emergencyId) {
    try {
      const emergency = await pool.query(
        'SELECT * FROM emergencies WHERE id = $1',
        [emergencyId]
      );

      if (emergency.rows.length === 0) {
        return null;
      }

      const responses = await pool.query(
        'SELECT er.*, o.name as operator_name FROM emergency_responses er LEFT JOIN operators o ON er.operator_id = o.id WHERE er.emergency_id = $1 ORDER BY er.created_at',
        [emergencyId]
      );

      const processingData = await redisClient.get(`emergency:${emergencyId}:processing`);

      return {
        emergency: emergency.rows[0],
        responses: responses.rows,
        processing_info: processingData ? JSON.parse(processingData) : null
      };
    } catch (error) {
      logger.error('Get emergency status error:', error);
      throw error;
    }
  }
}

module.exports = EmergencyService;