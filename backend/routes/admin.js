const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { logAction } = require('../utils/logger');

const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Требуются права администратора' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Неверный токен' });
  }
};

// Создать пользователя
router.post('/create-user', verifyAdmin, async (req, res) => {
  try {
    const { email, password, full_name, role, group_name } = req.body;
    
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (role, email, password_hash, full_name, group_name) VALUES($1,$2,$3,$4,$5) RETURNING id, role, email, full_name, group_name',
      [role, email.toLowerCase(), hash, full_name, group_name || null]
    );
    
    await logAction(req.user.id, 'CREATE_USER', `Created ${role}: ${email}`, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Ошибка сервера при создании пользователя' });
  }
});

module.exports = router;