# Sentra Security System Backend

A comprehensive Node.js/Express backend server for the Sentra Security System with real-time WebSocket communication, emergency processing, and JWT authentication.

## Features

- 🔐 **JWT Authentication** with refresh tokens
- 🚨 **Emergency Management System** with auto-dispatch
- 📱 **Real-time WebSocket Communication** with Socket.IO
- 🔧 **Device Management** with heartbeat monitoring
- 📊 **PostgreSQL Database** with connection pooling
- 🚀 **Redis Session Management** and caching
- 🛡️ **Security Middleware** with rate limiting and CORS
- 📝 **Winston Logging** with structured logs
- 🐳 **Docker Support** with docker-compose
- 🔍 **Health Monitoring** and metrics endpoint

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sentra-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start the server
npm run dev
```

### Docker Setup

```bash
# Start all services with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f sentra-backend

# Stop services
docker-compose down
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Customer login
- `POST /api/auth/register` - Customer registration
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout and invalidate tokens

### Customer Management
- `GET /api/customers/profile` - Get customer profile
- `PUT /api/customers/profile` - Update customer profile
- `GET /api/customers/devices` - List customer devices
- `POST /api/customers/arm` - Arm security system
- `POST /api/customers/disarm` - Disarm security system
- `GET /api/customers/system-status` - Get system status

### Emergency Management
- `POST /api/emergencies/trigger` - Trigger emergency alert
- `GET /api/emergencies/history` - Get emergency history
- `GET /api/emergencies/:id` - Get emergency details
- `POST /api/emergencies/:id/resolve` - Resolve emergency
- `POST /api/emergencies/:id/cancel` - Cancel emergency

### Device Management
- `GET /api/devices/status` - Get all device status
- `GET /api/devices/:id/status` - Get specific device status
- `POST /api/devices/:id/heartbeat` - Update device heartbeat
- `PUT /api/devices/:id/battery` - Update device battery level
- `PUT /api/devices/:id/location` - Update device location
- `POST /api/devices` - Add new device
- `DELETE /api/devices/:id` - Remove device

### System
- `GET /health` - Health check endpoint
- `GET /metrics` - System metrics
- `GET /api/status` - API status

## WebSocket Events

### Client Events
- `CONNECTION_ESTABLISHED` - Connection confirmation
- `SYSTEM_ARMED` - System armed notification
- `SYSTEM_DISARMED` - System disarmed notification
- `EMERGENCY_TRIGGERED` - Emergency alert triggered
- `EMERGENCY_RESOLVED` - Emergency resolved
- `SENSOR_TRIGGERED` - Sensor activation
- `HEARTBEAT_RECEIVED` - Device heartbeat
- `BATTERY_LOW` - Low battery warning
- `DEVICE_CONNECTED` - Device connected
- `DEVICE_DISCONNECTED` - Device disconnected
- `DEVICE_STATUS_CHANGED` - Device status update

### Server Events
- `CUSTOMER_STATUS_UPDATE` - Update customer status
- `DEVICE_SENSOR_TRIGGER` - Trigger sensor event
- `DEVICE_HEARTBEAT` - Send device heartbeat
- `EMERGENCY_UPDATE` - Update emergency status
- `SYSTEM_ARM_REQUEST` - Request system arm
- `SYSTEM_DISARM_REQUEST` - Request system disarm

## Environment Variables

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/sentra
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
SMS_PROVIDER_URL=https://api.sms.example.com
MPESA_API_URL=https://api.mpesa.example.com
```

## Database Schema

The system uses PostgreSQL with the following main tables:
- `customers` - Customer information and authentication
- `devices` - Security devices and sensors
- `emergencies` - Emergency alerts and incidents
- `emergency_responses` - Emergency response actions
- `operators` - System operators and staff
- `refresh_tokens` - JWT refresh token management

## Security Features

- **JWT Authentication** with access and refresh tokens
- **Rate Limiting** for API endpoints
- **CORS Protection** with configurable origins
- **Helmet.js** for security headers
- **Request Validation** with express-validator
- **Password Hashing** with bcrypt
- **Token Blacklisting** via Redis
- **SQL Injection Protection** with parameterized queries

## Performance Features

- **Connection Pooling** for PostgreSQL
- **Redis Caching** for session management
- **WebSocket Optimization** for real-time communication
- **Request Logging** with Winston
- **Health Monitoring** with metrics endpoint
- **Graceful Shutdown** handling

## Emergency Processing

The system includes a sophisticated emergency processing engine:

1. **Auto-Detection** - Sensors trigger emergency alerts
2. **Severity Classification** - Emergencies are categorized by severity
3. **Operator Assignment** - Available operators are auto-assigned
4. **Response Tracking** - All emergency responses are logged
5. **Auto-Dispatch** - Critical emergencies trigger automatic dispatch
6. **Real-time Updates** - WebSocket notifications for all parties

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with sample data

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testNamePattern="auth"
```

### Database Management
```bash
# Run migrations
npm run migrate

# Seed database with sample data
npm run seed

# Reset database (development only)
npm run db:reset
```

## Deployment

### Docker Deployment
```bash
# Build and start services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Scale backend instances
docker-compose up -d --scale sentra-backend=3
```

### Production Considerations
- Use strong JWT secrets
- Configure proper CORS origins
- Set up SSL/TLS certificates
- Configure log rotation
- Set up monitoring and alerting
- Use environment-specific configurations

## Monitoring

The system includes comprehensive monitoring:

- **Health Checks** - `/health` endpoint
- **Metrics** - `/metrics` endpoint with system stats
- **Structured Logging** - Winston with multiple log levels
- **Error Tracking** - Centralized error handling
- **Performance Metrics** - Response times and throughput

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.