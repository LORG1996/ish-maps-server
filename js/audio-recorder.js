// audio-recorder.js

window.mediaRecorder = null;
window.audioChunks = [];
window.audioContext = null;
window.analyserNode = null;
window.animFrameId = null;
window.activeAudioStream = null;

// Функція очищення та зупинки активних ресурсів аудіо
window.cleanupAudioResources = function() {
    if (window.animFrameId) {
        cancelAnimationFrame(window.animFrameId);
        window.animFrameId = null;
    }

    if (window.activeAudioStream) {
        window.activeAudioStream.getTracks().forEach(track => track.stop());
        window.activeAudioStream = null;
    }

    if (window.audioContext) {
        if (window.audioContext.state !== 'closed') {
            window.audioContext.close();
        }
        window.audioContext = null;
    }

    window.analyserNode = null;
};

// Функція запуску запису та візуалізації
window.startAudioRecording = async function() {
    try {
        // Очищаємо попередні сесії, якщо вони були
        window.cleanupAudioResources();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        window.activeAudioStream = stream;
        
        // --- 1. Налаштування MediaRecorder ---
        window.mediaRecorder = new MediaRecorder(stream);
        window.audioChunks = [];
        
        const startTime = Date.now();
        window.mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) window.audioChunks.push(event.data);
        };
        
        window.mediaRecorder.onstop = () => {
            window.recordedAudioBlob = new Blob(window.audioChunks, { type: 'audio/webm' });
            window.recordedAudioDuration = Math.round((Date.now() - startTime) / 1000);
            
            // Зупиняємо треки мікрофона
            if (window.activeAudioStream) {
                window.activeAudioStream.getTracks().forEach(track => track.stop());
                window.activeAudioStream = null;
            }
        };

        window.mediaRecorder.start();

        // --- 2. Налаштування Web Audio API ---
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = window.audioContext.createMediaStreamSource(stream);
        window.analyserNode = window.audioContext.createAnalyser();
        
        window.analyserNode.fftSize = 64;
        source.connect(window.analyserNode);

        // --- 3. Оновлення UI ---
        const btnStart = document.getElementById('rec-btn-start');
        const btnStop = document.getElementById('rec-btn-stop');
        const audioStatus = document.getElementById('audio-status');

        if (btnStart) btnStart.style.display = 'none';
        if (btnStop) btnStop.style.display = 'flex';
        if (audioStatus) audioStatus.innerHTML = `🔴 <span id="volume-indicator" style="color: #ef4444; font-weight: bold;">Запис...</span>`;

        // --- 4. Анімаційний цикл реального часу ---
        const dataArray = new Uint8Array(window.analyserNode.frequencyBinCount);

        function updateVolumeAnimation() {
            if (!window.analyserNode) return;

            window.analyserNode.getByteFrequencyData(dataArray);
            
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;

            const scale = 1 + (average / 255) * 0.35;
            
            const btnStopEl = document.getElementById('rec-btn-stop');
            if (btnStopEl) {
                btnStopEl.style.transform = `scale(${scale})`;
                btnStopEl.style.boxShadow = `0 0 ${Math.max(4, average / 8)}px rgba(239, 68, 68, 0.8)`;
            }

            window.animFrameId = requestAnimationFrame(updateVolumeAnimation);
        }

        updateVolumeAnimation();

    } catch (err) {
        console.error("Помилка доступу до мікрофона:", err);
        alert("Не вдалося отримати доступ до мікрофона. Перевірте дозволи у браузері.");
    }
};

// Функція зупинки запису
window.stopAudioRecording = function() {
    if (window.mediaRecorder && window.mediaRecorder.state !== 'inactive') {
        window.mediaRecorder.stop();
    }

    window.cleanupAudioResources();

    // Скидаємо стилі елементів UI
    const btnStart = document.getElementById('rec-btn-start');
    const btnStop = document.getElementById('rec-btn-stop');
    const audioStatus = document.getElementById('audio-status');

    if (btnStop) {
        btnStop.style.display = 'none';
        btnStop.style.transform = 'scale(1)';
        btnStop.style.boxShadow = '0 2px 4px rgba(239,68,68,0.3)';
    }

    if (btnStart) btnStart.style.display = 'flex';
    
    if (audioStatus) {
        audioStatus.innerHTML = `✅ <span style="color: #22c55e;">Записано</span>`;
    }
};
