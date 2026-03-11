/**
 * Novel Translator Pro - History Management
 * Quản lý lịch sử dịch
 */

// ============================================
// HISTORY MANAGEMENT
// ============================================
function loadHistory() {
    const saved = localStorage.getItem('novelTranslatorHistory');
    if (saved) {
        try {
            translationHistory = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading history:', e);
            translationHistory = [];
        }
    }
}

function saveHistory() {
    try {
        if (translationHistory.length > 20) {
            translationHistory = translationHistory.slice(-20);
        }

        // Lưu full text — chỉ bỏ chunks array để tiết kiệm
        const saveData = translationHistory.map(item => ({
            ...item,
            chunks: [] // Chunks array quá lớn, không lưu
        }));

        localStorage.setItem('novelTranslatorHistory', JSON.stringify(saveData));
    } catch (e) {
        console.error('Error saving history:', e);

        if (e.name === 'QuotaExceededError') {
            // Nếu đầy, cắt bớt text để vừa
            translationHistory = translationHistory.slice(-5);
            try {
                const lightHistory = translationHistory.map(item => ({
                    ...item,
                    originalText: item.originalText ? item.originalText.substring(0, 2000) : '',
                    translatedText: item.translatedText ? item.translatedText.substring(0, 2000) : '',
                    chunks: []
                }));
                localStorage.setItem('novelTranslatorHistory', JSON.stringify(lightHistory));
                showToast('Đã xóa bớt lịch sử cũ để tiết kiệm bộ nhớ.', 'warning');
            } catch (e2) {
                localStorage.removeItem('novelTranslatorHistory');
                translationHistory = [];
                showToast('Đã xóa lịch sử để giải phóng bộ nhớ.', 'warning');
            }
        }
    }
}

function addToHistory(name, originalText, translatedText, chunks, completedCount, totalCount) {
    const historyItem = {
        id: Date.now().toString(),
        name: name,
        date: new Date().toISOString(),
        originalText: originalText,
        translatedText: translatedText,
        chunks: chunks,
        completedChunks: completedCount,
        totalChunks: totalCount,
        charCount: originalText.length,
        isComplete: completedCount >= totalCount
    };

    if (currentHistoryId) {
        const index = translationHistory.findIndex(h => h.id === currentHistoryId);
        if (index !== -1) {
            historyItem.id = currentHistoryId;
            translationHistory[index] = historyItem;
        } else {
            translationHistory.push(historyItem);
        }
        currentHistoryId = null;
    } else {
        translationHistory.push(historyItem);
    }

    saveHistory();
    renderHistoryList();
    return historyItem.id;
}

function updateHistoryProgress(id, translatedText, chunks, completedCount) {
    const index = translationHistory.findIndex(h => h.id === id);
    if (index !== -1) {
        translationHistory[index].translatedText = translatedText;
        translationHistory[index].chunks = chunks;
        translationHistory[index].completedChunks = completedCount;
        translationHistory[index].isComplete = completedCount >= translationHistory[index].totalChunks;
        translationHistory[index].date = new Date().toISOString();
        saveHistory();
        renderHistoryList();
    }
}

function renderHistoryList() {
    const container = document.getElementById('historyList');
    if (!container) return;
    const countBadge = document.getElementById('historyCount');

    if (countBadge) countBadge.textContent = `${translationHistory.length} bản`;

    if (translationHistory.length === 0) {
        container.innerHTML = '<p class="empty-message">Chưa có lịch sử dịch nào.</p>';
        return;
    }

    const sorted = [...translationHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sorted.map(item => {
        const progress = Math.round((item.completedChunks / item.totalChunks) * 100);
        const statusIcon = item.isComplete ? '✅' : '⏳';
        const date = new Date(item.date);
        const dateStr = date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="history-item" data-id="${item.id}">
                <span class="status-icon">${statusIcon}</span>
                <div class="history-info">
                    <div class="history-name">${escapeHtml(item.name)}</div>
                    <div class="history-meta">
                        <span>📅 ${dateStr}</span>
                        <span>📝 ${formatNumber(item.charCount)} chữ</span>
                        <span>📦 ${item.completedChunks}/${item.totalChunks} chunks</span>
                    </div>
                </div>
                <div class="history-progress">
                    <div class="history-progress-fill ${item.isComplete ? 'complete' : ''}" style="width: ${progress}%"></div>
                </div>
                <div class="history-btns">
                    ${!item.isComplete ? `<button onclick="continueFromHistory('${item.id}')" title="Tiếp tục dịch">▶️</button>` : ''}
                    <button onclick="loadFromHistory('${item.id}')" title="Xem/Tải về">👁️</button>
                    <button onclick="deleteFromHistory('${item.id}')" class="btn-delete" title="Xóa">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function continueFromHistory(id) {
    const item = translationHistory.find(h => h.id === id);
    if (!item) {
        showToast('Không tìm thấy lịch sử!', 'error');
        return;
    }

    if (item.isComplete) {
        showToast('Bản dịch này đã hoàn thành!', 'info');
        loadFromHistory(id);
        return;
    }

    if (isTranslating) {
        showToast('Đang có bản dịch khác đang chạy!', 'warning');
        return;
    }

    document.getElementById('originalText').value = item.originalText;
    originalFileName = item.name;
    currentHistoryId = id;

    originalChunks = item.chunks || [];
    translatedChunks = item.translatedText ? item.translatedText.split('\n\n') : [];
    completedChunks = item.completedChunks || 0;
    totalChunksCount = item.totalChunks || 0;

    updateStats();
    showToast(`Đã tải "${item.name}" - Tiếp tục từ chunk ${completedChunks}/${totalChunksCount}`, 'success');
    document.getElementById('translateBtn').scrollIntoView({ behavior: 'smooth' });
}

function loadFromHistory(id) {
    const item = translationHistory.find(h => h.id === id);
    if (!item) {
        showToast('Không tìm thấy lịch sử!', 'error');
        return;
    }

    document.getElementById('originalText').value = item.originalText;
    originalFileName = item.name;

    document.getElementById('translatedText').value = item.translatedText || '';
    document.getElementById('resultSection').style.display = 'block';

    updateStats();
    showToast(`Đã tải "${item.name}"`, 'success');
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}

function deleteFromHistory(id) {
    if (!confirm('Bạn có chắc muốn xóa bản dịch này?')) {
        return;
    }

    translationHistory = translationHistory.filter(h => h.id !== id);
    saveHistory();
    renderHistoryList();
    showToast('Đã xóa khỏi lịch sử!', 'info');
}

function clearAllHistory() {
    if (translationHistory.length === 0) {
        showToast('Lịch sử đã trống!', 'info');
        return;
    }

    if (!confirm(`Bạn có chắc muốn xóa tất cả ${translationHistory.length} bản dịch?`)) {
        return;
    }

    translationHistory = [];
    saveHistory();
    renderHistoryList();
    showToast('Đã xóa tất cả lịch sử!', 'success');
}

function exportHistory() {
    if (translationHistory.length === 0) {
        showToast('Không có lịch sử để xuất!', 'warning');
        return;
    }

    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        count: translationHistory.length,
        history: translationHistory
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novel_translator_history_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Đã xuất ${translationHistory.length} bản dịch!`, 'success');
}

function importHistory(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.history || !Array.isArray(data.history)) {
                throw new Error('Invalid format');
            }

            const importCount = data.history.length;
            let newCount = 0;

            data.history.forEach(item => {
                const exists = translationHistory.some(h =>
                    h.id === item.id ||
                    (h.name === item.name && h.date === item.date)
                );

                if (!exists) {
                    item.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                    translationHistory.push(item);
                    newCount++;
                }
            });

            saveHistory();
            renderHistoryList();
            showToast(`Đã nhập ${newCount}/${importCount} bản dịch mới!`, 'success');

        } catch (error) {
            console.error('Import error:', error);
            showToast('File không hợp lệ!', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    return num.toLocaleString('vi-VN');
}
