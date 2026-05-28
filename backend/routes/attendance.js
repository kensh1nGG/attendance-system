const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { logAction } = require('../utils/logger');

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

// Отметить посещаемость
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    const { student_id, date, status, notes } = req.body;
    
    // Проверяем существующую запись
    const existing = await pool.query(
      'SELECT id FROM attendance WHERE student_id = $1 AND date = $2',
      [student_id, date]
    );
    
    let result;
    if (existing.rows.length > 0) {
      // Обновляем
      result = await pool.query(
        `UPDATE attendance 
         SET status = $1, notes = $2, marked_by = $3, updated_at = NOW() 
         WHERE id = $4 
         RETURNING *`,
        [status, notes || null, req.user.id, existing.rows[0].id]
      );
    } else {
      // Создаем новую
      result = await pool.query(
        `INSERT INTO attendance (student_id, date, status, notes, marked_by) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [student_id, date, status, notes || null, req.user.id]
      );
    }
    
    await logAction(req.user.id, 'MARK_ATTENDANCE', `Marked student ${student_id} as ${status}`, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create attendance error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить посещаемость
router.get('/', verifyToken, async (req, res) => {
  try {
    const { student_id, group_name } = req.query;
    let query = 'SELECT a.*, u.full_name as student_name, u.group_name FROM attendance a JOIN users u ON a.student_id = u.id WHERE 1=1';
    const params = [];
    
    if (student_id) {
      params.push(student_id);
      query += ` AND a.student_id = $${params.length}`;
    }
    if (group_name) {
      params.push(group_name);
      query += ` AND u.group_name = $${params.length}`;
    }
    
    query += ' ORDER BY a.date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;