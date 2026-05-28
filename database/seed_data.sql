-- 5. НАЧАЛЬНЫЕ ДАННЫЕ (тестовое наполнение для демонстрации функционала)
-- 5.1. Администратор (пароль: admin123, хеш bcrypt)
INSERT INTO users (role, email, password_hash, full_name, rating_points) VALUES
('admin', 'admin@mirea.ru', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Администратор Системы', 0)
ON CONFLICT (email) DO NOTHING;

-- 5.2. Тестовые студенты
INSERT INTO users (role, email, password_hash, full_name, group_name) VALUES
('student', 'ivanov@test.ru', '$2a$10$rH9z8Q5m6L3pN2wX1vY4tO8jK7sU6dF5gH3iJ2kL1mN0oP9qR8sT0u', 'Иванов Иван Иванович', 'ЭФБО-14-24'),
('student', 'petrova@test.ru', '$2a$10$rH9z8Q5m6L3pN2wX1vY4tO8jK7sU6dF5gH3iJ2kL1mN0oP9qR8sT0u', 'Петрова Анна Сергеевна', 'ЭФБО-14-24'),
('student', 'sidorov@test.ru', '$2a$10$rH9z8Q5m6L3pN2wX1vY4tO8jK7sU6dF5gH3iJ2kL1mN0oP9qR8sT0u', 'Сидоров Петр Алексеевич', 'ИВТ-12-23')
ON CONFLICT (email) DO NOTHING;

-- 5.3. Тестовое расписание
INSERT INTO schedules (teacher_id, group_name, subject_name, day_of_week, time_slot, room_number)
SELECT id, 'ЭФБО-14-24', 'Базы данных', 'Понедельник', '09:00-10:30', '301'
FROM users WHERE email = 'admin@mirea.ru'
ON CONFLICT DO NOTHING;

INSERT INTO schedules (teacher_id, group_name, subject_name, day_of_week, time_slot, room_number)
SELECT id, 'ИВТ-12-23', 'Веб-разработка', 'Среда', '12:00-13:30', '405'
FROM users WHERE email = 'admin@mirea.ru'
ON CONFLICT DO NOTHING;

-- 5.4. Генерация тестовой посещаемости за последние 5 дней
DO $$
DECLARE
    s1 INT; s2 INT; s3 INT;
BEGIN
    SELECT id INTO s1 FROM users WHERE email = 'ivanov@test.ru';
    SELECT id INTO s2 FROM users WHERE email = 'petrova@test.ru';
    SELECT id INTO s3 FROM users WHERE email = 'sidorov@test.ru';

    INSERT INTO attendance (student_id, date, status, notes) VALUES
    (s1, CURRENT_DATE - 4, 'present', ''), (s1, CURRENT_DATE - 3, 'late', 'Опоздал'),
    (s1, CURRENT_DATE - 2, 'present', ''), (s1, CURRENT_DATE - 1, 'absent', ''),
    (s1, CURRENT_DATE, 'present', ''),
    (s2, CURRENT_DATE - 4, 'present', ''), (s2, CURRENT_DATE - 3, 'present', ''),
    (s2, CURRENT_DATE - 2, 'sick', 'Больничный'), (s2, CURRENT_DATE - 1, 'present', ''),
    (s2, CURRENT_DATE, 'late', ''),
    (s3, CURRENT_DATE - 4, 'absent', ''), (s3, CURRENT_DATE - 3, 'absent', ''),
    (s3, CURRENT_DATE - 2, 'present', ''), (s3, CURRENT_DATE - 1, 'present', ''),
    (s3, CURRENT_DATE, 'absent', '')
    ON CONFLICT (student_id, date) DO NOTHING;
END $$;

-- 6. ФИНАЛЬНАЯ ПРОВЕРКА
SELECT '✅ База данных успешно инициализирована' AS status;
SELECT COUNT(*) AS total_users FROM users;
SELECT COUNT(*) AS total_attendance_records FROM attendance;