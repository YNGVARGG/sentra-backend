const express = require('express');
const { 
  triggerEmergency, 
  getEmergencyHistory, 
  getEmergencyDetails, 
  resolveEmergency, 
  cancelEmergency 
} = require('../controllers/emergencyController');
const { authenticateToken } = require('../middleware/auth');
const { 
  emergencyLimiter, 
  emergencyValidation, 
  handleValidationErrors 
} = require('../middleware/security');

const router = express.Router();

router.use(authenticateToken);

router.post('/trigger', 
  emergencyLimiter,
  emergencyValidation,
  handleValidationErrors,
  triggerEmergency
);

router.get('/history', getEmergencyHistory);

router.get('/:emergencyId', getEmergencyDetails);

router.post('/:emergencyId/resolve', resolveEmergency);

router.post('/:emergencyId/cancel', cancelEmergency);

module.exports = router;