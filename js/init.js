/**
 * Novel Translator Pro - Init (Load cuối cùng)
 * Expose tất cả functions sau khi modules đã load
 */

// ============================================
// EXPOSE GLOBALLY - Chạy sau khi tất cả modules load
// ============================================
window.addApiKey = addApiKey;
window.removeApiKey = removeApiKey;
window.resetRotationAndRefresh = resetRotationAndRefresh;
window.startTranslation = startTranslation;
window.togglePause = togglePause;
window.confirmCancel = confirmCancel;
window.closeCancelModal = closeCancelModal;
window.executeCancel = executeCancel;
window.cancelTranslation = cancelTranslation;
window.copyResult = copyResult;
window.downloadResult = downloadResult;
window.downloadPartial = downloadPartial;
window.setPromptTemplate = setPromptTemplate;
window.clearFile = clearFile;
window.continueFromHistory = continueFromHistory;
window.loadFromHistory = loadFromHistory;
window.deleteFromHistory = deleteFromHistory;
window.clearAllHistory = clearAllHistory;
window.exportHistory = exportHistory;
window.importHistory = importHistory;
window.exportApiKeys = exportApiKeys;
window.copyExportedKeys = copyExportedKeys;
window.closeKeyModal = closeKeyModal;
window.openImportApiKeysModal = openImportApiKeysModal;
window.executeImportApiKeys = executeImportApiKeys;
window.closeImportModal = closeImportModal;

// Model management functions
window.addGeminiModel = addGeminiModel;
window.removeGeminiModel = removeGeminiModel;
window.toggleGeminiModel = toggleGeminiModel;
window.updateModelQuota = updateModelQuota;
window.resetGeminiModels = resetGeminiModels;
window.addPresetModel = addPresetModel;
window.addCustomModel = addCustomModel;

window.listKeys = () => {
    console.table(apiKeys.map((key, i) => ({ '#': i + 1, 'Key': key })));
    return apiKeys;
};

// Ollama functions
if (typeof testOllamaConnection === 'function') window.testOllamaConnection = testOllamaConnection;
if (typeof loadOllamaModels === 'function') window.loadOllamaModels = loadOllamaModels;
if (typeof toggleOllama === 'function') window.toggleOllama = toggleOllama;
if (typeof selectOllamaModel === 'function') window.selectOllamaModel = selectOllamaModel;

console.log('✅ All modules loaded and exposed globally');
