// backend/tests/reports.test.js
const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');

let authToken;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@mirea.ru', password: 'admin123' });
  authToken = loginRes.body.token;
});

describe('Модуль отчетов', () => {
  
  test('GET /api/reports/attendance-summary – получение сводки', async () => {
    const startTime = Date.now();
    const res = await request(app)
      .get('/api/reports/attendance-summary')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    
    expect(Array.isArray(res.body)).toBe(true);
    expect(responseTime).toBeLessThan(2000);
    
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('full_name');
      expect(res.body[0]).toHaveProperty('present');
      expect(res.body[0]).toHaveProperty('attendance_percent');
    }
  });

  test('GET /api/reports/attendance-summary – фильтр по группе', async () => {
    const res = await request(app)
      .get('/api/reports/attendance-summary?group_name=ЭФБО-14-24')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/reports/export/excel – экспорт Excel', async () => {
    const res = await request(app)
      .get('/api/reports/export/excel')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats');
  });

  test('GET /api/reports/export/pdf – экспорт PDF', async () => {
    const res = await request(app)
      .get('/api/reports/export/pdf')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});

// Закрываем соединения с БД ПОСЛЕ ВСЕХ тестов (только один раз!)
afterAll(async () => {
  await pool.end();
});