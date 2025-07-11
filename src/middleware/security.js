const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const logger = require('../config/logger');

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://sentra-dashboard.com', 'https://app.sentra.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many requests, please try again later' });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many authentication attempts, please try again later' });
  }
});

const emergencyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 emergency requests per 5 minutes
  message: 'Too many emergency requests, please contact support',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Emergency rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many emergency requests, please contact support' });
  }
});

const loginValidation = [
  body('phone')
    .matches(/^\+254[0-9]{9}$/)
    .withMessage('Phone number must be in format +254XXXXXXXXX'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
];

const customerUpdateValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('address')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('emergency_contacts')
    .optional()
    .isArray()
    .withMessage('Emergency contacts must be an array'),
  body('emergency_contacts.*.name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Emergency contact name must be between 2 and 100 characters'),
  body('emergency_contacts.*.phone')
    .optional()
    .matches(/^\+254[0-9]{9}$/)
    .withMessage('Emergency contact phone must be in format +254XXXXXXXXX')
];

const emergencyValidation = [
  body('severity')
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Severity must be one of: low, medium, high, critical'),
  body('type')
    .isIn(['panic', 'intrusion', 'fire', 'medical', 'other'])
    .withMessage('Type must be one of: panic, intrusion, fire, medical, other'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('location_data')
    .optional()
    .isObject()
    .withMessage('Location data must be an object')
];

const deviceValidation = [
  body('type')
    .isIn(['panic_button', 'door_sensor', 'window_sensor', 'motion_detector', 'smoke_detector', 'camera'])
    .withMessage('Invalid device type'),
  body('location')
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters'),
  body('battery_level')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Battery level must be between 0 and 100')
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', errors.array());
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

const logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
  });
  
  next();
};

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
};

module.exports = {
  corsOptions,
  generalLimiter,
  authLimiter,
  emergencyLimiter,
  loginValidation,
  customerUpdateValidation,
  emergencyValidation,
  deviceValidation,
  handleValidationErrors,
  logRequest,
  errorHandler,
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false
  })
};