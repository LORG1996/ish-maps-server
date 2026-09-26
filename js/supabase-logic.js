// /js/supabase-logic.js

// 1. Конфігурація Supabase
const SUPABASE_URL = 'https://asfsvpwmyeuxsvjhstwy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FhsifNSIoMPstKBrhy2UPQ_tZmCgGSj';

// Список дозволених користувачів
const OFFLINE_USERS = {
    "roman@gmail.com": "112211",
    "anna@gmail.com": "112211",
    "sashaludkevych@gmail.com": "112211",
    "test@gmail.com": "112211",
    "taras@gmail.com": "112211",
    "yana@gmail.com": "112211",
    "vira@gmail.com": "112211",
    "olya@gmail.com": "112211",
    "zoryana@gmail.com": "112211",
    "volodya@gmail.com": "112211",
};

const STORAGE_KEY = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;

// Експортуємо змінні
window.OFFLINE_USERS = OFFLINE_USERS;
window.SUPABASE_URL = SUPABASE_URL;

// Ініціалізація клієнта Supabase
if (!window.supabaseClient) {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });
}

// Ініціалізація Dexie з підтримкою поля territory
if (!window.db) {
    window.db = new Dexie("TerritoryOfflineDB");
    window.db.version(5).stores({ 
        // Додаємо territory у список індексованих полів
        markers: '++id, lat, lng, type, comment, street, house_number, territory, town_slug, is_synced, remote_id, user_name' 
    });
}

window.currentStatusMarkers = [];
window.isSyncing = false;

// --- 1. СИНХРОНІЗАЦІЯ (DEXIE -> SUPABASE) ---
window.syncOfflineData = async function() {
    if (!navigator.onLine || window.isSyncing) return;
    
    const unsynced = await window.db.markers.where('is_synced').equals(0).toArray();
    if (unsynced.length === 0) return;

    window.isSyncing = true;
    
    let currentUserEmail = "Анонім";
    try {
        const sessionData = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (sessionData?.user?.email) currentUserEmail = sessionData.user.email;
    } catch (e) {}

    for (let marker of unsynced) {
        try {
            // Підготовка даних (копіюємо, щоб не псувати оригінал в циклі)
            const dataToSync = {
    lat: marker.lat,
    lng: marker.lng,
    type: marker.type,
    comment: marker.comment,
    street: marker.street,
    house_number: marker.house_number,
    territory: marker.territory, // ДОДАНО СЮДИ
    town_slug: marker.town_slug,
    user_name: marker.user_name || currentUserEmail
};

            const { data, error } = await window.supabaseClient
                .from('markers')
                .insert([dataToSync])
                .select();

            if (!error && data?.[0]) {
                await window.db.markers.update(marker.id, { 
                    is_synced: 1, 
                    remote_id: data[0].id,
                    user_name: dataToSync.user_name 
                });
            }
        } catch (e) { 
            console.error("Sync loop error:", e);
        }
    }
    window.isSyncing = false;
};

// --- 2. РЕНДЕР МАРКЕРІВ ---
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

    const displayId = data.remote_id ? String(data.remote_id) : 'local-' + data.id;

    // Словник імен
    const users = {
        "roman@gmail.com": "Роман Людкевич",
        "sashaludkevych@gmail.com": "Саша Людкевич",
        "anna@gmail.com": "Анна Мещерякова",
        "olya@gmail.com": "Оля Смиків",
        "volodya@gmail.com": "Володя Котів",
        "taras@gmail.com": "Тарас Гнатів",
        "yana@gmail.com": "Яна Гнатів",
        "zoryana@gmail.com": "Зоряна Бабур",
        "vira@gmail.com": "Віра Бавура"
    };
    
    const authorName = users[data.user_name] || data.user_name || 'Невідомо';
    
    // Форматування дати: "18 квітня, 14:20"
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

    const marker = new mapboxgl.Marker(el)
        .setLngLat([data.lng, data.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="text-align: center; min-width: 170px; font-family: sans-serif; padding: 5px;">
                <p style="margin: 0 0 5px 0; font-size: 13px; color: #7b4c7c; font-weight: bold; text-transform: uppercase;">${statusText}</p>
                ${addressHtml}
                
                <div style="border-top: 1px solid #eee; padding-top: 5px; margin-top: 5px;">
                    <p style="font-size: 11px; color: #333; margin: 0;">👤 ${authorName}</p>
                    <p style="font-size: 10px; color: #888; margin: 2px 0 0 0;">📅 ${dateString}</p>
                </div>

                ${commentHtml}
                
                <button onclick="window.deleteMarkerFromDB('${displayId}')"
                        style="margin-top: 10px; color: white; background: #ff4d4d; border: none; border-radius: 6px; padding: 8px; cursor: pointer; width: 100%; font-weight: bold; font-size: 11px;">
                    Видалити
                </button>
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

// --- 3. ЗАВАНТАЖЕННЯ ДАНИХ ---
window.loadUserMarkers = async function(townSlug) {
    if (!townSlug) return;
    const cleanSlug = townSlug.trim().toLowerCase();
    
    // Спершу показуємо локальні
    await window.renderAllLocalMarkers(cleanSlug);

    if (navigator.onLine) {
        try {
            const { data, error } = await window.supabaseClient
                .from('markers')
                .select('*')
                .eq('town_slug', cleanSlug);

            if (!error && data) {
                await window.db.transaction('rw', window.db.markers, async () => {
                    // Оновлюємо тільки синхронізовані, щоб не затерти те, що користувач додав в офлайні
                    await window.db.markers.where('town_slug').equals(cleanSlug)
                                         .and(m => m.is_synced === 1).delete();
                    
                    const toAdd = data.map(m => ({
                        ...m, 
                        is_synced: 1, 
                        remote_id: m.id, 
                        id: undefined // Дозволяємо Dexie створити новий автоінкремент
                    }));
                    if (toAdd.length > 0) await window.db.markers.bulkAdd(toAdd);
                });
                await window.renderAllLocalMarkers(cleanSlug);
            }
        } catch (e) { console.error("Cloud load error:", e); }
    }
};

// --- 4. ЗБЕРЕЖЕННЯ ---
// --- 4. ЗБЕРЕЖЕННЯ (Повна версія для supabase-logic.js) ---
window.saveMarkerToDB = async function(lng, lat, type, comment = "", street = "", house_number = "", territory = "") {
    // Отримуємо поточний town_slug з URL
    const urlParams = new URLSearchParams(window.location.search);
    const townSlug = urlParams.get('town') || 'berezhnytsia';

    // Отримуємо email користувача з локального сховища Supabase
    let userEmail = "Анонім";
    try {
        const sessionData = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (sessionData?.user?.email) userEmail = sessionData.user.email;
    } catch (e) {
        console.error("Помилка отримання email:", e);
    }

    const newMarker = {
        lng: parseFloat(lng), 
        lat: parseFloat(lat),
        type, 
        comment: comment.trim(),
        street: street.trim(),
        house_number: house_number.trim(),
        territory: territory.trim(), // Зберігаємо територію
        town_slug: townSlug,
        user_name: userEmail, 
        is_synced: 0, 
        created_at: new Date().toISOString()
    };

    try {
        // Зберігаємо в Dexie
        const localId = await window.db.markers.add(newMarker);
        
        // Закриваємо всі відкриті попапи Mapbox
        const activePopups = document.getElementsByClassName('mapboxgl-popup');
        while (activePopups[0]) activePopups[0].remove();

        // Рендеримо маркер на карті (з тимчасовим ID)
        window.renderEmojiMarker({ ...newMarker, id: localId });

        // Запускаємо фонову синхронізацію
        window.syncOfflineData();
    } catch (err) {
        console.error("Помилка збереження в IndexedDB:", err);
        alert("Помилка збереження! Перевірте консоль.");
    }
};

// --- 5. ВИДАЛЕННЯ ---
window.deleteMarkerFromDB = async function(internalId) {
    if (!confirm("Видалити цю відмітку?")) return;
    
    try {
        const idStr = String(internalId);
        const isLocalOnly = idStr.startsWith('local-');

        if (navigator.onLine) {
            let idToDelete = null;
            if (isLocalOnly) {
                const localIdx = parseInt(idStr.replace('local-', ''));
                const m = await window.db.markers.get(localIdx);
                if (m?.remote_id) idToDelete = m.remote_id;
            } else {
                idToDelete = parseInt(idStr);
            }

            if (idToDelete) {
                await window.supabaseClient.from('markers').delete().eq('id', idToDelete);
            }
        }

        // Локальне видалення
        if (isLocalOnly) {
            await window.db.markers.delete(parseInt(idStr.replace('local-', '')));
        } else {
            await window.db.markers.where('remote_id').equals(parseInt(idStr)).delete();
        }

        // Видалення з карти
        const idx = window.currentStatusMarkers.findIndex(m => String(m.myCustomId) === idStr);
        if (idx > -1) {
            window.currentStatusMarkers[idx].remove();
            window.currentStatusMarkers.splice(idx, 1);
        }
    } catch (err) { 
        console.error("Delete failed:", err); 
    }
};

// --- 6. ПЕРЕВІРКА АВТОРИЗАЦІЇ ---
window.checkAuthStatus = async function() {
    const overlay = document.getElementById('auth-overlay');
    const loginBtn = document.getElementById('show-login-btn');
    const town = new URLSearchParams(window.location.search).get('town') || 'berezhnytsia';

    const sessionData = localStorage.getItem(STORAGE_KEY);
    
    if (sessionData) {
        if (overlay) overlay.style.display = 'none';
        if (loginBtn) loginBtn.innerText = "🔓";
        window.loadUserMarkers(town);
    } else {
        if (overlay) overlay.style.display = 'flex';
    }
};

// Ініціалізація
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.checkAuthStatus, 500);
});

window.addEventListener('online', window.syncOfflineData);
setInterval(window.syncOfflineData, 30000);