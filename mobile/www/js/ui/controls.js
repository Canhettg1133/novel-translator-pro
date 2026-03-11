/**
 * Novel Translator Pro - UI Controls
 * Xử lý pause, resume, cancel
 */

// ============================================
// PAUSE / RESUME FUNCTIONALITY
// ============================================
function togglePause() {
    const pauseBtn = document.getElementById('pauseBtn');

    if (isPaused) {
        // Resume
        isPaused = false;
        pauseBtn.classList.remove('paused');
        pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Tạm dừng</span>';
        updateProgress(completedChunks, totalChunksCount, 'Đang tiếp tục dịch...');
        showToast('▶️ Đã tiếp tục dịch!', 'success');
        console.log('[Pause] Resumed translation');
    } else {
        // Pause
        isPaused = true;
        pauseBtn.classList.add('paused');
        pauseBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Tiếp tục</span>';
        updateProgress(completedChunks, totalChunksCount, '⏸️ Đã tạm dừng');
        showToast('⏸️ Đã tạm dừng dịch. Nhấn "Tiếp tục" để tiếp tục.', 'warning');
        console.log('[Pause] Paused translation');
    }
}

// Wait while paused
async function waitWhilePaused() {
    while (isPaused && !cancelRequested) {
        await sleep(500);
    }
}

// ============================================
// CANCEL WITH CONFIRMATION
// ============================================
function confirmCancel() {
    if (!isTranslating) {
        showToast('Không có bản dịch đang chạy!', 'info');
        return;
    }

    // Pause first
    if (!isPaused) {
        togglePause();
    }

    // Update modal stats
    const statsEl = document.getElementById('cancelModalStats');
    const percentage = totalChunksCount > 0 ? Math.round((completedChunks / totalChunksCount) * 100) : 0;
    const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

    statsEl.innerHTML = `
        <div class="cancel-stats">
            <div class="cancel-stats-item">
                <span class="cancel-stats-label">📦 Đã dịch:</span>
                <span class="cancel-stats-value">${completedChunks} / ${totalChunksCount} chunks (${percentage}%)</span>
            </div>
            <div class="cancel-stats-item">
                <span class="cancel-stats-label">⏱️ Thời gian:</span>
                <span class="cancel-stats-value">${formatTime(elapsed)}</span>
            </div>
            <div class="cancel-stats-item">
                <span class="cancel-stats-label">📄 File:</span>
                <span class="cancel-stats-value">${originalFileName}</span>
            </div>
        </div>
    `;

    // Show modal
    document.getElementById('cancelModal').style.display = 'flex';
}

function closeCancelModal() {
    document.getElementById('cancelModal').style.display = 'none';

    // Resume if was paused for confirmation
    if (isPaused && isTranslating) {
        togglePause();
    }
}

function executeCancel() {
    // Close modal
    document.getElementById('cancelModal').style.display = 'none';

    // Update button to show cancelling state
    const cancelBtn = document.getElementById('cancelBtn');
    cancelBtn.classList.add('cancelling');
    cancelBtn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-text">Đang hủy...</span>';

    // Set cancel flag
    cancelRequested = true;
    isPaused = false;

    updateProgress(completedChunks, totalChunksCount, '🛑 Đang hủy và lưu tiến trình...');

    const percentage = totalChunksCount > 0 ? Math.round((completedChunks / totalChunksCount) * 100) : 0;
    showToast(`Đã hủy! Đã lưu ${completedChunks}/${totalChunksCount} chunks (${percentage}%)`, 'warning');

    console.log(`[Cancel] Cancelled with ${completedChunks}/${totalChunksCount} chunks completed`);
}

// Legacy function for compatibility
function cancelTranslation() {
    confirmCancel();
}
