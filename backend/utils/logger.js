const pool = require('../config/db');

async function logAction(userId, action, details, ipAddress, userAgent = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, action, details, ipAddress, userAgent]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = { logAction };