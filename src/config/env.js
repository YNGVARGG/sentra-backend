require('dotenv').config();

const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

const validateEnv = () => {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const productionVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const weakSecrets = productionVars.filter(varName => {
      const value = process.env[varName];
      return !value || value.length < 32 || value.includes('change-in-production');
    });

    if (weakSecrets.length > 0) {
      console.error('Weak or default secrets detected in production:', weakSecrets.join(', '));
      process.exit(1);
    }
  }

  console.log('Environment validation passed');
};

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  smsProviderUrl: process.env.SMS_PROVIDER_URL,
  mpesaApiUrl: process.env.MPESA_API_URL,
  
  // Feature flags
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  enableTracing: process.env.ENABLE_TRACING === 'true',
  enableSms: process.env.ENABLE_SMS === 'true',
  enableMpesa: process.env.ENABLE_MPESA === 'true',
  
  // Security settings
  maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 3600,
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
  
  // Performance settings
  dbPoolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 20,
  redisMaxRetries: parseInt(process.env.REDIS_MAX_RETRIES, 10) || 3,
  socketTimeout: parseInt(process.env.SOCKET_TIMEOUT, 10) || 60000,
  
  // Emergency settings
  emergencyResponseTime: parseInt(process.env.EMERGENCY_RESPONSE_TIME, 10) || 60,
  autoDispatchEnabled: process.env.AUTO_DISPATCH_ENABLED === 'true',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS, 10) || 30,
  
  // CORS
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  
  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 5,
  emergencyRateLimitMax: parseInt(process.env.EMERGENCY_RATE_LIMIT_MAX, 10) || 10,
  
  // Health check
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000,
  
  // WebSocket
  wsMaxConnections: parseInt(process.env.WS_MAX_CONNECTIONS, 10) || 10000,
  wsPingInterval: parseInt(process.env.WS_PING_INTERVAL, 10) || 25000,
  wsPingTimeout: parseInt(process.env.WS_PING_TIMEOUT, 10) || 60000,
  
  // Encryption
  encryptionAlgorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
  encryptionKey: process.env.ENCRYPTION_KEY || 'default-key-change-in-production',
  
  // External services
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
  
  // Monitoring
  sentryDsn: process.env.SENTRY_DSN,
  enableSentry: process.env.ENABLE_SENTRY === 'true',
  
  // Testing
  testDatabase: process.env.TEST_DATABASE_URL,
  testRedis: process.env.TEST_REDIS_URL,
  
  // Development
  enableDebugLogs: process.env.ENABLE_DEBUG_LOGS === 'true',
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
  
  // Deployment
  deploymentId: process.env.DEPLOYMENT_ID || 'local',
  buildVersion: process.env.BUILD_VERSION || '1.0.0'
};

module.exports = {
  validateEnv,
  config
};