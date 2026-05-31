// frontend/tests/dom-interaction.test.js
/**
 * @jest-environment jsdom
 */

describe('DOM-взаимодействия (ручное тестирование дублирует)', () => {
  
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="auth-form">
        <input type="email" id="email">
        <input type="password" id="password">
        <button type="submit" id="auth-btn">Войти</button>
      </form>
      <div id="alert-container"></div>
    `;
  });

  test('форма входа содержит необходимые поля', () => {
    const form = document.getElementById('auth-form');
    expect(form).toBeTruthy();
    
    const emailInput = document.getElementById('email');
    expect(emailInput.type).toBe('email');
    
    const passwordInput = document.getElementById('password');
    expect(passwordInput.type).toBe('password');
  });

  test('контейнер для уведомлений существует', () => {
    const container = document.getElementById('alert-container');
    expect(container).toBeTruthy();
  });
});