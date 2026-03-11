/**
 * Novel Translator Pro - Mobile Controller
 * Flow: Input → Progress → Result + Settings Drawer
 * Bridges between mobile UI and existing web translation engine
 */

// ============================================
// SCREEN NAVIGATION
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.mobile-screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');

    // Update header based on screen
    const header = document.getElementById('mobileHeader');
    if (screenId === 'screenProgress') {
        header.querySelector('.app-title').textContent = 'Đang dịch...';
    } else if (screenId === 'screenResult') {
        header.querySelector('.app-title').textContent = 'Kết quả';
    } else {
        header.querySelector('.app-title').textContent = 'Novel Translator';
    }
}

// ============================================
// SETTINGS DRAWER
// ============================================
function toggleSettingsDrawer() {
    const drawer = document.getElementById('settingsDrawer');
    const overlay = document.getElementById('settingsOverlay');
    const isOpen = drawer.classList.contains('open');

    if (isOpen) {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
    } else {
        drawer.classList.add('open');
        overlay.classList.add('open');
    }
}

function toggleDrawerSection(sectionId) {
    const body = document.getElementById(sectionId);
    const arrow = document.getElementById(sectionId + 'Arrow');
    if (!body) return;

    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    if (arrow) arrow.classList.toggle('open', isHidden);
}

// ============================================
// MOBILE STATS
// ============================================
function updateMobileStats() {
    const text = document.getElementById('originalText').value;
    const charCount = text.length;
    const chunkSize = parseInt(document.getElementById('chunkSize').value) || 4500;
    const chunkCount = Math.ceil(charCount / chunkSize);

    document.getElementById('mCharCount').textContent = charCount.toLocaleString();
    document.getElementById('mChunkCount').textContent = chunkCount;

    // Estimate time based on mode
    let estimatedSeconds;
    if (useProxy) {
        const keyCount = typeof getProxyKeyCount === 'function' ? getProxyKeyCount() : 1;
        const chunksPerBatch = Math.min(keyCount, chunkCount);
        const batches = Math.ceil(chunkCount / Math.max(chunksPerBatch, 1));
        estimatedSeconds = batches * 10; // ~10s per batch with proxy
    } else {
        const parallelCount = parseInt(document.getElementById('parallelCount').value) || 5;
        const batches = Math.ceil(chunkCount / parallelCount);
        estimatedSeconds = batches * 3; // ~3s per batch with Gemini Direct
    }

    if (estimatedSeconds < 60) {
        document.getElementById('mEstTime').textContent = `~${estimatedSeconds}s`;
    } else {
        document.getElementById('mEstTime').textContent = `~${Math.ceil(estimatedSeconds / 60)}ph`;
    }

    // Update status bar
    updateMobileStatusBar();
}

function updateMobileStatusBar() {
    const keyCount = typeof getProxyKeyCount === 'function' ? getProxyKeyCount() : 0;

    if (useProxy) {
        document.getElementById('keyCountStatus').textContent = `${keyCount} keys`;
        const modelShort = proxyModel.split('-').slice(0, 3).join(' ');
        document.getElementById('modelStatus').textContent = modelShort;
    } else if (typeof useOllama !== 'undefined' && useOllama) {
        document.getElementById('keyCountStatus').textContent = 'Local';
        document.getElementById('modelStatus').textContent = 'Ollama';
    } else {
        document.getElementById('keyCountStatus').textContent = `${apiKeys.length} keys`;
        document.getElementById('modelStatus').textContent = 'Gemini';
    }
}

// ============================================
// START TRANSLATION (bridge to engine.js)
// ============================================
async function startMobileTranslation() {
    const text = document.getElementById('originalText').value.trim();
    if (!text) {
        showToast('Vui lòng nhập nội dung cần dịch!', 'warning');
        return;
    }

    // Check keys
    if (useProxy) {
        const keyCount = typeof getProxyKeyCount === 'function' ? getProxyKeyCount() : 0;
        if (keyCount === 0) {
            showToast('Chưa có Proxy API Key! Mở ⚙️ Cài đặt để thêm.', 'error');
            return;
        }
    } else if (!useOllama && apiKeys.length === 0) {
        showToast('Chưa có API Key! Mở ⚙️ Cài đặt để thêm.', 'error');
        return;
    }

    // Switch to progress screen
    showScreen('screenProgress');

    // Request Wake Lock to keep CPU alive
    requestWakeLock();

    // Disable translate button
    document.getElementById('btnTranslate').disabled = true;

    // Reset progress UI
    updateMobileProgress(0, 1);

    try {
        // Call the existing translateText() from engine.js
        await translateText();

        // Translation complete — switch to result screen
        showMobileResult();
    } catch (e) {
        console.error('[Mobile] Translation error:', e);
        showToast(`❌ Lỗi: ${e.message}`, 'error');
        showScreen('screenInput');
    } finally {
        document.getElementById('btnTranslate').disabled = false;
        releaseWakeLock();
    }
}

// ============================================
// PROGRESS UPDATES (override web progress functions)
// ============================================
const _originalUpdateProgress = typeof updateProgress === 'function' ? updateProgress : null;

// Override updateProgress to also update mobile UI
function updateProgressMobile(completed, total, message) {
    // Call original if exists
    if (_originalUpdateProgress) {
        _originalUpdateProgress(completed, total, message);
    }

    updateMobileProgress(completed, total);
}

function updateMobileProgress(completed, total) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Update circular progress
    document.getElementById('mProgressPercent').textContent = percent + '%';
    document.getElementById('mProgressDetail').textContent = `${completed}/${total} chunks`;

    // Update SVG circle
    const circle = document.getElementById('progressArc');
    if (circle) {
        const circumference = 2 * Math.PI * 42; // r=42
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    // Update chunk badge
    const badge = document.getElementById('mChunkBadge');
    if (badge) badge.textContent = `${completed}/${total}`;

    // Update speed info
    if (typeof translationStartTime !== 'undefined' && translationStartTime > 0 && completed > 0) {
        const elapsed = (Date.now() - translationStartTime) / 1000;
        const speed = (completed / elapsed).toFixed(1);
        const remaining = total > completed ? Math.ceil((total - completed) / (completed / elapsed)) : 0;
        const remainStr = remaining > 60 ? `${Math.ceil(remaining / 60)}ph` : `${remaining}s`;
        document.getElementById('mSpeedInfo').textContent =
            `⏱️ ${Math.round(elapsed)}s | ⚡ ${speed} chunk/s | 🏁 còn ~${remainStr}`;
    }

    // Sync chunk tracker to mobile list
    syncChunkTrackerToMobile();
}

function syncChunkTrackerToMobile() {
    if (typeof chunkTrackingData === 'undefined' || !chunkTrackingData.length) return;

    const list = document.getElementById('mChunkList');
    const summary = document.getElementById('mChunkSummary');
    if (!list) return;

    // Only render last 20 chunks for performance
    const startIdx = Math.max(0, chunkTrackingData.length - 20);
    const visibleChunks = chunkTrackingData.slice(startIdx);

    list.innerHTML = visibleChunks.map(data => {
        const statusInfo = typeof getStatusInfo === 'function' ? getStatusInfo(data.status) : { icon: '?', label: data.status };
        const keyBadge = data.keyLabel ? `<span class="ct-key">🔑${data.keyLabel}</span>` : '';
        return `
            <div class="ct-row ct-${data.status}" onclick="viewChunkDetail(${data.index})">
                <span class="ct-num">#${data.index + 1}</span>
                <span class="ct-io">${data.inputLen.toLocaleString()}→${data.outputLen > 0 ? data.outputLen.toLocaleString() : '...'}</span>
                <span class="ct-ratio ${data.ratio < 60 && data.ratio > 0 ? 'ratio-warning' : (data.ratio >= 60 ? 'ratio-ok' : '')}">${data.ratio > 0 ? data.ratio + '%' : '--'}</span>
                <span class="ct-status">${statusInfo.icon}</span>
                ${keyBadge}
            </div>
        `;
    }).join('');

    // Auto-scroll to bottom
    list.scrollTop = list.scrollHeight;

    // Summary
    if (summary) {
        const success = chunkTrackingData.filter(d => d.status === 'success').length;
        const failed = chunkTrackingData.filter(d => d.status === 'failed' || d.status === 'warning').length;
        const total = chunkTrackingData.length;
        summary.textContent = `✅ ${success} | ⚠️ ${failed} | 📊 ${total} chunks`;
    }
}

// ============================================
// SHOW RESULT
// ============================================
function showMobileResult() {
    showScreen('screenResult');

    const translated = document.getElementById('translatedText').value;
    document.getElementById('mResultCharCount').textContent = `${translated.length.toLocaleString()} chữ`;

    // Stats
    if (typeof chunkTrackingData !== 'undefined' && chunkTrackingData.length) {
        const total = chunkTrackingData.length;
        const success = chunkTrackingData.filter(d => d.status === 'success').length;
        const warning = chunkTrackingData.filter(d => d.status === 'warning').length;
        const failed = chunkTrackingData.filter(d => d.status === 'failed').length;
        const totalInput = chunkTrackingData.reduce((s, d) => s + d.inputLen, 0);
        const totalOutput = chunkTrackingData.reduce((s, d) => s + d.outputLen, 0);
        const ratio = totalInput > 0 ? Math.round((totalOutput / totalInput) * 100) : 0;
        const totalRetries = chunkTrackingData.reduce((s, d) => s + d.retryCount, 0);

        document.getElementById('mResultStats').innerHTML = `
            <span>📊 ${success}/${total}</span>
            <span>📏 ${ratio}%</span>
            ${warning ? `<span>⚠️ ${warning} ngắn</span>` : ''}
            ${failed ? `<span>❌ ${failed} lỗi</span>` : ''}
            <span>🔄 ${totalRetries} retry</span>
        `;

        // Show failed chunks bar
        if (failed + warning > 0) {
            document.getElementById('mFailedCount').textContent = failed + warning;
            document.getElementById('mFailedChunksBar').style.display = 'flex';
        } else {
            document.getElementById('mFailedChunksBar').style.display = 'none';
        }

        // Result status
        if (failed > 0) {
            document.getElementById('mResultStatus').textContent = `⚠️ Hoàn thành (${failed} lỗi)`;
            document.getElementById('mResultStatus').style.color = 'var(--warning)';
        } else {
            document.getElementById('mResultStatus').textContent = '✅ Hoàn thành!';
            document.getElementById('mResultStatus').style.color = 'var(--success)';
        }
    }
}

// ============================================
// COPY & DOWNLOAD
// ============================================
function copyMobileResult() {
    const text = document.getElementById('translatedText').value;
    if (!text) {
        showToast('Chưa có kết quả!', 'warning');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Đã copy kết quả!', 'success');
    }).catch(() => {
        // Fallback
        document.getElementById('translatedText').select();
        document.execCommand('copy');
        showToast('📋 Đã copy!', 'success');
    });
}

function downloadMobileResult() {
    const text = document.getElementById('translatedText').value;
    if (!text) {
        showToast('Chưa có kết quả!', 'warning');
        return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translated_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Đã tải file!', 'success');
}

// ============================================
// PAUSE & CANCEL
// ============================================
function togglePauseMobile() {
    if (typeof togglePause === 'function') {
        togglePause();
    }
    const btn = document.getElementById('btnPause');
    if (typeof isPaused !== 'undefined' && isPaused) {
        btn.innerHTML = '<span>▶️</span> Tiếp tục';
        btn.classList.add('paused');
    } else {
        btn.innerHTML = '<span>⏸️</span> Tạm dừng';
        btn.classList.remove('paused');
    }
}

function cancelMobileTranslation() {
    if (confirm('Hủy dịch? Phần đã dịch sẽ được giữ lại.')) {
        if (typeof cancelTranslation === 'function') {
            cancelTranslation();
        }
        showMobileResult();
    }
}

// ============================================
// CHUNK TRACKER TOGGLE
// ============================================
function toggleMobileChunkList() {
    const list = document.getElementById('mChunkList');
    const toggle = document.getElementById('mChunkToggle');
    if (!list) return;

    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? '' : 'none';
    if (toggle) toggle.textContent = isHidden ? '▼' : '▶';
}

// ============================================
// WAKE LOCK (keep CPU alive while translating)
// ============================================
let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('[Mobile] Wake Lock acquired');
            wakeLock.addEventListener('release', () => {
                console.log('[Mobile] Wake Lock released');
            });
        }
    } catch (e) {
        console.warn('[Mobile] Wake Lock failed:', e);
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

// ============================================
// OVERRIDE PROGRESS UPDATE FUNCTION
// ============================================
// Override the global updateProgress to funnel into mobile UI
window.addEventListener('DOMContentLoaded', () => {
    // Override updateProgress if it exists
    if (typeof window.updateProgress === 'function') {
        const _orig = window.updateProgress;
        window.updateProgress = function(completed, total, message) {
            _orig(completed, total, message);
            updateMobileProgress(completed, total);
        };
    }

    // Initial stats update
    setTimeout(() => {
        updateMobileStats();
        updateMobileStatusBar();
    }, 500);
});

// ============================================
// FILE UPLOAD
// ============================================
function handleMobileFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('originalText').value = e.target.result;
        document.getElementById('mFileName').textContent = `${file.name} (${(file.size / 1024).toFixed(1)}KB)`;
        document.getElementById('mFileInfo').style.display = 'flex';
        updateMobileStats();
        showToast(`📁 Đã tải: ${file.name}`, 'success');
    };
    reader.readAsText(file, 'UTF-8');
}

function clearMobileFile() {
    document.getElementById('fileInput').value = '';
    document.getElementById('mFileInfo').style.display = 'none';
    document.getElementById('originalText').value = '';
    updateMobileStats();
}

// ============================================
// EXPOSE MOBILE FUNCTIONS GLOBALLY
// ============================================
window.showScreen = showScreen;
window.toggleSettingsDrawer = toggleSettingsDrawer;
window.toggleDrawerSection = toggleDrawerSection;
window.startMobileTranslation = startMobileTranslation;
window.copyMobileResult = copyMobileResult;
window.downloadMobileResult = downloadMobileResult;
window.togglePauseMobile = togglePauseMobile;
window.cancelMobileTranslation = cancelMobileTranslation;
window.toggleMobileChunkList = toggleMobileChunkList;
window.updateMobileStats = updateMobileStats;
window.handleMobileFile = handleMobileFile;
window.clearMobileFile = clearMobileFile;
