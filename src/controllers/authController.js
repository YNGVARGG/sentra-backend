const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { generateTokens, blacklistToken } = require('../middleware/auth');
const logger = require('../config/logger');

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const result = await pool.query(
      'SELECT id, phone, name, password_hash, subscription_status FROM customers WHERE phone = $1',
      [phone]
    );

    if (result.rows.length === 0) {
      logger.warn(`Login attempt with invalid phone: ${phone}`);
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const customer = result.rows[0];

    if (customer.subscription_status !== 'active') {
      logger.warn(`Login attempt with inactive account: ${phone}`);
      return res.status(403).json({ error: 'Account is not active' });
    }

    const isValidPassword = await bcrypt.compare(password, customer.password_hash);
    if (!isValidPassword) {
      logger.warn(`Login attempt with invalid password for phone: ${phone}`);
      return res.status(401).json({ error: 'Invalid phone number or password' });
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

    logger.info(`Successful login for customer: ${customer.id}`);

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
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const logout = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      await blacklistToken(token);
    }

    if (req.customer && req.customer.id) {
      await pool.query(
        'DELETE FROM refresh_tokens WHERE customer_id = $1',
        [req.customer.id]
      );
      
      logger.info(`Customer logged out: ${req.customer.id}`);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const register = async (req, res) => {
  try {
    const { phone, name, password, address, emergency_contacts } = req.body;

    const existingCustomer = await pool.query(
      'SELECT id FROM customers WHERE phone = $1',
      [phone]
    );

    if (existingCustomer.rows.length > 0) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO customers (phone, name, password_hash, address, emergency_contacts) VALUES ($1, $2, $3, $4, $5) RETURNING id, phone, name',
      [phone, name, hashedPassword, address, emergency_contacts ? JSON.stringify(emergency_contacts) : null]
    );

    const customer = result.rows[0];
    const tokens = generateTokens(customer.id);

    await pool.query(
      'INSERT INTO refresh_tokens (customer_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
      [customer.id, tokens.refreshToken]
    );

    logger.info(`New customer registered: ${customer.id}`);

    res.status(201).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  logout,
  register
};