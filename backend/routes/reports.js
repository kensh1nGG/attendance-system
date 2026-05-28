const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { generateExcel, generatePDF } = require('../utils/export');

// Middleware проверки токена
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('❌ Token not provided');
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ User authenticated:', req.user.email, 'Role:', req.user.role);
    next();
  } catch (err) {
    console.error('❌ Invalid token:', err.message);
    res.status(403).json({ error: 'Неверный токен' });
  }
};

// Отчет по посещаемости (ИСПРАВЛЕНО - теперь работает для всех ролей)
router.get('/attendance-summary', verifyToken, async (req, res) => {
  try {
    console.log('\n📊 Запрос отчета от:', req.user.email, 'Роль:', req.user.role);
    console.log('Query params:', req.query);
    
    const { group_name, student_id } = req.query;
    let whereClause = '';
    const params = [];
    
    // Если студент - показываем только его данные
    if (req.user.role === 'student') {
      whereClause = 'WHERE u.id = $1';
      params.push(req.user.id);
      console.log('📌 Режим студента, ID:', req.user.id);
    } else if (group_name) {
      // Если указана группа - показываем по группе
      whereClause = 'WHERE u.group_name = $1';
      params.push(group_name);
      console.log('📌 Режим фильтра по группе:', group_name);
    } else if (student_id) {
      // Если указан конкретный студент
      whereClause = 'WHERE u.id = $1';
      params.push(student_id);
      console.log('📌 Режим конкретного студента, ID:', student_id);
    } else {
      console.log('📌 Режим админа/преподавателя - показываем всех');
    }
    
    const query = `
      SELECT 
        u.id,
        u.full_name, 
        u.group_name,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN a.status = 'sick' THEN 1 END) as sick,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late,
        COUNT(a.id) as total,
        CASE 
          WHEN COUNT(a.id) > 0 
          THEN ROUND(COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / COUNT(a.id)::numeric * 100, 1)
          ELSE 0 
        END as attendance_percent
      FROM users u
      LEFT JOIN attendance a ON u.id = a.student_id
      ${whereClause}
      GROUP BY u.id, u.full_name, u.group_name
      ORDER BY u.group_name, u.full_name
    `;
    
    console.log('SQL Query:', query);
    console.log('Params:', params);
    
    const result = await pool.query(query, params);
    
    console.log(`✅ Найдено записей: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log('Пример данных:', result.rows[0]);
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Report error:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: error.message 
    });
  }
});

// Экспорт в Excel
router.get('/export/excel', verifyToken, async (req, res) => {
  try {
    await generateExcel(res, req.query.group_name);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Ошибка экспорта в Excel' });
  }
});

// Экспорт в PDF
router.get('/export/pdf', verifyToken, async (req, res) => {
  try {
    await generatePDF(res, req.query.group_name);
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ error: 'Ошибка экспорта в PDF' });
  }
});

module.exports = router;