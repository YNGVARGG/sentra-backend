const express = require('express');
const http = require('http');
const cors = require('cors');
const { validateEnv, config } = require('./config/env');
const { connectRedis } = require('./config/redis');
const logger = require('./config/logger');
const SocketService = require('./services/socketService');

const {
  corsOptions,
  generalLimiter,
  helmet,
  logRequest,
  errorHandler
} = require('./middleware/security');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const emergencyRoutes = require('./routes/emergencies');
const deviceRoutes = require('./routes/devices');
const staffRoutes = require('./routes/staff');
const adminRoutes = require('./routes/admin');

validateEnv();

const app = express();
const server = http.createServer(app);

app.use(helmet);
app.use(cors(corsOptions));
app.use(express.json({ limit: config.maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: config.maxRequestSize }));

if (config.enableRequestLogging) {
  app.use(logRequest);
}

app.use(generalLimiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.buildVersion,
    environment: config.nodeEnv,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/metrics', (req, res) => {
  if (!config.enableMetrics) {
    return res.status(404).json({ error: 'Metrics not enabled' });
  }

  const socketService = req.app.get('socketService');
  
  res.json({
    timestamp: new Date().toISOString(),
    websocket_connections: socketService ? socketService.getConnectionCount() : 0,
    connected_customers: socketService ? socketService.getConnectedCustomers().length : 0,
    memory_usage: process.memoryUsage(),
    cpu_usage: process.cpuUsage(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: config.buildVersion
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/status', (req, res) => {
  res.json({
    service: 'Sentra Security Backend',
    version: config.buildVersion,
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    status: 'operational'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    logger.info('Starting Sentra Security Backend...');
    
    await connectRedis();
    logger.info('Redis connected successfully');

    const socketService = new SocketService(server);
    app.set('socketService', socketService);
    app.set('io', socketService.io);
    
    logger.info('WebSocket server initialized');

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`WebSocket support: enabled`);
      logger.info(`Database: ${config.databaseUrl.split('@')[1]}`);
      logger.info(`Redis: ${config.redisUrl}`);
      
      if (config.nodeEnv === 'development') {
        logger.info(`Health check: http://localhost:${config.port}/health`);
        logger.info(`API status: http://localhost:${config.port}/api/status`);
        logger.info(`Metrics: http://localhost:${config.port}/metrics`);
      }
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  startServer();
}

module.exports = app;