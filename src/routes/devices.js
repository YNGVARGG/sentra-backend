const express = require('express');
const { 
  getDeviceStatus, 
  updateDeviceHeartbeat, 
  updateDeviceBattery, 
  addDevice, 
  removeDevice, 
  updateDeviceLocation 
} = require('../controllers/deviceController');
const { authenticateToken } = require('../middleware/auth');
const { 
  deviceValidation, 
  handleValidationErrors 
} = require('../middleware/security');

const router = express.Router();

router.use(authenticateToken);

router.get('/status', getDeviceStatus);

router.get('/:device_id/status', getDeviceStatus);

router.post('/:device_id/heartbeat', updateDeviceHeartbeat);

router.put('/:device_id/battery', updateDeviceBattery);

router.put('/:device_id/location', updateDeviceLocation);

router.post('/', 
  deviceValidation,
  handleValidationErrors,
  addDevice
);

router.delete('/:device_id', removeDevice);

module.exports = router;