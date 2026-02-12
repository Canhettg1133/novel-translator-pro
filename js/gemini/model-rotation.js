/**
 * Novel Translator Pro - Gemini Model Rotation
 * Xoay vòng model + key thông minh
 */

// ============================================
// MODEL KEY ERROR TRACKING
// ============================================
function recordModelKeyError(modelName, keyIndex, retryAfterSeconds = 60) {
    const pairId = `${modelName}|${keyIndex}`;
    if (!modelKeyHealthMap[pairId]) {
        modelKeyHealthMap[pairId] = { errorCount: 0, disabledUntil: null };
    }
    modelKeyHealthMap[pairId].errorCount++;
    modelKeyHealthMap[pairId].disabledUntil = Date.now() + (retryAfterSeconds * 1000);
    console.warn(`[Rotation] ${modelName} + Key ${keyIndex + 1} disabled for ${retryAfterSeconds}s`);
}

function isModelKeyAvailable(modelName, keyIndex) {
    const pairId = `${modelName}|${keyIndex}`;
    if (!modelKeyHealthMap[pairId]) return true;

    const health = modelKeyHealthMap[pairId];
    const now = Date.now();

    if (health.disabledUntil && now >= health.disabledUntil) {
        health.disabledUntil = null;
        health.errorCount = 0;
        console.log(`[Rotation] ${modelName} + Key ${keyIndex + 1} re-enabled`);
        return true;
    }

    return !health.disabledUntil;
}

function getAllAvailableCombinations() {
    const combinations = [];
    for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
        for (let modelIdx = 0; modelIdx < GEMINI_MODELS.length; modelIdx++) {
            const model = GEMINI_MODELS[modelIdx];
            if (isModelKeyAvailable(model.name, keyIdx)) {
                combinations.push({
                    model: model.name,
                    keyIndex: keyIdx,
                    key: apiKeys[keyIdx]
                });
            }
        }
    }
    return combinations;
}

function getNextModelKeyPair() {
    if (apiKeys.length === 0) {
        throw new Error('Không có API key nào! Vui lòng thêm ít nhất 1 key.');
    }

    const availableCombinations = getAllAvailableCombinations();

    if (availableCombinations.length === 0) {
        console.warn('[Round-Robin] All combinations disabled, forcing first available');
        return {
            model: GEMINI_MODELS[0].name,
            keyIndex: 0,
            key: apiKeys[0]
        };
    }

    const index = globalRotationCounter % availableCombinations.length;
    globalRotationCounter++;

    const selected = availableCombinations[index];
    console.log(`[Round-Robin] #${globalRotationCounter}: Key ${selected.keyIndex + 1}/${apiKeys.length}, Model ${selected.model}`);

    return selected;
}

function resetRotationSystem() {
    globalRotationCounter = 0;
    modelKeyHealthMap = {};
    requestTimestamps = {};
    console.log('[Round-Robin] Full rotation system reset');
}

// ============================================
// REQUEST QUEUE WITH RATE LIMITING
// ============================================
function getRecentRequestCount(modelName, keyIndex) {
    const pairId = `${modelName}|${keyIndex}`;
    if (!requestTimestamps[pairId]) return 0;

    const oneMinuteAgo = Date.now() - 60000;
    requestTimestamps[pairId] = requestTimestamps[pairId].filter(ts => ts > oneMinuteAgo);
    return requestTimestamps[pairId].length;
}

function recordRequestTimestamp(modelName, keyIndex) {
    const pairId = `${modelName}|${keyIndex}`;
    if (!requestTimestamps[pairId]) {
        requestTimestamps[pairId] = [];
    }
    requestTimestamps[pairId].push(Date.now());
}

function getModelQuota(modelName) {
    const model = GEMINI_MODELS.find(m => m.name === modelName);
    return model ? model.quota : 5;
}

function isPairUnderQuota(modelName, keyIndex) {
    const recentCount = getRecentRequestCount(modelName, keyIndex);
    const quota = getModelQuota(modelName);
    return recentCount < quota;
}

function getBestAvailablePair() {
    if (apiKeys.length === 0) {
        throw new Error('Không có API key nào! Vui lòng thêm ít nhất 1 key.');
    }

    const scoredCombinations = [];

    for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
        for (let modelIdx = 0; modelIdx < GEMINI_MODELS.length; modelIdx++) {
            const model = GEMINI_MODELS[modelIdx];

            if (!isModelKeyAvailable(model.name, keyIdx)) continue;

            const recentCount = getRecentRequestCount(model.name, keyIdx);
            const quota = model.quota;
            const remainingQuota = quota - recentCount;

            if (remainingQuota > 0) {
                scoredCombinations.push({
                    model: model.name,
                    keyIndex: keyIdx,
                    key: apiKeys[keyIdx],
                    remainingQuota: remainingQuota,
                    score: remainingQuota / quota
                });
            }
        }
    }

    if (scoredCombinations.length === 0) {
        console.warn('[Queue] All pairs at quota limit, using round-robin fallback');
        return getNextModelKeyPair();
    }

    scoredCombinations.sort((a, b) => b.score - a.score);

    const selected = scoredCombinations[0];
    console.log(`[Queue] Selected: Key ${selected.keyIndex + 1}, Model ${selected.model} (${selected.remainingQuota} quota left)`);

    return selected;
}

function getNextModelKeyPairWithQueue() {
    const pair = getBestAvailablePair();
    recordRequestTimestamp(pair.model, pair.keyIndex);
    return pair;
}

// ============================================
// KEY HEALTH MANAGEMENT
// ============================================
function initKeyHealth(keyIndex) {
    if (!keyHealthMap[keyIndex]) {
        keyHealthMap[keyIndex] = {
            errorCount: 0,
            successCount: 0,
            totalRequests: 0,
            lastError: null,
            lastErrorTime: null,
            disabledUntil: null,
            rateLimitHits: 0
        };
    }
}

function recordKeySuccess(keyIndex) {
    initKeyHealth(keyIndex);
    const health = keyHealthMap[keyIndex];
    health.successCount++;
    health.totalRequests++;
    health.errorCount = Math.max(0, health.errorCount - 1);
    health.rateLimitHits = Math.max(0, health.rateLimitHits - 1);
}

function recordKeyError(keyIndex, errorType, retryAfterSeconds = 60) {
    initKeyHealth(keyIndex);
    const health = keyHealthMap[keyIndex];
    health.totalRequests++;
    health.errorCount++;
    health.lastError = errorType;
    health.lastErrorTime = Date.now();

    if (errorType === 'RATE_LIMIT') {
        health.rateLimitHits++;
        health.disabledUntil = Date.now() + (retryAfterSeconds * 1000);
        console.warn(`[Key ${keyIndex + 1}] Disabled for ${retryAfterSeconds}s due to rate limiting`);
    } else if (errorType === 'NOT_FOUND') {
        console.log(`[Key ${keyIndex + 1}] Model not found, but key still valid`);
    } else if (errorType === 'INVALID_KEY') {
        health.disabledUntil = Date.now() + (retryAfterSeconds * 1000);
        console.error(`[Key ${keyIndex + 1}] ❌ INVALID - Disabled for 24h.`);
    } else if (health.errorCount >= 3) {
        health.disabledUntil = Date.now() + 300000;
        console.warn(`[Key ${keyIndex + 1}] Disabled for 5 min due to errors`);
        showToast(`API Key ${keyIndex + 1} tạm dừng 5 phút`, 'warning');
    }
}

function getActiveKeyCount() {
    const now = Date.now();
    let count = 0;
    for (let i = 0; i < apiKeys.length; i++) {
        initKeyHealth(i);
        const health = keyHealthMap[i];
        if (!health.disabledUntil || now >= health.disabledUntil) {
            count++;
        }
    }
    return count;
}

function getKeyStatus(keyIndex) {
    initKeyHealth(keyIndex);
    const health = keyHealthMap[keyIndex];
    const now = Date.now();

    if (health.disabledUntil && now < health.disabledUntil) {
        const remainingSec = Math.ceil((health.disabledUntil - now) / 1000);
        return { status: 'disabled', message: `Tạm dừng (${remainingSec}s)`, color: 'red' };
    }

    const successRate = health.totalRequests > 0
        ? Math.round((health.successCount / health.totalRequests) * 100)
        : 100;

    if (successRate >= 90) {
        return { status: 'healthy', message: `Tốt (${successRate}%)`, color: 'green' };
    } else if (successRate >= 70) {
        return { status: 'warning', message: `Trung bình (${successRate}%)`, color: 'orange' };
    } else {
        return { status: 'poor', message: `Yếu (${successRate}%)`, color: 'red' };
    }
}

function resetKeyHealth() {
    keyHealthMap = {};
    console.log('[Keys] All key health reset');
}

// ============================================
// EXPORT API KEYS (Simple - only keys)
// ============================================
function exportApiKeys() {
    console.log('========== DANH SÁCH API KEYS ==========');

    if (apiKeys.length === 0) {
        showToast('Không có API key nào trong hệ thống!', 'info');
        return;
    }

    // Chỉ xuất danh sách keys, mỗi dòng 1 key
    const fullKeyList = apiKeys.join('\n');

    // Log to console
    apiKeys.forEach((key, index) => {
        console.log(`Key ${index + 1}: ${key}`);
    });

    const modal = document.createElement('div');
    modal.id = 'keyExportModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
    `;

    modal.innerHTML = `
        <div style="
            background: #1a1a2e;
            border: 1px solid #6366f1;
            border-radius: 12px;
            padding: 20px;
            max-width: 90%;
            max-height: 80%;
            display: flex;
            flex-direction: column;
        ">
            <h3 style="color: #fff; margin: 0 0 15px 0;">📋 Xuất API Keys (${apiKeys.length} keys)</h3>
            <p style="color: #888; margin: 0 0 10px 0; font-size: 13px;">Mỗi dòng 1 key - Copy và paste vào nơi khác để backup</p>
            <textarea id="keyExportTextarea" readonly style="
                width: 600px;
                max-width: 100%;
                height: 300px;
                background: #0a0a0f;
                color: #10b981;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 15px;
                font-family: monospace;
                font-size: 13px;
                resize: none;
            ">${fullKeyList}</textarea>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button onclick="copyExportedKeys()" style="
                    flex: 1;
                    padding: 12px;
                    background: #6366f1;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">📋 Copy tất cả</button>
                <button onclick="closeKeyModal()" style="
                    flex: 1;
                    padding: 12px;
                    background: #333;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">✕ Đóng</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    setTimeout(() => {
        document.getElementById('keyExportTextarea').select();
    }, 100);

    return apiKeys;
}

function copyExportedKeys() {
    const textarea = document.getElementById('keyExportTextarea');
    textarea.select();
    document.execCommand('copy');
    showToast('Đã copy ' + apiKeys.length + ' API keys!', 'success');
}

function closeKeyModal() {
    const modal = document.getElementById('keyExportModal');
    if (modal) {
        modal.remove();
    }
}

// ============================================
// IMPORT API KEYS (Bulk import)
// ============================================
function openImportApiKeysModal() {
    const modal = document.createElement('div');
    modal.id = 'keyImportModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
    `;

    modal.innerHTML = `
        <div style="
            background: #1a1a2e;
            border: 1px solid #10b981;
            border-radius: 12px;
            padding: 20px;
            max-width: 90%;
            max-height: 80%;
            display: flex;
            flex-direction: column;
        ">
            <h3 style="color: #fff; margin: 0 0 10px 0;">📥 Nhập nhiều API Keys</h3>
            <p style="color: #888; margin: 0 0 5px 0; font-size: 13px;">Paste danh sách API keys vào đây. Hỗ trợ các định dạng:</p>
            <ul style="color: #888; margin: 0 0 15px 0; font-size: 12px; padding-left: 20px;">
                <li>Mỗi dòng 1 key</li>
                <li>Keys phân cách bằng dấu phẩy (,)</li>
                <li>Keys phân cách bằng dấu chấm phẩy (;)</li>
            </ul>
            <textarea id="keyImportTextarea" placeholder="AIzaSyB...&#10;AIzaSyC...&#10;AIzaSyD...&#10;&#10;hoặc: AIzaSyB..., AIzaSyC..., AIzaSyD..." style="
                width: 600px;
                max-width: 100%;
                height: 250px;
                background: #0a0a0f;
                color: #10b981;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 15px;
                font-family: monospace;
                font-size: 13px;
                resize: none;
            "></textarea>
            <div id="importPreview" style="
                color: #888; 
                font-size: 12px; 
                margin-top: 10px;
                padding: 8px;
                background: rgba(0,0,0,0.3);
                border-radius: 6px;
            ">Paste danh sách keys để xem preview...</div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button onclick="executeImportApiKeys()" style="
                    flex: 1;
                    padding: 12px;
                    background: #10b981;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">✅ Nhập keys</button>
                <button onclick="closeImportModal()" style="
                    flex: 1;
                    padding: 12px;
                    background: #333;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">✕ Hủy</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add live preview
    const textarea = document.getElementById('keyImportTextarea');
    textarea.addEventListener('input', updateImportPreview);
    textarea.focus();
}

function updateImportPreview() {
    const textarea = document.getElementById('keyImportTextarea');
    const previewDiv = document.getElementById('importPreview');
    const rawText = textarea.value;

    if (!rawText.trim()) {
        previewDiv.innerHTML = 'Paste danh sách keys để xem preview...';
        previewDiv.style.color = '#888';
        return;
    }

    const result = parseApiKeysFromText(rawText);

    if (result.validKeys.length === 0) {
        previewDiv.innerHTML = `❌ Không tìm thấy API key hợp lệ nào!<br>Keys phải bắt đầu bằng "AIza" và dài hơn 30 ký tự.`;
        previewDiv.style.color = '#ef4444';
    } else {
        let html = `✅ Tìm thấy <strong style="color:#10b981">${result.validKeys.length}</strong> keys hợp lệ`;

        if (result.duplicates > 0) {
            html += ` | ⚠️ <strong style="color:#f59e0b">${result.duplicates}</strong> keys trùng lặp (sẽ bỏ qua)`;
        }

        if (result.alreadyExists > 0) {
            html += ` | 📌 <strong style="color:#3b82f6">${result.alreadyExists}</strong> keys đã tồn tại`;
        }

        if (result.invalid > 0) {
            html += ` | ❌ <strong style="color:#ef4444">${result.invalid}</strong> keys không hợp lệ`;
        }

        html += `<br>Sẽ thêm: <strong style="color:#10b981">${result.newKeys.length}</strong> keys mới`;

        previewDiv.innerHTML = html;
        previewDiv.style.color = '#ccc';
    }
}

function parseApiKeysFromText(text) {
    // Tách theo nhiều ký tự: xuống dòng, dấu phẩy, dấu chấm phẩy, tab
    const separators = /[\n\r,;]+/;
    const rawKeys = text.split(separators).map(k => k.trim()).filter(k => k.length > 0);

    const validKeys = [];
    const newKeys = [];
    let duplicates = 0;
    let alreadyExists = 0;
    let invalid = 0;

    const seen = new Set();

    for (const key of rawKeys) {
        // Validate key format
        if (!key.startsWith('AIza') || key.length < 30) {
            invalid++;
            continue;
        }

        // Check duplicate trong input
        if (seen.has(key)) {
            duplicates++;
            continue;
        }
        seen.add(key);

        validKeys.push(key);

        // Check đã tồn tại trong hệ thống chưa
        if (apiKeys.includes(key)) {
            alreadyExists++;
        } else {
            newKeys.push(key);
        }
    }

    return { validKeys, newKeys, duplicates, alreadyExists, invalid };
}

function executeImportApiKeys() {
    const textarea = document.getElementById('keyImportTextarea');
    const rawText = textarea.value;

    if (!rawText.trim()) {
        showToast('Vui lòng paste danh sách API keys!', 'warning');
        return;
    }

    const result = parseApiKeysFromText(rawText);

    if (result.newKeys.length === 0) {
        if (result.alreadyExists > 0) {
            showToast(`Tất cả ${result.alreadyExists} keys đã tồn tại trong hệ thống!`, 'info');
        } else {
            showToast('Không tìm thấy API key hợp lệ nào!', 'error');
        }
        return;
    }

    // Thêm các keys mới
    for (const key of result.newKeys) {
        apiKeys.push(key);
    }

    // Cập nhật UI
    renderApiKeysList();
    saveSettings();
    closeImportModal();

    // Thông báo kết quả
    let message = `✅ Đã thêm ${result.newKeys.length} API keys mới!`;
    if (result.alreadyExists > 0) {
        message += ` (${result.alreadyExists} keys đã tồn tại được bỏ qua)`;
    }
    showToast(message, 'success');

    console.log(`[Import] Added ${result.newKeys.length} new keys:`, result.newKeys);
}

function closeImportModal() {
    const modal = document.getElementById('keyImportModal');
    if (modal) {
        modal.remove();
    }
}

