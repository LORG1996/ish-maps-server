(() => {
  'use strict';

  const STORAGE_KEY = 'mi-tiempo-v4';
  const LEGACY_KEYS = ['predicacion-tracker-v3', 'predicacion-tracker-v2', 'predicacion-tracker-v1'];
  const MARKERS_FALLBACK_KEY = 'mi-tiempo-markers-v1';
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const $ = (id) => document.getElementById(id);

  let viewedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let currentCalendarMonth = monthKey(new Date());
  let ticker;
  let toastTimer;
  let map;
  let mapLoading = false;
  let draftPosition = null;
  let draftMarker = null;
  let markerInfoWindow = null;
  const visibleMarkers = new Map();

  const emptyTimer = () => ({ status: 'idle', accumulatedMs: 0, startedAt: null, date: '', note: '' });
  const defaultState = () => ({ version: 4, entries: [], timer: emptyTimer(), mapType: 'roadmap', lastBackupAt: null });

  function normalizeEntry(entry) {
    return {
      id: entry.id || uuid(),
      date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date || '') ? entry.date : localDateKey(),
      durationMs: Math.max(0, Number(entry.durationMs) || 0),
      note: String(entry.note || entry.studyName || '').slice(0, 160),
      createdAt: Number(entry.createdAt) || Date.now(),
      updatedAt: Number(entry.updatedAt) || undefined
    };
  }

  function loadState() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (current?.entries && Array.isArray(current.entries)) {
        return { ...defaultState(), ...current, entries: current.entries.map(normalizeEntry), timer: { ...emptyTimer(), ...(current.timer || {}) } };
      }
      for (const key of LEGACY_KEYS) {
        const legacy = JSON.parse(localStorage.getItem(key));
        if (legacy?.entries && Array.isArray(legacy.entries)) {
          return { ...defaultState(), entries: legacy.entries.map(normalizeEntry), timer: { ...emptyTimer(), ...(legacy.timer || {}) }, lastBackupAt: legacy.lastBackupAt || null };
        }
      }
    } catch (_) { /* Ignore damaged browser storage and start with an empty register. */ }
    return defaultState();
  }

  let state = loadState();

  const markerStore = (() => {
    if (window.Dexie) {
      const db = new Dexie('MiTiempoDB');
      db.version(1).stores({ markers: '++id, createdAt' });
      return {
        all: () => db.markers.orderBy('createdAt').reverse().toArray(),
        add: (marker) => db.markers.add(marker),
        remove: (id) => db.markers.delete(Number(id)),
        replace: async (markers) => db.transaction('rw', db.markers, async () => { await db.markers.clear(); await db.markers.bulkAdd(markers.map(({ id, ...marker }) => marker)); })
      };
    }
    const read = () => { try { return JSON.parse(localStorage.getItem(MARKERS_FALLBACK_KEY)) || []; } catch (_) { return []; } };
    const write = (items) => localStorage.setItem(MARKERS_FALLBACK_KEY, JSON.stringify(items));
    return {
      all: async () => read().sort((a, b) => b.createdAt - a.createdAt),
      add: async (marker) => { const items = read(); const id = Date.now(); items.push({ ...marker, id }); write(items); return id; },
      remove: async (id) => write(read().filter((item) => Number(item.id) !== Number(id))),
      replace: async (markers) => write(markers.map((marker, index) => ({ ...marker, id: Date.now() + index })))
    };
  })();

  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function elapsedMs() { return (Number(state.timer.accumulatedMs) || 0) + (state.timer.status === 'running' && state.timer.startedAt ? Math.max(0, Date.now() - state.timer.startedAt) : 0); }
  function formatClock(ms) { const seconds = Math.floor(ms / 1000); return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((n) => String(n).padStart(2, '0')).join(':'); }
  function formatDuration(ms, precise = false) { const minutes = Math.round(ms / 60000); if (precise && minutes < 1 && ms > 0) return '< 1 min'; const h = Math.floor(minutes / 60), m = minutes % 60; if (!h) return `${m} min`; return m ? `${h} h ${m} min` : `${h} h`; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600); }
  function addEntry(data) { state.entries.push(normalizeEntry({ id: uuid(), createdAt: Date.now(), ...data })); }

  function rollRunningTimerToToday() {
    if (state.timer.status !== 'running' || !state.timer.startedAt || !state.timer.date) return;
    const today = localDateKey();
    let changed = false;
    while (state.timer.date < today) {
      const day = new Date(`${state.timer.date}T00:00:00`);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const segment = (Number(state.timer.accumulatedMs) || 0) + Math.max(0, nextDay.getTime() - state.timer.startedAt);
      if (segment > 0) addEntry({ date: state.timer.date, durationMs: segment, note: state.timer.note });
      state.timer.accumulatedMs = 0;
      state.timer.startedAt = nextDay.getTime();
      state.timer.date = localDateKey(nextDay);
      changed = true;
    }
    if (changed) { saveState(); renderMonth(); }
  }

  function followNewMonth() {
    const nowMonth = monthKey(new Date());
    if (nowMonth !== currentCalendarMonth) {
      if (monthKey(viewedMonth) === currentCalendarMonth) viewedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      currentCalendarMonth = nowMonth;
      renderMonth();
    }
  }

  function renderTimer() {
    rollRunningTimerToToday();
    followNewMonth();
    const ms = elapsedMs();
    $('timerDisplay').textContent = formatClock(ms);
    $('timerCard').classList.toggle('is-running', state.timer.status === 'running');
    $('startPauseButton').textContent = state.timer.status === 'running' ? 'Pausa' : (ms ? 'Seguir' : 'Iniciar');
    $('stopButton').disabled = ms <= 0;
    $('timerStatus').textContent = state.timer.status === 'running' ? 'En marcha' : (ms ? 'En pausa' : 'Listo');
  }

  function renderMonth() {
    const current = monthKey(viewedMonth) === monthKey(new Date());
    $('monthHint').textContent = current ? 'Mes actual' : 'Historial';
    $('monthTitle').textContent = `${MONTHS[viewedMonth.getMonth()]} de ${viewedMonth.getFullYear()}`;
    $('monthPicker').value = monthKey(viewedMonth);
    $('nextMonth').disabled = current;
    const entries = state.entries.filter((entry) => entry.date.startsWith(monthKey(viewedMonth))).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const total = entries.reduce((sum, entry) => sum + entry.durationMs, 0);
    $('summaryGrid').innerHTML = `<div class="summary-card"><div class="summary-name">Tiempo total</div><div class="summary-time">${formatDuration(total)}</div></div><div class="summary-card"><div class="summary-name">Registros</div><div class="summary-time">${entries.length}</div></div>`;
    $('emptyState').hidden = entries.length > 0;
    $('entryList').innerHTML = entries.map((entry) => {
      const date = new Date(`${entry.date}T12:00:00`);
      return `<article class="entry"><div class="date-badge">${date.getDate()}<small>${SHORT_MONTHS[date.getMonth()]}</small></div><div><div class="entry-title">${escapeHtml(entry.note || 'Sin comentario')}</div><div class="entry-meta">${entry.date.split('-').reverse().join('/')}</div></div><div class="entry-tools"><span class="entry-duration">${formatDuration(entry.durationMs, true)}</span><button class="edit-entry" data-edit="${escapeHtml(entry.id)}" type="button" aria-label="Editar">✎</button><button class="delete-entry" data-delete="${escapeHtml(entry.id)}" type="button" aria-label="Eliminar">×</button></div></article>`;
    }).join('');
    document.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openEntryEditor(button.dataset.edit)));
    document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => {
      if (!confirm('¿Eliminar este registro?')) return;
      state.entries = state.entries.filter((entry) => entry.id !== button.dataset.delete); saveState(); renderMonth(); toast('Registro eliminado');
    }));
  }

  function renderBackupDate() {
    $('backupDate').textContent = state.lastBackupAt ? `Última copia: ${new Date(state.lastBackupAt).toLocaleString('es-ES')}` : 'Aún no se ha descargado una copia';
  }

  function renderMapTypeButton() {
    const satellite = state.mapType === 'hybrid';
    $('mapTypeButton').textContent = satellite ? 'MAP' : 'SAT';
    $('mapTypeButton').classList.toggle('active', satellite);
    $('mapTypeButton').setAttribute('aria-label', satellite ? 'Cambiar a mapa normal' : 'Cambiar a vista satélite');
    $('mapTypeButton').title = satellite ? 'Cambiar a mapa normal' : 'Cambiar a vista satélite';
  }

  function renderAll() { renderTimer(); renderMonth(); renderBackupDate(); renderMapTypeButton(); }

  function openEntryEditor(id) {
    const entry = state.entries.find((item) => item.id === id); if (!entry) return;
    $('editingEntryId').value = entry.id; $('manualDate').value = entry.date;
    $('manualHours').value = String(Math.floor(entry.durationMs / 3600000)); $('manualMinutes').value = String(Math.round((entry.durationMs % 3600000) / 60000));
    $('manualNote').value = entry.note || ''; $('manualDialogTitle').textContent = 'Editar registro'; $('saveManualButton').textContent = 'Guardar cambios'; $('manualError').textContent = '';
    if ($('statsDialog').open) $('statsDialog').close();
    $('manualDialog').showModal();
  }

  function loadGoogleMaps() {
    if (window.google?.maps) { initializeMap(); return; }
    if (mapLoading) return;
    const apiKey = String(window.APP_CONFIG?.googleMapsApiKey || '').trim();
    if (!apiKey) { $('mapMessage').textContent = 'Añade tu clave de Google Maps en config.js.'; return; }
    mapLoading = true;
    window.initMiTiempoMap = initializeMap;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initMiTiempoMap&v=weekly&loading=async`;
    script.async = true; script.defer = true;
    script.onerror = () => { mapLoading = false; $('mapMessage').textContent = 'No se pudo cargar Google Maps. Comprueba la clave, sus restricciones y la conexión.'; };
    document.head.appendChild(script);
  }

  async function initializeMap() {
    mapLoading = false;
    $('mapMessage').hidden = true;
    map = new google.maps.Map($('mapCanvas'), {
      center: { lat: 0.060999941499529794, lng: -78.13949914993468 },
      zoom: 15,
      mapTypeId: state.mapType === 'hybrid' ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] }
      ]
    });
    markerInfoWindow = new google.maps.InfoWindow();
    map.addListener('click', (event) => { markerInfoWindow.close(); setDraftPosition({ lat: event.latLng.lat(), lng: event.latLng.lng() }); });
    await renderMarkers();
  }

  function setDraftPosition(position) {
    draftPosition = position;
    if (draftMarker) draftMarker.setMap(null);
    draftMarker = new google.maps.Marker({ map, position, draggable: true, title: 'Nueva marca' });
    draftMarker.addListener('dragend', () => setDraftPosition({ lat: draftMarker.getPosition().lat(), lng: draftMarker.getPosition().lng() }));
    $('draftCoordinates').textContent = `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
    $('markerForm').hidden = false;
    $('markerComment').focus();
  }

  function clearDraft() {
    draftPosition = null; $('markerForm').hidden = true; $('markerComment').value = '';
    if (draftMarker) { draftMarker.setMap(null); draftMarker = null; }
  }

  async function renderMarkers() {
    const markers = await markerStore.all();
    $('emptyMarkers').hidden = markers.length > 0;
    $('markerList').innerHTML = markers.map((marker) => `<article class="saved-marker"><div class="marker-pin">●</div><div><div class="entry-title">${escapeHtml(marker.comment || 'Marca sin comentario')}</div><div class="entry-meta">${new Date(marker.createdAt).toLocaleString('es-ES')} · ${Number(marker.lat).toFixed(5)}, ${Number(marker.lng).toFixed(5)}</div></div><div class="marker-row-actions"><button class="edit-entry" data-show-marker="${marker.id}" type="button" aria-label="Mostrar en el mapa">⌖</button><button class="delete-entry" data-delete-marker="${marker.id}" type="button" aria-label="Eliminar marca">×</button></div></article>`).join('');
    if (map) {
      if (markerInfoWindow) markerInfoWindow.close();
      visibleMarkers.forEach((marker) => marker.setMap(null)); visibleMarkers.clear();
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((item) => {
        const marker = new google.maps.Marker({ map, position: { lat: Number(item.lat), lng: Number(item.lng) }, title: item.comment || 'Marca sin comentario' });
        marker.addListener('click', () => openMarkerInfo(item, marker));
        visibleMarkers.set(Number(item.id), marker);
        bounds.extend(marker.getPosition());
      });
      if (markers.length === 1) { map.setCenter({ lat: Number(markers[0].lat), lng: Number(markers[0].lng) }); map.setZoom(15); }
      else if (markers.length > 1) map.fitBounds(bounds, 48);
    }
    document.querySelectorAll('[data-show-marker]').forEach((button) => button.addEventListener('click', () => {
      const item = markers.find((marker) => Number(marker.id) === Number(button.dataset.showMarker)); if (!item || !map) return;
      const googleMarker = visibleMarkers.get(Number(item.id));
      map.setCenter({ lat: Number(item.lat), lng: Number(item.lng) }); map.setZoom(17); $('statsDialog').close();
      if (googleMarker) setTimeout(() => openMarkerInfo(item, googleMarker), 180);
    }));
    document.querySelectorAll('[data-delete-marker]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta marca?')) return;
      await markerStore.remove(button.dataset.deleteMarker); await renderMarkers(); toast('Marca eliminada');
    }));
  }

  function openMarkerInfo(item, marker) {
    if (!markerInfoWindow || !map) return;
    const comment = escapeHtml(item.comment || 'Marca sin comentario');
    const date = escapeHtml(new Date(item.createdAt).toLocaleString('es-ES'));
    const coordinates = `${Number(item.lat).toFixed(5)}, ${Number(item.lng).toFixed(5)}`;
    markerInfoWindow.setContent(`<div class="map-info"><strong>${comment}</strong><span>${date}</span><small>${coordinates}</small></div>`);
    markerInfoWindow.open({ map, anchor: marker });
  }

  $('startPauseButton').addEventListener('click', () => {
    const today = localDateKey();
    if (state.timer.status === 'running') {
      state.timer.accumulatedMs = elapsedMs(); state.timer.startedAt = null; state.timer.status = 'paused';
    } else {
      if (state.timer.accumulatedMs > 0 && state.timer.date && state.timer.date !== today) {
        addEntry({ date: state.timer.date, durationMs: state.timer.accumulatedMs, note: state.timer.note });
        state.timer = emptyTimer(); toast('El tiempo anterior se guardó en su fecha');
      }
      state.timer.date = today; state.timer.startedAt = Date.now(); state.timer.status = 'running';
    }
    saveState(); renderAll();
  });
  $('stopButton').addEventListener('click', () => {
    const durationMs = elapsedMs(); if (!durationMs) return;
    addEntry({ date: state.timer.date || localDateKey(), durationMs, note: state.timer.note || '' });
    state.timer = emptyTimer(); saveState(); renderAll(); toast('Tiempo guardado');
  });
  $('previousMonth').addEventListener('click', () => { viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1); renderMonth(); });
  $('nextMonth').addEventListener('click', () => { const next = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1); if (next <= new Date(new Date().getFullYear(), new Date().getMonth(), 1)) viewedMonth = next; renderMonth(); });
  $('monthPicker').addEventListener('change', () => {
    if (!/^\d{4}-\d{2}$/.test($('monthPicker').value)) return;
    const selected = new Date(`${$('monthPicker').value}-01T12:00:00`);
    const current = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    viewedMonth = selected > current ? current : selected;
    renderMonth();
  });
  $('statsButton').addEventListener('click', async () => { renderMonth(); await renderMarkers(); $('statsDialog').showModal(); });
  $('closeStatsButton').addEventListener('click', () => $('statsDialog').close());
  function openManualEntry() {
    $('editingEntryId').value = ''; $('manualDate').value = localDateKey(); $('manualHours').value = '1'; $('manualMinutes').value = '0'; $('manualNote').value = '';
    $('manualDialogTitle').textContent = 'Añadir tiempo'; $('saveManualButton').textContent = 'Guardar'; $('manualError').textContent = ''; $('manualDialog').showModal();
  }
  $('manualButton').addEventListener('click', openManualEntry);
  $('dialogManualButton').addEventListener('click', () => { $('statsDialog').close(); openManualEntry(); });
  $('manualForm').addEventListener('submit', (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    const durationMs = ((Number($('manualHours').value) || 0) * 60 + (Number($('manualMinutes').value) || 0)) * 60000;
    if (!durationMs) { $('manualError').textContent = 'Indica una duración mayor que cero.'; return; }
    const data = { date: $('manualDate').value, durationMs, note: $('manualNote').value.trim() };
    const id = $('editingEntryId').value;
    if (id) Object.assign(state.entries.find((entry) => entry.id === id), data, { updatedAt: Date.now() }); else addEntry(data);
    viewedMonth = new Date(`${data.date.slice(0, 7)}-01T12:00:00`); saveState(); $('manualDialog').close(); renderMonth(); toast(id ? 'Cambios guardados' : 'Tiempo añadido');
  });
  $('manualDialog').addEventListener('close', () => { $('editingEntryId').value = ''; });

  async function getDevicePosition() {
    const nativeGeolocation = window.Capacitor?.isNativePlatform?.()
      ? window.Capacitor?.Plugins?.Geolocation
      : null;

    if (nativeGeolocation) {
      const currentPermission = await nativeGeolocation.checkPermissions();
      if (currentPermission.location !== 'granted') {
        const requestedPermission = await nativeGeolocation.requestPermissions({ permissions: ['location'] });
        if (requestedPermission.location !== 'granted') throw new Error('permission-denied');
      }
      return nativeGeolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    }

    if (!navigator.geolocation) throw new Error('unavailable');
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      });
    });
  }

  $('locateButton').addEventListener('click', async () => {
    if (!map) { toast('Espera a que el mapa termine de cargar'); return; }
    $('locateButton').disabled = true; $('locateButton').textContent = '…';
    try {
      const position = await getDevicePosition();
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      map.setCenter(point); map.setZoom(17); setDraftPosition(point);
    } catch (_) {
      toast('No se pudo obtener la ubicación');
    } finally {
      $('locateButton').disabled = false; $('locateButton').textContent = '⌖';
    }
  });
  $('mapTypeButton').addEventListener('click', () => {
    state.mapType = state.mapType === 'hybrid' ? 'roadmap' : 'hybrid';
    saveState(); renderMapTypeButton();
    if (map) map.setMapTypeId(state.mapType === 'hybrid' ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP);
  });
  $('markerForm').addEventListener('submit', async (event) => {
    event.preventDefault(); if (!draftPosition) return;
    await markerStore.add({ lat: draftPosition.lat, lng: draftPosition.lng, comment: $('markerComment').value.trim(), createdAt: Date.now() });
    clearDraft(); await renderMarkers(); toast('Marca guardada');
  });
  $('cancelMarkerButton').addEventListener('click', clearDraft);

  $('exportButton').addEventListener('click', async () => {
    state.lastBackupAt = new Date().toISOString(); saveState();
    const payload = { app: 'Mi tiempo', version: 4, exportedAt: state.lastBackupAt, data: state, markers: await markerStore.all() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `mi-tiempo-${localDateKey()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    renderBackupDate(); toast('Copia JSON descargada');
  });
  $('importInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text()), incoming = payload.data || payload;
      if (!Array.isArray(incoming.entries)) throw new Error('invalid');
      if (!confirm('La restauración reemplazará los datos de este dispositivo. ¿Continuar?')) return;
      state = { ...defaultState(), ...incoming, entries: incoming.entries.map(normalizeEntry), timer: { ...emptyTimer(), ...(incoming.timer || {}) } };
      await markerStore.replace(Array.isArray(payload.markers) ? payload.markers : []); saveState(); viewedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderAll(); await renderMarkers(); toast('Copia restaurada');
    } catch (_) { toast('El archivo JSON no es válido'); }
    finally { event.target.value = ''; }
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderTimer(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  renderAll(); renderMarkers(); loadGoogleMaps(); ticker = setInterval(renderTimer, 1000);
})();
