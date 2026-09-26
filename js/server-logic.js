// /js/server-logic.js

/**
 * Логіка відображення статусу локального сервера та IP-адреси пристрою
 */

async function setupServerDisplay() {
    try {
        const { Network } = Capacitor.Plugins;

        // 1. Створюємо або знаходимо контейнер для IP в DOM
        let display = document.getElementById('device-ip-display');
        if (!display) {
            display = document.createElement('div');
            display.id = 'device-ip-display';
            // Стилізація через JS (або додай в CSS)
            Object.assign(display.style, {
                position: 'fixed',
                bottom: '10px',
                left: '10px',
                zIndex: '1000',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '5px',
                fontSize: '11px',
                fontFamily: 'monospace',
                pointerEvents: 'none'
            });
            document.body.appendChild(display);
        }

        // 2. Отримуємо статус мережі
        const status = await Network.getStatus();

        if (status.connected) {
            // Визначаємо локальний IP через RTCPeerConnection (WebRTC hack)
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel("");
            pc.createOffer().then(o => pc.setLocalDescription(o));
            pc.onicecandidate = (ice) => {
                if (ice && ice.candidate && ice.candidate.candidate) {
                    const ipMatch = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate);
                    if (ipMatch) {
                        const ip = ipMatch[1];
                        display.innerHTML = `<span style="color: #00ff00; animation: blink 1s infinite;">●</span> SERVER: ${ip}:8080`;
                        
                        // Оновлюємо текстові поля в UI, якщо вони існують
                        const ipAddressEl = document.getElementById('ip-address');
                        if (ipAddressEl) ipAddressEl.innerText = `${ip}:8080`;
                        
                        pc.onicecandidate = null;
                    }
                }
            };
        } else {
            display.innerHTML = `<span style="color: red;">●</span> OFFLINE`;
        }
    } catch (e) {
        console.warn("Server Logic: Capacitor Network plugin not ready or desktop mode.");
    }
}

/**
 * Оновлення візуальних елементів (точки, кнопок), якщо вони є в HTML
 */
function updateServerUI(active) {
    const dot = document.getElementById('status-dot');
    const btn = document.getElementById('toggle-server-btn');
    const statusText = document.getElementById('status-text');

    if (dot) dot.style.backgroundColor = active ? "#28a745" : "#dc3545";
    if (btn) btn.innerText = active ? "Сервер активний (Native)" : "Сервер вимкнено";
    if (statusText) statusText.innerText = active ? "Сервер працює (Native)" : "Сервер офлайн";
}

// Ініціалізація при завантаженні
window.addEventListener('load', () => {
    // Запускаємо через 1.5 секунди, щоб Capacitor встиг прокинутись
    setTimeout(() => {
        setupServerDisplay();
        updateServerUI(navigator.onLine);
    }, 1500);
});

// Додаємо обробник кліку на кнопку (якщо вона є)
const serverBtn = document.getElementById('toggle-server-btn');
if (serverBtn) {
    serverBtn.addEventListener('click', () => {
        alert("Нативний сервер керується автоматично системою Android при запуску додатку.");
    });
}