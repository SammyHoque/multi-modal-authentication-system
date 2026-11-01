// Database connection configuration for PostgreSQL
// Uses environment variables for secure credential management

const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool for efficient database connections
// Pool automatically handles connection limits, recycling, and error recovery
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Export the pool for use in other modules
module.exports = pool;