// ui-logic.js

window.layersConfig = [];
window.isOfflineStyle = true;
window.currentTownName = "вибрану територію";
window.cachedLocations = null; // Кеш для пошуку

// Допоміжна функція для захисту від XSS
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.getCurrentTownSlug = function() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('town') || null;
};

window.collectAndSaveMarker = function(lng, lat, type) {
    const streetInput = document.getElementById('marker-street-input');
    const houseInput = document.getElementById('marker-house-input');
    const territoryInput = document.getElementById('marker-territory-input');
    const commentInput = document.getElementById('marker-comment-input');

    const street = streetInput ? streetInput.value.trim() : '';
    const house = houseInput ? houseInput.value.trim() : '';
    const territory = territoryInput ? territoryInput.value.trim() : ''; 
    const comment = commentInput ? commentInput.value.trim() : '';
    
    const currentTown = window.getCurrentTownSlug();

    // Збираємо аудіо з глобальних змінних аудіо-модуля
    let audioToSend = window.recordedAudioBase64 || null;

    if (typeof window.saveMarkerToDB === 'function') {
        window.saveMarkerToDB(
            lng, 
            lat, 
            type, 
            comment, 
            street, 
            house, 
            territory, 
            audioToSend || window.recordedAudioBlob, 
            window.recordedAudioDuration || 0,
            currentTown
        );
    }
};

// --- 1. МЕНЮ ВИБОРУ СТАТУСУ ---
window.showStatusPopup = function(lngLat) {
    if (!window.map) return;

    // Зупиняємо попередній запис та очищаємо аудіо-ресурси при відкритті нового попапу
    if (typeof window.cleanupAudioResources === 'function') {
        window.cleanupAudioResources();
    }

    window.recordedAudioBlob = null;
    window.recordedAudioBase64 = null;
    window.recordedAudioDuration = 0;

    const inputStyle = `
        height: 44px;
        padding: 0 12px;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        font-size: 15px;
        box-sizing: border-box;
        outline: none;
        background: #f8fafc;
        color: #0f172a;
        width: 100%;
    `;

    const btnStatusStyle = `
        height: 50px;
        flex: 1;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.12);
        transition: transform 0.1s active, opacity 0.2s;
    `;

    const html = `
        <div class="status-picker-mobile" style="
            display: flex; 
            flex-direction: column; 
            gap: 10px; 
            padding: 0; 
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            width: 260px;
            box-sizing: border-box;
            overflow: hidden;
        ">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                <span style="font-weight: 700; font-size: 15px; color: #1e293b;">
                    📍 Нова мітка
                </span>
            </div>
            
            <div style="display: flex; gap: 6px; width: 100%;">
                <input type="text" id="marker-street-input" placeholder="Вулиця" style="${inputStyle} flex: 2; min-width: 0;">
                <input type="text" id="marker-house-input" placeholder="№" style="${inputStyle} flex: 1; min-width: 0; text-align: center; padding: 0 4px;">
                <input type="text" id="marker-territory-input" placeholder="Тер." style="${inputStyle} flex: 1; min-width: 0; text-align: center; padding: 0 4px;" title="Номер території">
            </div>

            <input type="text" id="marker-comment-input" placeholder="Коментар або нотатка..." style="${inputStyle}">

            <!-- БЛОК ЗАПИСУ ГОЛОСУ -->
            <div style="
                background: #f8fafc; 
                border: 2px dashed #cbd5e1; 
                border-radius: 10px; 
                padding: 8px 10px; 
                display: flex; 
                align-items: center; 
                justify-content: space-between;
                gap: 6px;
                box-sizing: border-box;
                width: 100%;
            ">
                <span id="audio-status" style="font-size: 13px; color: #475569; font-weight: 600; white-space: nowrap;">
                    🎙️ Голос
                </span>
                
                <button id="rec-btn-start" type="button" style="
                    height: 38px;
                    padding: 0 12px;
                    background: #10b981; 
                    color: white; 
                    border: none; 
                    border-radius: 8px; 
                    font-size: 13px; 
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                ">
                    🔴 Запис
                </button>

                <button id="rec-btn-stop" type="button" style="
                    height: 38px;
                    padding: 0 12px;
                    background: #ef4444; 
                    color: white; 
                    border: none; 
                    border-radius: 8px; 
                    font-size: 13px; 
                    font-weight: 600;
                    cursor: pointer; 
                    display: none;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                ">
                    ⏹️ Стоп
                </button>
            </div>

            <!-- КНОПКИ СТАТУСІВ -->
            <div style="display: flex; gap: 8px; margin-top: 2px; width: 100%;">
                <button id="btn-status-not-home" style="${btnStatusStyle} background: #f59e0b;" title="Нема вдома">
                    🔒
                </button>
                
                <button id="btn-status-visit" style="${btnStatusStyle} background: #10b981;" title="Повторний візит">
                    🔁
                </button>
                
                <button id="btn-status-stop" style="${btnStatusStyle} background: #ef4444;" title="Не заходити">
                    🚫
                </button>
            </div>
        </div>
    `;

    const activePopups = document.getElementsByClassName('mapboxgl-popup');
    while (activePopups[0]) activePopups[0].remove();

    const popup = new mapboxgl.Popup({ offset: 12, closeButton: true })
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(window.map);

    const popupNode = popup.getElement();

    const btnStart = popupNode.querySelector('#rec-btn-start');
    const btnStop = popupNode.querySelector('#rec-btn-stop');
    const btnNotHome = popupNode.querySelector('#btn-status-not-home');
    const btnVisit = popupNode.querySelector('#btn-status-visit');
    const btnStopStatus = popupNode.querySelector('#btn-status-stop');

    if (btnStart) btnStart.onclick = () => window.startAudioRecording && window.startAudioRecording();
    if (btnStop) btnStop.onclick = () => window.stopAudioRecording && window.stopAudioRecording();

    // --- НАДІЙНИЙ АВТОСТОП ЗАПИСУ ПРИ НАТИСКАННІ СТАТУСУ ---
    const handleSave = (type) => {
        let isRecordingActive = false;

        // Перевіряємо різні можливі стани активності запису у вашому проєкті
        if (window.mediaRecorder && window.mediaRecorder.state === 'recording') {
            isRecordingActive = true;
        } else if (btnStop && window.getComputedStyle(btnStop).display !== 'none') {
            // Якщо кнопка "Стоп" зараз видима на екрані — значить запис йде
            isRecordingActive = true;
        }

        if (isRecordingActive && typeof window.stopAudioRecording === 'function') {
            // Викликаємо зупинку запису
            window.stopAudioRecording();
            
            // Даємо невелику паузу (300мс), щоб браузер встиг згенерувати Blob та зберегти в змінні,
            // і тільки після цього відправляємо мітку на сервер
            setTimeout(() => {
                window.collectAndSaveMarker(lngLat.lng, lngLat.lat, type);
            }, 300);
        } else {
            // Якщо запис не йшов, зберігаємо одразу
            window.collectAndSaveMarker(lngLat.lng, lngLat.lat, type);
        }
    };

    if (btnNotHome) btnNotHome.onclick = () => handleSave('not_home');
    if (btnVisit) btnVisit.onclick = () => handleSave('visit');
    if (btnStopStatus) btnStopStatus.onclick = () => handleSave('stop');

    popup.on('close', () => {
        if (window.mediaRecorder && window.mediaRecorder.state === 'recording') {
            window.stopAudioRecording();
        } else if (typeof window.cleanupAudioResources === 'function') {
            window.cleanupAudioResources();
        }
    });
};

// --- 2. ПОШУК ---
window.initSearch = async function() {
    const searchInput = document.getElementById('location-search');
    const resultsContainer = document.getElementById('search-results');
    if (!searchInput || !resultsContainer) return;

    try {
        if (!window.cachedLocations) {
            const response = await fetch('data/locations.json');
            window.cachedLocations = await response.json();
        }

        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            resultsContainer.innerHTML = ''; 
            
            if (term.length === 0) { 
                resultsContainer.style.display = 'none'; 
                return; 
            }

            let filtered = window.cachedLocations.filter(loc => loc.name.toLowerCase().includes(term));
            
            if (window.townConfig) {
                Object.entries(window.townConfig).forEach(([slug, data]) => {
                    const isIdMatch = data.layerIds && data.layerIds.some(id => 
                        id.replace('obj-', '') === term || id.toLowerCase() === term
                    );
                    if (isIdMatch && !filtered.some(f => f.name === data.name)) {
                        filtered.push({ name: data.name, coords: data.coords, zoom: data.zoom, matchedById: true });
                    }
                });
            }

            if (filtered.length > 0) {
                resultsContainer.style.display = 'block';
                filtered.forEach(loc => {
                    const item = document.createElement('div');
                    item.className = 'search-item';
                    item.style.padding = '14px 16px';
                    item.style.fontSize = '16px';
                    item.style.cursor = 'pointer';

                    const safeName = escapeHTML(loc.name);
                    const safeTerm = escapeHTML(term);

                    item.innerHTML = loc.matchedById 
                        ? `<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                           <span>📍 ${safeName}</span>
                           <span style="font-size:12px; background:#7b4c7c; color:white; padding:4px 10px; border-radius:12px;">№${safeTerm}</span>
                           </div>`
                        : `<span>📍 ${safeName}</span>`;

                    item.onclick = () => {
                        const entry = Object.entries(window.townConfig || {}).find(([key, val]) => val.name === loc.name);
                        const slug = entry ? entry[0] : null;
                        window.map.flyTo({ center: loc.coords, zoom: loc.zoom || 15, essential: true });
                        if (slug) { 
                            window.updateURL(slug, loc.name); 
                            window.renderVillageLayers(slug); 
                        }
                        searchInput.value = loc.name;
                        resultsContainer.style.display = 'none';
                        searchInput.blur();
                    };
                    resultsContainer.appendChild(item);
                });
            } else { 
                resultsContainer.style.display = 'none'; 
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        });
    } catch (err) { 
        console.warn("Search init error:", err); 
    }
};

// --- 3. САЙДБАР ---
window.initTownsSidebar = function() {
    const listContainer = document.getElementById('towns-list');
    if (!listContainer || !window.townConfig) return;

    listContainer.innerHTML = ''; 
    const sorted = Object.entries(window.townConfig).sort((a, b) => a[1].name.localeCompare(b[1].name));
    
    sorted.forEach(([slug, data]) => {
        const item = document.createElement('div');
        item.className = 'town-item';
        item.style.padding = '16px';
        item.style.fontSize = '16px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid #f1f5f9';
        item.textContent = data.name;
        item.onclick = () => {
            window.map.flyTo({ center: data.coords, zoom: data.zoom, essential: true });
            window.updateURL(slug, data.name);
            window.renderVillageLayers(slug);
            if (window.innerWidth < 768) window.toggleSidebar();
        };
        listContainer.appendChild(item);
    });
};

// --- 4. ВІДОБРАЖЕННЯ ШАРІВ ---
window.renderVillageLayers = async function(townSlug) {
    const townData = window.townConfig ? window.townConfig[townSlug] : null;
    if (!townData || !window.map) return;

    if (!window.layersConfig || window.layersConfig.length === 0) {
        try {
            const response = await fetch(`data/layers-config.json?v=${Date.now()}`);
            window.layersConfig = await response.json();
        } catch (e) { 
            console.error("Помилка завантаження layers-config:", e);
            return; 
        }
    }

    window.clearMapObjects();
    
    const activeLayers = window.layersConfig.filter(l => townData.layerIds.includes(l.id));
    const style = window.map.getStyle();
    let labelLayerId = null;
    
    if (style && style.layers) {
        const labelLayer = style.layers.find(l => 
            (l.type === 'symbol' && l.layout && l.layout['text-field']) || 
            l.id.includes('label')
        );
        if (labelLayer) labelLayerId = labelLayer.id;
    }

    activeLayers.forEach(layer => {
        const sourceId = `${layer.id}-source`;
        
        if (!window.map.getSource(sourceId)) {
            window.map.addSource(sourceId, { 
                'type': 'geojson', 
                'data': `${layer.file}?v=${Date.now()}`,
                'buffer': 0,
                'tolerance': 0.375
            });
        }

        const fillId = `${layer.id}-fill`;
        if (!window.map.getLayer(fillId)) {
            window.map.addLayer({
                'id': fillId, 
                'type': 'fill', 
                'source': sourceId,
                'filter': ['==', ['geometry-type'], 'Polygon'],
                'paint': { 
                    'fill-color': ['coalesce', ['get', 'fill-color'], '#cccccc'], 
                    'fill-opacity': 0.35 
                }
            }, labelLayerId);
        }

        const circleId = `${layer.id}-circle`;
        if (!window.map.getLayer(circleId)) {
            window.map.addLayer({
                'id': circleId, 
                'type': 'circle', 
                'source': sourceId,
                'filter': ['==', ['geometry-type'], 'Point'],
                'paint': { 
                    'circle-radius': 13, 
                    'circle-color': '#ffffff', 
                    'circle-stroke-width': 2, 
                    'circle-stroke-color': '#7b4c7c' 
                }
            }, labelLayerId);
        }

        const numberId = `${layer.id}-number`;
        if (!window.map.getLayer(numberId)) {
            window.map.addLayer({
                'id': numberId, 
                'type': 'symbol', 
                'source': sourceId,
                'filter': ['==', ['geometry-type'], 'Point'],
                'layout': додатиТекстовіНалаштування = { 
                    'text-field': ['to-string', ['get', 'label']], 
                    'text-size': 12, 
                    'text-allow-overlap': true,
                    'text-ignore-placement': true,
                    'text-font': ['Open Sans Bold']
                },
                'paint': { 
                    'text-color': '#000000',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1.5
                }
            }, labelLayerId);
        }
    });

    if (typeof window.loadUserMarkers === 'function') {
        window.loadUserMarkers(townSlug);
    }
};

window.clearMapObjects = function() {
    if (!window.map) return;
    const style = window.map.getStyle();
    if (!style) return;
    
    if (style.layers) {
        style.layers.forEach(l => {
            if (l.id.endsWith('-fill') || l.id.endsWith('-circle') || l.id.endsWith('-number')) {
                if (window.map.getLayer(l.id)) {
                    window.map.removeLayer(l.id);
                }
            }
        });
    }
    
    if (style.sources) {
        Object.keys(style.sources).forEach(sourceId => {
            if (sourceId.endsWith('-source')) {
                if (window.map.getSource(sourceId)) {
                    window.map.removeSource(sourceId);
                }
            }
        });
    }
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('towns-sidebar');
    const openBtn = document.getElementById('open-sidebar');
    if (!sidebar) return;
    
    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (openBtn) isCollapsed ? openBtn.classList.remove('hidden') : openBtn.classList.add('hidden');
    
    setTimeout(() => { if (window.map) window.map.resize(); }, 350);
};

window.updateURL = function(slug, name) {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('town', slug);
    window.history.pushState({}, '', newUrl.href);
    window.currentTownName = name;
};

document.addEventListener('mapLoaded', () => {
    window.initTownsSidebar();
    window.initSearch();
    
    const urlParams = new URLSearchParams(window.location.search);
    const startTown = urlParams.get('town');
    if (startTown && window.townConfig && window.townConfig[startTown]) {
        const data = window.townConfig[startTown];
        window.map.jumpTo({ center: data.coords, zoom: data.zoom });
        window.renderVillageLayers(startTown);
    }

    const openBtn = document.getElementById('open-sidebar');
    if (openBtn) openBtn.onclick = window.toggleSidebar;
    
    const closeBtn = document.getElementById('close-sidebar');
    if (closeBtn) closeBtn.onclick = window.toggleSidebar;
});

// --- ЕКСПОРТ ТІЛЬКИ МІТОК "НЕ ЗАХОДИТИ" ІЗ БАЗИ DEXIE У CSV ---
window.exportMarkersToCSV = async function() {
    let markers = [];

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const townSlug = urlParams.get('town') || window.currentTownSlug || 'berezhnytsia';

        if (window.db && window.db.markers) {
            markers = await window.db.markers.where('town_slug').equals(townSlug).toArray();
            if (!markers || markers.length === 0) {
                markers = await window.db.markers.toArray();
            }
        }
    } catch (e) {
        console.error("Помилка читання бази даних для експорту:", e);
    }

    if (!markers || markers.length === 0) {
        alert("Немає збережених міток у базі даних для цієї території!");
        return;
    }

    // Фільтруємо мітки: залишаємо тільки "Не заходити" (тип 'stop' або текст 'не заходити')
    markers = markers.filter(m => {
        const typeVal = (m.type || '').toString().trim().toLowerCase();
        return typeVal === 'stop' || typeVal === 'не заходити';
    });

    if (markers.length === 0) {
        alert("Не знайдено міток із типом \"Не заходити\" для експорту!");
        return;
    }

    // Допоміжна функція для перетворення Blob у Base64 рядок
    const convertBlobToBase64 = (blob) => {
        return new Promise((resolve) => {
            if (!blob) {
                resolve("");
                return;
            }
            if (typeof blob === 'string') {
                resolve(blob);
                return;
            }
            if (blob instanceof Blob) {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result || "");
                reader.onerror = () => resolve("");
                reader.readAsDataURL(blob);
            } else {
                resolve("");
            }
        });
    };

    // Заголовки CSV файлу
    let csvContent = "\uFEFF"; // BOM для коректного відображення кирилиці в Excel
    csvContent += "ID,Type,Street,House,Territory,Comment,Longitude,Latitude,Audio Duration (s),Created At,Audio Base64\n";

    // Проходимо по кожному відфільтрованому маркеру та асинхронно конвертуємо аудіо
    for (const m of markers) {
        const escapeCSV = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

        const townName = m.territory || m.town_slug || new URLSearchParams(window.location.search).get('town') || '';

        const rawAudio = m.audio_blob || m.audioBase64 || null;
        const base64Audio = await convertBlobToBase64(rawAudio);

        const row = [
            escapeCSV(m.id || ''),
            escapeCSV(m.type || ''),
            escapeCSV(m.street || ''),
            escapeCSV(m.house_number || m.house || ''),
            escapeCSV(townName),
            escapeCSV(m.comment || ''),
            m.lng || '',
            m.lat || '',
            m.audio_duration || m.audioDuration || 0,
            escapeCSV(m.created_at || m.createdAt || ''),
            escapeCSV(base64Audio)
        ];

        csvContent += row.join(",") + "\n";
    }

    const townNameSlug = new URLSearchParams(window.location.search).get('town') || window.currentTownSlug || 'export';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `markers_ne_zakhodyty_${townNameSlug}_${dateStr}.csv`;

    // Перевіряємо, чи ми у середовищі Capacitor (мобільний додаток)
    const isCapacitorNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

    if (isCapacitorNative) {
        try {
            const Filesystem = window.Capacitor.Plugins.Filesystem;
            const Share = window.Capacitor.Plugins.Share;

            if (!Filesystem || !Share) {
                throw new Error("Плагіни Filesystem або Share не знайдені в Capacitor. Перевір їх встановлення.");
            }

            const writeFileResult = await Filesystem.writeFile({
                path: fileName,
                data: csvContent,
                directory: 'CACHE',
                encoding: 'utf8'
            });

            await Share.share({
                title: 'Експорт міток "Не заходити"',
                text: `База міток "Не заходити" для території: ${townNameSlug}`,
                url: writeFileResult.uri,
                dialogTitle: 'Зберегти або надіслати файл CSV'
            });

        } catch (err) {
            console.error("Помилка мобільного експорту через Capacitor:", err);
            alert("Помилка збереження файлу на пристрої: " + err.message);
        }
    } else {
        // Стандартний веб-варіант (для браузера на ПК)
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// --- 6. ГЛОБАЛЬНИЙ ЕКСПОРТ ТА ІМПОРТ ВСІХ СЕЛ ---

window.exportAllMarkersToCSV = async function() {
    let markers = [];

    try {
        if (window.db && window.db.markers) {
            markers = await window.db.markers.toArray();
        }
    } catch (e) {
        console.error("Помилка читання бази даних для глобального експорту:", e);
    }

    if (!markers || markers.length === 0) {
        alert("У базі даних немає жодної мітки для експорту!");
        return;
    }

    const convertBlobToBase64 = (blob) => {
        return new Promise((resolve) => {
            if (!blob) {
                resolve("");
                return;
            }
            if (typeof blob === 'string') {
                resolve(blob);
                return;
            }
            if (blob instanceof Blob) {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result || "");
                reader.onerror = () => resolve("");
                reader.readAsDataURL(blob);
            } else {
                resolve("");
            }
        });
    };

    let csvContent = "\uFEFF";
    csvContent += "ID,Type,Street,House,Territory,TownSlug,Comment,Longitude,Latitude,Audio Duration (s),Created At,Audio Base64\n";

    for (const m of markers) {
        const escapeCSV = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        const rawAudio = m.audio_blob || m.audioBase64 || null;
        const base64Audio = await convertBlobToBase64(rawAudio);

        const row = [
            escapeCSV(m.id || ''),
            escapeCSV(m.type || ''),
            escapeCSV(m.street || ''),
            escapeCSV(m.house_number || m.house || ''),
            escapeCSV(m.territory || ''),
            escapeCSV(m.town_slug || ''),
            escapeCSV(m.comment || ''),
            m.lng || '',
            m.lat || '',
            m.audio_duration || m.audioDuration || 0,
            escapeCSV(m.created_at || m.createdAt || ''),
            escapeCSV(base64Audio)
        ];

        csvContent += row.join(",") + "\n";
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `all_villages_markers_${dateStr}.csv`;

    const isCapacitorNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

    if (isCapacitorNative) {
        try {
            const Filesystem = window.Capacitor.Plugins.Filesystem;
            const Share = window.Capacitor.Plugins.Share;

            if (!Filesystem || !Share) {
                throw new Error("Плагіни Filesystem або Share не знайдені.");
            }

            const writeFileResult = await Filesystem.writeFile({
                path: fileName,
                data: csvContent,
                directory: 'CACHE',
                encoding: 'utf8'
            });

            await Share.share({
                title: 'Глобальний експорт усіх сел',
                text: 'Повна база міток та аудіозаписів по всіх селах',
                url: writeFileResult.uri,
                dialogTitle: 'Зберегти або надіслати файл CSV'
            });

        } catch (err) {
            console.error("Помилка глобального експорту через Capacitor:", err);
            alert("Помилка збереження файлу на пристрої: " + err.message);
        }
    } else {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

window.importAllMarkersFromCSV = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("Увага! Імпорт додасть записи з файлу (з перевіркою на дублікати за координатами). Продовжити?")) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n');

        if (lines.length < 2) {
            alert("Файл порожній або має невірний формат!");
            return;
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const row = [];
            let inQuotes = false;
            let currentVal = '';

            for (let char of line) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    row.push(currentVal);
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            row.push(currentVal);

            // Перевіряємо довжину рядка для глобального формату (12 стовпців) або старого (11 стовпців)
            if (row.length >= 11) {
                const type = row[1] ? row[1].replace(/^"|"$/g, '').trim() : 'lock';
                const street = row[2] ? row[2].replace(/^"|"$/g, '').trim() : '';
                const houseNumber = row[3] ? row[3].replace(/^"|"$/g, '').trim() : '';
                const territory = row[4] ? row[4].replace(/^"|"$/g, '').trim() : '';

                // Якщо є окреме поле town_slug (новий глобальний формат)
                let townSlug = '';
                let comment = '';
                let lng, lat, audioDuration, createdAt, audioBase64;

                if (row.length >= 12) {
                    townSlug = row[5] ? row[5].replace(/^"|"$/g, '').trim() : '';
                    comment = row[6] ? row[6].replace(/^"|"$/g, '').trim() : '';
                    lng = parseFloat(row[7]);
                    lat = parseFloat(row[8]);
                    audioDuration = row[9] ? parseFloat(row[9]) : 0;
                    createdAt = row[10] ? row[10].replace(/^"|"$/g, '').trim() : new Date().toISOString();
                    audioBase64 = row[11] ? row[11].replace(/^"|"$/g, '').trim() : null;
                } else {
                    // Сумісність зі старим форматом експорту однієї території
                    comment = row[5] ? row[5].replace(/^"|"$/g, '').trim() : '';
                    lng = parseFloat(row[6]);
                    lat = parseFloat(row[7]);
                    audioDuration = row[8] ? parseFloat(row[8]) : 0;
                    createdAt = row[9] ? row[9].replace(/^"|"$/g, '').trim() : new Date().toISOString();
                    audioBase64 = row[10] ? row[10].replace(/^"|"$/g, '').trim() : null;
                }

                if (!townSlug) {
                    townSlug = territory ? territory.toLowerCase().replace(/\s+/g, '_') : 'berezhnytsia';
                }

                if (!isNaN(lng) && !isNaN(lat)) {
                    try {
                        if (window.db && window.db.markers) {
                            // ПЕРЕВІРКА: чи існує вже мітка з такими ж координатами у базі
                            const existing = await window.db.markers
                                .where('lng').equals(lng)
                                .and(m => m.lat === lat)
                                .first();

                            if (existing) {
                                skippedCount++;
                                continue; // Пропускаємо дублікат
                            }

                            const markerData = {
                                lng: lng,
                                lat: lat,
                                type: type,
                                comment: comment,
                                street: street,
                                house_number: houseNumber,
                                territory: territory || townSlug,
                                town_slug: townSlug,
                                user_name: "Глобальний імпорт",
                                audio_blob: (audioBase64 && audioBase64 !== "") ? audioBase64 : null,
                                audio_duration: audioDuration,
                                created_at: createdAt
                            };

                            await window.db.markers.add(markerData);
                            importedCount++;
                        }
                    } catch (err) {
                        console.error("Помилка перевірки або додавання мітки при глобальному імпорті:", err);
                    }
                }
            }
        }

        event.target.value = '';

        if (importedCount > 0 || skippedCount > 0) {
            alert(`Глобальний імпорт завершено!\nДодано нових міток: ${importedCount}\nПропущено дублікатів: ${skippedCount}`);
            const currentTown = new URLSearchParams(window.location.search).get('town') || 'berezhnytsia';
            if (window.loadUserMarkers) {
                window.loadUserMarkers(currentTown);
            }
        } else {
            alert("Не знайдено нових унікальних міток для імпорту.");
        }
    };

    reader.readAsText(file, 'UTF-8');
};

// --- 7. ПОВНЕ ОЧИЩЕННЯ БАЗИ ДАНИХ (З ПОДВІЙНИМ ПОПЕРЕДЖЕННЯМ) ---

window.clearAllMarkers = async function() {
    // Перше попередження
    const firstConfirm = confirm("УВАГА! Ви збираєтесь видалити абсолютно всі мітки та аудіозаписи по всіх селах із бази даних!\n\nВи впевнені, що хочете продовжити?");
    if (!firstConfirm) return;

    // Друге попередження (акцентоване)
    const secondConfirm = confirm("🔴 УВАГА! ЦЮ ДІЮ НЕМОЖЛИВО СКАСУВАТИ!\n\nВи точно-точно хочете НАЗАВЖДИ стерти всі дані?");
    if (!secondConfirm) return;

    try {
        if (window.db && window.db.markers) {
            // Очищаємо таблицю міток у Dexie
            await window.db.markers.clear();
            
            alert("Усі мітки та записи успішно видалено з бази.");

            // Оновлюємо карту для поточної території
            const currentTown = new URLSearchParams(window.location.search).get('town') || 'berezhnytsia';
            if (typeof window.loadUserMarkers === 'function') {
                window.loadUserMarkers(currentTown);
            } else {
                window.location.reload(); // Перезавантажуємо сторінку, якщо функція оновлення недоступна
            }
        } else {
            alert("Помилка: База даних не знайдена.");
        }
    } catch (err) {
        console.error("Помилка при очищенні бази даних:", err);
        alert("Сталася помилка під час видалення даних: " + err.message);
    }
};
