const express = require('express');
const { login, logout } = require('../controllers/staffAuthController');
const { refreshTokens, authenticateToken } = require('../middleware/auth');
const { 
  authLimiter, 
  loginValidation, 
  handleValidationErrors 
} = require('../middleware/security');

const router = express.Router();

// Staff authentication routes
router.post('/auth/login', 
  authLimiter,
  handleValidationErrors,
  login
);

router.post('/auth/logout',
  authenticateToken,
  logout
);

router.post('/auth/refresh',
  authLimiter,
  refreshTokens
);

module.exports = router;