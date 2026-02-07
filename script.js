/**
 * Novel Translator Pro - Gemini AI
 * Dịch truyện chữ siêu nhanh với Smart Key + Model Management
 */

// ============================================
// GLOBAL VARIABLES
// ============================================
let apiKeys = [];
let translationHistory = [];
let currentHistoryId = null;
let originalFileName = 'translated_novel.txt';
let isTranslating = false;
let cancelRequested = false;
let isPaused = false;
let translatedChunks = [];
let originalChunks = [];
let startTime = null;
let completedChunks = 0;
let totalChunksCount = 0;

// ============================================
// PROMPT TEMPLATES - Tối ưu cho từng thể loại
// ============================================
const PROMPT_TEMPLATES = {
    convert: `[QUAN TRỌNG: CHỈ TRẢ VỀ VĂN BẢN ĐÃ VIẾT LẠI. KHÔNG GIẢI THÍCH. KHÔNG NÓI "Dưới đây là...". KHÔNG LỜI MỞ ĐẦU. BẮT ĐẦU NGAY VỚI NỘI DUNG.]

Bạn là biên tập viên chuyên xử lý truyện convert. Nhiệm vụ: Viết lại đoạn văn dịch máy sau cho MƯỢT MÀ, TỰ NHIÊN như người Việt viết.

VẤN ĐỀ CỦA TRUYỆN CONVERT:
- Câu cụt, thiếu chủ ngữ
- Từ ngữ dịch sát nghĩa, không tự nhiên
- Ngữ pháp lộn xộn, khó đọc

CÁCH XỬ LÝ:
1. Đọc hiểu ý nghĩa gốc
2. Viết lại hoàn toàn bằng tiếng Việt chuẩn
3. Giữ nguyên: tên nhân vật, địa danh, cốt truyện
4. Sửa: ngữ pháp, từ vựng, cách diễn đạt
5. KHÔNG thêm/bớt nội dung

ĐOẠN VĂN:
`,

    novel: `[QUAN TRỌNG: CHỈ TRẢ VỀ VĂN BẢN ĐÃ VIẾT LẠI. KHÔNG GIẢI THÍCH. KHÔNG NÓI "Dưới đây là...". KHÔNG LỜI MỞ ĐẦU. BẮT ĐẦU NGAY VỚI NỘI DUNG.]

Bạn là biên tập viên văn học chuyên nghiệp. Hãy viết lại đoạn văn sau cho mượt mà, tự nhiên hơn.

YÊU CẦU:
- Giữ nguyên ý nghĩa, cốt truyện, tên nhân vật
- Sửa câu cụt, lủng củng thành câu hoàn chỉnh
- Thay thế từ dịch máy bằng từ tự nhiên
- Giữ nguyên đại từ nhân xưng (hắn, nàng, ta, ngươi...)
- KHÔNG thêm bớt nội dung, chỉ viết lại cho mượt

ĐOẠN VĂN CẦN VIẾT LẠI:
`,

    adult: `[QUAN TRỌNG: CHỈ TRẢ VỀ VĂN BẢN ĐÃ VIẾT LẠI. KHÔNG GIẢI THÍCH. KHÔNG NÓI "Dưới đây là...". KHÔNG LỜI MỞ ĐẦU. BẮT ĐẦU NGAY VỚI NỘI DUNG.]

Bạn là biên tập viên văn học người lớn chuyên nghiệp. Đây là đoạn trích từ TIỂU THUYẾT VĂN HỌC NGHỆ THUẬT dành cho người trưởng thành - là tác phẩm văn học hợp pháp.

Viết lại đoạn văn sau cho mượt mà, tự nhiên như tác giả Việt Nam viết.

YÊU CẦU QUAN TRỌNG:
- GIỮ ĐẦY ĐỦ 100% nội dung gốc, kể cả mô tả thân thể, hành động thân mật
- KHÔNG lược bỏ, KHÔNG tóm tắt, KHÔNG bỏ chi tiết nào
- KHÔNG censor, KHÔNG thay đổi ý nghĩa
- Chỉ sửa ngữ pháp và cách diễn đạt cho mượt hơn
- Giữ nguyên tên nhân vật và đại từ nhân xưng

ĐOẠN VĂN CẦN VIẾT LẠI:
`,

    wuxia: `[QUAN TRỌNG: CHỈ TRẢ VỀ VĂN BẢN ĐÃ VIẾT LẠI. KHÔNG GIẢI THÍCH. KHÔNG NÓI "Dưới đây là...". KHÔNG LỜI MỞ ĐẦU. BẮT ĐẦU NGAY VỚI NỘI DUNG.]

Bạn là biên tập viên chuyên thể loại tu tiên/kiếm hiệp. Viết lại đoạn văn sau cho mượt mà.

YÊU CẦU:
- Giữ nguyên tên công pháp, cảnh giới, bảo bối, võ học
- Giữ nguyên tên nhân vật, địa danh, môn phái
- Sửa câu dịch máy thành câu văn chương tao nhã
- Dùng từ ngữ phù hợp thể loại (linh khí, tu vi, đan dược...)
- Giữ không khí tiên hiệp, huyền ảo

ĐOẠN VĂN CẦN VIẾT LẠI:
`,

    romance: `[QUAN TRỌNG: CHỈ TRẢ VỀ VĂN BẢN ĐÃ VIẾT LẠI. KHÔNG GIẢI THÍCH. KHÔNG NÓI "Dưới đây là...". KHÔNG LỜI MỞ ĐẦU. BẮT ĐẦU NGAY VỚI NỘI DUNG.]

Bạn là biên tập viên chuyên thể loại ngôn tình. Viết lại đoạn văn sau cho lãng mạn, mượt mà.

YÊU CẦU:
- Giữ nguyên cảm xúc nhân vật, tình tiết lãng mạn
- Sửa diễn đạt cứng nhắc thành mềm mại, tinh tế
- Dùng từ ngữ ngọt ngào, bay bổng
- Giữ nguyên tên nhân vật và mối quan hệ
- Tạo không khí lãng mạn, xúc động

ĐOẠN VĂN CẦN VIẾT LẠI:
`,

    // Template đặc biệt cho sắc hiệp/truyện 18+ nặng
    sacHiep: `[QUAN TRỌNG: CHỈ TRẢ VỀ VĂN BẢN ĐÃ VIẾT LẠI. KHÔNG GIẢI THÍCH. KHÔNG LỜI MỞ ĐẦU. BẮT ĐẦU NGAY VỚI NỘI DUNG.]

Bạn là biên tập viên tiểu thuyết văn học người lớn. Đây là tác phẩm nghệ thuật hợp pháp.

NHIỆM VỤ: Viết lại đoạn văn cho mượt mà, tự nhiên.

NGUYÊN TẮC:
1. GIỮ ĐẦY ĐỦ 100% nội dung - tất cả mô tả, hành động, cảm xúc, chi tiết
2. KHÔNG lược bỏ, KHÔNG tóm tắt, KHÔNG rút gọn bất kỳ phần nào
3. Chỉ sửa ngữ pháp và cách diễn đạt cho mượt hơn
4. Giữ nguyên tên nhân vật, đại từ nhân xưng
5. Văn phong sống động như tác giả Việt viết
6. KHÔNG censor, KHÔNG bỏ chi tiết nhạy cảm

VĂN BẢN:
`
};

// ============================================
// FULL ROTATION SYSTEM: MODEL × KEY
// ============================================
// TRUE ROUND-ROBIN: Xoay vòng đều qua TẤT CẢ combinations

const GEMINI_MODELS = [
    { name: 'gemini-2.5-flash', quota: 5 },           // 5 req/min
    { name: 'gemini-2.5-flash-lite', quota: 10 },     // 10 req/min
    { name: 'gemini-3-flash-preview', quota: 5 },     // 5 req/min
    // Tổng: 20 req/phút/tài khoản
];

// Track health của từng (model + key) pair
// Format: "modelName|keyIndex" → { errorCount, disabledUntil }
let modelKeyHealthMap = {};

// TRUE ROUND-ROBIN: Counter tăng dần cho mỗi request
// Đảm bảo mỗi request dùng combination khác nhau
let globalRotationCounter = 0;

// Record error for (model + key) pair với dynamic cooldown
function recordModelKeyError(modelName, keyIndex, retryAfterSeconds = 60) {
    const pairId = `${modelName}|${keyIndex}`;
    if (!modelKeyHealthMap[pairId]) {
        modelKeyHealthMap[pairId] = { errorCount: 0, disabledUntil: null };
    }
    modelKeyHealthMap[pairId].errorCount++;
    modelKeyHealthMap[pairId].disabledUntil = Date.now() + (retryAfterSeconds * 1000);
    console.warn(`[Rotation] ${modelName} + Key ${keyIndex + 1} disabled for ${retryAfterSeconds}s`);
}

// Check if (model + key) pair is available
function isModelKeyAvailable(modelName, keyIndex) {
    const pairId = `${modelName}|${keyIndex}`;
    if (!modelKeyHealthMap[pairId]) return true;

    const health = modelKeyHealthMap[pairId];
    const now = Date.now();

    // Re-enable if cooldown passed
    if (health.disabledUntil && now >= health.disabledUntil) {
        health.disabledUntil = null;
        health.errorCount = 0;
        console.log(`[Rotation] ${modelName} + Key ${keyIndex + 1} re-enabled`);
        return true;
    }

    return !health.disabledUntil;
}

// Get ALL available (model, key) combinations
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

// TRUE ROUND-ROBIN: Lấy combination tiếp theo
// Mỗi lần gọi sẽ trả về combination KHÁC NHAU
function getNextModelKeyPair() {
    if (apiKeys.length === 0) {
        throw new Error('Không có API key nào! Vui lòng thêm ít nhất 1 key.');
    }

    const availableCombinations = getAllAvailableCombinations();

    if (availableCombinations.length === 0) {
        // Tất cả đều disabled → force reset và dùng combination đầu tiên
        console.warn('[Round-Robin] All combinations disabled, forcing first available');
        return {
            model: GEMINI_MODELS[0].name,
            keyIndex: 0,
            key: apiKeys[0]
        };
    }

    // TRUE ROUND-ROBIN: Dùng counter để xoay vòng đều
    const index = globalRotationCounter % availableCombinations.length;
    globalRotationCounter++;

    const selected = availableCombinations[index];
    console.log(`[Round-Robin] #${globalRotationCounter}: Key ${selected.keyIndex + 1}/${apiKeys.length}, Model ${selected.model}`);

    return selected;
}

// Reset rotation system
function resetRotationSystem() {
    globalRotationCounter = 0;
    modelKeyHealthMap = {};
    requestTimestamps = {};
    console.log('[Round-Robin] Full rotation system reset');
}


// ============================================
// REQUEST QUEUE WITH RATE LIMITING
// ============================================
// Track timestamps of requests per (model + key) pair
let requestTimestamps = {}; // Format: "modelName|keyIndex" → [timestamp1, timestamp2, ...]

// Get request count in last minute for a pair
function getRecentRequestCount(modelName, keyIndex) {
    const pairId = `${modelName}|${keyIndex}`;
    if (!requestTimestamps[pairId]) return 0;

    const oneMinuteAgo = Date.now() - 60000;
    // Clean old timestamps
    requestTimestamps[pairId] = requestTimestamps[pairId].filter(ts => ts > oneMinuteAgo);
    return requestTimestamps[pairId].length;
}

// Record a request timestamp
function recordRequestTimestamp(modelName, keyIndex) {
    const pairId = `${modelName}|${keyIndex}`;
    if (!requestTimestamps[pairId]) {
        requestTimestamps[pairId] = [];
    }
    requestTimestamps[pairId].push(Date.now());
}

// Get quota for a model
function getModelQuota(modelName) {
    const model = GEMINI_MODELS.find(m => m.name === modelName);
    return model ? model.quota : 5; // Default 5 req/min
}

// Check if a pair is under quota
function isPairUnderQuota(modelName, keyIndex) {
    const recentCount = getRecentRequestCount(modelName, keyIndex);
    const quota = getModelQuota(modelName);
    return recentCount < quota;
}

// Get BEST available pair (under quota + not disabled)
function getBestAvailablePair() {
    if (apiKeys.length === 0) {
        throw new Error('Không có API key nào! Vui lòng thêm ít nhất 1 key.');
    }

    // Sort combinations by: 1) availability, 2) recent request count (lowest first)
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
                    score: remainingQuota / quota // 0-1, higher = better
                });
            }
        }
    }

    if (scoredCombinations.length === 0) {
        // Tất cả đã hết quota → fallback to round-robin
        console.warn('[Queue] All pairs at quota limit, using round-robin fallback');
        return getNextModelKeyPair();
    }

    // Sort by score (highest first) then by round-robin counter
    scoredCombinations.sort((a, b) => b.score - a.score);

    // Pick the best one
    const selected = scoredCombinations[0];
    console.log(`[Queue] Selected: Key ${selected.keyIndex + 1}, Model ${selected.model} (${selected.remainingQuota} quota left)`);

    return selected;
}

// Wrapper function that uses queue-aware selection
function getNextModelKeyPairWithQueue() {
    const pair = getBestAvailablePair();
    recordRequestTimestamp(pair.model, pair.keyIndex);
    return pair;
}



// ============================================
// SMART KEY MANAGEMENT
// ============================================
// Track key health: { keyIndex: { errorCount, lastError, disabledUntil, successCount, totalRequests } }
let keyHealthMap = {};

// Initialize key health for a key
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

// Get the best available key (not disabled, lowest error rate)
function getBestAvailableKey() {
    const now = Date.now();
    let bestKeyIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < apiKeys.length; i++) {
        initKeyHealth(i);
        const health = keyHealthMap[i];

        // Skip disabled keys
        if (health.disabledUntil && now < health.disabledUntil) {
            continue;
        }

        // Re-enable if disabled time has passed
        if (health.disabledUntil && now >= health.disabledUntil) {
            health.disabledUntil = null;
            health.errorCount = Math.floor(health.errorCount / 2); // Reduce error count
            console.log(`[Key ${i + 1}] Re-enabled after cooldown`);
        }

        // Calculate score: higher success rate = better
        const successRate = health.totalRequests > 0
            ? health.successCount / health.totalRequests
            : 1; // New keys get full score
        const score = successRate - (health.errorCount * 0.1) - (health.rateLimitHits * 0.2);

        if (score > bestScore) {
            bestScore = score;
            bestKeyIndex = i;
        }
    }

    return bestKeyIndex;
}

// Get next available key for parallel processing (round-robin but skip disabled)
function getNextAvailableKey(startIndex) {
    const now = Date.now();
    for (let i = 0; i < apiKeys.length; i++) {
        const idx = (startIndex + i) % apiKeys.length;
        initKeyHealth(idx);
        const health = keyHealthMap[idx];

        // Re-enable if time passed
        if (health.disabledUntil && now >= health.disabledUntil) {
            health.disabledUntil = null;
            health.errorCount = Math.floor(health.errorCount / 2);
        }

        if (!health.disabledUntil || now >= health.disabledUntil) {
            return idx;
        }
    }
    return startIndex % apiKeys.length; // Fallback
}

// Record successful API call
function recordKeySuccess(keyIndex) {
    initKeyHealth(keyIndex);
    const health = keyHealthMap[keyIndex];
    health.successCount++;
    health.totalRequests++;
    health.errorCount = Math.max(0, health.errorCount - 1); // Decrease error count on success
    health.rateLimitHits = Math.max(0, health.rateLimitHits - 1);
}

// Record failed API call với dynamic cooldown
function recordKeyError(keyIndex, errorType, retryAfterSeconds = 60) {
    initKeyHealth(keyIndex);
    const health = keyHealthMap[keyIndex];
    health.totalRequests++;
    health.errorCount++;
    health.lastError = errorType;
    health.lastErrorTime = Date.now();

    if (errorType === 'RATE_LIMIT') {
        health.rateLimitHits++;
        // Dynamic cooldown based on API response - disable ngay lần đầu
        health.disabledUntil = Date.now() + (retryAfterSeconds * 1000);
        console.warn(`[Key ${keyIndex + 1}] Disabled for ${retryAfterSeconds}s due to rate limiting`);
    } else if (errorType === 'NOT_FOUND') {
        // Model không tồn tại - không disable key vì key vẫn hoạt động với models khác
        console.log(`[Key ${keyIndex + 1}] Model not found, but key still valid`);
    } else if (errorType === 'INVALID_KEY') {
        // API Key không hợp lệ - disable vĩnh viễn (24h)
        health.disabledUntil = Date.now() + (retryAfterSeconds * 1000);
        console.error(`[Key ${keyIndex + 1}] ❌ INVALID - Disabled for 24h. Please remove this key.`);
    } else if (health.errorCount >= 3) {
        // Disable for 5 minutes after 3 consecutive errors
        health.disabledUntil = Date.now() + 300000;
        console.warn(`[Key ${keyIndex + 1}] Disabled for 5 min due to errors`);
        showToast(`API Key ${keyIndex + 1} tạm dừng 5 phút (lỗi liên tục)`, 'warning');
    }
}

// Get count of active (non-disabled) keys
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

// Get key status for display
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

// Reset all key health (when user wants to retry)
function resetKeyHealth() {
    keyHealthMap = {};
    console.log('[Keys] All key health reset');
}

// ========== EXPORT API KEYS - Hiển thị danh sách keys ==========
function exportApiKeys() {
    console.log('========== DANH SÁCH API KEYS ==========');

    if (apiKeys.length === 0) {
        console.log('Không có API key nào!');
        // alert('Không có API key nào trong hệ thống!'); // Removed alert
        showToast('Không có API key nào trong hệ thống!', 'info');
        return;
    }

    // Tạo danh sách keys đầy đủ
    let fullKeyList = '';
    apiKeys.forEach((key, index) => {
        const health = keyHealthMap[index] || {};
        let status = 'OK';

        if (health.disabledUntil && Date.now() < health.disabledUntil) {
            const remaining = Math.ceil((health.disabledUntil - Date.now()) / 1000);
            status = `Disabled (${remaining}s)`;
        } else if (health.lastError === 'INVALID_KEY') {
            status = 'INVALID';
        }

        fullKeyList += `${index + 1}. ${key} [${status}]\n`;
        console.log(`Key ${index + 1}: ${key} | ${status}`);
    });

    // Tạo modal popup
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
            <h3 style="color: #fff; margin: 0 0 15px 0;">📋 Danh sách API Keys (${apiKeys.length} keys)</h3>
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

    // Select all text
    setTimeout(() => {
        document.getElementById('keyExportTextarea').select();
    }, 100);

    return apiKeys;
}

// Copy keys từ modal
function copyExportedKeys() {
    const textarea = document.getElementById('keyExportTextarea');
    textarea.select();
    document.execCommand('copy');
    showToast('Đã copy ' + apiKeys.length + ' API keys!', 'success');
}

// Đóng modal
function closeKeyModal() {
    const modal = document.getElementById('keyExportModal');
    if (modal) {
        modal.remove();
    }
}

// Expose function globally for console access
window.exportApiKeys = exportApiKeys;
window.copyExportedKeys = copyExportedKeys;
window.closeKeyModal = closeKeyModal;
window.listKeys = () => {
    console.table(apiKeys.map((key, i) => ({
        '#': i + 1,
        'Key': key
    })));
    return apiKeys;
};


// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadSettings();
    loadHistory();
    setupEventListeners();
    updateStats();
    renderApiKeysList();
    renderHistoryList();

    // Set default prompt to Convert if empty
    const promptEl = document.getElementById('customPrompt');
    if (!promptEl.value.trim()) {
        promptEl.value = PROMPT_TEMPLATES.convert;
    }
}

function setupEventListeners() {
    // File input
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // Click to upload - prevent double trigger
    uploadArea.addEventListener('click', (e) => {
        // Only trigger if not clicking on the input itself
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    // Text input
    const originalText = document.getElementById('originalText');
    originalText.addEventListener('input', updateStats);

    // Settings auto-save
    ['sourceLang', 'parallelCount', 'chunkSize', 'delayMs'].forEach(id => {
        document.getElementById(id).addEventListener('change', saveSettings);
    });

    // Enter key for adding API
    document.getElementById('newApiKey').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addApiKey();
    });
}

// ============================================
// API KEYS MANAGEMENT
// ============================================
function addApiKey() {
    const input = document.getElementById('newApiKey');
    const key = input.value.trim();

    if (!key) {
        showToast('Vui lòng nhập API Key!', 'warning');
        return;
    }

    // Check for duplicates
    if (apiKeys.includes(key)) {
        showToast('API Key này đã tồn tại!', 'error');
        input.value = '';
        input.focus();
        return;
    }

    // Basic validation (Google API keys usually start with AIza)
    if (!key.startsWith('AIza') || key.length < 30) {
        showToast('API Key không hợp lệ! Key phải bắt đầu bằng "AIza"', 'error');
        return;
    }

    apiKeys.push(key);
    input.value = '';
    renderApiKeysList();
    saveSettings();
    showToast('Đã thêm API Key thành công!', 'success');
}

function removeApiKey(index) {
    apiKeys.splice(index, 1);
    // Also remove health data for this key
    delete keyHealthMap[index];
    // Re-index remaining keys
    const newHealthMap = {};
    Object.keys(keyHealthMap).forEach(oldIdx => {
        const newIdx = parseInt(oldIdx) > index ? parseInt(oldIdx) - 1 : parseInt(oldIdx);
        if (newIdx >= 0) newHealthMap[newIdx] = keyHealthMap[oldIdx];
    });
    keyHealthMap = newHealthMap;

    renderApiKeysList();
    saveSettings();
    showToast('Đã xóa API Key!', 'info');
}

function resetRotationAndRefresh() {
    resetRotationSystem(); // Reset full rotation system
    resetKeyHealth();       // Reset key health
    renderApiKeysList();
    showToast('Đã reset toàn bộ rotation system!', 'success');
}


function renderApiKeysList() {
    const container = document.getElementById('apiKeysList');
    const countBadge = document.getElementById('apiCount');
    const activeCount = getActiveKeyCount();

    countBadge.textContent = `${activeCount}/${apiKeys.length} keys`;
    countBadge.style.background = activeCount === apiKeys.length ? 'var(--success)' : 'var(--warning)';

    if (apiKeys.length === 0) {
        container.innerHTML = '<p class="empty-message">Chưa có API key nào. Thêm ít nhất 1 key để bắt đầu dịch.</p>';
        return;
    }

    container.innerHTML = apiKeys.map((key, index) => {
        const status = getKeyStatus(index);
        const statusColor = status.color === 'green' ? 'var(--success)' :
            status.color === 'orange' ? 'var(--warning)' : 'var(--danger)';
        return `
        <div class="api-key-item">
            <span class="key-index" style="background: ${statusColor}">${index + 1}</span>
            <span class="key-value">${maskApiKey(key)}</span>
            <span class="key-status" style="color: ${statusColor}; font-size: 0.75rem;">${status.message}</span>
            <button class="remove-btn" onclick="removeApiKey(${index})" title="Xóa">🗑️</button>
        </div>
    `}).join('');
}

function maskApiKey(key) {
    if (key.length <= 10) return key;
    return key.substring(0, 8) + '••••••••' + key.substring(key.length - 4);
}

// ============================================
// PROMPT TEMPLATES
// ============================================
function setPromptTemplate(type) {
    const textarea = document.getElementById('customPrompt');
    textarea.value = PROMPT_TEMPLATES[type] || '';
    showToast('Đã áp dụng mẫu prompt!', 'success');
}

// ============================================
// FILE HANDLING  
// ============================================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
        // Reset input to allow selecting the same file again
        event.target.value = '';
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('uploadArea').classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('uploadArea').classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('uploadArea').classList.remove('dragover');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.txt')) {
            processFile(file);
        } else {
            showToast('Chỉ hỗ trợ file .txt', 'error');
        }
    }
}

function processFile(file) {
    if (!file.name.endsWith('.txt')) {
        showToast('Chỉ hỗ trợ file .txt', 'error');
        return;
    }

    originalFileName = file.name.replace('.txt', '_translated.txt');

    const reader = new FileReader();
    reader.onload = function (e) {
        document.getElementById('originalText').value = e.target.result;
        updateStats();
        showFileInfo(file);
        showToast('Đã tải file thành công!', 'success');
    };
    reader.onerror = function () {
        showToast('Lỗi khi đọc file!', 'error');
    };
    reader.readAsText(file, 'UTF-8');
}

function showFileInfo(file) {
    document.getElementById('fileInfo').style.display = 'flex';
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
}

function clearFile() {
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('originalText').value = '';
    updateStats();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Set prompt template
function setPromptTemplate(templateName) {
    if (PROMPT_TEMPLATES[templateName]) {
        document.getElementById('customPrompt').value = PROMPT_TEMPLATES[templateName];
        saveSettings();

        // Toggle active class on buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.classList.remove('active-template');
        });
        event.target.classList.add('active-template');

        showToast(`Đã chọn template: ${getTemplateName(templateName)}`, 'success');
    }
}

function getTemplateName(key) {
    const names = {
        convert: '🔄 Convert (Làm mượt)',
        novel: '📖 Tiểu thuyết',
        adult: '🔞 Truyện 18+',
        sacHiep: '🔥 Sắc Hiệp',
        wuxia: '⚔️ Tu tiên/Kiếm hiệp',
        romance: '💕 Ngôn tình'
    };
    return names[key] || key;
}

// ============================================
// STATISTICS
// ============================================
function updateStats() {
    const text = document.getElementById('originalText').value;
    const charCount = text.length;
    const chunkSize = parseInt(document.getElementById('chunkSize').value) || 4500;
    const chunkCount = Math.ceil(charCount / chunkSize);
    const parallelCount = parseInt(document.getElementById('parallelCount').value) || 5;

    // Estimate time (roughly 0.5s per request with parallel)
    const batches = Math.ceil(chunkCount / Math.min(parallelCount, apiKeys.length || 1));
    const estimatedSeconds = batches * 0.8;

    document.getElementById('charCount').textContent = `${charCount.toLocaleString()} ký tự`;
    document.getElementById('chunkCount').textContent = `${chunkCount} chunks`;
    document.getElementById('estimatedTime').textContent = `~${Math.ceil(estimatedSeconds)} giây`;
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================
function saveSettings() {
    const settings = {
        apiKeys: apiKeys,
        sourceLang: document.getElementById('sourceLang').value,
        parallelCount: document.getElementById('parallelCount').value,
        chunkSize: document.getElementById('chunkSize').value,
        delayMs: document.getElementById('delayMs').value,
        customPrompt: document.getElementById('customPrompt').value
    };
    localStorage.setItem('novelTranslatorProSettings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('novelTranslatorProSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            if (settings.apiKeys) apiKeys = settings.apiKeys;
            if (settings.sourceLang) document.getElementById('sourceLang').value = settings.sourceLang;
            if (settings.parallelCount) document.getElementById('parallelCount').value = settings.parallelCount;
            if (settings.chunkSize) document.getElementById('chunkSize').value = settings.chunkSize;
            if (settings.delayMs) document.getElementById('delayMs').value = settings.delayMs;
            if (settings.customPrompt) document.getElementById('customPrompt').value = settings.customPrompt;
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

// ============================================
// TRANSLATION ENGINE - PARALLEL
// ============================================
async function startTranslation() {
    // Validate
    if (apiKeys.length === 0) {
        showToast('Vui lòng thêm ít nhất 1 API Key!', 'error');
        return;
    }

    const text = document.getElementById('originalText').value.trim();
    if (!text) {
        showToast('Vui lòng nhập hoặc tải file truyện!', 'error');
        return;
    }

    // Get settings
    const sourceLang = document.getElementById('sourceLang').value;
    const chunkSize = parseInt(document.getElementById('chunkSize').value) || 4500;
    let parallelCount = parseInt(document.getElementById('parallelCount').value) || 5;
    const delayMs = parseInt(document.getElementById('delayMs').value) || 100;
    const customPrompt = document.getElementById('customPrompt').value;

    // ========== PRE-CHECK: Kiểm tra quota trước khi bắt đầu ==========
    const availableCombos = getAllAvailableCombinations();
    if (availableCombos.length === 0) {
        // Tìm thời gian chờ ngắn nhất
        const now = Date.now();
        let minWaitTime = 60000; // Default 60s

        for (const pairId in modelKeyHealthMap) {
            const health = modelKeyHealthMap[pairId];
            if (health.disabledUntil) {
                const waitTime = health.disabledUntil - now;
                if (waitTime > 0 && waitTime < minWaitTime) {
                    minWaitTime = waitTime;
                }
            }
        }

        // GIỚI HẠN: Chờ tối đa 30 giây
        const maxWaitMs = 30000;
        minWaitTime = Math.min(minWaitTime, maxWaitMs);

        const waitSeconds = Math.ceil(minWaitTime / 1000);
        showToast(`Tất cả API đang cooldown. Tự động chờ ${waitSeconds}s...`, 'warning');
        console.warn(`[Pre-check] All combinations disabled. Waiting ${waitSeconds}s (max 30s)...`);

        // TỰ ĐỘNG CHỜ với countdown thay vì hỏi user
        document.getElementById('progressSection').style.display = 'block';
        await sleepWithCountdown(minWaitTime, '⏳ Chờ API sẵn sàng');

        // Reset health map để thử lại
        modelKeyHealthMap = {};
    }

    // Auto-reduce parallel nếu ít combinations available
    if (availableCombos.length < parallelCount) {
        console.log(`[Pre-check] Reducing parallel from ${parallelCount} to ${availableCombos.length}`);
        parallelCount = Math.max(1, availableCombos.length);
    }

    // Split text into chunks
    const chunks = splitTextIntoChunks(text, chunkSize);

    if (chunks.length === 0) {
        showToast('Không có nội dung để dịch!', 'error');
        return;
    }

    // Prepare chunks with prompt
    const preparedChunks = chunks.map(chunk => customPrompt + chunk);

    // UI Setup
    isTranslating = true;
    cancelRequested = false;
    isPaused = false;
    translatedChunks = new Array(chunks.length).fill(null);
    completedChunks = 0;
    startTime = Date.now();

    const translateBtn = document.getElementById('translateBtn');
    translateBtn.disabled = true;
    translateBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Đang dịch...</span>';

    // Reset pause/cancel buttons
    const pauseBtn = document.getElementById('pauseBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    if (pauseBtn) {
        pauseBtn.classList.remove('paused');
        pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Tạm dừng</span>';
    }
    if (cancelBtn) {
        cancelBtn.classList.remove('cancelling');
        cancelBtn.innerHTML = '<span class="btn-icon">⏹️</span><span class="btn-text">Hủy dịch</span>';
    }

    document.getElementById('progressSection').style.display = 'block';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('translatedText').value = '';

    updateProgress(0, chunks.length, 'Bắt đầu dịch song song...');
    updateProgressStats(0, apiKeys.length, '--:--');

    try {
        // Process in parallel batches với STAGGERED START
        const totalCombinations = apiKeys.length * GEMINI_MODELS.length;
        const effectiveParallel = Math.min(parallelCount, totalCombinations, 10);
        const staggerDelayMs = 200; // Delay giữa các parallel requests để tránh spam

        for (let i = 0; i < chunks.length && !cancelRequested; i += effectiveParallel) {
            // Check pause state
            await waitWhilePaused();
            if (cancelRequested) break;

            const batch = [];
            const batchIndices = [];

            for (let j = 0; j < effectiveParallel && i + j < chunks.length; j++) {
                const chunkIndex = i + j;

                // STAGGERED START: Delay mỗi request trong batch
                batch.push(
                    (async () => {
                        await sleep(j * staggerDelayMs); // Stagger: 0ms, 200ms, 400ms, ...
                        return translateChunkWithRetry(preparedChunks[chunkIndex], chunkIndex);
                    })()
                );
                batchIndices.push(chunkIndex);
            }

            // Wait for batch to complete
            const results = await Promise.allSettled(batch);

            results.forEach((result, idx) => {
                const chunkIndex = batchIndices[idx];
                if (result.status === 'fulfilled') {
                    translatedChunks[chunkIndex] = result.value;
                    completedChunks++;
                } else {
                    translatedChunks[chunkIndex] = `[LỖI CHUNK ${chunkIndex + 1}]\n${chunks[chunkIndex]}`;
                    completedChunks++;
                    console.error(`Chunk ${chunkIndex + 1} failed:`, result.reason);
                }
            });

            // Update progress
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = completedChunks / elapsed;
            const remaining = chunks.length - completedChunks;
            const eta = remaining / speed;
            const currentActiveKeys = getActiveKeyCount();

            updateProgress(completedChunks, chunks.length, `Đang dịch chunk ${completedChunks}/${chunks.length}...`);
            updateProgressStats(speed.toFixed(1), currentActiveKeys, formatTime(eta));

            // Update preview
            document.getElementById('translatedText').value = translatedChunks.filter(c => c !== null).join('\n\n');

            // Delay between batches
            if (i + effectiveParallel < chunks.length && !cancelRequested) {
                await sleep(delayMs);
            }
        }

        // ========== AUTO RETRY FAILED CHUNKS ==========
        // Sau khi dịch xong, tự động thử lại các chunk bị lỗi
        if (!cancelRequested) {
            const failedChunkIndices = [];
            translatedChunks.forEach((chunk, idx) => {
                if (chunk && chunk.startsWith('[LỖI CHUNK')) {
                    failedChunkIndices.push(idx);
                }
            });

            if (failedChunkIndices.length > 0) {
                console.log(`[AUTO-RETRY] Found ${failedChunkIndices.length} failed chunks, retrying...`);
                updateProgress(completedChunks, chunks.length, `Đang thử lại ${failedChunkIndices.length} chunk bị lỗi...`);

                // Thử lại tối đa 3 vòng
                for (let round = 1; round <= 3 && failedChunkIndices.length > 0; round++) {
                    console.log(`[AUTO-RETRY] Round ${round}/3 for ${failedChunkIndices.length} chunks`);

                    const stillFailed = [];
                    for (const idx of failedChunkIndices) {
                        if (cancelRequested) break;

                        try {
                            // Dùng temperature cao hơn mỗi vòng để tăng cơ hội
                            const highTemp = 0.8 + (round * 0.2); // 1.0, 1.2, 1.4
                            const modelKeyPair = getNextModelKeyPair();
                            const result = await translateChunk(preparedChunks[idx], modelKeyPair, highTemp);

                            if (result && !result.startsWith('[LỖI') && !result.startsWith('[AUTO-SPLIT]')) {
                                translatedChunks[idx] = result;
                                recordKeySuccess(modelKeyPair.keyIndex);
                                console.log(`[AUTO-RETRY] Chunk ${idx + 1} SUCCESS at round ${round}!`);
                            } else {
                                stillFailed.push(idx);
                            }
                        } catch (e) {
                            console.warn(`[AUTO-RETRY] Chunk ${idx + 1} failed again: ${e.message}`);
                            stillFailed.push(idx);
                        }

                        await sleep(1000); // Delay giữa các retry
                    }

                    // Cập nhật danh sách chunk còn lỗi
                    failedChunkIndices.length = 0;
                    failedChunkIndices.push(...stillFailed);

                    if (failedChunkIndices.length === 0) {
                        console.log(`[AUTO-RETRY] All chunks recovered!`);
                        showToast('Đã khôi phục tất cả chunk lỗi! 🎉', 'success');
                        break;
                    }

                    // Chờ 3s giữa các vòng
                    if (round < 3 && failedChunkIndices.length > 0) {
                        console.log(`[AUTO-RETRY] Waiting 3s before next round...`);
                        await sleep(3000);
                    }
                }

                if (failedChunkIndices.length > 0) {
                    console.log(`[AUTO-RETRY] ${failedChunkIndices.length} chunks still failed after 3 rounds`);
                    showToast(`Còn ${failedChunkIndices.length} chunk không thể dịch`, 'warning');
                }
            }
        }

        // Completion - save to history
        const translatedText = translatedChunks.filter(c => c !== null).join('\n\n');
        addToHistory(originalFileName, text, translatedText, chunks, completedChunks, chunks.length);

        if (!cancelRequested) {
            updateProgress(chunks.length, chunks.length, 'Hoàn thành!');
            document.getElementById('resultSection').style.display = 'block';
            document.getElementById('translatedText').value = translatedChunks.join('\n\n');

            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

            // Đếm số chunk còn lỗi
            const errorCount = translatedChunks.filter(c => c && c.startsWith('[LỖI CHUNK')).length;
            if (errorCount > 0) {
                showToast(`Dịch hoàn tất trong ${totalTime}s! (${errorCount} chunk lỗi)`, 'warning');
            } else {
                showToast(`Dịch hoàn tất 100% trong ${totalTime}s! 🎉`, 'success');
            }

            document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
        } else {
            showToast('Đã hủy dịch! (Lịch sử đã được lưu)', 'warning');
        }

    } catch (error) {
        console.error('Translation error:', error);
        showToast(`Lỗi: ${error.message}`, 'error');

        // Save partial progress on error
        if (completedChunks > 0) {
            const translatedText = translatedChunks.filter(c => c !== null).join('\n\n');
            addToHistory(originalFileName, text, translatedText, chunks, completedChunks, chunks.length);
        }
    } finally {
        isTranslating = false;
        translateBtn.disabled = false;
        translateBtn.innerHTML = '<span class="btn-icon">🚀</span><span class="btn-text">Bắt đầu dịch</span>';
    }
}

async function translateChunkWithRetry(text, chunkIndex, retries = 5) {
    // Danh sách temperature để thử - mỗi lần retry dùng temperature khác
    // Temperature cao hơn = AI "sáng tạo" hơn = cơ hội lách bộ lọc cao hơn
    const temperatures = [0.7, 0.9, 0.5, 1.0, 0.3, 0.8, 0.6, 1.2, 0.4, 0.95];

    for (let attempt = 1; attempt <= retries; attempt++) {
        let modelKeyPair = null;
        try {
            // Get next available (model + key) combination với queue-aware selection
            modelKeyPair = getNextModelKeyPairWithQueue();

            // Dùng temperature khác nhau mỗi lần thử
            const temperature = temperatures[(attempt - 1) % temperatures.length];

            const result = await translateChunk(text, modelKeyPair, temperature);

            // Record success for this key
            recordKeySuccess(modelKeyPair.keyIndex);
            return result;

        } catch (error) {
            const errorMsg = error.message.toLowerCase();

            const isContentBlocked = errorMsg.includes('blocked') ||
                errorMsg.includes('safety') ||
                errorMsg.includes('prohibited');
            const isRateLimit = errorMsg.includes('429') || errorMsg.includes('quota');
            const isServerError = errorMsg.includes('503') || errorMsg.includes('500');
            const isNotFound = errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('model not found');
            // Fix: Chỉ detect invalid key khi có đúng message, không dựa vào 400
            const isInvalidKey = errorMsg.includes('api key not valid') ||
                errorMsg.includes('api key not found') ||
                errorMsg.includes('invalid api key');
            const isModelOverloaded = errorMsg.includes('overloaded');

            console.warn(`[Chunk ${chunkIndex + 1}] Attempt ${attempt}/${retries} failed: ${error.message}`);

            // === XỬ LÝ API KEY KHÔNG HỢP LỆ ===
            if (modelKeyPair && isInvalidKey) {
                // Disable TOÀN BỘ pairs của key này (tất cả models)
                console.error(`[Chunk ${chunkIndex + 1}] ❌ INVALID API KEY: Key ${modelKeyPair.keyIndex + 1} - Disabling ALL models for this key`);
                GEMINI_MODELS.forEach(model => {
                    recordModelKeyError(model.name, modelKeyPair.keyIndex, 86400); // 24h
                });
                recordKeyError(modelKeyPair.keyIndex, 'INVALID_KEY', 86400);
                showToast(`API Key ${modelKeyPair.keyIndex + 1} không hợp lệ! Vui lòng xóa key này.`, 'error');
                continue;
            }

            // === XỬ LÝ MODEL OVERLOADED (503) ===
            if (modelKeyPair && isModelOverloaded) {
                console.warn(`[Chunk ${chunkIndex + 1}] ⚠️ Model ${modelKeyPair.model} overloaded, disabling for 30s`);
                recordModelKeyError(modelKeyPair.model, modelKeyPair.keyIndex, 30);
                continue;
            }

            // === XỬ LÝ RATE LIMIT (429) ===
            if (modelKeyPair && (isRateLimit || isNotFound)) {
                // Parse "Please retry in XX.XXs" từ error message để dynamic cooldown
                let cooldownSeconds = 60; // Default
                if (isRateLimit) {
                    const retryMatch = error.message.match(/retry in ([\d.]+)s/i);
                    if (retryMatch) {
                        cooldownSeconds = Math.ceil(parseFloat(retryMatch[1])) + 2; // +2s buffer
                    }
                } else if (isNotFound) {
                    cooldownSeconds = 300; // Model không tồn tại → disable 5 phút
                }

                // Disable pair này để rotation chọn pair khác
                recordModelKeyError(modelKeyPair.model, modelKeyPair.keyIndex, cooldownSeconds);
                recordKeyError(modelKeyPair.keyIndex, isRateLimit ? 'RATE_LIMIT' : 'NOT_FOUND', cooldownSeconds);
                console.log(`[Chunk ${chunkIndex + 1}] Disabled ${modelKeyPair.model} + Key ${modelKeyPair.keyIndex + 1} for ${cooldownSeconds}s`);

                // === SMART WAIT: Kiểm tra nếu TẤT CẢ combinations đều disabled ===
                const availableCombos = getAllAvailableCombinations();
                if (availableCombos.length === 0) {
                    // Tìm thời gian chờ ngắn nhất từ các disabled pairs
                    const now = Date.now();
                    let minWaitTime = cooldownSeconds * 1000;

                    for (const pairId in modelKeyHealthMap) {
                        const health = modelKeyHealthMap[pairId];
                        if (health.disabledUntil) {
                            const waitTime = health.disabledUntil - now;
                            if (waitTime > 0 && waitTime < minWaitTime) {
                                minWaitTime = waitTime;
                            }
                        }
                    }

                    // GIỚI HẠN: Chờ tối đa 30 giây thay vì chờ mãi
                    const maxWaitMs = 30000;
                    minWaitTime = Math.min(minWaitTime, maxWaitMs);

                    const waitSeconds = Math.ceil(minWaitTime / 1000);
                    console.warn(`[Chunk ${chunkIndex + 1}] ⏳ ALL COMBINATIONS DISABLED! Waiting ${waitSeconds}s (max 30s)...`);

                    // CẬP NHẬT UI trong khi chờ - dùng countdown
                    showToast(`Tất cả API đều hết quota. Chờ ${waitSeconds}s...`, 'warning');

                    await sleepWithCountdown(minWaitTime, '⏳ Chờ quota reset');
                    console.log(`[Chunk ${chunkIndex + 1}] ✅ Resuming after wait...`);
                }

                continue; // Chuyển sang pair khác
            }

            if (attempt === retries) {
                // Lần cuối cùng thất bại - thử chia nhỏ chunk
                if (text.length > 2000 && !text.includes('[AUTO-SPLIT]')) {
                    console.log(`[Chunk ${chunkIndex + 1}] Trying to split large chunk...`);
                    try {
                        return await translateLargeChunkBySplitting(text, chunkIndex);
                    } catch (splitError) {
                        throw error; // Throw original error
                    }
                }
                throw error;
            }

            // Wait before retry (chỉ cho content blocked và server error)
            let waitTime = 1000 * attempt;
            if (isContentBlocked) {
                waitTime = 500; // Retry nhanh với temperature khác
            } else if (isServerError) {
                waitTime = 2000 * attempt; // Server lỗi thì chờ lâu hơn
            }

            console.log(`[Chunk ${chunkIndex + 1}] Waiting ${waitTime / 1000}s before retry (temp=${temperatures[attempt % temperatures.length]})...`);
            await sleep(waitTime);
        }
    }
}

// Chia nhỏ chunk lớn và dịch từng phần khi chunk gốc bị lỗi
async function translateLargeChunkBySplitting(text, chunkIndex) {
    console.log(`[Chunk ${chunkIndex + 1}] Splitting into smaller parts...`);

    // Chia thành 2-3 phần nhỏ hơn
    const parts = splitTextIntoSmallerParts(text, 3);
    const translatedParts = [];

    for (let i = 0; i < parts.length; i++) {
        const partText = '[AUTO-SPLIT]' + parts[i]; // Đánh dấu để không bị split lại
        try {
            const modelKeyPair = getNextModelKeyPair();
            const result = await translateChunk(partText, modelKeyPair, 0.8);
            translatedParts.push(result.replace('[AUTO-SPLIT]', ''));
            recordKeySuccess(modelKeyPair.keyIndex);
        } catch (e) {
            // Nếu vẫn lỗi, giữ nguyên text gốc
            translatedParts.push(parts[i]);
        }
        await sleep(500); // Delay giữa các phần
    }

    return translatedParts.join('\n');
}

// Chia text thành N phần nhỏ hơn theo dấu xuống dòng
function splitTextIntoSmallerParts(text, numParts) {
    const lines = text.split('\n');
    const linesPerPart = Math.ceil(lines.length / numParts);
    const parts = [];

    for (let i = 0; i < lines.length; i += linesPerPart) {
        parts.push(lines.slice(i, i + linesPerPart).join('\n'));
    }

    return parts.filter(p => p.trim().length > 0);
}

async function translateChunk(text, modelKeyPair, temperature = 0.7) {
    // Full Rotation: tự động xoay qua tất cả (model × key) combinations
    const { model: modelName, key: apiKey, keyIndex } = modelKeyPair;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    console.log(`[API] ${modelName} + Key ${keyIndex + 1} (temp=${temperature})`);

    const body = {
        contents: [{
            parts: [{ text: text }]
        }],
        generationConfig: {
            temperature: temperature,
            maxOutputTokens: 16384, // Tăng lên để tránh cắt output
            topP: 0.95,
            topK: 40
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" }
        ]
    };

    // THÊM TIMEOUT: 30 giây để tránh bị treo
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
    } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
            throw new Error(`API timeout sau 30s - ${modelName} + Key ${keyIndex + 1}`);
        }
        throw fetchError;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`;

        console.error(`[API ERROR] Status: ${response.status}`);
        console.error(`[API ERROR] Message: ${errorMsg}`);
        console.error(`[API ERROR] Full response:`, errorData);

        // Check for specific errors
        if (response.status === 429) {
            // Record (model + key) pair error and disable it
            recordModelKeyError(modelName, keyIndex);
            throw new Error(`429 - ${modelName} + Key ${keyIndex + 1} hết quota. Switching...`);
        }
        if (response.status === 400 && errorMsg.includes('API key')) {
            throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại.');
        }
        if (response.status === 404) {
            recordModelKeyError(modelName, keyIndex);
            throw new Error(`Model "${modelName}" không tìm thấy. Thử combination khác.`);
        }

        throw new Error(errorMsg);
    }

    const data = await response.json();
    console.log(`[API] Response received successfully`);

    // Extract text from Gemini response
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        let result = data.candidates[0].content.parts[0].text.trim();
        // Clean up Gemini's introduction/explanation text
        result = cleanGeminiResponse(result);

        // ⚠️ CẢNH BÁO: Kiểm tra nếu output ngắn hơn input đáng kể
        const inputLength = text.length;
        const outputLength = result.length;
        const ratio = outputLength / inputLength;

        if (ratio < 0.6) {
            console.warn(`[⚠️ WARNING] Output ngắn hơn 60% so với input!`);
            console.warn(`   Input: ${inputLength} chars, Output: ${outputLength} chars (${Math.round(ratio * 100)}%)`);
        }

        return result;
    }

    // Check for blocked content (finishReason)
    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
        console.warn('[API] Content blocked by SAFETY filter');
        return text; // Return original text
    }

    // Check for blocked content (promptFeedback)
    if (data.promptFeedback?.blockReason === 'PROHIBITED_CONTENT') {
        console.warn('[API] Content blocked by PROHIBITED_CONTENT filter');
        console.warn('[API] Returning original text (Gemini từ chối dịch nội dung này)');
        return text; // Return original text
    }

    console.error('[API ERROR] Invalid response format:', data);
    throw new Error('Gemini API: Invalid response format');
}

// Clean up Gemini's introduction/explanation text
function cleanGeminiResponse(text) {
    // Patterns to remove (Gemini often adds these before the actual content)
    const patternsToRemove = [
        /^(Tuyệt vời!|Được rồi!|Okay!|Dưới đây là|Đây là|Here is)[^\n]*\n+/gi,
        /^(Tôi đã|Tôi sẽ|I have|I will)[^\n]*\n+/gi,
        /^[^\n]*(phiên bản đã|version|chỉnh sửa|edited)[^\n]*:\s*\n+/gi,
        /^---+\s*\n/gm,
        /^\*\*[^\n]+\*\*\s*\n+/gm,  // Remove bold headers like **Phiên bản chỉnh sửa:**
        /^#+\s+[^\n]+\n+/gm,  // Remove markdown headers
    ];

    let cleaned = text;
    for (const pattern of patternsToRemove) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Also remove trailing explanations
    const trailingPatterns = [
        /\n+(Hy vọng|Tôi đã|Lưu ý|Note:|Ghi chú)[^\n]*$/gi,
        /\n+---+\s*$/gm,
    ];

    for (const pattern of trailingPatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
}

// ============================================
// SMART CHUNKING - Chia văn bản thông minh
// ============================================
function splitTextIntoChunks(text, maxSize) {
    const chunks = [];

    // Normalize line breaks
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split by double newlines (paragraphs) or single newlines
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    let lastContext = ''; // Lưu câu cuối để context carryover

    for (const paragraph of paragraphs) {
        const trimmed = paragraph.trim();
        if (!trimmed) continue;

        // Check if adding this paragraph exceeds max size
        if (currentChunk.length + trimmed.length + 2 > maxSize) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());

                // Extract last sentence for context (max 200 chars)
                lastContext = extractLastSentence(currentChunk, 200);
            }

            if (trimmed.length > maxSize) {
                // Split long paragraphs by sentences intelligently
                const sentenceChunks = splitBySentences(trimmed, maxSize, lastContext);

                for (let i = 0; i < sentenceChunks.length - 1; i++) {
                    chunks.push(sentenceChunks[i]);
                    lastContext = extractLastSentence(sentenceChunks[i], 200);
                }

                currentChunk = sentenceChunks[sentenceChunks.length - 1] || '';
            } else {
                currentChunk = trimmed;
            }
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
        }
    }

    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    console.log(`[Smart Chunking] Split into ${chunks.length} chunks, avg size: ${Math.round(text.length / chunks.length)} chars`);
    return chunks;
}

// Extract last sentence from text (for context carryover)
function extractLastSentence(text, maxLength = 200) {
    // Find last sentence ending
    const sentences = text.match(/[^.!?。！？]*[.!?。！？]+/g);
    if (!sentences || sentences.length === 0) {
        return text.slice(-maxLength);
    }

    let lastSentence = sentences[sentences.length - 1].trim();
    if (lastSentence.length > maxLength) {
        lastSentence = lastSentence.slice(-maxLength);
    }
    return lastSentence;
}

// Smart split by sentences - avoid cutting in middle of dialogue
function splitBySentences(text, maxSize, contextPrefix = '') {
    const chunks = [];

    // Split by sentences (keep delimiter)
    // Handle both Western and Asian punctuation
    const sentencePattern = /([^.!?。！？]*[.!?。！？]+\s*)/g;
    const sentences = text.match(sentencePattern) || [text];

    let currentChunk = '';
    let inDialogue = false;

    for (const sentence of sentences) {
        // Check if we're in a dialogue (has opening quote but no closing)
        const openQuotes = (sentence.match(/[""「『【《]/g) || []).length;
        const closeQuotes = (sentence.match(/[""」』】》]/g) || []).length;

        if (openQuotes > closeQuotes) {
            inDialogue = true;
        } else if (closeQuotes > openQuotes || (closeQuotes > 0 && openQuotes === closeQuotes)) {
            inDialogue = false;
        }

        // Don't break in the middle of dialogue if possible
        const wouldExceed = currentChunk.length + sentence.length > maxSize;
        const shouldBreak = wouldExceed && !inDialogue && currentChunk.length > 0;

        if (shouldBreak) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
        } else if (wouldExceed && currentChunk.length > maxSize * 0.8) {
            // Force break even in dialogue if chunk is too big
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
        } else {
            currentChunk += sentence;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}


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
    isPaused = false; // Resume to let the loop exit

    updateProgress(completedChunks, totalChunksCount, '🛑 Đang hủy và lưu tiến trình...');

    // Show stats
    const percentage = totalChunksCount > 0 ? Math.round((completedChunks / totalChunksCount) * 100) : 0;
    showToast(`Đã hủy! Đã lưu ${completedChunks}/${totalChunksCount} chunks (${percentage}%)`, 'warning');

    console.log(`[Cancel] Cancelled with ${completedChunks}/${totalChunksCount} chunks completed`);
}

// Legacy function for compatibility
function cancelTranslation() {
    confirmCancel();
}

function updateProgress(current, total, status) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${percentage}%`;
    document.getElementById('progressDetails').textContent = `${current} / ${total} chunks`;
    document.getElementById('progressStatus').textContent = status;

    // Update download button text with current count
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Sleep với countdown hiển thị trên UI
async function sleepWithCountdown(ms, statusPrefix = '⏳ Chờ quota reset') {
    const totalSeconds = Math.ceil(ms / 1000);
    for (let remaining = totalSeconds; remaining > 0; remaining--) {
        updateProgress(completedChunks, totalChunksCount, `${statusPrefix}... ${remaining}s`);
        await sleep(1000);

        // Check nếu đã bị cancel
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

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Đã tải file thành công!', 'success');
}

// Download partial - tải phần đã dịch được (ngay cả khi đang dịch)
function downloadPartial() {
    // Lấy phần đã dịch được (bỏ qua các chunks null/chưa dịch)
    const translatedParts = translatedChunks.filter(c => c !== null && c !== undefined);

    if (translatedParts.length === 0) {
        showToast('Chưa có nội dung nào được dịch!', 'warning');
        return;
    }

    const text = translatedParts.join('\n\n');
    const partialFileName = originalFileName.replace('.txt', `_partial_${completedChunks}chunks.txt`);

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = partialFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Đã tải ${completedChunks} chunks đã dịch!`, 'success');
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
        // Giới hạn 20 bản ghi để không tràn localStorage
        if (translationHistory.length > 20) {
            translationHistory = translationHistory.slice(-20);
        }

        // Tạo phiên bản nhẹ để lưu (không lưu full text, chỉ lưu 500 chars preview)
        const lightHistory = translationHistory.map(item => ({
            ...item,
            originalText: item.originalText ? item.originalText.substring(0, 500) + (item.originalText.length > 500 ? '...' : '') : '',
            translatedText: item.translatedText ? item.translatedText.substring(0, 500) + (item.translatedText.length > 500 ? '...' : '') : '',
            chunks: [] // Không lưu chunks để tiết kiệm dung lượng
        }));

        localStorage.setItem('novelTranslatorHistory', JSON.stringify(lightHistory));
    } catch (e) {
        console.error('Error saving history:', e);

        // Nếu vẫn đầy, xóa bớt và thử lại
        if (e.name === 'QuotaExceededError') {
            translationHistory = translationHistory.slice(-5); // Chỉ giữ 5 bản mới nhất
            try {
                const lightHistory = translationHistory.map(item => ({
                    ...item,
                    originalText: item.originalText ? item.originalText.substring(0, 200) : '',
                    translatedText: item.translatedText ? item.translatedText.substring(0, 200) : '',
                    chunks: []
                }));
                localStorage.setItem('novelTranslatorHistory', JSON.stringify(lightHistory));
                showToast('Đã xóa bớt lịch sử cũ để tiết kiệm bộ nhớ.', 'warning');
            } catch (e2) {
                // Xóa hết nếu vẫn không được
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

    // Nếu đang tiếp tục từ lịch sử cũ, cập nhật thay vì tạo mới
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
    const countBadge = document.getElementById('historyCount');

    countBadge.textContent = `${translationHistory.length} bản`;

    if (translationHistory.length === 0) {
        container.innerHTML = '<p class="empty-message">Chưa có lịch sử dịch nào.</p>';
        return;
    }

    // Sắp xếp theo thời gian mới nhất
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

    // Load content
    document.getElementById('originalText').value = item.originalText;
    originalFileName = item.name;
    currentHistoryId = id;

    // Restore chunks
    originalChunks = item.chunks || [];
    translatedChunks = item.translatedText ? item.translatedText.split('\n\n') : [];
    completedChunks = item.completedChunks || 0;
    totalChunksCount = item.totalChunks || 0;

    updateStats();
    showToast(`Đã tải "${item.name}" - Tiếp tục từ chunk ${completedChunks}/${totalChunksCount}`, 'success');

    // Scroll to translate button
    document.getElementById('translateBtn').scrollIntoView({ behavior: 'smooth' });
}

function loadFromHistory(id) {
    const item = translationHistory.find(h => h.id === id);
    if (!item) {
        showToast('Không tìm thấy lịch sử!', 'error');
        return;
    }

    // Load original text
    document.getElementById('originalText').value = item.originalText;
    originalFileName = item.name;

    // Load translated text
    document.getElementById('translatedText').value = item.translatedText || '';
    document.getElementById('resultSection').style.display = 'block';

    updateStats();
    showToast(`Đã tải "${item.name}"`, 'success');

    // Scroll to result
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
                // Check for duplicates by ID or by name+date
                const exists = translationHistory.some(h =>
                    h.id === item.id ||
                    (h.name === item.name && h.date === item.date)
                );

                if (!exists) {
                    // Generate new ID to avoid conflicts
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

    // Reset input
    event.target.value = '';
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    return num.toLocaleString('vi-VN');
}
