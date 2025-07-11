const express = require('express');
const { 
  getProfile, 
  updateProfile, 
  getDevices, 
  armSystem, 
  disarmSystem, 
  getSystemStatus 
} = require('../controllers/customerController');
const { authenticateToken } = require('../middleware/auth');
const { 
  customerUpdateValidation, 
  handleValidationErrors 
} = require('../middleware/security');

const router = express.Router();

router.use(authenticateToken);

router.get('/profile', getProfile);

router.put('/profile', 
  customerUpdateValidation,
  handleValidationErrors,
  updateProfile
);

router.get('/devices', getDevices);

router.post('/arm', armSystem);

router.post('/disarm', disarmSystem);

router.get('/system-status', getSystemStatus);

module.exports = router;