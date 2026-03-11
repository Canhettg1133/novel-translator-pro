/**
 * Novel Translator Pro - Progress & UI Updates
 * Cập nhật tiến độ, toast, download
 */

// ============================================
// PROGRESS UPDATES
// ============================================
function updateProgress(current, total, status) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${percentage}%`;
    document.getElementById('progressDetails').textContent = `${current} / ${total} chunks`;
    document.getElementById('progressStatus').textContent = status;

    // Update download button text
    const downloadBtn = document.getElementById('downloadPartialBtn');
    if (downloadBtn && current > 0) {
        downloadBtn.innerHTML = `📥 Tải ${current} chunks đã dịch`;
    }
}

function updateProgressStats(speed, activeKeys, eta) {
    document.getElementById('speedStat').textContent = speed;
    document.getElementById('activeKeysStat').textContent = activeKeys;
    document.getElementById('etaStat').textContent = eta;
}

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// SLEEP UTILITIES
// ============================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Sleep với countdown hiển thị trên UI
async function sleepWithCountdown(ms, statusPrefix = '⏳ Chờ quota reset') {
    const totalSeconds = Math.ceil(ms / 1000);
    for (let remaining = totalSeconds; remaining > 0; remaining--) {
        updateProgress(completedChunks, totalChunksCount, `${statusPrefix}... ${remaining}s`);
        await sleep(1000);

        if (cancelRequested) {
            console.log('[Countdown] Cancelled!');
            return;
        }
    }
}

// ============================================
// RESULT ACTIONS
// ============================================
function copyResult() {
    const text = document.getElementById('translatedText').value;
    if (!text) {
        showToast('Không có nội dung để copy!', 'warning');
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã copy vào clipboard!', 'success');
    }).catch(() => {
        const textarea = document.getElementById('translatedText');
        textarea.select();
        document.execCommand('copy');
        showToast('Đã copy vào clipboard!', 'success');
    });
}

function downloadResult() {
    const text = document.getElementById('translatedText').value;
    if (!text) {
        showToast('Không có nội dung để tải!', 'warning');
        return;
    }
    // Tên file: [tên_truyện]_translated.txt
    const baseName = originalFileName.replace(/\.txt$/i, '').replace(/_translated$/, '');
    const fileName = `${baseName}_translated.txt`;
    downloadTextFile(text, fileName);
}

// Download partial - tải phần đã dịch được
function downloadPartial() {
    // Giữ đúng thứ tự, chỉ lấy chunks đã dịch
    const translatedParts = translatedChunks
        .filter(c => c !== null && c !== undefined);

    if (translatedParts.length === 0) {
        showToast('Chưa có nội dung nào được dịch!', 'warning');
        return;
    }

    const text = translatedParts.join('\n\n');
    // Tên file: [tên_truyện]_50of200chunks.txt
    const baseName = originalFileName.replace(/\.txt$/i, '').replace(/_translated$/, '');
    const fileName = `${baseName}_${completedChunks}of${totalChunksCount}chunks.txt`;
    downloadTextFile(text, fileName);
}

// Shared download helper — Capacitor Filesystem > Share API > Blob
async function downloadTextFile(text, fileName) {
    // TIER 1: Capacitor Filesystem (Android native — writes to Downloads/NovelTranslator/)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
        try {
            const { Filesystem } = window.Capacitor.Plugins;
            // Directory enum: 0=Documents, 1=Data, 2=Library, 3=Cache, 4=External, 5=ExternalStorage
            // Use ExternalStorage for Downloads access, or Documents as fallback
            
            // Try to create subfolder
            const subDir = 'NovelTranslator';
            try {
                await Filesystem.mkdir({
                    path: subDir,
                    directory: 'DOCUMENTS',
                    recursive: true
                });
            } catch (mkdirErr) {
                // Folder may already exist — that's OK
            }

            const filePath = `${subDir}/${fileName}`;
            await Filesystem.writeFile({
                path: filePath,
                data: text,
                directory: 'DOCUMENTS',
                encoding: 'utf8'
            });

            showToast(`💾 Đã lưu: Documents/${filePath}`, 'success');
            console.log(`[Download] Saved to Documents/${filePath}`);
            return;
        } catch (fsError) {
            console.warn('[Download] Filesystem write failed:', fsError);
            // Fall through to Share API
        }
    }

    // TIER 2: Web Share API (Android share sheet)
    if (navigator.share && navigator.canShare) {
        try {
            const file = new File([text], fileName, { type: 'text/plain' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ title: fileName, files: [file] });
                showToast(`💾 File "${fileName}" đã được chia sẻ/lưu!`, 'success');
                return;
            }
        } catch (shareErr) {
            if (shareErr.name !== 'AbortError') {
                console.warn('[Download] Share failed:', shareErr);
            }
        }
    }

    // TIER 3: Blob download (desktop browsers)
    try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
        showToast(`💾 Đang tải "${fileName}"`, 'success');
    } catch (e) {
        // TIER 4: Copy clipboard
        try {
            await navigator.clipboard.writeText(text);
            showToast('📋 Không tải được file. Đã copy nội dung vào clipboard!', 'info');
        } catch (clipErr) {
            const ta = document.getElementById('translatedText');
            if (ta) { ta.value = text; ta.select(); }
            showToast('⚠️ Hãy chọn text trong ô kết quả và copy thủ công.', 'warning');
        }
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
