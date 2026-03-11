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
    downloadTextFile(text, originalFileName);
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
    const partialFileName = originalFileName.replace('.txt', `_partial_${completedChunks}chunks.txt`);
    downloadTextFile(text, partialFileName);
    showToast(`Đã tải ${completedChunks} chunks đã dịch!`, 'success');
}

// Shared download helper — 3-tier approach for maximum compatibility
function downloadTextFile(text, fileName) {
    // TIER 1: Web Share API (best for Android — opens native share sheet)
    if (navigator.share && navigator.canShare) {
        try {
            const file = new File([text], fileName, { type: 'text/plain' });
            if (navigator.canShare({ files: [file] })) {
                navigator.share({
                    title: fileName,
                    files: [file]
                }).then(() => {
                    showToast(`💾 File "${fileName}" đã được chia sẻ/lưu!`, 'success');
                }).catch(err => {
                    // User cancelled share — that's OK
                    if (err.name !== 'AbortError') {
                        console.warn('[Download] Share failed, trying blob download:', err);
                        downloadViaBlobLink(text, fileName);
                    }
                });
                return; // Share dialog opened
            }
        } catch (e) {
            console.warn('[Download] Share API error:', e);
        }
    }

    // TIER 2: Blob download (works on desktop browsers, sometimes works on Android)
    downloadViaBlobLink(text, fileName);
}

// Blob download approach
function downloadViaBlobLink(text, fileName) {
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
        showToast(`💾 Đang tải "${fileName}" — kiểm tra thư mục Downloads!`, 'success');
    } catch (e) {
        // TIER 3: Copy to clipboard as last resort
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Không tải được file. Đã copy nội dung vào clipboard!', 'info');
        }).catch(() => {
            const ta = document.getElementById('translatedText');
            if (ta) { ta.value = text; ta.select(); }
            showToast('⚠️ Hãy chọn text trong ô kết quả và copy thủ công.', 'warning');
        });
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
