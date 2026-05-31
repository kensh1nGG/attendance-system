// backend/tests/auth.test.js
const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');

describe('Модуль аутентификации', () => {
  
  test('POST /api/auth/login – успешный вход администратора', async () => {
    const startTime = Date.now();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@mirea.ru', password: 'admin123' })
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.role).toBe('admin');
    expect(responseTime).toBeLessThan(2000);
  });

  test('POST /api/auth/login – неверный пароль', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@mirea.ru', password: 'wrongpassword' })
      .expect(401);
    
    expect(res.body.error).toBe('Неверный email или пароль');
  });

  test('POST /api/auth/login – несуществующий пользователь', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@mirea.ru', password: 'password123' })
      .expect(401);
    
    expect(res.body.error).toBe('Неверный email или пароль');
  });

  test('POST /api/auth/register – регистрация нового студента', async () => {
    const randomEmail = `test${Date.now()}@student.ru`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: randomEmail,
        password: 'test123456',
        full_name: 'Тестовый Студент',
        role: 'student',
        group_name: 'ТЕСТ-00-00'
      })
      .expect(201);
    
    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe(randomEmail.toLowerCase());
    expect(res.body.role).toBe('student');
  });

  test('POST /api/auth/register – дубликат email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@mirea.ru',
        password: 'test123',
        full_name: 'Тест',
        role: 'student'
      })
      .expect(400);
    
    expect(res.body.error).toContain('уже существует');
  });

  test('POST /api/auth/register – невалидная роль', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `test${Date.now()}@student.ru`,
        password: 'test123',
        full_name: 'Тест',
        role: 'hacker'
      })
      .expect(403);
    
    expect(res.body.error).toBe('Саморегистрация доступна только студентам');
  });
});

// Закрываем соединения с БД ПОСЛЕ ВСЕХ тестов (только один раз!)
afterAll(async () => {
  await pool.end();
});