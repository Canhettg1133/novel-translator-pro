/**
 * Novel Translator Pro - Proxy API UI Functions
 * Quản lý UI và chức năng cho Proxy API (BeiJiXingXing, OpenRouter...)
 */

// ============================================
// TOGGLE PROXY MODE
// ============================================
function toggleProxyMode() {
    useProxy = document.getElementById('useProxyToggle').checked;
    document.getElementById('proxySettings').style.display = useProxy ? 'block' : 'none';
    document.getElementById('proxyStatus').textContent = useProxy ? 'Bật' : 'Tắt';
    document.getElementById('proxyStatus').style.background = useProxy ? '#10b981' : '';

    if (useProxy) {
        // Tắt Ollama nếu đang bật
        if (typeof useOllama !== 'undefined' && useOllama) {
            useOllama = false;
            const ollamaToggle = document.getElementById('useOllamaToggle');
            if (ollamaToggle) ollamaToggle.checked = false;
            document.getElementById('ollamaSettings').style.display = 'none';
            document.getElementById('ollamaStatus').textContent = 'Tắt';
            document.getElementById('ollamaStatus').style.background = '';
        }
        showToast('✅ Đã bật Proxy API mode! Hệ thống sẽ gọi qua proxy thay vì Gemini Direct.', 'success');
    } else {
        showToast('🔄 Đã tắt Proxy, sử dụng Gemini Direct.', 'info');
    }

    saveSettings();
    renderProxyModelsDropdown();
}

// ============================================
// UPDATE PROXY CONFIG
// ============================================
function updateProxyConfig() {
    proxyBaseUrl = document.getElementById('proxyBaseUrlInput').value.trim();
    proxyApiKey = document.getElementById('proxyApiKeyInput').value.trim();
    saveSettings();
}

// ============================================
// SELECT PROXY MODEL
// ============================================
function selectProxyModel() {
    const select = document.getElementById('proxyModelSelect');
    if (select.value) {
        proxyModel = select.value;
        saveSettings();
        showToast(`Đã chọn model: ${proxyModel}`, 'success');
    }
}

// ============================================
// RENDER PROXY MODELS DROPDOWN
// ============================================
function renderProxyModelsDropdown() {
    const select = document.getElementById('proxyModelSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Chọn model --</option>';

    // Group models by group property
    const groups = {};
    PROXY_MODELS.forEach(m => {
        const groupName = m.group || 'Other';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(m);
    });

    for (const [groupName, models] of Object.entries(groups)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        models.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.label;
            if (m.id === proxyModel) option.selected = true;
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    }
}

// ============================================
// TEST PROXY CONNECTION
// ============================================
async function testProxyConnection() {
    const resultDiv = document.getElementById('proxyTestResult');
    resultDiv.innerHTML = '<p style="color:#f59e0b;">⏳ Đang test kết nối proxy...</p>';

    if (!proxyApiKey) {
        resultDiv.innerHTML = '<p style="color:#ef4444;">❌ Chưa nhập API Key!</p>';
        return;
    }

    const startTime = Date.now();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(proxyBaseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${proxyApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: proxyModel,
                messages: [{ role: 'user', content: 'Xin chào! Trả lời ngắn gọn 1 câu.' }],
                temperature: 0.5,
                max_tokens: 100
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
            resultDiv.innerHTML = `<p style="color:#ef4444;">❌ Lỗi ${response.status}: ${errorMsg}</p>
                <p style="color:#888;font-size:12px;">Thời gian: ${elapsed}s</p>`;
            return;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '(no content)';
        const model = data.model || proxyModel;

        resultDiv.innerHTML = `
            <div style="background:rgba(16,185,129,0.1);border:1px solid #10b981;border-radius:8px;padding:12px;">
                <p style="color:#10b981;font-weight:600;">✅ Kết nối thành công!</p>
                <p style="color:#ccc;font-size:13px;">
                    <strong>Model:</strong> ${model}<br>
                    <strong>Thời gian:</strong> ${elapsed}s<br>
                    <strong>Response:</strong> ${content.substring(0, 200)}
                </p>
            </div>`;

        showToast(`✅ Proxy hoạt động! (${elapsed}s)`, 'success');
    } catch (error) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (error.name === 'AbortError') {
            resultDiv.innerHTML = `<p style="color:#ef4444;">❌ Timeout sau 30s! Server proxy quá chậm.</p>`;
        } else {
            resultDiv.innerHTML = `<p style="color:#ef4444;">❌ Lỗi: ${error.message}</p>
                <p style="color:#888;font-size:12px;">Thời gian: ${elapsed}s</p>`;
        }
    }
}

// ============================================
// INIT PROXY UI
// ============================================
function initProxyUI() {
    renderProxyModelsDropdown();

    // Restore saved state
    if (useProxy) {
        document.getElementById('useProxyToggle').checked = true;
        document.getElementById('proxySettings').style.display = 'block';
        document.getElementById('proxyStatus').textContent = 'Bật';
        document.getElementById('proxyStatus').style.background = '#10b981';
    }
    if (proxyBaseUrl) {
        document.getElementById('proxyBaseUrlInput').value = proxyBaseUrl;
    }
    if (proxyApiKey) {
        document.getElementById('proxyApiKeyInput').value = proxyApiKey;
    }
}
