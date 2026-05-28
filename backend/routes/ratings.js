const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(403).json({ error: 'Неверный токен' });
  }
};

// Пересчет рейтинга
router.post('/recalculate', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Только для администраторов' });
    }
    
    // Формула: present=2, late=1, sick=1, absent=0
    const { rows } = await pool.query(`
      SELECT student_id,
        SUM(CASE 
          WHEN status = 'present' THEN 2
          WHEN status = 'late' OR status = 'sick' THEN 1
          ELSE 0 
        END) as points
      FROM attendance 
      GROUP BY student_id
    `);
    
    await pool.query('BEGIN');
    await pool.query('UPDATE users SET rating_points = 0 WHERE role = $1', ['student']);
    
    for (const r of rows) {
      await pool.query('UPDATE users SET rating_points = $1 WHERE id = $2', [r.points, r.student_id]);
    }
    
    await pool.query('COMMIT');
    res.json({ message: 'Рейтинг пересчитан', updated: rows.length });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Recalculate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Получить рейтинг
router.get('/', verifyToken, async (req, res) => {
  try {
    const { group_name } = req.query;
    let query = `SELECT full_name, group_name, rating_points FROM users WHERE role = 'student'`;
    const params = [];
    
    if (group_name) {
      query += ` AND group_name = $${params.length + 1}`;
      params.push(group_name);
    }
    
    query += ` ORDER BY rating_points DESC LIMIT 50`;
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Get ratings error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;