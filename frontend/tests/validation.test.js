// frontend/tests/validation.test.js

// Функции валидации (дублируем из app.js для изоляции тестов)
// Используем !! для гарантированного возврата boolean
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return !!re.test(String(email).toLowerCase());
};

const validatePassword = (password) => {
  return !!(password && password.length >= 6);
};

const validateRequiredField = (value) => {
  return !!(value && String(value).trim().length > 0);
};

const validateDate = (date) => {
  const d = new Date(date);
  return !!(d instanceof Date && !isNaN(d) && date !== null && date !== '');
};

describe('Валидация форм (ГОСТ 34.602-89, п. 3.2.4.3)', () => {
  
  describe('validateEmail', () => {
    test('принимает корректные email-адреса', () => {
      expect(validateEmail('student@mirea.ru')).toBe(true);
      expect(validateEmail('admin@test.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.ru')).toBe(true);
    });

    test('отклоняет некорректные email-адреса', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@mirea.ru')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('принимает пароли от 6 символов', () => {
      expect(validatePassword('123456')).toBe(true);
      expect(validatePassword('password123')).toBe(true);
    });

    test('отклоняет пароли короче 6 символов', () => {
      expect(validatePassword('12345')).toBe(false);
      expect(validatePassword('abc')).toBe(false);
      expect(validatePassword('')).toBe(false);
      expect(validatePassword(null)).toBe(false);
      expect(validatePassword(undefined)).toBe(false);
    });
  });

  describe('validateRequiredField', () => {
    test('принимает непустые значения', () => {
      expect(validateRequiredField('Иванов Иван')).toBe(true);
      expect(validateRequiredField('ЭФБО-14-24')).toBe(true);
    });

    test('отклоняет пустые значения', () => {
      expect(validateRequiredField('')).toBe(false);
      expect(validateRequiredField('   ')).toBe(false);
      expect(validateRequiredField(null)).toBe(false);
      expect(validateRequiredField(undefined)).toBe(false);
    });
  });

  describe('validateDate', () => {
    test('принимает корректные даты', () => {
      expect(validateDate('2026-05-28')).toBe(true);
      expect(validateDate(new Date())).toBe(true);
    });

    test('отклоняет некорректные даты', () => {
      expect(validateDate('invalid-date')).toBe(false);
      expect(validateDate('')).toBe(false);
      expect(validateDate(null)).toBe(false);
      expect(validateDate(undefined)).toBe(false);
    });
  });
});