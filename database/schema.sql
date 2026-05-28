-- ========================================================================
-- ПРОЕКТ: Информационная система учета посещаемости студентов
-- СУБД: PostgreSQL 14+
-- НАЗНАЧЕНИЕ: Скрипт инициализации структуры БД и тестового наполнения
-- АВТОР: [Баксаров Богдан Вячеславович], Группа ЭФБО-14-24
-- ДАТА: 28.05.2026
-- ИНСТРУКЦИЯ: 
--   1. Создать БД: CREATE DATABASE attendance_db;
--   2. Выполнить скрипт: \i attendance_init.sql
--   3. Для сброса: просто запустить повторно (используются IF EXISTS)
-- ========================================================================

-- 1. ОЧИСТКА СУЩЕСТВУЮЩИХ ОБЪЕКТОВ (строго в обратном порядке зависимостей)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 2. СОЗДАНИЕ ТАБЛИЦ
-- Таблица пользователей (реализует ролевую модель доступа)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    group_name VARCHAR(50),
    rating_points INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица расписания занятий
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    group_name VARCHAR(50) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота')),
    time_slot VARCHAR(20) NOT NULL,
    room_number VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица посещаемости (ограничение: 1 студент = 1 запись в день)
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'sick', 'late')),
    notes TEXT,
    marked_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_date UNIQUE (student_id, date)
);

-- Таблица аудита (соответствует ГОСТ Р ИСО/МЭК 27001-2012, A.12.4)
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица уведомлений
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица токенов восстановления пароля
CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL
);

-- 3. ИНДЕКСЫ (оптимизация производительности частых запросов)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_schedules_teacher ON schedules(teacher_id);
CREATE INDEX idx_schedules_group ON schedules(group_name);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- 4. ФУНКЦИИ И ТРИГГЕРЫ (автоматизация временных меток)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();