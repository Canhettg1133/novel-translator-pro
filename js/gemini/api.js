/**
 * Novel Translator Pro - Gemini API
 * Gọi Gemini Cloud API để dịch văn bản
 */

// ============================================
// GEMINI TRANSLATE CHUNK
// ============================================
async function translateChunk(text, modelKeyPair, temperature = 0.7) {
    const { model: modelName, key: apiKey, keyIndex } = modelKeyPair;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    console.log(`[Gemini API] ${modelName} + Key ${keyIndex + 1} (temp=${temperature})`);

    const body = {
        contents: [{
            parts: [{ text: text }]
        }],
        generationConfig: {
            temperature: temperature,
            maxOutputTokens: 16384,
            topP: 0.95,
            topK: 40
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
        ]
    };

    // TIMEOUT: 30 giây
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

        console.error(`[Gemini API ERROR] Status: ${response.status}`);
        console.error(`[Gemini API ERROR] Message: ${errorMsg}`);

        if (response.status === 429) {
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
    console.log(`[Gemini API] Response received successfully`);

    // Extract text from Gemini response
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        let result = data.candidates[0].content.parts[0].text.trim();
        result = cleanGeminiResponse(result);

        // ========== VALIDATION ĐẦY ĐỦ ==========
        const validationResult = validateTranslationOutput(text, result);

        if (!validationResult.valid) {
            console.error(`[❌ VALIDATION FAILED] ${validationResult.reason}`);
            throw new Error(`${validationResult.errorCode}:${validationResult.details}`);
        }

        if (validationResult.warning) {
            console.warn(`[⚠️ WARNING] ${validationResult.warning}`);
        }

        return result;
    }

    // Check for blocked content
    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
        console.warn('[Gemini API] Content blocked by SAFETY filter');
        return text;
    }

    if (data.promptFeedback?.blockReason === 'PROHIBITED_CONTENT') {
        console.warn('[Gemini API] Content blocked by PROHIBITED_CONTENT filter');
        return text;
    }

    console.error('[Gemini API ERROR] Invalid response format:', data);
    throw new Error('Gemini API: Invalid response format');
}

// ============================================
// VALIDATE TRANSLATION OUTPUT - Kiểm tra đầy đủ
// ============================================
function validateTranslationOutput(original, translated) {
    const result = {
        valid: true,
        warning: null,
        reason: null,
        errorCode: null,
        details: null
    };

    // Tính ratio
    const inputLength = original.length;
    const outputLength = translated.length;
    const ratio = outputLength / inputLength;

    console.log(`[Validation] Input=${inputLength}, Output=${outputLength}, Ratio=${Math.round(ratio * 100)}%`);

    // ========== 1. CHECK ĐỘ DÀI (50% threshold) ==========
    if (ratio < 0.5) {
        result.valid = false;
        result.reason = `Output quá ngắn! Chỉ ${Math.round(ratio * 100)}% so với input`;
        result.errorCode = 'OUTPUT_TOO_SHORT';
        result.details = Math.round(ratio * 100);
        return result;
    }

    // Warning nếu hơi ngắn
    if (ratio < 0.65) {
        result.warning = `Output hơi ngắn: ${Math.round(ratio * 100)}% so với input`;
    }

    // ========== 2. CHECK TIẾNG VIỆT ==========
    // Regex cho các chữ có dấu tiếng Việt
    const vietnamesePattern = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;

    // Chỉ check nếu output đủ dài (tránh false positive với text ngắn)
    if (outputLength > 100 && !vietnamesePattern.test(translated)) {
        result.valid = false;
        result.reason = 'Output không chứa tiếng Việt! AI có thể bị lỗi hoặc xuất sai ngôn ngữ.';
        result.errorCode = 'NO_VIETNAMESE';
        result.details = 'missing_diacritics';
        return result;
    }

    // ========== 3. CHECK ERROR MARKERS ==========
    const errorMarkers = [
        /\[LỖI/i,
        /\[ERROR/i,
        /\[FAILED/i,
        /\[BLOCKED/i,
        /I cannot/i,
        /I can't translate/i,
        /I'm unable to/i,
        /As an AI/i,
        /I apologize/i
    ];

    for (const marker of errorMarkers) {
        if (marker.test(translated)) {
            result.valid = false;
            result.reason = `Output chứa error marker hoặc AI từ chối dịch`;
            result.errorCode = 'ERROR_MARKER';
            result.details = marker.source;
            return result;
        }
    }

    // ========== 4. CHECK PROMPT LEAK ==========
    const promptLeakPatterns = [
        /⚠️ QUAN TRỌNG/,
        /KHÔNG ĐƯỢC VI PHẠM/,
        /FICTIONAL TRANSLATION TASK/,
        /CONTEXT:.*TÁC PHẨM VĂN HỌC/
    ];

    for (const pattern of promptLeakPatterns) {
        if (pattern.test(translated)) {
            result.valid = false;
            result.reason = 'Output chứa prompt leak (AI lặp lại instructions)';
            result.errorCode = 'PROMPT_LEAK';
            result.details = 'prompt_in_output';
            return result;
        }
    }

    return result;
}

// ============================================
// CLEAN GEMINI RESPONSE - Loại bỏ markdown và format thừa
// ============================================
function cleanGeminiResponse(text) {
    // Patterns đầu văn bản cần xóa
    const patternsToRemove = [
        /^(Tuyệt vời!|Được rồi!|Okay!|Dưới đây là|Đây là|Here is)[^\n]*\n+/gi,
        /^(Tôi đã|Tôi sẽ|I have|I will)[^\n]*\n+/gi,
        /^[^\n]*(phiên bản đã|version|chỉnh sửa|edited)[^\n]*:\s*\n+/gi,
        /^---+\s*\n/gm,
        /^#+\s+[^\n]+\n+/gm,
    ];

    let cleaned = text;
    for (const pattern of patternsToRemove) {
        cleaned = cleaned.replace(pattern, '');
    }

    // ========== XÓA MARKDOWN FORMATTING ==========
    // Xóa headers (# ## ### etc)
    cleaned = cleaned.replace(/^#+\s+/gm, '');

    // Xóa bold (**text** hoặc __text__)
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');

    // Xóa italic (*text* hoặc _text_) - cẩn thận không xóa dấu * đơn trong văn bản
    cleaned = cleaned.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
    cleaned = cleaned.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1');

    // Xóa bullet points (* - at start of line)
    cleaned = cleaned.replace(/^\s*[\*\-•]\s+/gm, '');

    // Xóa numbered list (1. 2. etc)
    cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');

    // Xóa inline code (`code`)
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // Xóa code blocks (```...```)
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

    // Xóa blockquote (> at start)
    cleaned = cleaned.replace(/^\s*>\s*/gm, '');

    // Xóa horizontal rules (--- or ***)
    cleaned = cleaned.replace(/^\s*[-*_]{3,}\s*$/gm, '');

    // Xóa dấu * hoặc ** đứng đơn lẻ còn sót
    cleaned = cleaned.replace(/\*+\s*/g, ' ');
    cleaned = cleaned.replace(/\s*\*+/g, ' ');

    // Clean up multiple spaces
    cleaned = cleaned.replace(/  +/g, ' ');
    // Clean up multiple newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Patterns cuối văn bản cần xóa
    const trailingPatterns = [
        /\n+(Hy vọng|Tôi đã|Lưu ý|Note:|Ghi chú)[^\n]*$/gi,
        /\n+---+\s*$/gm,
    ];

    for (const pattern of trailingPatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
}

// NOTE: translateChunkWithRetry, translateLargeChunkBySplitting, splitTextIntoSmallerParts
// đã được định nghĩa đầy đủ trong js/translation/retry.js với:
// - Progressive prompt support
// - OUTPUT_TOO_SHORT handling
// - Better error recovery
// Do đó không cần duplicate ở đây.
