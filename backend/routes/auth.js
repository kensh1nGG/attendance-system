const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { logAction } = require('../utils/logger');

// Регистрация
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, role, group_name } = req.body;
    
    if (role !== 'student') {
      return res.status(403).json({ error: 'Саморегистрация доступна только студентам' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (role, email, password_hash, full_name, group_name) VALUES($1,$2,$3,$4,$5) RETURNING id, role, email, full_name, group_name',
      ['student', email.toLowerCase(), hash, full_name, group_name || null]
    );

    await logAction(result.rows[0].id, 'REGISTER', 'New user registered', req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Вход
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    await logAction(user.id, 'LOGIN', 'User logged in', req.ip);

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        full_name: user.full_name,
        group_name: user.group_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Получить список студентов (для учителя/админа)
router.get('/users/students', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'student') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const result = await pool.query(
      'SELECT id, full_name, email, group_name FROM users WHERE role = $1 ORDER BY full_name',
      ['student']
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Забыли пароль
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (user.rows.length === 0) {
      return res.json({ message: 'Если email существует, инструкция отправлена' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 час
    
    await pool.query(
      `INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3`,
      [email, token, expires]
    );

    // Для курсовой выводим в консоль
    console.log(`\n📧 Ссылка для сброса пароля:`);
    console.log(`http://localhost:5500/reset-password.html?token=${token}\n`);
    
    res.json({ message: 'Инструкция отправлена (см. консоль сервера)' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сброс пароля
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    const reset = await pool.query(
      'SELECT email FROM password_resets WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (reset.rows.length === 0) {
      return res.status(400).json({ error: 'Ссылка для сброса недействительна или истекла' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, reset.rows[0].email]);
    await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);

    res.json({ message: 'Пароль успешно изменён' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;