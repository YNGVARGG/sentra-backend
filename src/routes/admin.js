const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const logger = require('../config/logger');

const router = express.Router();

// Migration endpoint - only for development/setup
router.post('/migrate', async (req, res) => {
  try {
    logger.info('Starting database migration...');
    
    const migrationsDir = path.join(__dirname, '..', '..', 'database', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();
    
    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        logger.info(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await pool.query(sql);
        logger.info(`✓ Migration ${file} completed`);
      }
    }
    
    logger.info('All migrations completed successfully!');
    res.json({ 
      success: true, 
      message: 'Database migrations completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Migration failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Migration failed', 
      details: error.message 
    });
  }
});

// Seed endpoint - only for development/setup
router.post('/seed', async (req, res) => {
  try {
    logger.info('Starting database seeding...');
    
    const seedsDir = path.join(__dirname, '..', '..', 'database', 'seeds');
    const seedFiles = fs.readdirSync(seedsDir).sort();
    
    for (const file of seedFiles) {
      if (file.endsWith('.sql')) {
        logger.info(`Running seed: ${file}`);
        const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
        await pool.query(sql);
        logger.info(`✓ Seed ${file} completed`);
      }
    }
    
    logger.info('All seeds completed successfully!');
    res.json({ 
      success: true, 
      message: 'Database seeding completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Seeding failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Seeding failed', 
      details: error.message 
    });
  }
});

// Database status endpoint
router.get('/db-status', async (req, res) => {
  try {
    // Check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // Count records in each table
    const tableCounts = {};
    for (const table of tables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        tableCounts[table] = parseInt(countResult.rows[0].count);
      } catch (err) {
        tableCounts[table] = 'error';
      }
    }
    
    res.json({
      success: true,
      tables: tables,
      table_counts: tableCounts,
      total_tables: tables.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Database status check failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database status check failed', 
      details: error.message 
    });
  }
});

module.exports = router;