// /js/map-core.js

window.isOfflineSatellite = false; 
window.isStyleSwitching = false; // Прапор для блокування подвійних запитів

// 1. Ініціалізація карти
window.map = new mapboxgl.Map({
    container: 'map',
    style: window.offlineStyle, 
    center: [24.1848, 49.3370],
    zoom: 14,
    antialias: true
});

// 2. Функція перемикання стилів (Схема/Супутник)
window.toggleMapStyle = function() {
    if (!window.map || window.isStyleSwitching) return;
    
    window.isStyleSwitching = true;
    const btn = document.getElementById('map-style-toggle');

    const currentParams = {
        center: window.map.getCenter(),
        zoom: window.map.getZoom(),
        bearing: window.map.getBearing(),
        pitch: window.map.getPitch()
    };

    window.isOfflineSatellite = !window.isOfflineSatellite;
    const nextStyle = window.isOfflineSatellite ? window.offlineSatelliteStyle : window.offlineStyle;
    
    if (btn) btn.innerHTML = window.isOfflineSatellite ? '<span>🗺️</span>' : '<span>🛰️</span>';

    // Встановлюємо новий стиль
    window.map.setStyle(nextStyle);

    // Функція перевірки та відновлення шарів після зміни стилю
    const checkStyleLoadedAndRestore = () => {
        if (window.map.isStyleLoaded()) {
            console.log("Новий стиль повністю завантажено. Відновлюємо полігони та мітки...");

            window.map.jumpTo(currentParams);

            const urlParams = new URLSearchParams(window.location.search);
            const slug = urlParams.get('town');

            if (slug) {
                // Невелика затримка для гарантованого рендерингу геометрії
                setTimeout(async () => {
                    if (typeof window.renderVillageLayers === 'function') {
                        await window.renderVillageLayers(slug);
                    }
                    if (typeof window.loadUserMarkers === 'function') {
                        window.loadUserMarkers(slug);
                    }
                    window.isStyleSwitching = false;
                }, 150);
            } else {
                window.isStyleSwitching = false;
            }
        } else {
            // Якщо стиль ще не до кінця завантажився, перевіряємо знову через невеликий інтервал
            setTimeout(checkStyleLoadedAndRestore, 50);
        }
    };

    // Чекаємо на першу подію 'styledata', а потім запускаємо надійну перевірку готовності
    window.map.once('styledata', () => {
        setTimeout(checkStyleLoadedAndRestore, 100);
    });
};

// 3. Основні події при завантаженні
window.map.on('load', () => {
    // Навігація (Zoom, Compass)
    const nav = new mapboxgl.NavigationControl({ showCompass: true, showZoom: true });
    window.map.addControl(nav, 'top-right');

    // GPS (Геолокація)
    window.geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true
    });
    window.map.addControl(window.geolocate, 'top-right');

    // --- ЛОГІКА КЛІКІВ ТА ТАЧІВ ---

    // Звичайний клік
    window.map.on('click', (e) => {
        if (e.originalEvent.target.closest('.emoji-marker')) return;

        const sb = document.getElementById('towns-sidebar');
        if (sb && !sb.classList.contains('collapsed') && window.innerWidth < 768) {
            if (typeof window.toggleSidebar === 'function') window.toggleSidebar();
            return;
        }

        if (typeof window.showStatusPopup === 'function') window.showStatusPopup(e.lngLat);
    });

    // Правий клік (для ПК)
    window.map.on('contextmenu', (e) => {
        if (typeof window.showStatusPopup === 'function') window.showStatusPopup(e.lngLat);
    });

    // Довге натискання (Long Press для сенсорних екранів)
    let pressTimer;
    window.map.on('touchstart', (e) => {
        if (e.points && e.points.length > 1) { 
            clearTimeout(pressTimer); 
            return; 
        }
        pressTimer = setTimeout(() => {
            if (typeof window.showStatusPopup === 'function') window.showStatusPopup(e.lngLat);
        }, 600);
    });

    window.map.on('touchend', () => clearTimeout(pressTimer));
    window.map.on('touchmove', () => clearTimeout(pressTimer));

    // Подія про готовність карти
    document.dispatchEvent(new Event('mapLoaded'));
});