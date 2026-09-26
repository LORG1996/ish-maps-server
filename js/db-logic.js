// /js/offline-logic.js

if (!window.db) {
    window.db = new Dexie("TerritoryOfflineDB");
    window.db.version(1).stores({
        markers: '++id, lat, lng, type, comment, street, house_number, territory, town_slug, user_name, created_at'
    });
}

window.currentStatusMarkers = [];
window.editingMarkerId = null;

// --- 1. РЕНДЕР МАРКЕРІВ НА КАРТІ ---
window.renderEmojiMarker = function(data) {
    if (!window.map) return;

    const el = document.createElement('div');
    el.className = 'emoji-marker';

    let emoji = '🔒';
    let statusText = 'Нема вдома';
    if (data.type === 'stop') { emoji = '🚫'; statusText = 'Не заходити'; }
    else if (data.type === 'visit') { emoji = '🔁'; statusText = 'Повторний візит'; }

    el.innerText = emoji;
    el.style.fontSize = '32px';
    el.style.cursor = 'pointer';

    const displayId = String(data.id);
    const authorName = data.user_name || 'Користувач';

    const dateObj = new Date(data.created_at);
    const dateString = dateObj.toLocaleString('uk-UA', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    });

    const addressHtml = (data.street || data.house_number || data.territory)
    ? `<p style="margin: 0 0 4px 0; font-size: 14px;">
        <b>📍 ${data.street || ''} ${data.house_number || ''}</b>
        ${data.territory ? `<br><span style="font-size:11px; color:#666;">Територія: ${data.territory}</span>` : ''}
       </p>`
    : '';

    const commentHtml = data.comment
        ? `<p style="font-size: 12px; color: #444; background: #fdf6e3; padding: 6px; border-radius: 4px; border: 1px solid #eee; margin: 8px 0;">${data.comment}</p>`
        : '';

    let audioHtml = '';
    if (data.audio_blob) {
        let audioUrl = data.audio_blob;
        if (data.audio_blob instanceof Blob) {
            audioUrl = URL.createObjectURL(data.audio_blob);
        }

        audioHtml = `
            <div style="margin: 8px 0; background: #f1f5f9; padding: 6px; border-radius: 6px; text-align: left;">
                <p style="font-size: 11px; color: #475569; margin: 0 0 4px 0; font-weight: 600;">🎙️ Голосова нотатка:</p>
                <audio controls preload="none" style="width: 100%; height: 32px;">
                    <source src="${audioUrl}" type="audio/webm">
                    Ваш браузер не підтримує аудіо.
                </audio>
            </div>
        `;
    }

    const marker = new mapboxgl.Marker(el)
        .setLngLat([data.lng, data.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="text-align: center; min-width: 200px; font-family: sans-serif; padding: 5px;">
                <p style="margin: 0 0 5px 0; font-size: 13px; color: #7b4c7c; font-weight: bold; text-transform: uppercase;">${statusText}</p>
                ${addressHtml}

                <div style="border-top: 1px solid #eee; padding-top: 5px; margin-top: 5px;">
                    <p style="font-size: 11px; color: #333; margin: 0;">👤 ${authorName}</p>
                    <p style="font-size: 10px; color: #888; margin: 2px 0 0 0;">📅 ${dateString}</p>
                </div>

                ${commentHtml}
                ${audioHtml}

                <div style="display: flex; gap: 6px; margin-top: 8px;">
                    <button type="button" class="edit-marker-action" data-id="${displayId}"
                            style="flex: 1; color: white; background: #3b82f6; border: none; border-radius: 6px; padding: 8px; cursor: pointer; font-weight: bold; font-size: 11px;">
                        ✏️ Редагувати
                    </button>
                    <button type="button" class="delete-marker-action" data-id="${displayId}"
                            style="flex: 1; color: white; background: #ff4d4d; border: none; border-radius: 6px; padding: 8px; cursor: pointer; font-weight: bold; font-size: 11px;">
                        🗑️ Видалити
                    </button>
                </div>
            </div>
        `))
        .addTo(window.map);

    marker.myCustomId = displayId;
    window.currentStatusMarkers.push(marker);
};

window.renderAllLocalMarkers = async function(townSlug) {
    window.currentStatusMarkers.forEach(m => m.remove());
    window.currentStatusMarkers = [];

    const markers = await window.db.markers.where('town_slug').equals(townSlug).toArray();
    markers.forEach(m => window.renderEmojiMarker(m));
};

window.loadUserMarkers = async function(townSlug) {
    if (!townSlug) return;
    const cleanSlug = townSlug.trim().toLowerCase();
    await window.renderAllLocalMarkers(cleanSlug);
};

// --- ДОПОМІЖНА ФУНКЦІЯ: Управління кнопкою "+ Додати коментар та деталі" ---
window.toggleExtraFields = function() {
    const extraContainer = document.getElementById('extra-fields-container');
    const toggleBtn = document.getElementById('toggle-details-btn');

    if (!extraContainer) return;

    if (extraContainer.style.display === 'none' || extraContainer.style.display === '') {
        extraContainer.style.display = 'block';
        if (toggleBtn) toggleBtn.innerText = '➖ Приховати деталі';
    } else {
        extraContainer.style.display = 'none';
        if (toggleBtn) toggleBtn.innerText = '➕ Додати коментар та деталі';

        if (document.activeElement) document.activeElement.blur();
    }
};

// --- 2. ЗБЕРЕЖЕННЯ АБО ОНОВЛЕННЯ МАРКЕРА ---
window.saveMarkerToDB = async function(lng, lat, type, comment = "", street = "", house_number = "", territory = "", audioBase64 = null, audioDuration = 0) {

    // 🔥 Гарантоване закриття клавіатури через невидимий інпут + глобальний blur
    if (document.activeElement) document.activeElement.blur();
    document.querySelectorAll('input, textarea, select').forEach(el => el.blur());

    const dummyInput = document.createElement('input');
    dummyInput.setAttribute('type', 'text');
    dummyInput.style.position = 'fixed';
    dummyInput.style.opacity = '0';
    dummyInput.style.pointerEvents = 'none';
    document.body.appendChild(dummyInput);
    dummyInput.focus();
    setTimeout(() => {
        dummyInput.blur();
        dummyInput.remove();
    }, 150);

    // Миттєво закриваємо модалку та складаємо деталі назад
    const modal = document.getElementById('marker-modal') || document.getElementById('marker-form-container') || document.querySelector('.marker-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active', 'open');
    }

    const extraContainer = document.getElementById('extra-fields-container');
    const toggleBtn = document.getElementById('toggle-details-btn');
    if (extraContainer) extraContainer.style.display = 'none';
    if (toggleBtn) toggleBtn.innerText = '➕ Додати коментар та деталі';

    const urlParams = new URLSearchParams(window.location.search);
    const townSlug = urlParams.get('town') || 'berezhnytsia';
    let userName = "Користувач";

    if (window.editingMarkerId) {
        try {
            const numericId = Number(window.editingMarkerId);
            await window.db.markers.update(numericId, {
                type: type,
                comment: comment.trim(),
                street: street.trim(),
                house_number: house_number.trim(),
                territory: territory.trim()
            });

            window.editingMarkerId = null;

            const saveBtn = document.getElementById('save-marker-btn') || document.querySelector('.save-marker-class');
            if (saveBtn) saveBtn.innerText = "Зберегти мітку";

            document.querySelectorAll('.mapboxgl-popup').forEach(el => el.remove());
            await window.loadUserMarkers(townSlug);

            return;
        } catch (err) {
            console.error("Помилка оновлення мітки:", err);
            alert("Помилка оновлення: " + err.message);
            return;
        }
    }

    const newMarker = {
        lng: parseFloat(lng),
        lat: parseFloat(lat),
        type,
        comment: comment.trim(),
        street: street.trim(),
        house_number: house_number.trim(),
        territory: territory.trim(),
        town_slug: townSlug,
        user_name: userName,
        audio_blob: audioBase64 || window.recordedAudioBase64 || null,
        audio_duration: audioDuration || window.recordedAudioDuration || 0,
        created_at: new Date().toISOString()
    };

    try {
        const localId = await window.db.markers.add(newMarker);

        window.recordedAudioBase64 = null;
        window.recordedAudioDuration = 0;

        const activePopups = document.getElementsByClassName('mapboxgl-popup');
        while (activePopups[0]) activePopups[0].remove();

        window.renderEmojiMarker({ ...newMarker, id: localId });
    } catch (err) {
        console.error("Помилка збереження в IndexedDB:", err);
        alert("Помилка збереження: " + err.message);
    }
};

// --- 3. ВІДКРИТТЯ ФОРМИ ДЛЯ РЕДАГУВАННЯ ---
window.openEditMarkerForm = async function(event, internalId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    try {
        const numericId = Number(internalId);
        const markerData = await window.db.markers.get(numericId);

        if (!markerData) {
            alert("Мітку не знайдено в базі!");
            return;
        }

        window.editingMarkerId = numericId;
        document.querySelectorAll('.mapboxgl-popup').forEach(el => el.remove());

        const findField = (selectors) => {
            for (let sel of selectors) {
                const el = document.querySelector(sel);
                if (el) return el;
            }
            return null;
        };

        const streetInput = findField(['#marker-street', '#street', 'input[name="street"]', 'input[placeholder*="вулиц"]']);
        const houseInput = findField(['#marker-house', '#house_number', '#house', 'input[name="house_number"]', 'input[name="house"]', 'input[placeholder*="будин"]']);
        const territoryInput = findField(['#marker-territory', '#territory', 'input[name="territory"]', 'input[placeholder*="територ"]']);
        const commentInput = findField(['#marker-comment', '#comment', 'textarea[name="comment"]', 'textarea']);
        const typeSelect = findField(['#marker-type', '#type', 'select[name="type"]', 'select']);

        // Заповнюємо значення
        if (streetInput) streetInput.value = markerData.street || "";
        if (houseInput) houseInput.value = markerData.house_number || "";
        if (territoryInput) territoryInput.value = markerData.territory || "";
        if (commentInput) commentInput.value = markerData.comment || "";
        if (typeSelect) typeSelect.value = markerData.type || "lock";

        // Якщо у мітки вже є заповнені деталі — автоматично розгортаємо блок, інакше залишаємо згорнутим
        const extraContainer = document.getElementById('extra-fields-container');
        const toggleBtn = document.getElementById('toggle-details-btn');
        if (markerData.street || markerData.house_number || markerData.comment) {
            if (extraContainer) extraContainer.style.display = 'block';
            if (toggleBtn) toggleBtn.innerText = '➖ Приховати деталі';
        } else {
            if (extraContainer) extraContainer.style.display = 'none';
            if (toggleBtn) toggleBtn.innerText = '➕ Додати коментар та деталі';
        }

        const possibleModals = [
            document.getElementById('marker-modal'),
            document.getElementById('marker-form-container'),
            document.getElementById('add-marker-modal'),
            document.querySelector('.marker-modal'),
            document.querySelector('.modal-form'),
            document.querySelector('form')
        ];

        let opened = false;
        for (let modal of possibleModals) {
            if (modal) {
                modal.style.display = 'block';
                modal.classList.add('active', 'open');
                opened = true;
            }
        }

        if (typeof window.openModal === 'function') window.openModal();
        if (typeof window.openMarkerModal === 'function') window.openMarkerModal(markerData);

        const saveBtn = document.getElementById('save-marker-btn') || document.querySelector('button[type="submit"]') || document.querySelector('.save-btn');
        if (saveBtn) saveBtn.innerText = "💾 Зберегти зміни";

        // Забороняємо будь-який фокус на інпутах при відкритті модалки
        setTimeout(() => {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
        }, 50);

        if (!opened) {
            const newStreet = prompt("Редагувати вулицю:", markerData.street || "");
            if (newStreet === null) return;
            const newHouse = prompt("Редагувати номер будинку:", markerData.house_number || "");
            if (newHouse === null) return;
            const newTerritory = prompt("Редагувати територію:", markerData.territory || "");
            if (newTerritory === null) return;
            const newComment = prompt("Редагувати коментар:", markerData.comment || "");
            if (newComment === null) return;

            await window.db.markers.update(numericId, {
                street: newStreet.trim(),
                house_number: newHouse.trim(),
                territory: newTerritory.trim(),
                comment: newComment.trim()
            });

            window.editingMarkerId = null;
            const currentTown = new URLSearchParams(window.location.search).get('town') || 'berezhnytsia';
            await window.loadUserMarkers(currentTown);
            alert("Мітку успішно оновлено!");
        }

    } catch (err) {
        console.error("Помилка в openEditMarkerForm:", err);
        alert("Помилка редагування: " + err.message);
    }
};

// --- 4. ВИДАЛЕННЯ МАРКЕРА ---
window.deleteMarkerFromDB = async function(event, internalId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!confirm("Видалити цю відмітку?")) return;

    try {
        const numericId = Number(internalId);
        await window.db.markers.delete(numericId);

        const idx = window.currentStatusMarkers.findIndex(m => String(m.myCustomId) === String(internalId));
        if (idx > -1) {
            window.currentStatusMarkers[idx].remove();
            window.currentStatusMarkers.splice(idx, 1);
        }

        document.querySelectorAll('.mapboxgl-popup').forEach(el => el.remove());
    } catch (err) {
        console.error("Delete failed:", err);
    }
};

['click', 'touchend'].forEach(eventType => {
    document.addEventListener(eventType, function(e) {
        const editBtn = e.target.closest('.edit-marker-action');
        if (editBtn) {
            e.preventDefault();
            e.stopPropagation();
            window.openEditMarkerForm(e, editBtn.getAttribute('data-id'));
            return;
        }

        const deleteBtn = e.target.closest('.delete-marker-action');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            window.deleteMarkerFromDB(e, deleteBtn.getAttribute('data-id'));
        }
    }, { passive: false });
});

// --- 5. ІМПОРТ ТА ЕКСПОРТ CSV (З ПЕРЕВІРКОЮ ДУБЛІКАТІВ ЗА КООРДИНАТАМИ) ---
window.importMarkersFromCSV = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n');

        if (lines.length < 2) {
            alert("Файл порожній або має невірний формат!");
            event.target.value = '';
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

            if (row.length >= 8) {
                const type = row[1] ? row[1].replace(/^"|"$/g, '').trim() : '';
                const typeVal = type.toLowerCase();

                // ФІЛЬТР: Імпортуємо тільки мітки "Не заходити" або "stop"
                if (typeVal !== 'stop' && typeVal !== 'не заходити') {
                    continue;
                }

                const street = row[2] ? row[2].replace(/^"|"$/g, '').trim() : '';
                const houseNumber = row[3] ? row[3].replace(/^"|"$/g, '').trim() : '';
                const territory = row[4] ? row[4].replace(/^"|"$/g, '').trim() : '';
                const comment = row[5] ? row[5].replace(/^"|"$/g, '').trim() : '';
                const lng = parseFloat(row[6]);
                const lat = parseFloat(row[7]);
                const audioDuration = row[8] ? parseFloat(row[8]) : 0;
                const createdAt = row[9] ? row[9].replace(/^"|"$/g, '').trim() : new Date().toISOString();
                const audioBase64 = row[10] ? row[10].replace(/^"|"$/g, '').trim() : null;

                if (!isNaN(lng) && !isNaN(lat)) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const townSlug = urlParams.get('town') || 'berezhnytsia';

                    try {
                        if (window.db && window.db.markers) {
                            // ПЕРЕВІРКА: чи існує вже мітка з такими ж координатами в базі
                            const existing = await window.db.markers
                                .where('lng').equals(lng)
                                .and(m => m.lat === lat)
                                .first();

                            if (existing) {
                                skippedCount++;
                                continue; // Пропускаємо, якщо вже є
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
                                user_name: "Імпорт",
                                audio_blob: (audioBase64 && audioBase64 !== "") ? audioBase64 : null,
                                audio_duration: audioDuration,
                                created_at: createdAt
                            };

                            await window.db.markers.add(markerData);
                            importedCount++;
                        }
                    } catch (err) {
                        console.error("Помилка перевірки або додавання мітки:", err);
                    }
                }
            }
        }

        event.target.value = '';

        if (importedCount > 0 || skippedCount > 0) {
            alert(`Імпорт завершено!\nДодано нових міток "Не заходити": ${importedCount}\nПропущено (вже існували): ${skippedCount}`);
            const currentTown = new URLSearchParams(window.location.search).get('town') || 'berezhnytsia';
            if (window.loadUserMarkers) {
                window.loadUserMarkers(currentTown);
            }
        } else {
            alert("У файлі не знайдено нових міток із типом \"Не заходити\" / \"stop\".");
        }
    };

    reader.readAsText(file, 'UTF-8');
};

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
    csvContent += "ID,Type,Street,House,Territory,Comment,Longitude,Latitude,Audio Duration (s),Created At,Audio Base64\n";

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
    const fileName = `markers_${townNameSlug}_${dateStr}.csv`;

    const isCapacitorNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

    if (isCapacitorNative) {
        try {
            const Filesystem = window.Capacitor.Plugins.Filesystem;
            const Share = window.Capacitor.Plugins.Share;

            if (!Filesystem || !Share) {
                throw new Error("Плагіни Filesystem або Share не знайдені в категоріях.");
            }

            const writeFileResult = await Filesystem.writeFile({
                path: fileName,
                data: csvContent,
                directory: 'CACHE',
                encoding: 'utf8'
            });

            await Share.share({
                title: 'Експорт міток',
                text: `База міток для території: ${townNameSlug}`,
                url: writeFileResult.uri,
                dialogTitle: 'Зберегти або надіслати файл CSV'
            });

        } catch (err) {
            console.error("Помилка мобільного експорту через Capacitor:", err);
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
