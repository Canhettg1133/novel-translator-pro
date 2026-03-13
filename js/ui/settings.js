/**
 * Novel Translator Pro - Settings
 * Lưu và tải cấu hình
 */

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
        customPrompt: document.getElementById('customPrompt').value,
        // Proxy settings
        useProxy: useProxy,
        proxyBaseUrl: proxyBaseUrl,
        proxyApiKey: proxyApiKey,
        proxyApiKeys: proxyApiKeys,
        proxyModel: proxyModel
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
            // Proxy settings
            if (settings.useProxy !== undefined) useProxy = settings.useProxy;
            if (settings.proxyBaseUrl) proxyBaseUrl = settings.proxyBaseUrl;
            if (settings.proxyApiKey) proxyApiKey = settings.proxyApiKey;
            if (settings.proxyApiKeys) proxyApiKeys = settings.proxyApiKeys;
            // Migrate: if old single key exists but new array is empty
            if (!proxyApiKeys.length && proxyApiKey) {
                proxyApiKeys = [proxyApiKey];
            }
            if (settings.proxyModel) proxyModel = settings.proxyModel;
            // Update proxy UI
            if (document.getElementById('useProxyToggle')) {
                document.getElementById('useProxyToggle').checked = useProxy;
                document.getElementById('proxySettings').style.display = useProxy ? 'block' : 'none';
                document.getElementById('proxyStatus').textContent = useProxy ? 'Bật' : 'Tắt';
                document.getElementById('proxyStatus').style.background = useProxy ? '#10b981' : '';
            }
            if (document.getElementById('proxyBaseUrlInput')) {
                document.getElementById('proxyBaseUrlInput').value = proxyBaseUrl;
            }
            if (document.getElementById('proxyModelSelect')) {
                document.getElementById('proxyModelSelect').value = proxyModel;
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

// ============================================
// STATISTICS UPDATE
// ============================================
function updateStats() {
    const text = document.getElementById('originalText').value;
    const charCount = text.length;
    const chunkSize = parseInt(document.getElementById('chunkSize').value) || 4500;
    const chunkCount = Math.ceil(charCount / chunkSize);
    const parallelCount = parseInt(document.getElementById('parallelCount').value) || 5;

    const batches = Math.ceil(chunkCount / Math.min(parallelCount, apiKeys.length || 1));
    const estimatedSeconds = batches * 0.8;

    document.getElementById('charCount').textContent = `${charCount.toLocaleString()} ký tự`;
    document.getElementById('chunkCount').textContent = `${chunkCount} chunks`;
    document.getElementById('estimatedTime').textContent = `~${Math.ceil(estimatedSeconds)} giây`;
}

// ============================================
// PROMPT TEMPLATES
// ============================================
function setPromptTemplate(templateName) {
    if (PROMPT_TEMPLATES[templateName]) {
        document.getElementById('customPrompt').value = PROMPT_TEMPLATES[templateName];
        saveSettings();

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
        sacHiepPro: '💎 Sắc Hiệp PRO',
        sacHiepENI: '⭐ Sắc Hiệp ENI',
        wuxia: '⚔️ Tu tiên/Kiếm hiệp',
        romance: '💕 Ngôn tình'
    };
    return names[key] || key;
}
