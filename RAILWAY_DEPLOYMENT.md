# Railway Deployment Guide for Sentra Security System

## 🚀 Step-by-Step Deployment

### 1. **Create Railway Account**
- Go to [railway.app](https://railway.app)
- Sign up with GitHub account (recommended)
- Connect your GitHub repository

### 2. **Deploy via Railway Dashboard**

#### Option A: One-Click Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/postgres-redis-node)

#### Option B: Manual Deploy
1. Go to [railway.app/new](https://railway.app/new)
2. Select "Deploy from GitHub repo"
3. Choose your `sentra-backend` repository
4. Railway will automatically detect it as a Node.js project

### 🔧 **Docker Build Fix**
If you encounter Docker build issues with `package-lock.json`, the project includes:
- Updated `Dockerfile` with fallback to `npm install`
- Railway-specific `Dockerfile.railway` for optimized builds
- Generated `package-lock.json` file

### 3. **Add Database Services**

In your Railway project dashboard:

**Add PostgreSQL:**
1. Click "New Service" → "Database" → "PostgreSQL"
2. Wait for deployment (2-3 minutes)
3. Note the connection details

**Add Redis:**
1. Click "New Service" → "Database" → "Redis"
2. Wait for deployment (1-2 minutes)
3. Note the connection details

### 4. **Configure Environment Variables**

In your Railway project, go to "Variables" tab and add:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_REFRESH_SECRET=your-super-secret-refresh-key-minimum-32-characters
SMS_PROVIDER_URL=https://api.sms.example.com
MPESA_API_URL=https://api.mpesa.example.com
ENABLE_METRICS=true
ENABLE_REQUEST_LOGGING=true
```

**Important:** Railway will automatically provide `DATABASE_URL` and `REDIS_URL` when you add the database services.

### 5. **Generate Strong Secrets**

Run these commands locally to generate secure secrets:

```bash
# Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Refresh Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the outputs to your Railway environment variables.

### 6. **Deploy and Monitor**

1. Railway will automatically deploy after you push to GitHub
2. Monitor the deployment logs in Railway dashboard
3. Check the "Deployments" tab for status

### 7. **Run Database Migrations**

After successful deployment:

1. Go to your Railway project
2. Click on your backend service
3. Go to "Settings" → "Service Settings"
4. Under "Deploy", add this command:
   ```
   npm run migrate && npm start
   ```

Or run migrations manually in the Railway shell:
1. Go to your service → "Settings" → "Service Settings"
2. Open the "Shell" tab
3. Run: `npm run migrate`

### 8. **Test Your Deployment**

Your API will be available at: `https://your-project-name.railway.app`

Test endpoints:
- Health check: `GET https://your-project-name.railway.app/health`
- API status: `GET https://your-project-name.railway.app/api/status`
- Metrics: `GET https://your-project-name.railway.app/metrics`

### 9. **WebSocket Testing**

Test WebSocket connection using your frontend or a tool like [WebSocket King](https://websocketking.com/):
- URL: `wss://your-project-name.railway.app/socket.io`
- Include JWT token in auth header

## 🔧 **Railway Configuration Files**

The following files are included for Railway:

### `railway.toml`
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
NODE_ENV = "production"
PORT = "3001"
```

### `package.json` (optimized for Railway)
- Added `engines` field for Node.js version
- Added `build` and `postinstall` scripts
- All dependencies properly configured

## 📊 **Monitoring Your Deployment**

### Railway Dashboard
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time application logs
- **Deployments**: History and rollback options

### Application Endpoints
- **Health**: `/health` - Server health status
- **Metrics**: `/metrics` - Application metrics
- **Status**: `/api/status` - API operational status

## 🛠️ **Troubleshooting**

### Common Issues:

**1. Database Connection Errors**
```
Error: Connection refused
```
**Solution:** Ensure PostgreSQL and Redis services are running in Railway dashboard.

**2. JWT Secret Errors**
```
Error: JWT secret not configured
```
**Solution:** Add proper JWT_SECRET and JWT_REFRESH_SECRET to environment variables.

**3. Migration Failures**
```
Error: Cannot connect to database
```
**Solution:** Run migrations after database is fully deployed.

**4. WebSocket Connection Issues**
```
Error: WebSocket connection failed
```
**Solution:** Check that Railway supports WebSocket connections (it does by default).

### Debug Commands:
```bash
# Check logs
railway logs

# Check environment variables
railway variables

# Connect to shell
railway shell
```

## 🚀 **Production Checklist**

- [ ] Strong JWT secrets generated and set
- [ ] Database migrations run successfully
- [ ] Environment variables configured
- [ ] Health check endpoint responding
- [ ] WebSocket connections working
- [ ] Rate limiting active
- [ ] Logging configured
- [ ] SSL/TLS enabled (automatic with Railway)

## 🔄 **Continuous Deployment**

Railway automatically:
- Deploys on every push to main branch
- Runs health checks
- Provides rollback capabilities
- Scales based on traffic

## 💰 **Cost Estimation**

Railway pricing (as of 2024):
- **Starter Plan**: $5/month per service
- **PostgreSQL**: ~$5/month
- **Redis**: ~$5/month
- **Backend Service**: ~$5/month
- **Total**: ~$15-20/month

## 🔗 **Next Steps**

1. **Custom Domain**: Add your domain in Railway dashboard
2. **Monitoring**: Set up alerts for downtime
3. **Backup**: Configure database backups
4. **Scaling**: Monitor usage and scale as needed

## 📞 **Support**

- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Railway Status: [status.railway.app](https://status.railway.app)

---

Your Sentra Security System is now ready for Railway deployment! 🚀