const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis');
const pool = require('../config/database');
const logger = require('../config/logger');

const generateTokens = (customerId) => {
  const accessToken = jwt.sign(
    { customerId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { customerId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const verifyToken = (token, secret) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const blacklisted = await redisClient.get(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = await verifyToken(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const customerResult = await pool.query(
      'SELECT id, phone, name, subscription_status FROM customers WHERE id = $1',
      [decoded.customerId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(401).json({ error: 'Customer not found' });
    }

    const customer = customerResult.rows[0];
    
    if (customer.subscription_status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    logger.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const refreshTokens = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = await verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const tokenResult = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND customer_id = $2 AND expires_at > NOW()',
      [refreshToken, decoded.customerId]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const customerResult = await pool.query(
      'SELECT id, phone, name, subscription_status FROM customers WHERE id = $1',
      [decoded.customerId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(401).json({ error: 'Customer not found' });
    }

    const customer = customerResult.rows[0];
    
    if (customer.subscription_status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    const tokens = generateTokens(customer.id);

    await pool.query(
      'DELETE FROM refresh_tokens WHERE customer_id = $1',
      [customer.id]
    );

    await pool.query(
      'INSERT INTO refresh_tokens (customer_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
      [customer.id, tokens.refreshToken]
    );

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

const blacklistToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        await redisClient.setEx(`blacklist:${token}`, expiresIn, 'true');
      }
    }
  } catch (error) {
    logger.error('Token blacklist error:', error);
  }
};

module.exports = {
  generateTokens,
  authenticateToken,
  refreshTokens,
  blacklistToken
};