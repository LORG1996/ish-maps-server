// /js/auth.js

const CUSTOM_PASSWORD_KEY = 'territory_custom_password';
const MASTER_PASSWORD = '1914';

// Перевірка статусу авторизації при завантаженні
window.checkAuthStatus = async function() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }

    // Приховуємо кнопку зміни пароля, якщо власний пароль уже було встановлено раніше
    const changePassBtn = document.getElementById('set-custom-password-btn');
    if (changePassBtn && localStorage.getItem(CUSTOM_PASSWORD_KEY)) {
        changePassBtn.style.display = 'none';
    }
};

// Обробка натискання кнопки «Увійти»
window.handleAuthSubmit = function() {
    const passwordInput = document.getElementById('auth-password-input');
    if (!passwordInput) return;

    const enteredPassword = passwordInput.value.trim();
    const savedCustomPassword = localStorage.getItem(CUSTOM_PASSWORD_KEY);

    if (enteredPassword === MASTER_PASSWORD || (savedCustomPassword && enteredPassword === savedCustomPassword)) {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.style.display = 'none';

        passwordInput.value = '';

        const town = new URLSearchParams(window.location.search).get('town') || 'berezhnytsia';
        if (typeof window.loadUserMarkers === 'function') {
            window.loadUserMarkers(town);
        }
    } else {
        alert("Невірний пароль! Спробуйте ще раз.");
        passwordInput.value = '';
    }
};

// Функція для первинного встановлення власного пароля
window.setCustomPassword = function() {
    // Додаткова перевірка на випадок, якщо кнопка якось залишилась
    if (localStorage.getItem(CUSTOM_PASSWORD_KEY)) {
        alert("Власний пароль уже було встановлено раніше на цьому пристрої.");
        return;
    }

    const newPass = prompt("Введіть новий персональний пароль для цього пристрою (він назавжди замінить стандартний для цього додатка):");
    if (newPass === null) return;

    const trimmed = newPass.trim();
    if (trimmed.length < 3) {
        alert("Пароль занадто короткий! Мінімум 3 символи.");
        return;
    }

    localStorage.setItem(CUSTOM_PASSWORD_KEY, trimmed);
    alert(`Успішно! Персональний пароль збережено. Кнопка встановлення більше не з'являтиметься.`);

    // Одразу ховаємо кнопку після встановлення
    const changePassBtn = document.getElementById('set-custom-password-btn');
    if (changePassBtn) {
        changePassBtn.style.display = 'none';
    }
};

// Автоматична перевірка при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.checkAuthStatus, 300);
});