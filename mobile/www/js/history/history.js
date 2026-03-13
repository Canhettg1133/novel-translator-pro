/**
 * Novel Translator Pro - History Management
 * Quáº£n lĂ½ lá»‹ch sá»­ dá»‹ch
 */

// ============================================
// HISTORY MANAGEMENT
// ============================================
const HISTORY_STORAGE_KEY = 'novelTranslatorHistory';
const HISTORY_DB_NAME = 'NovelTranslatorDB';
const HISTORY_DB_VERSION = 1;
const HISTORY_DB_STORE = 'keyValue';
const HISTORY_DB_RECORD_KEY = 'translationHistory';
let historyDbPromise = null;
let historyWriteQueue = Promise.resolve();

function hasIndexedDBHistory() {
    return typeof indexedDB !== 'undefined';
}

function openHistoryDB() {
    if (!hasIndexedDBHistory()) {
        return Promise.reject(new Error('IndexedDB not supported'));
    }
    if (historyDbPromise) {
        return historyDbPromise;
    }

    historyDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(HISTORY_DB_NAME, HISTORY_DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(HISTORY_DB_STORE)) {
                db.createObjectStore(HISTORY_DB_STORE, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open history DB'));
    });

    return historyDbPromise;
}

function readHistoryFromIndexedDB() {
    if (!hasIndexedDBHistory()) {
        return Promise.resolve({ found: false, data: [] });
    }

    return openHistoryDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(HISTORY_DB_STORE, 'readonly');
        const store = tx.objectStore(HISTORY_DB_STORE);
        const req = store.get(HISTORY_DB_RECORD_KEY);

        req.onsuccess = () => {
            const value = req.result?.value;
            if (Array.isArray(value)) {
                resolve({ found: true, data: value });
            } else {
                resolve({ found: false, data: [] });
            }
        };
        req.onerror = () => reject(req.error || new Error('Failed to read history DB'));
    })).catch(err => {
        console.warn('[History] IndexedDB read failed:', err);
        return { found: false, data: [] };
    });
}

function writeHistoryToIndexedDB(data) {
    if (!hasIndexedDBHistory()) {
        return Promise.resolve(false);
    }

    return openHistoryDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(HISTORY_DB_STORE, 'readwrite');
        const store = tx.objectStore(HISTORY_DB_STORE);
        store.put({
            key: HISTORY_DB_RECORD_KEY,
            value: data,
            updatedAt: new Date().toISOString()
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('Failed to write history DB'));
        tx.onabort = () => reject(tx.error || new Error('History DB transaction aborted'));
    })).catch(err => {
        console.warn('[History] IndexedDB write failed:', err);
        return false;
    });
}

function persistHistoryFallbackToLocalStorage(saveData) {
    try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(saveData));
        return;
    } catch (e) {
        console.error('Error saving history (localStorage fallback):', e);

        if (e.name !== 'QuotaExceededError') {
            return;
        }

        translationHistory = translationHistory.slice(-5);
        try {
            const lightHistory = translationHistory.map(item => ({
                ...item,
                originalText: item.originalText ? item.originalText.substring(0, 2000) : '',
                translatedText: item.translatedText ? item.translatedText.substring(0, 2000) : '',
                chunks: []
            }));
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(lightHistory));
            showToast('Đã xóa bớt lịch sử cũ để tiết kiệm bộ nhớ.', 'warning');
        } catch (e2) {
            localStorage.removeItem(HISTORY_STORAGE_KEY);
            translationHistory = [];
            showToast('Đã xóa lịch sử để giải phóng bộ nhớ.', 'warning');
        }
    }
}

async function loadHistory() {
    translationHistory = [];

    const dbResult = await readHistoryFromIndexedDB();
    if (dbResult.found) {
        translationHistory = Array.isArray(dbResult.data) ? dbResult.data : [];
        return;
    }

    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!saved) {
        return;
    }

    try {
        const parsed = JSON.parse(saved);
        translationHistory = Array.isArray(parsed) ? parsed : [];

        const migrated = await writeHistoryToIndexedDB(translationHistory);
        if (migrated) {
            localStorage.removeItem(HISTORY_STORAGE_KEY);
        }
    } catch (e) {
        console.error('Error loading history:', e);
        translationHistory = [];
    }
}

function saveHistory() {
    if (translationHistory.length > 20) {
        translationHistory = translationHistory.slice(-20);
    }

    const saveData = translationHistory.map(item => ({
        ...item,
        chunks: []
    }));

    historyWriteQueue = historyWriteQueue
        .catch(() => { })
        .then(async () => {
            const savedToIndexedDB = await writeHistoryToIndexedDB(saveData);
            if (!savedToIndexedDB) {
                persistHistoryFallbackToLocalStorage(saveData);
            }
        });
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

    if (countBadge) countBadge.textContent = `${translationHistory.length} báº£n`;

    if (translationHistory.length === 0) {
        container.innerHTML = '<p class="empty-message">ChÆ°a cĂ³ lá»‹ch sá»­ dá»‹ch nĂ o.</p>';
        return;
    }

    const sorted = [...translationHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sorted.map(item => {
        const progress = Math.round((item.completedChunks / item.totalChunks) * 100);
        const statusIcon = item.isComplete ? 'âœ…' : 'â³';
        const date = new Date(item.date);
        const dateStr = date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="history-item" data-id="${item.id}">
                <span class="status-icon">${statusIcon}</span>
                <div class="history-info">
                    <div class="history-name">${escapeHtml(item.name)}</div>
                    <div class="history-meta">
                        <span>đŸ“… ${dateStr}</span>
                        <span>đŸ“ ${formatNumber(item.charCount)} chá»¯</span>
                        <span>đŸ“¦ ${item.completedChunks}/${item.totalChunks} chunks</span>
                    </div>
                </div>
                <div class="history-progress">
                    <div class="history-progress-fill ${item.isComplete ? 'complete' : ''}" style="width: ${progress}%"></div>
                </div>
                <div class="history-btns">
                    ${!item.isComplete ? `<button onclick="continueFromHistory('${item.id}')" title="Tiáº¿p tá»¥c dá»‹ch">â–¶ï¸</button>` : ''}
                    <button onclick="loadFromHistory('${item.id}')" title="Xem/Táº£i vá»">đŸ‘ï¸</button>
                    <button onclick="deleteFromHistory('${item.id}')" class="btn-delete" title="XĂ³a">đŸ—‘ï¸</button>
                </div>
            </div>
        `;
    }).join('');
}

function continueFromHistory(id) {
    const item = translationHistory.find(h => h.id === id);
    if (!item) {
        showToast('KhĂ´ng tĂ¬m tháº¥y lá»‹ch sá»­!', 'error');
        return;
    }

    if (item.isComplete) {
        showToast('Báº£n dá»‹ch nĂ y Ä‘Ă£ hoĂ n thĂ nh!', 'info');
        loadFromHistory(id);
        return;
    }

    if (isTranslating) {
        showToast('Äang cĂ³ báº£n dá»‹ch khĂ¡c Ä‘ang cháº¡y!', 'warning');
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
    showToast(`ÄĂ£ táº£i "${item.name}" - Tiáº¿p tá»¥c tá»« chunk ${completedChunks}/${totalChunksCount}`, 'success');
    document.getElementById('translateBtn').scrollIntoView({ behavior: 'smooth' });
}

function loadFromHistory(id) {
    const item = translationHistory.find(h => h.id === id);
    if (!item) {
        showToast('KhĂ´ng tĂ¬m tháº¥y lá»‹ch sá»­!', 'error');
        return;
    }

    document.getElementById('originalText').value = item.originalText;
    originalFileName = item.name;

    document.getElementById('translatedText').value = item.translatedText || '';
    document.getElementById('resultSection').style.display = 'block';

    updateStats();
    showToast(`ÄĂ£ táº£i "${item.name}"`, 'success');
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}

function deleteFromHistory(id) {
    if (!confirm('Báº¡n cĂ³ cháº¯c muá»‘n xĂ³a báº£n dá»‹ch nĂ y?')) {
        return;
    }

    translationHistory = translationHistory.filter(h => h.id !== id);
    saveHistory();
    renderHistoryList();
    showToast('ÄĂ£ xĂ³a khá»i lá»‹ch sá»­!', 'info');
}

function clearAllHistory() {
    if (translationHistory.length === 0) {
        showToast('Lá»‹ch sá»­ Ä‘Ă£ trá»‘ng!', 'info');
        return;
    }

    if (!confirm(`Báº¡n cĂ³ cháº¯c muá»‘n xĂ³a táº¥t cáº£ ${translationHistory.length} báº£n dá»‹ch?`)) {
        return;
    }

    translationHistory = [];
    saveHistory();
    renderHistoryList();
    showToast('ÄĂ£ xĂ³a táº¥t cáº£ lá»‹ch sá»­!', 'success');
}

function exportHistory() {
    if (translationHistory.length === 0) {
        showToast('KhĂ´ng cĂ³ lá»‹ch sá»­ Ä‘á»ƒ xuáº¥t!', 'warning');
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

    showToast(`ÄĂ£ xuáº¥t ${translationHistory.length} báº£n dá»‹ch!`, 'success');
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
            showToast(`ÄĂ£ nháº­p ${newCount}/${importCount} báº£n dá»‹ch má»›i!`, 'success');

        } catch (error) {
            console.error('Import error:', error);
            showToast('File khĂ´ng há»£p lá»‡!', 'error');
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

