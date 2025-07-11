const express = require('express');
const { login, logout, register } = require('../controllers/authController');
const { refreshTokens, authenticateToken } = require('../middleware/auth');
const { 
  authLimiter, 
  loginValidation, 
  handleValidationErrors 
} = require('../middleware/security');

const router = express.Router();

router.post('/login', 
  authLimiter,
  loginValidation,
  handleValidationErrors,
  login
);

router.post('/register',
  authLimiter,
  loginValidation,
  handleValidationErrors,
  register
);

router.post('/refresh',
  authLimiter,
  refreshTokens
);

router.post('/logout',
  authenticateToken,
  logout
);

module.exports = router;