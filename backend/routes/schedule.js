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

// Получить расписание
router.get('/', verifyToken, async (req, res) => {
  try {
    const { group_name, teacher_id } = req.query;
    let query = 'SELECT s.*, u.full_name as teacher_name FROM schedules s JOIN users u ON s.teacher_id = u.id WHERE 1=1';
    const params = [];

    // ✅ СИНХРОНИЗАЦИЯ ПО РОЛЯМ
    if (req.user.role === 'student') {
      // Студенты видят только свою группу
      const group = req.user.group_name || group_name;
      if (group) {
        params.push(group);
        query += ` AND s.group_name = $${params.length}`;
      } else {
        query += ' AND FALSE'; // Если группы нет -> пустой результат
      }
    } else {
      // ✅ Админ и Преподаватель видят ВСЁ расписание (синхронизация)
      // Фильтры применяются только если явно переданы в запросе
      if (group_name) {
        params.push(group_name);
        query += ` AND s.group_name = $${params.length}`;
      }
      if (teacher_id) {
        params.push(teacher_id);
        query += ` AND s.teacher_id = $${params.length}`;
      }
    }

    query += ' ORDER BY s.day_of_week, s.time_slot';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get schedule error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать занятие
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    const { group_name, subject_name, day_of_week, time_slot, room_number } = req.body;
    
    const result = await pool.query(
      `INSERT INTO schedules (teacher_id, group_name, subject_name, day_of_week, time_slot, room_number) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [req.user.id, group_name, subject_name, day_of_week, time_slot, room_number || null]
    );
    
    await logAction(req.user.id, 'CREATE_SCHEDULE', `Created for ${group_name}`, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить студентов группы для отметки
router.get('/:scheduleId/students', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    const sched = await pool.query(
      'SELECT group_name, subject_name FROM schedules WHERE id = $1',
      [req.params.scheduleId]
    );
    
    if (sched.rows.length === 0) {
      return res.status(404).json({ error: 'Занятие не найдено' });
    }
    
    const { group_name, subject_name } = sched.rows[0];
    const today = new Date().toISOString().split('T')[0];
    
    const students = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.group_name, 
              a.status as today_status, a.notes as today_notes,
              (SELECT COUNT(*) FROM attendance a2 WHERE a2.student_id=u.id AND a2.status='present') as total_present,
              (SELECT COUNT(*) FROM attendance a3 WHERE a3.student_id=u.id AND a3.status='absent') as total_absent,
              (SELECT COUNT(*) FROM attendance a4 WHERE a4.student_id=u.id AND a4.status='late') as total_late
       FROM users u 
       LEFT JOIN attendance a ON u.id=a.student_id AND a.date=$2
       WHERE u.role='student' AND u.group_name=$1 
       ORDER BY u.full_name`,
      [group_name, today]
    );
    
    res.json({
      group_name,
      subject_name,
      date: today,
      students: students.rows
    });
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Массовая отметка посещаемости
router.post('/:scheduleId/attendance', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    const { students } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Нет данных для сохранения' });
    }
    
    const date = new Date().toISOString().split('T')[0];
    const marked_by = req.user.id;
    const results = [];
    const errors = [];
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const student of students) {
        try {
          if (!student.student_id || !student.status) continue;
          
          const result = await client.query(
            `INSERT INTO attendance (student_id, date, status, notes, marked_by) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (student_id, date) 
             DO UPDATE SET 
               status = EXCLUDED.status, 
               notes = EXCLUDED.notes, 
               marked_by = EXCLUDED.marked_by, 
               updated_at = NOW() 
             RETURNING *`,
            [student.student_id, date, student.status, student.notes || null, marked_by]
          );
          
          if (result.rows.length > 0) {
            results.push(result.rows[0]);
          }
        } catch (e) {
          errors.push({ student_id: student.student_id, error: e.message });
        }
      }
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
    if (results.length === 0) {
      return res.status(400).json({ error: 'Не удалось сохранить ни одной записи', details: errors });
    }
    
    await logAction(req.user.id, 'BULK_MARK_ATTENDANCE', `Marked ${results.length} students`, req.ip);
    res.status(201).json({ 
      message: `Отмечено ${results.length} студентов`, 
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Bulk attendance error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;