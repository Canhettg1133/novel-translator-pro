/**
 * Novel Translator Pro - Ollama Local API Integration
 * Tích hợp Ollama để dịch truyện với AI local
 */

// ============================================
// OLLAMA SETTINGS
// ============================================
let useOllama = false;
let ollamaUrl = 'http://localhost:11434';
let ollamaModel = 'huihui_ai/qwen3-abliterated:4b';

// Track Ollama speed
let ollamaChunkTimes = [];
let ollamaTotalChunks = 0;

// ============================================
// TOGGLE & CONNECTION
// ============================================

// Toggle Ollama mode
function toggleOllamaMode() {
    const toggle = document.getElementById('useOllamaToggle');
    const settings = document.getElementById('ollamaSettings');
    const badge = document.getElementById('ollamaStatus');

    useOllama = toggle.checked;

    if (useOllama) {
        settings.style.display = 'block';
        badge.textContent = 'Bật';
        badge.classList.add('active');
        showToast('🦙 Đã chuyển sang Ollama Local API!', 'success');
    } else {
        settings.style.display = 'none';
        badge.textContent = 'Tắt';
        badge.classList.remove('active');
        showToast('☁️ Đã chuyển sang Gemini Cloud API!', 'info');
    }

    saveOllamaSettings();
}

// Test Ollama connection
async function testOllamaConnection() {
    const resultDiv = document.getElementById('ollamaTestResult');
    const url = document.getElementById('ollamaUrl').value.trim();
    const model = document.getElementById('ollamaModel').value.trim();

    resultDiv.className = 'ollama-test-result info';
    resultDiv.textContent = '🔍 Đang kiểm tra kết nối...';

    try {
        const response = await fetch(`${url}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Server trả về lỗi: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Ollama] API Response:', data);

        const models = data.models || [];
        console.log('[Ollama] Models found:', models.map(m => m.name));

        const modelBaseName = model.split(':')[0].toLowerCase();
        const modelExists = models.some(m => {
            const installedName = m.name.toLowerCase();
            return installedName === model.toLowerCase() ||
                installedName.startsWith(modelBaseName) ||
                installedName.includes(modelBaseName.split('/').pop());
        });

        console.log('[Ollama] Looking for:', model, 'Found:', modelExists);

        if (modelExists) {
            resultDiv.className = 'ollama-test-result success';
            resultDiv.textContent = `✅ Kết nối thành công!\n\n📦 Model "${model}" đã sẵn sàng!\n\n🎉 Bạn có thể bắt đầu dịch với Ollama Local.\n\n📋 Models đã cài: ${models.map(m => m.name).join(', ')}`;
        } else {
            resultDiv.className = 'ollama-test-result error';
            resultDiv.textContent = `⚠️ Kết nối OK nhưng model "${model}" chưa được cài!\n\n📥 Chạy lệnh sau để cài:\n   ollama pull ${model}\n\n📋 Models đã cài: ${models.map(m => m.name).join(', ') || 'Không có'}`;
        }

    } catch (error) {
        resultDiv.className = 'ollama-test-result error';

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            resultDiv.textContent = `❌ Không thể kết nối đến Ollama!\n\n🔧 Kiểm tra:\n1. Ollama đã chạy chưa? (ollama serve)\n2. URL đúng chưa? (${url})\n3. Firewall có chặn không?\n\n📥 Tải Ollama: https://ollama.com/download`;
        } else {
            resultDiv.textContent = `❌ Lỗi: ${error.message}`;
        }
    }
}

// List installed Ollama models
async function listOllamaModels() {
    const resultDiv = document.getElementById('ollamaTestResult');
    const url = document.getElementById('ollamaUrl').value.trim();

    resultDiv.className = 'ollama-test-result info';
    resultDiv.textContent = '📋 Đang lấy danh sách models...';

    try {
        const response = await fetch(`${url}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Server trả về lỗi: ${response.status}`);
        }

        const data = await response.json();
        const models = data.models || [];

        if (models.length === 0) {
            resultDiv.className = 'ollama-test-result error';
            resultDiv.textContent = '⚠️ Chưa có model nào được cài!\n\n📥 Cài model khuyến nghị:\n   ollama pull huihui_ai/qwen3-abliterated:4b';
        } else {
            resultDiv.className = 'ollama-test-result success';
            let output = `📦 Có ${models.length} model đã cài:\n\n`;
            models.forEach((m, i) => {
                const sizeGB = (m.size / (1024 * 1024 * 1024)).toFixed(1);
                output += `${i + 1}. ${m.name} (${sizeGB}GB)\n`;
            });
            output += '\n💡 Click vào tên model để sử dụng.';
            resultDiv.textContent = output;
        }

    } catch (error) {
        resultDiv.className = 'ollama-test-result error';
        resultDiv.textContent = `❌ Lỗi: ${error.message}\n\n🔧 Đảm bảo Ollama đang chạy: ollama serve`;
    }
}

// ============================================
// TRANSLATION
// ============================================

// Trích xuất kết quả thực từ thinking output của Qwen3
function extractResultFromThinking(thinkingText) {
    if (!thinkingText) return '';

    // Bước 1: Tìm marker kết quả cuối cùng
    const resultMarkers = [
        /Here(?:'s| is) the (?:rewritten|revised|translated|final)(?: version)?:?\s*/gi,
        /(?:Viết lại|Kết quả|Bản dịch|Đoạn văn viết lại):?\s*/gi,
        /(?:Final|Rewritten|Revised)(?: version)?:?\s*/gi,
        /---+\s*/g,
        /\n\n(?=")/,
    ];

    let result = thinkingText;

    for (const marker of resultMarkers) {
        const match = thinkingText.match(marker);
        if (match) {
            const idx = thinkingText.lastIndexOf(match[match.length - 1]);
            if (idx !== -1) {
                const afterMarker = thinkingText.substring(idx + match[match.length - 1].length).trim();
                if (afterMarker.length > 100) {
                    result = afterMarker;
                    console.log(`[Ollama] Extracted result after marker: "${match[match.length - 1].substring(0, 30)}..."`);
                    break;
                }
            }
        }
    }

    // Bước 2: Nếu có lẫn thinking tiếng Anh, lọc lấy TOÀN BỘ các khối tiếng Việt
    if (result.includes('Okay') || result.includes('Let me') || result.includes('I need to')) {
        const vietnameseBlocks = result.split(/\n\n+/).filter(block => {
            const hasVietnamese = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(block);
            const startsWithEnglish = /^(Okay|Let me|I need|I'll|First|The|So|Now|Wait|Actually|Hmm)/i.test(block.trim());
            return hasVietnamese && !startsWithEnglish && block.length > 50;
        });

        if (vietnameseBlocks.length > 0) {
            // SỬA LỖI: GHÉP TẤT CẢ các khối Vietnamese thay vì chỉ lấy một
            result = vietnameseBlocks.join('\n\n');
            console.log(`[Ollama] Extracted ${vietnameseBlocks.length} Vietnamese blocks: ${result.length} chars total`);
        }
    }

    return result.trim();
}

// Translate with Ollama API
async function translateWithOllama(text, temperature = 0.7) {
    const url = document.getElementById('ollamaUrl').value.trim() || ollamaUrl;
    const model = document.getElementById('ollamaModel').value.trim() || ollamaModel;

    const startTime = Date.now();
    console.log(`[Ollama] Calling ${model} at ${url}...`);
    console.log(`[Ollama] Text length: ${text.length} chars`);

    let processedText = text;

    // Auto-detect model type và lấy settings tối ưu
    const modelType = detectModelType(model);
    let modelSettings = {
        temperature: temperature,
        top_p: 0.9,
        top_k: 40,
        num_predict: 4096,
        num_ctx: 8192
    };
    let useThinking = false;

    // Override với preset nếu có
    if (modelType && typeof MODEL_PRESETS !== 'undefined' && MODEL_PRESETS[modelType]) {
        const preset = MODEL_PRESETS[modelType];
        modelSettings = { ...modelSettings, ...preset.settings };
        useThinking = preset.features.includes('think');
        console.log(`[Ollama] Auto-detected: ${preset.name}, thinking: ${useThinking}`);
    }

    const body = {
        model: model,
        messages: [
            { role: 'user', content: processedText }
        ],
        stream: false,
        options: modelSettings
    };

    // Bật thinking mode nếu model hỗ trợ
    if (useThinking) {
        body.think = true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    let response;
    try {
        response = await fetch(`${url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
    } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
            throw new Error(`Ollama timeout sau 300s - Chunk quá dài hoặc model quá chậm.`);
        }
        if (fetchError.message.includes('Failed to fetch')) {
            throw new Error('Không thể kết nối Ollama. Đảm bảo Ollama đang chạy!');
        }
        throw fetchError;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP ${response.status}`;
        console.error(`[Ollama ERROR] Status: ${response.status}`);
        console.error(`[Ollama ERROR] Message: ${errorMsg}`);
        throw new Error(errorMsg);
    }

    const data = await response.json();
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`[Ollama] Response received in ${processingTime.toFixed(1)}s`);

    if (typeof updateOllamaSpeed === 'function') {
        updateOllamaSpeed(processingTime);
    }

    if (data.message) {
        let contentResult = '';
        let thinkingResult = '';

        // Lấy content nếu có
        if (data.message.content && data.message.content.trim()) {
            contentResult = data.message.content.trim();
            console.log(`[Ollama] message.content: ${contentResult.length} chars`);
        }

        // Lấy từ thinking nếu có
        if (data.message.thinking && data.message.thinking.trim()) {
            let thinkingText = data.message.thinking.trim();
            console.log(`[Ollama] message.thinking: ${thinkingText.length} chars`);
            thinkingResult = extractResultFromThinking(thinkingText);
            console.log(`[Ollama] Extracted from thinking: ${thinkingResult.length} chars`);
        }

        // SMART SELECT: Chọn kết quả tốt hơn
        let result = '';
        const vietnamesePattern = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;

        const contentHasVietnamese = vietnamesePattern.test(contentResult);
        const thinkingHasVietnamese = vietnamesePattern.test(thinkingResult);

        if (contentResult && thinkingResult) {
            // Cả hai đều có → chọn cái dài hơn có tiếng Việt
            if (contentHasVietnamese && contentResult.length >= thinkingResult.length * 0.7) {
                result = contentResult;
                console.log(`[Ollama] ✅ Selected: content (longer or similar, has Vietnamese)`);
            } else if (thinkingHasVietnamese && thinkingResult.length > contentResult.length) {
                result = thinkingResult;
                console.log(`[Ollama] ✅ Selected: thinking (longer, has Vietnamese)`);
            } else {
                result = contentResult.length >= thinkingResult.length ? contentResult : thinkingResult;
                console.log(`[Ollama] ✅ Selected: ${result === contentResult ? 'content' : 'thinking'} (fallback)`);
            }
        } else if (contentResult) {
            result = contentResult;
            console.log(`[Ollama] ✅ Using content (only option)`);
        } else if (thinkingResult) {
            result = thinkingResult;
            console.log(`[Ollama] ✅ Using thinking (only option)`);
        }

        if (result) {
            result = cleanGeminiResponse(result);
            console.log(`[Ollama] Final result: ${result.length} chars`);
            return result;
        }
    }

    if (data.response) {
        let result = data.response.trim();
        result = cleanGeminiResponse(result);
        return result;
    }

    console.error('[Ollama] Invalid response:', JSON.stringify(data));
    throw new Error('Ollama API: Invalid response format');
}

// ============================================
// SETTINGS
// ============================================

function saveOllamaSettings() {
    ollamaUrl = document.getElementById('ollamaUrl')?.value.trim() || ollamaUrl;
    ollamaModel = document.getElementById('ollamaModel')?.value.trim() || ollamaModel;

    const ollamaSettings = {
        useOllama: useOllama,
        ollamaUrl: ollamaUrl,
        ollamaModel: ollamaModel
    };

    localStorage.setItem('novelTranslatorOllamaSettings', JSON.stringify(ollamaSettings));
    console.log('[Ollama] Settings saved:', ollamaSettings);
}

function loadOllamaSettings() {
    const saved = localStorage.getItem('novelTranslatorOllamaSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            useOllama = settings.useOllama || false;
            ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
            ollamaModel = settings.ollamaModel || 'huihui_ai/qwen3-abliterated:4b';

            const toggle = document.getElementById('useOllamaToggle');
            const settingsDiv = document.getElementById('ollamaSettings');
            const badge = document.getElementById('ollamaStatus');
            const urlInput = document.getElementById('ollamaUrl');
            const modelInput = document.getElementById('ollamaModel');

            if (toggle) toggle.checked = useOllama;
            if (urlInput) urlInput.value = ollamaUrl;
            if (modelInput) modelInput.value = ollamaModel;

            if (useOllama) {
                if (settingsDiv) settingsDiv.style.display = 'block';
                if (badge) {
                    badge.textContent = 'Bật';
                    badge.classList.add('active');
                }
            }

            console.log('[Ollama] Settings loaded:', settings);
        } catch (e) {
            console.error('[Ollama] Error loading settings:', e);
        }
    }
}

function setupOllamaEventListeners() {
    const urlInput = document.getElementById('ollamaUrl');
    const modelInput = document.getElementById('ollamaModel');

    if (urlInput) {
        urlInput.addEventListener('change', saveOllamaSettings);
    }
    if (modelInput) {
        modelInput.addEventListener('change', saveOllamaSettings);
    }
}

// ============================================
// MODEL DROPDOWN
// ============================================

async function loadOllamaModelsDropdown() {
    const select = document.getElementById('ollamaModelSelect');
    const url = document.getElementById('ollamaUrl').value.trim() || ollamaUrl;

    select.innerHTML = '<option value="">⏳ Đang tải...</option>';

    try {
        const response = await fetch(`${url}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const models = data.models || [];

        if (models.length === 0) {
            select.innerHTML = '<option value="">❌ Chưa có model nào</option>';
            showToast('Chưa có model nào được cài. Chạy: ollama pull <model>', 'warning');
            return;
        }

        select.innerHTML = '<option value="">-- Chọn model --</option>';
        models.forEach(m => {
            const sizeGB = (m.size / (1024 * 1024 * 1024)).toFixed(1);
            const option = document.createElement('option');
            option.value = m.name;
            option.textContent = `${m.name} (${sizeGB}GB)`;
            select.appendChild(option);
        });

        const currentModel = document.getElementById('ollamaModel').value;
        if (currentModel) {
            select.value = currentModel;
        }

        showToast(`Đã tải ${models.length} models!`, 'success');

    } catch (error) {
        select.innerHTML = '<option value="">❌ Lỗi kết nối</option>';
        showToast(`Lỗi: ${error.message}`, 'error');
    }
}

function selectOllamaModel() {
    const select = document.getElementById('ollamaModelSelect');
    const input = document.getElementById('ollamaModel');

    if (select.value) {
        input.value = select.value;
        ollamaModel = select.value;
        saveOllamaSettings();
        showToast(`Đã chọn model: ${select.value}`, 'success');
    }
}

// ============================================
// SPEED TRACKING
// ============================================

function updateOllamaSpeed(chunkTime) {
    ollamaChunkTimes.push(chunkTime);
    ollamaTotalChunks++;

    if (ollamaChunkTimes.length > 10) {
        ollamaChunkTimes.shift();
    }

    const avgTime = ollamaChunkTimes.reduce((a, b) => a + b, 0) / ollamaChunkTimes.length;

    const speedDiv = document.getElementById('ollamaSpeedInfo');
    const speedValue = document.getElementById('ollamaSpeedValue');
    const chunksProcessed = document.getElementById('ollamaChunksProcessed');

    if (speedDiv && speedValue && chunksProcessed) {
        speedDiv.style.display = 'flex';
        speedValue.textContent = avgTime.toFixed(1);
        chunksProcessed.textContent = ollamaTotalChunks;
    }
}

function resetOllamaSpeed() {
    ollamaChunkTimes = [];
    ollamaTotalChunks = 0;
    const speedDiv = document.getElementById('ollamaSpeedInfo');
    if (speedDiv) {
        speedDiv.style.display = 'none';
    }
}

// ============================================
// TEST TRANSLATION
// ============================================

async function testOllamaTranslation() {
    const resultDiv = document.getElementById('ollamaTestResult');
    const url = document.getElementById('ollamaUrl').value.trim() || 'http://localhost:11434';
    const model = document.getElementById('ollamaModel').value.trim() || ollamaModel;

    resultDiv.className = 'ollama-test-result info';
    resultDiv.textContent = '🧪 Đang test dịch thử... Đợi 10-30 giây...';

    let testText = 'Viết lại cho mượt mà: Ta ngửa mặt Quan Thiên, hướng về kia vạn bên trong trời quang chửi ầm lên.';
    const systemPrompt = 'You are a translator. Output ONLY the translation, nothing else. No explanations.';

    console.log('[Test] Starting translation test...');
    console.log('[Test] URL:', url);
    console.log('[Test] Model:', model);
    console.log('[Test] Text:', testText);

    try {
        const startTime = Date.now();

        const response = await fetch(`${url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: testText }
                ],
                stream: false,
                think: model.toLowerCase().includes('qwen3') ? true : undefined,
                options: { num_predict: 256 }
            })
        });

        console.log('[Test] Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('[Test] Full response data:', JSON.stringify(data, null, 2));

        let content = null;

        if (data.message && typeof data.message === 'object' && data.message.content && data.message.content.trim()) {
            content = data.message.content;
            console.log('[Test] Using message.content format');
        }
        else if (data.message && data.message.thinking && data.message.thinking.trim()) {
            content = data.message.thinking;
            console.log('[Test] Using message.thinking format (Qwen3 mode)');
        }
        else if (data.response) {
            content = data.response;
            console.log('[Test] Using response format');
        }
        else if (typeof data === 'string') {
            content = data;
            console.log('[Test] Using string format');
        }
        else if (typeof data.message === 'string') {
            content = data.message;
            console.log('[Test] Using message string format');
        }

        if (content) {
            resultDiv.className = 'ollama-test-result success';
            resultDiv.textContent = `✅ THÀNH CÔNG! (${elapsed}s)\n\n📝 Kết quả: ${content}\n\n🎉 Ollama hoạt động tốt!`;
            console.log('[Test] SUCCESS! Content:', content);
        } else {
            console.error('[Test] Unknown response format. Keys:', Object.keys(data));
            resultDiv.className = 'ollama-test-result error';
            resultDiv.textContent = `❌ Response format lạ. Xem Console để debug.\n\nData keys: ${Object.keys(data).join(', ')}`;
        }

    } catch (error) {
        console.error('[Test] Error:', error);
        resultDiv.className = 'ollama-test-result error';
        resultDiv.textContent = `❌ LỖI: ${error.message}\n\n🔧 Kiểm tra:\n1. Ollama đang chạy?\n2. Model đã cài?\n3. URL đúng?`;
    }
}

// ============================================
// START SERVER GUIDE
// ============================================

function showStartServerGuide() {
    const resultDiv = document.getElementById('ollamaTestResult');
    resultDiv.className = 'ollama-test-result info';
    resultDiv.innerHTML = `
<h4>🖥️ Hướng dẫn chạy Ollama Server</h4>

<p><strong>Bước 1:</strong> Mở Terminal/Command Prompt</p>

<p><strong>Bước 2:</strong> Chạy lệnh sau:</p>
<div style="background: #1a1a2e; padding: 10px; border-radius: 8px; margin: 10px 0;">
    <code style="color: #10b981; font-size: 14px;">ollama serve</code>
    <button onclick="copyCommand('ollama serve')" style="margin-left: 10px; padding: 5px 10px; cursor: pointer;">📋 Copy</button>
</div>

<p><strong>Bước 3:</strong> Nếu chưa có model, cài model:</p>
<div style="background: #1a1a2e; padding: 10px; border-radius: 8px; margin: 10px 0;">
    <code style="color: #10b981; font-size: 14px;">ollama pull qwen3:4b</code>
    <button onclick="copyCommand('ollama pull qwen3:4b')" style="margin-left: 10px; padding: 5px 10px; cursor: pointer;">📋 Copy</button>
</div>

<p><strong>Models khuyến nghị:</strong></p>
<ul style="margin: 10px 0; padding-left: 20px;">
    <li><code>qwen3:4b</code> - Nhanh, tốt cho dịch truyện ⭐</li>
    <li><code>qwen3:8b</code> - Chất lượng cao hơn</li>
    <li><code>llama3.2:3b</code> - Nhẹ, nhanh</li>
    <li><code>gemma2:9b</code> - Chất lượng tốt</li>
</ul>

<p style="color: #f59e0b;">⚠️ Lưu ý: Giữ terminal mở khi dịch!</p>
    `;
}

function copyCommand(cmd) {
    navigator.clipboard.writeText(cmd).then(() => {
        showToast('Đã copy: ' + cmd, 'success');
    });
}

// ============================================
// MODEL PRESETS - Cài đặt tối ưu cho từng model
// ============================================

const MODEL_PRESETS = {
    qwen3: {
        name: 'Qwen3',
        models: ['qwen3:4b', 'qwen3:8b', 'huihui_ai/qwen3-abliterated:4b'],
        recommended: 'qwen3:4b',
        settings: {
            temperature: 0.7,
            num_predict: 4096,
            num_ctx: 8192,
            top_p: 0.9,
            top_k: 40
        },
        features: ['think'],  // Qwen3 hỗ trợ thinking mode
        tips: 'Hỗ trợ thinking mode, tốt cho dịch văn học'
    },
    llama3: {
        name: 'Llama3',
        models: ['llama3.2:3b', 'llama3.2:8b', 'llama3:8b'],
        recommended: 'llama3.2:3b',
        settings: {
            temperature: 0.7,
            num_predict: 4096,
            num_ctx: 8192,
            top_p: 0.9,
            top_k: 40
        },
        features: [],
        tips: 'Đa năng, nhanh, hỗ trợ tiếng Việt tốt'
    },
    gemma2: {
        name: 'Gemma2',
        models: ['gemma2:2b', 'gemma2:9b', 'gemma2:27b'],
        recommended: 'gemma2:9b',
        settings: {
            temperature: 0.7,
            num_predict: 4096,
            num_ctx: 8192,
            top_p: 0.95,
            top_k: 50
        },
        features: [],
        tips: 'Của Google, chất lượng cao'
    },
    mistral: {
        name: 'Mistral',
        models: ['mistral:7b', 'mistral-nemo:12b'],
        recommended: 'mistral:7b',
        settings: {
            temperature: 0.7,
            num_predict: 4096,
            num_ctx: 8192,
            top_p: 0.9,
            top_k: 40
        },
        features: [],
        tips: 'Nhẹ, nhanh, chất lượng ổn định'
    },
    phi3: {
        name: 'Phi3',
        models: ['phi3:mini', 'phi3:medium'],
        recommended: 'phi3:mini',
        settings: {
            temperature: 0.7,
            num_predict: 4096,
            num_ctx: 4096,
            top_p: 0.9,
            top_k: 40
        },
        features: [],
        tips: 'Của Microsoft, rất nhẹ'
    }
};

// Áp dụng preset cho model
function applyModelPreset(presetKey) {
    const preset = MODEL_PRESETS[presetKey];
    if (!preset) {
        showToast('Không tìm thấy preset!', 'error');
        return;
    }

    const modelInput = document.getElementById('ollamaModel');
    modelInput.value = preset.recommended;
    ollamaModel = preset.recommended;

    // Lưu settings cho model này
    localStorage.setItem('ollamaModelPreset', JSON.stringify({
        presetKey: presetKey,
        model: preset.recommended,
        settings: preset.settings,
        features: preset.features
    }));

    saveOllamaSettings();

    const resultDiv = document.getElementById('ollamaTestResult');
    resultDiv.className = 'ollama-test-result success';
    resultDiv.innerHTML = `
✅ <strong>Đã chọn ${preset.name}!</strong>

📦 Model: <code>${preset.recommended}</code>
⚙️ Settings đã tối ưu tự động

💡 <strong>Tip:</strong> ${preset.tips}

📥 Nếu chưa có model, chạy lệnh:
<div style="background: #1a1a2e; padding: 8px; border-radius: 6px; margin-top: 5px;">
    <code style="color: #10b981;">ollama pull ${preset.recommended}</code>
    <button onclick="copyCommand('ollama pull ${preset.recommended}')" style="margin-left: 10px; padding: 3px 8px; cursor: pointer;">📋</button>
</div>
    `;

    showToast(`Đã chọn ${preset.name}! Settings tối ưu đã áp dụng.`, 'success');
}

// Auto-detect model type từ tên model
function detectModelType(modelName) {
    const name = modelName.toLowerCase();

    if (name.includes('qwen')) return 'qwen3';
    if (name.includes('llama')) return 'llama3';
    if (name.includes('gemma')) return 'gemma2';
    if (name.includes('mistral')) return 'mistral';
    if (name.includes('phi')) return 'phi3';

    return null;
}

// Lấy settings tối ưu cho model hiện tại
function getModelSettings() {
    const saved = localStorage.getItem('ollamaModelPreset');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) { }
    }

    // Fallback: detect từ tên model
    const modelName = document.getElementById('ollamaModel')?.value || ollamaModel;
    const presetKey = detectModelType(modelName);

    if (presetKey && MODEL_PRESETS[presetKey]) {
        return {
            settings: MODEL_PRESETS[presetKey].settings,
            features: MODEL_PRESETS[presetKey].features
        };
    }

    // Default settings
    return {
        settings: {
            temperature: 0.7,
            num_predict: 4096,
            num_ctx: 8192,
            top_p: 0.9,
            top_k: 40
        },
        features: []
    };
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        loadOllamaSettings();
        setupOllamaEventListeners();
    }, 100);
});

// Expose globally
window.toggleOllamaMode = toggleOllamaMode;
window.testOllamaConnection = testOllamaConnection;
window.listOllamaModels = listOllamaModels;
window.translateWithOllama = translateWithOllama;
window.loadOllamaModelsDropdown = loadOllamaModelsDropdown;
window.selectOllamaModel = selectOllamaModel;
window.updateOllamaSpeed = updateOllamaSpeed;
window.resetOllamaSpeed = resetOllamaSpeed;
window.testOllamaTranslation = testOllamaTranslation;
window.showStartServerGuide = showStartServerGuide;
window.applyModelPreset = applyModelPreset;
window.copyCommand = copyCommand;
window.getModelSettings = getModelSettings;
window.detectModelType = detectModelType;
