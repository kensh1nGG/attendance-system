// backend/tests/attendance.test.js
const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');

let authToken;
let testStudentId;

beforeAll(async () => {
  // Авторизуемся как админ для получения токена
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@mirea.ru', password: 'admin123' });
  authToken = loginRes.body.token;

  // Находим тестового студента
  const studentsRes = await request(app)
    .get('/api/auth/users/students')
    .set('Authorization', `Bearer ${authToken}`);
  
  if (studentsRes.body.length > 0) {
    testStudentId = studentsRes.body[0].id;
  }
});

describe('Модуль посещаемости', () => {
  
  test('GET /api/attendance – без токена (401)', async () => {
    const res = await request(app)
      .get('/api/attendance')
      .expect(401);
    
    expect(res.body.error).toBe('Требуется авторизация');
  });

  test('GET /api/attendance – с валидным токеном', async () => {
    const startTime = Date.now();
    const res = await request(app)
      .get('/api/attendance')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(Array.isArray(res.body)).toBe(true);
    expect(responseTime).toBeLessThan(2000);
  });

  test('POST /api/attendance – отметка присутствия', async () => {
    if (!testStudentId) return;

    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        student_id: testStudentId,
        date: '2026-05-28',
        status: 'present',
        notes: 'Тестовая отметка'
      })
      .expect(201);
    
    expect(res.body.status).toBe('present');
    expect(res.body.notes).toBe('Тестовая отметка');
  });

  test('POST /api/attendance – обновление существующей записи', async () => {
    if (!testStudentId) return;

    // Сначала создаём запись
    await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        student_id: testStudentId,
        date: '2026-05-27',
        status: 'present'
      });

    // Обновляем
    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        student_id: testStudentId,
        date: '2026-05-27',
        status: 'absent',
        notes: 'Обновлено'
      })
      .expect(201);
    
    expect(res.body.status).toBe('absent');
    expect(res.body.notes).toBe('Обновлено');
  });

test('POST /api/attendance – студент не может отмечать', async () => {
  // 1. Регистрируем нового студента
  const studentEmail = `student${Date.now()}@test.ru`;
  const studentPassword = 'test123';
  
  await request(app)
    .post('/api/auth/register')
    .send({
      email: studentEmail,
      password: studentPassword,
      full_name: 'Студент Тест',
      role: 'student',
      group_name: 'ТЕСТ'
    })
    .expect(201);

  // 2. ✅ Логинимся как этот студент, чтобы получить токен
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: studentEmail,
      password: studentPassword
    })
    .expect(200);
  
  const studentToken = loginRes.body.token;

  // 3. Делаем запрос с токеном студента (у которого нет прав)
  const res = await request(app)
    .post('/api/attendance')
    .set('Authorization', `Bearer ${studentToken}`) // ← Теперь токен валидный!
    .send({
      student_id: testStudentId || 1,
      date: '2026-05-28',
      status: 'present'
    })
    .expect(403);
  
  expect(res.body.error).toBe('Доступ запрещен');
});
});

// Закрываем соединения с БД ПОСЛЕ ВСЕХ тестов (только один раз!)
afterAll(async () => {
  await pool.end();
});