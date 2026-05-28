const API = 'http://localhost:3000/api';
const TOKEN_KEY = 'attendance_token';
const USER_KEY = 'attendance_user';
const THEME_KEY = 'attendance_theme';

const $ = (selector) => document.querySelector(selector);

// Утилиты
const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const getUser = () => {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
};
const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));
const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const showAlert = (msg, type = 'info', dur = 4000) => {
  const c = $('#alert-container');
  if (!c) { alert(msg); return; }
  const a = document.createElement('div');
  a.className = `alert alert-${type}`;
  a.innerHTML = `
    <span style="margin-right:1rem;flex:1;">${msg}</span>
    <button style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:inherit;">&times;</button>
  `;
  a.querySelector('button').onclick = () => {
    a.style.opacity = '0';
    setTimeout(() => a.remove(), 300);
  };
  c.insertBefore(a, c.firstChild);
  if (dur > 0) setTimeout(() => {
    a.style.opacity = '0';
    setTimeout(() => a.remove(), 300);
  }, dur);
};

// Тема
const initTheme = () => {
  const t = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', t);
  updateThemeBtn(t);
};
const toggleTheme = () => {
  const c = document.documentElement.getAttribute('data-theme');
  const n = c === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', n);
  localStorage.setItem(THEME_KEY, n);
  updateThemeBtn(n);
};
const updateThemeBtn = (t) => {
  const b = $('#theme-toggle');
  if (b) b.innerHTML = t === 'dark' ? '☀️ Светлая тема' : '🌙 Темная тема';
};

// Авторизация
const setupAuth = () => {
  const ta = $('#toggle-auth'), af = $('#auth-form'), rf = $('#register-fields'), ab = $('#auth-btn');
  if (!af) return;
  
  if (ta) ta.addEventListener('click', () => {
    const ir = rf.style.display === 'none';
    rf.style.display = ir ? 'block' : 'none';
    ab.textContent = ir ? 'Зарегистрироваться' : 'Войти';
    $('#auth-title').textContent = ir ? 'Регистрация' : 'Вход в систему';
    ta.textContent = ir ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
    af.reset();
  });

  af.addEventListener('submit', async (e) => {
    e.preventDefault();
    const em = $('#email').value.trim().toLowerCase();
    const pw = $('#password').value;
    const ir = rf.style.display !== 'none';
    
    if (!em || !pw || pw.length < 6) {
      showAlert('Заполните все поля', 'error');
      return;
    }
    
    ab.disabled = true;
    const ot = ab.textContent;
    ab.textContent = ir ? 'Регистрация...' : 'Вход...';
    
    try {
      const url = ir ? `${API}/auth/register` : `${API}/auth/login`;
      const bd = ir ? {
        email: em, password: pw, role: $('#role').value,
        full_name: $('#full_name').value.trim(),
        group_name: $('#group_name').value.trim() || null
      } : { email: em, password: pw };
      
      const rs = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bd)
      });
      
      if (rs.status === 429) throw new Error('Слишком много запросов');
      if (!rs.ok) {
        const ed = await rs.json().catch(() => ({ error: 'Ошибка' }));
        throw new Error(ed.error || 'Ошибка');
      }
      
      const dt = await rs.json();
      
      if (ir) {
        showAlert('Регистрация успешна! Теперь войдите.', 'success');
        ta.click();
      } else {
        setToken(dt.token);
        setUser(dt.user);
        showAlert('Добро пожаловать!', 'success', 1500);
        setTimeout(() => renderDashboard(), 500);
      }
    } catch (er) {
      showAlert('Ошибка: ' + er.message, 'error');
    } finally {
      ab.disabled = false;
      ab.textContent = ot;
    }
  });
};

const setupLogout = () => {
  const lb = $('#logout-btn');
  if (lb) lb.addEventListener('click', () => {
    if (confirm('Выйти?')) {
      clearSession();
      location.reload();
    }
  });
};

// Интерфейс
const getRoleName = (r) => ({
  admin: 'Администратор',
  teacher: 'Преподаватель',
  student: 'Студент'
}[r] || r);

const renderDashboard = () => {
  const user = getUser();
  if (!user) return;

  $('#auth-section').style.display = 'none';
  $('#dashboard').style.display = 'grid';
  $('#nav').style.display = 'flex';

  const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  const el = {
    'user-avatar': initials,
    'sidebar-avatar': initials,
    'user-name': user.full_name.split(' ').map((n, i) => i === 0 ? n : n[0] + '.').join(' '),
    'sidebar-user-name': user.full_name.split(' ').map((n, i) => i === 0 ? n : n[0] + '.').join(' '),
    'user-role': getRoleName(user.role),
    'sidebar-user-role': getRoleName(user.role),
    'profile-name': user.full_name,
    'profile-email': user.email,
    'profile-group': user.group_name || 'Не указана',
    'profile-role': getRoleName(user.role)
  };
  
  Object.keys(el).forEach(id => {
    const e = $(`#${id}`);
    if (e) e.textContent = el[id];
  });

  setupNavigation(user.role);
  setupLogout();
  setupMarkAttendance();
  setupAdminForm();
  setupScheduleModal();
  
  // Для админа показываем кнопку добавления расписания
  if (user.role === 'admin') {
    const btn = $('#add-schedule-btn');
    if (btn) btn.style.display = 'inline-block';
  }
  
  loadSectionData('profile');
};

const setupNavigation = (role) => {
  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return;
  nav.innerHTML = '';

  const items = [
    { id: 'profile', icon: '👤', text: 'Кабинет', roles: ['all'] },
    { id: 'schedule', icon: '📅', text: 'Расписание', roles: ['all'] },
    { id: 'attendance', icon: '📋', text: 'Посещаемость', roles: ['all'] }
  ];

  if (role === 'teacher' || role === 'admin') {
    items.splice(1, 0, { id: 'mark-attendance', icon: '✏️', text: 'Отметить', roles: ['teacher', 'admin'] });
  }

  if (role === 'admin') {
    items.push({ id: 'admin', icon: '⚙️', text: 'Управление', roles: ['admin'] });
  }

  items.push(
    { id: 'reports', icon: '📊', text: 'Отчеты', roles: ['all'] },
    { id: 'notifications', icon: '🔔', text: 'Уведомления', roles: ['all'] }
  );

  items.forEach((item, index) => {
    if (item.roles.includes('all') || item.roles.includes(role)) {
      const btn = document.createElement('button');
      btn.className = `nav-item ${index === 0 ? 'active' : ''}`;
      btn.dataset.section = item.id;
      btn.innerHTML = `<span class="nav-icon">${item.icon}</span><span class="nav-text">${item.text}</span>`;
      nav.appendChild(btn);
    }
  });

  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      const si = btn.dataset.section + '-section';
      const ts = $(`#${si}`);
      if (ts) {
        ts.classList.add('active');
        if (btn.dataset.section === 'attendance') loadAttendance();
        if (btn.dataset.section === 'schedule') loadSchedule();
        if (btn.dataset.section === 'reports') loadReports();
        if (btn.dataset.section === 'notifications') loadNotifications();
        if (btn.dataset.section === 'mark-attendance') loadStudents();
      }
    });
  });
};

const loadSectionData = (s) => {
  const u = getUser();
  if (s === 'attendance') loadAttendance();
  if (s === 'schedule') loadSchedule();
  if (s === 'reports') loadReports();
  if (s === 'notifications') loadNotifications();
  if (s === 'mark-attendance' && (u.role === 'teacher' || u.role === 'admin')) loadStudents();
  
  const asb = $('#add-schedule-btn');
  if (asb && s === 'schedule') {
    asb.style.display = (u.role === 'teacher' || u.role === 'admin') ? 'inline-block' : 'none';
  }
  if (s === 'attendance' || s === 'reports') loadGroupsFilter();
};

// Расписание
const loadSchedule = async () => {
  const u = getUser();
  const c = $('#schedule-content');
  try {
    // ✅ Запрашиваем расписание без фильтров. Бэкенд сам отдаст нужное по роли.
    const url = `${API}/schedule`;
    
    const rs = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    
    if (!rs.ok) throw new Error('Ошибка загрузки');
    const dt = await rs.json();
    
    if (dt.length === 0) {
      c.innerHTML = '<div class="empty-state"><p>Расписание пусто</p></div>';
      return;
    }

    const byDay = {};
    dt.forEach(i => {
      if (!byDay[i.day_of_week]) byDay[i.day_of_week] = [];
      byDay[i.day_of_week].push(i);
    });

    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    let html = '<div class="schedule-grid">';
    
    days.forEach(d => {
      if (byDay[d]) {
        html += `<div class="day-column"><h3>${d}</h3>`;
        byDay[d].sort((a, b) => a.time_slot.localeCompare(b.time_slot)).forEach(it => {
          // Клик для отметки доступен преподавателям и админам
          const clk = (u.role === 'teacher' || u.role === 'admin') 
            ? `onclick="openAttendanceModal(${it.id})" style="cursor:pointer;"` 
            : '';
            
          html += `
            <div class="schedule-item" ${clk}>
              <div class="schedule-subject">${it.subject_name}</div>
              <div class="schedule-time">${it.time_slot}</div>
              <div class="schedule-group">${it.group_name}</div>
              ${it.room_number ? `<div class="schedule-room">Ауд. ${it.room_number}</div>` : ''}
              <div class="schedule-teacher">${it.teacher_name}</div>
            </div>
          `;
        });
        html += '</div>';
      }
    });
    html += '</div>';
    c.innerHTML = html;
  } catch (er) {
    c.innerHTML = '<div class="alert alert-error">Ошибка загрузки расписания</div>';
  }
};

const setupScheduleModal = () => {
  const md = $('#schedule-modal'), ab = $('#add-schedule-btn'), cb = md?.querySelector('.close-modal');
  if (ab) ab.addEventListener('click', () => { if (md) md.style.display = 'flex'; });
  if (cb) cb.addEventListener('click', () => { if (md) md.style.display = 'none'; });
  
  const fm = $('#schedule-form');
  if (fm) fm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dt = {
      group_name: $('#sched-group').value,
      subject_name: $('#sched-subject').value,
      day_of_week: $('#sched-day').value,
      time_slot: $('#sched-time').value,
      room_number: $('#sched-room').value || null
    };
    
    try {
      const rs = await fetch(`${API}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(dt)
      });
      
      if (!rs.ok) throw new Error('Ошибка');
      showAlert('Занятие добавлено', 'success');
      if (md) md.style.display = 'none';
      fm.reset();
      loadSchedule();
    } catch (er) {
      showAlert('Ошибка: ' + er.message, 'error');
    }
  });
};

// Посещаемость (групповая)
let curSchedId = null, curStudData = [];

const openAttendanceModal = async (sid) => {
  curSchedId = sid;
  const md = $('#attendance-modal');
  if (!md) return;
  md.style.display = 'flex';
  $('#attendance-modal-body').innerHTML = '<tr><td colspan="6" class="text-center">Загрузка...</td></tr>';
  
  try {
    const rs = await fetch(`${API}/schedule/${sid}/students`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    
    if (!rs.ok) throw new Error('Ошибка');
    const dt = await rs.json();
    curStudData = dt.students;
    
    $('#attendance-modal-title').textContent = `Посещаемость: ${dt.subject_name} (${dt.group_name})`;
    $('#attendance-info').innerHTML = `
      <div class="attendance-info-row">
        <span><strong>Группа:</strong> ${dt.group_name}</span>
        <span><strong>Предмет:</strong> ${dt.subject_name}</span>
        <span><strong>Дата:</strong> ${new Date(dt.date).toLocaleDateString('ru-RU')}</span>
      </div>
    `;
    renderAttendanceModalTable(dt.students);
  } catch (er) {
    $('#attendance-modal-body').innerHTML = '<tr><td colspan="6" class="text-center">Ошибка</td></tr>';
  }
};

const renderAttendanceModalTable = (sts) => {
  const tb = $('#attendance-modal-body');
  if (!tb || sts.length === 0) {
    tb.innerHTML = '<tr><td colspan="6" class="text-center">Нет студентов</td></tr>';
    return;
  }
  
  const uniq = sts.filter((s, i, a) => i === a.findIndex(x => x.id === s.id));
  tb.innerHTML = uniq.map(st => {
    return `
      <tr data-student-id="${st.id}">
        <td>${st.full_name}</td>
        <td>${st.group_name || '-'}</td>
        <td>${st.total_present}</td>
        <td>${st.total_absent}</td>
        <td>
          <select class="attendance-status-select form-select" data-student-id="${st.id}">
            <option value="present" ${st.today_status === 'present' ? 'selected' : ''}>Присутствует</option>
            <option value="absent" ${st.today_status === 'absent' ? 'selected' : ''}>Отсутствует</option>
            <option value="late" ${st.today_status === 'late' ? 'selected' : ''}>Опоздал</option>
            <option value="sick" ${st.today_status === 'sick' ? 'selected' : ''}>Болезнь</option>
            <option value="" ${!st.today_status ? 'selected' : ''}>Не отмечено</option>
          </select>
        </td>
        <td>
          <input type="text" class="attendance-note-input form-input" data-student-id="${st.id}"
                 value="${st.today_notes || ''}" placeholder="Примечание">
        </td>
      </tr>
    `;
  }).join('');
};

const saveAttendanceModal = async () => {
  if (!curSchedId) return;
  
  const sts = curStudData.map(s => ({
    student_id: s.id,
    status: $(`.attendance-status-select[data-student-id="${s.id}"]`).value || 'present',
    notes: $(`.attendance-note-input[data-student-id="${s.id}"]`).value || ''
  })).filter(x => x.status);
  
  if (sts.length === 0) {
    showAlert('Отметьте хотя бы одного', 'error');
    return;
  }
  
  try {
    const rs = await fetch(`${API}/schedule/${curSchedId}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ students: sts })
    });
    
    if (!rs.ok) throw new Error('Ошибка');
    const dt = await rs.json();
    showAlert(dt.message || 'Сохранено', 'success');
    closeAttendanceModal();
    loadSchedule();
  } catch (er) {
    showAlert('Ошибка: ' + er.message, 'error');
  }
};

const closeAttendanceModal = () => {
  const md = $('#attendance-modal');
  if (md) {
    md.style.display = 'none';
    curSchedId = null;
    curStudData = [];
  }
};

window.addEventListener('click', e => {
  const sm = $('#schedule-modal'), am = $('#attendance-modal'), fm = $('#forgot-modal');
  if (e.target === sm) sm.style.display = 'none';
  if (e.target === am) closeAttendanceModal();
  if (e.target === fm) fm.style.display = 'none';
});

// Журнал
const loadAttendance = async () => {
  const u = getUser(), tk = getToken(), gf = $('#group-filter')?.value || '';
  try {
    let url = `${API}/attendance`;
    if (u.role === 'student') url += `?student_id=${u.id}`;
    else if (gf) url += `?group_name=${encodeURIComponent(gf)}`;
    
    const rs = await fetch(url, {
      headers: { 'Authorization': `Bearer ${tk}` }
    });
    const dt = await rs.json();
    const tb = $('#attendance-body');
    
    if (tb) {
      tb.innerHTML = dt.length ? dt.map(r => `
        <tr>
          <td>${new Date(r.date).toLocaleDateString('ru-RU')}</td>
          <td>${r.student_name || '-'}</td>
          <td>${r.group_name || '-'}</td>
          <td>${getStatusBadge(r.status)}</td>
          <td>${r.notes || '-'}</td>
        </tr>
      `).join('') : '<tr><td colspan="5" class="text-center">Нет записей</td></tr>';
    }
  } catch (er) {
    console.error(er);
  }
};

const loadStudents = async () => {
  const sl = $('#student-select');
  if (!sl) return;
  try {
    const rs = await fetch(`${API}/auth/users/students`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const dt = await rs.json();
    sl.innerHTML = '<option value="">Выберите студента</option>' +
      dt.map(s => `<option value="${s.id}">${s.full_name} (${s.group_name || 'Без группы'})</option>`).join('');
  } catch (er) {
    sl.innerHTML = '<option>Ошибка</option>';
  }
};

const setupMarkAttendance = () => {
  const fm = $('#mark-attendance-form');
  if (!fm) return;
  const di = $('#attendance-date');
  if (di) di.value = new Date().toISOString().split('T')[0];
  
  fm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dt = {
      student_id: parseInt($('#student-select').value),
      date: $('#attendance-date').value,
      status: $('#status-select').value,
      notes: $('#attendance-note').value
    };
    
    if (!dt.student_id) {
      showAlert('Выберите студента', 'error');
      return;
    }
    
    try {
      const rs = await fetch(`${API}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(dt)
      });
      
      if (!rs.ok) throw new Error('Ошибка');
      showAlert('Отмечено', 'success');
      fm.reset();
      if (di) di.value = new Date().toISOString().split('T')[0];
    } catch (er) {
      showAlert('Ошибка: ' + er.message, 'error');
    }
  });
};

// Админ (Создание пользователей)
const setupAdminForm = () => {
  const fm = $('#create-user-form');
  if (!fm) return;
  
  fm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dt = {
      email: $('#new-email').value.trim().toLowerCase(),
      password: $('#new-password').value,
      full_name: $('#new-name').value.trim(),
      role: $('#new-role').value,
      group_name: $('#new-group').value.trim() || null
    };
    
    try {
      const rs = await fetch(`${API}/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(dt)
      });
      
      if (!rs.ok) {
        const er = await rs.json();
        throw new Error(er.error || 'Ошибка');
      }
      showAlert('Пользователь создан', 'success');
      fm.reset();
    } catch (er) {
      showAlert(er.message, 'error');
    }
  });
};

// ОТЧЕТЫ + ГРАФИКИ + РЕЙТИНГ
const loadReports = async () => {
  const c = $('#reports-content');
  if (!c) return;
  
  const u = getUser(), gf = $('#report-group-filter')?.value || '';
  
  try {
    let url = `${API}/reports/attendance-summary`;
    if (gf) url += `?group_name=${encodeURIComponent(gf)}`;
    
    const rs = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    
    if (!rs.ok) throw new Error(`Ошибка сервера: ${rs.status}`);
    const dt = await rs.json();
    
    console.log('📊 Данные для графиков:', dt);
    
    if (dt.length === 0) {
      c.innerHTML = '<div class="empty-state"><p>Нет данных. Отметьте посещаемость или запустите SQL-скрипт.</p></div>';
      return;
    }

    // Подсчет суммарных статусов
    const totals = dt.reduce((acc, r) => ({
      present: acc.present + (parseInt(r.present) || 0),
      absent: acc.absent + (parseInt(r.absent) || 0),
      late: acc.late + (parseInt(r.late) || 0),
      sick: acc.sick + (parseInt(r.sick) || 0)
    }), { present: 0, absent: 0, late: 0, sick: 0 });

    // Рендер таблицы
    let html = `
      <div class="stats-row">
        <div class="stat-card success">
          <div class="stat-icon">✓</div>
          <div class="stat-content">
            <div class="stat-value">${totals.present}</div>
            <div class="stat-label">Присутствия</div>
          </div>
        </div>
        <div class="stat-card danger">
          <div class="stat-icon">✕</div>
          <div class="stat-content">
            <div class="stat-value">${totals.absent}</div>
            <div class="stat-label">Пропуски</div>
          </div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon">!</div>
          <div class="stat-content">
            <div class="stat-value">${totals.late + totals.sick}</div>
            <div class="stat-label">Опоздания/Болезнь</div>
          </div>
        </div>
      </div>
      <div class="table-wrapper" style="margin-top:2rem;">
        <table class="data-table">
          <thead>
            <tr><th>ФИО</th><th>Группа</th><th>Присутствовал</th><th>Отсутствовал</th><th>Болезнь</th><th>Опоздал</th><th>%</th></tr>
          </thead>
          <tbody>
            ${dt.map(r => `
              <tr>
                <td>${r.full_name}</td>
                <td>${r.group_name || '-'}</td>
                <td><span class="badge badge-success">${r.present || 0}</span></td>
                <td><span class="badge badge-danger">${r.absent || 0}</span></td>
                <td><span class="badge badge-warning">${r.sick || 0}</span></td>
                <td><span class="badge badge-info">${r.late || 0}</span></td>
                <td><strong>${r.attendance_percent || 0}%</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    c.innerHTML = html;
    
    // Запуск графиков и рейтинга
    initCharts(dt);
    recalcRating();
    
  } catch (err) {
    console.error('Ошибка отчетов:', err);
    c.innerHTML = `<div class="alert alert-error">Ошибка: ${err.message}</div>`;
  }
};

if ($('#group-filter')) $('#group-filter').addEventListener('change', loadAttendance);
if ($('#report-group-filter')) $('#report-group-filter').addEventListener('change', loadReports);

const exportReport = async (ty) => {
  try {
    const rs = await fetch(`${API}/reports/export/${ty}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    
    if (!rs.ok) throw new Error('Ошибка экспорта');
    const bl = await rs.blob();
    const ur = window.URL.createObjectURL(bl);
    const a = document.createElement('a');
    a.href = ur;
    a.download = `attendance.${ty === 'excel' ? 'xlsx' : 'pdf'}`;
    a.click();
    showAlert('Файл скачан', 'success');
  } catch (er) {
    showAlert(er.message, 'error');
  }
};

// ГРАФИКИ (Chart.js)
let stChart, grChart;

const initCharts = (data) => {
  const c1 = $('#statusChart')?.getContext('2d');
  const c2 = $('#groupChart')?.getContext('2d');
  if (!c1 || !c2) return;
  
  if (window.stChart) window.stChart.destroy();
  if (window.grChart) window.grChart.destroy();

  // Подсчет итогов
  const totals = data.reduce((acc, r) => ({
    present: acc.present + (parseInt(r.present) || 0),
    absent: acc.absent + (parseInt(r.absent) || 0),
    late: acc.late + (parseInt(r.late) || 0),
    sick: acc.sick + (parseInt(r.sick) || 0)
  }), { present: 0, absent: 0, late: 0, sick: 0 });

  // 1. Круговая диаграмма
  window.stChart = new Chart(c1, {
    type: 'pie',
    data: {
      labels: ['Присутствует', 'Отсутствует', 'Опоздал', 'Болезнь'],
      datasets: [{
        data: [totals.present, totals.absent, totals.late, totals.sick],
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // 2. Столбчатая диаграмма по группам
  const groupData = {};
  data.forEach(r => {
    if (r.group_name) {
      groupData[r.group_name] = (groupData[r.group_name] || 0) + (parseInt(r.present) || 0);
    }
  });

  window.grChart = new Chart(c2, {
    type: 'bar',
    data: {
      labels: Object.keys(groupData),
      datasets: [{
        label: 'Посещений',
        data: Object.values(groupData),
        backgroundColor: '#2563eb'
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
};

// РЕЙТИНГ
const loadRating = async () => {
  try {
    const rs = await fetch(`${API}/ratings`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const dt = await rs.json();
    
    if ($('#rating-body')) {
      $('#rating-body').innerHTML = dt.map((r, i) => `
        <tr>
          <td>${i+1}</td>
          <td>${r.full_name}</td>
          <td>${r.group_name || '-'}</td>
          <td><strong>${r.rating_points}</strong></td>
        </tr>
      `).join('');
    }
  } catch (er) {
    console.error('Ошибка загрузки рейтинга:', er);
  }
};

const recalcRating = async () => {
  try {
    const rs = await fetch(`${API}/ratings/recalculate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const dt = await rs.json();
    showAlert(dt.message, 'success');
    loadRating();
  } catch (er) {
    showAlert(er.message, 'error');
  }
};

// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
const showForgot = () => { $('#forgot-modal').style.display = 'flex'; };
const closeForgot = () => { $('#forgot-modal').style.display = 'none'; };

const requestReset = async () => {
  const em = $('#reset-email').value;
  try {
    const rs = await fetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em })
    });
    const dt = await rs.json();
    showAlert(dt.message, 'success');
    closeForgot();
  } catch (er) {
    showAlert(er.message, 'error');
  }
};

const getStatusBadge = (s) => ({
  present: '<span class="badge badge-success">Присутствует</span>',
  absent: '<span class="badge badge-danger">Отсутствует</span>',
  late: '<span class="badge badge-warning">Опоздал</span>',
  sick: '<span class="badge badge-warning">Болезнь</span>'
}[s] || s);

const loadGroupsFilter = async () => {
  try {
    const rs = await fetch(`${API}/reports/attendance-summary`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const dt = await rs.json();
    const gr = [...new Set(dt.map(s => s.group_name).filter(Boolean))];
    const html = '<option value="">Все группы</option>' +
      gr.map(g => `<option value="${g}">${g}</option>`).join('');
    
    if ($('#group-filter')) $('#group-filter').innerHTML = html;
    if ($('#report-group-filter')) $('#report-group-filter').innerHTML = html;
  } catch (er) {
    console.error(er);
  }
};

const loadNotifications = async () => {
  const u = getUser(), c = $('#notifications-content');
  if (!c || !u) return;
  
  try {
    const rs = await fetch(`${API}/notifications/${u.id}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const dt = await rs.json();
    
    if (dt.length === 0) {
      c.innerHTML = '<div class="empty-state"><div class="empty-icon">🔔</div><h3>Нет уведомлений</h3></div>';
      return;
    }
    
    c.innerHTML = dt.map(n => `
      <div class="info-row">
        <div>
          <div style="font-weight:600">${n.message}</div>
          <div style="font-size:0.85rem;color:var(--text-secondary)">
            ${new Date(n.created_at).toLocaleString('ru-RU')}
          </div>
        </div>
        <span class="badge ${n.is_read ? 'badge-success' : 'badge-warning'}">
          ${n.is_read ? 'Прочитано' : 'Новое'}
        </span>
      </div>
    `).join('');
  } catch (er) {
    c.innerHTML = '<div class="alert alert-error">Ошибка</div>';
  }
};

// Инициализация
const init = () => {
  initTheme();
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
  setupAuth();
  
  // Обработчик для кнопки "Забыли пароль"
  $('#forgot-password-link')?.addEventListener('click', showForgot);
  
  const tk = getToken(), us = getUser();
  if (tk && us) setTimeout(() => renderDashboard(), 100);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}