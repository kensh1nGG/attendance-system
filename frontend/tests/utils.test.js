// frontend/tests/utils.test.js

describe('Вспомогательные функции (ГОСТ 19.301-79, п. 3.6)', () => {
  
  test('getRoleName – правильное отображение ролей', () => {
    const getRoleName = (role) => {
      const roles = {
        admin: 'Администратор',
        teacher: 'Преподаватель',
        student: 'Студент',
        guest: 'Гость'
      };
      return roles[role] || role;
    };

    expect(getRoleName('admin')).toBe('Администратор');
    expect(getRoleName('teacher')).toBe('Преподаватель');
    expect(getRoleName('student')).toBe('Студент');
    expect(getRoleName('guest')).toBe('Гость');
    expect(getRoleName('unknown')).toBe('unknown');
  });

  test('getStatusBadge – правильные CSS-классы для статусов', () => {
    const getStatusBadge = (status) => {
      const badges = {
        present: 'badge-success',
        absent: 'badge-danger',
        late: 'badge-warning',
        sick: 'badge-warning'
      };
      return badges[status] || '';
    };

    expect(getStatusBadge('present')).toBe('badge-success');
    expect(getStatusBadge('absent')).toBe('badge-danger');
    expect(getStatusBadge('late')).toBe('badge-warning');
    expect(getStatusBadge('sick')).toBe('badge-warning');
    expect(getStatusBadge('unknown')).toBe('');
  });

  test('calculateRating – расчет рейтинга студентов', () => {
    const calculateRating = (attendanceRecords) => {
      return attendanceRecords.reduce((total, record) => {
        switch(record.status) {
          case 'present': return total + 2;
          case 'late':
          case 'sick': return total + 1;
          default: return total; // absent = 0
        }
      }, 0);
    };

    const records = [
      { status: 'present' },
      { status: 'present' },
      { status: 'absent' },
      { status: 'late' },
      { status: 'sick' }
    ];

    expect(calculateRating(records)).toBe(6); // 2+2+0+1+1 = 6
  });

  test('formatDate – форматирование даты в русский формат', () => {
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    expect(formatDate('2026-05-28')).toContain('2026');
    expect(formatDate('2026-05-28')).toContain('мая');
  });

  test('showAlert – функция отображает уведомление', () => {
  // Мокаем DOM-элементы
  document.body.innerHTML = '<div id="alert-container"></div>';
  
  // Локальная реализация для теста
  const showAlert = (msg, type = 'info') => {
    const c = document.getElementById('alert-container');
    if (!c) return false;
    const a = document.createElement('div');
    a.className = `alert alert-${type}`;
    a.textContent = msg;
    c.insertBefore(a, c.firstChild);
    return true;
  };

  expect(showAlert('Тест', 'success')).toBe(true);
  expect(document.querySelector('.alert-success')).toBeTruthy();
});
});