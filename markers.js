// markers.js - Модуль для керування відмітками користувачів

const UserMarkers = {
    isUserLoggedIn: false, // Тут має бути перевірка через вашу систему авторизації
    activeMarkers: [],

    init(map) {
        this.map = map;
        this.setupMapListeners();
    },

    setupMapListeners() {
        // Додаємо обробку довгого кліку або кліку з клавішею Alt для встановлення мітки
        this.map.on('click', (e) => {
            if (!this.isUserLoggedIn) return; // Якщо не залогінений - нічого не робимо

            // Створюємо кастомне вікно (Popup) для вибору статусу
            const coords = e.lngLat;
            this.showStatusPicker(coords);
        });
    },

    showStatusPicker(coords) {
        const html = `
            <div class="marker-picker">
                <button onclick="UserMarkers.saveMarker('${coords.lng}', '${coords.lat}', 'stop')">🛑 Не заходити</button>
                <button onclick="UserMarkers.saveMarker('${coords.lng}', '${coords.lat}', 'away')">🏠 Нема вдома</button>
            </div>
        `;

        new mapboxgl.Popup()
            .setLngLat(coords)
            .setHTML(html)
            .addTo(this.map);
    },

    async saveMarker(lng, lat, type) {
        const markerData = {
            lng: parseFloat(lng),
            lat: parseFloat(lat),
            type: type,
            town: window.currentTownSlug // беремо з основного скрипта
        };

        try {
            // Відправка в БД (приклад)
            const response = await fetch('/api/save-marker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(markerData)
            });

            if (response.ok) {
                this.renderMarkerOnMap(markerData);
            }
        } catch (err) {
            console.error("Помилка збереження:", err);
        }
    },

    renderMarkerOnMap(data) {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerText = data.type === 'stop' ? '🛑' : '🏠';
        el.style.fontSize = '20px';
        el.style.cursor = 'pointer';

        new mapboxgl.Marker(el)
            .setLngLat([data.lng, data.lat])
            .addTo(this.map);
    }
};