const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { generateTokens, blacklistToken } = require('../middleware/auth');
const logger = require('../config/logger');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT id, name, email, password_hash, language_skills, center_location, shift_schedule FROM operators WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      logger.warn(`Staff login attempt with invalid email: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const operator = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, operator.password_hash);
    if (!isValidPassword) {
      logger.warn(`Staff login attempt with invalid password for email: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokens = generateTokens(operator.id);

    // Store refresh token (using customer_id field for compatibility)
    await pool.query(
      'DELETE FROM refresh_tokens WHERE customer_id = $1',
      [operator.id]
    );

    await pool.query(
      'INSERT INTO refresh_tokens (customer_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
      [operator.id, tokens.refreshToken]
    );

    logger.info(`Successful staff login for operator: ${operator.id}`);

    // Format user data to match staff dashboard expectations
    const user = {
      id: operator.id.toString(),
      name: operator.name,
      email: operator.email,
      role: 'operator', // Default role, could be enhanced
      language: operator.language_skills?.[0] || 'en',
      shift: 'day', // Default shift, could be parsed from shift_schedule
      status: 'active'
    };

    res.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: user
    });
  } catch (error) {
    logger.error('Staff login error:', error);
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

    if (req.operator && req.operator.id) {
      await pool.query(
        'DELETE FROM refresh_tokens WHERE customer_id = $1',
        [req.operator.id]
      );
      
      logger.info(`Staff logged out: ${req.operator.id}`);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Staff logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  logout
};