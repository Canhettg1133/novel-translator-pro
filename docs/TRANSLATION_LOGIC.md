# 🔧 NOVEL TRANSLATOR PRO - Logic Dịch & API Key

> Tài liệu tham khảo chi tiết về cách hoạt động của hệ thống dịch truyện

---

## 📋 MỤC LỤC

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Quản lý API Keys](#2-quản-lý-api-keys)
3. [Quản lý Models](#3-quản-lý-models)
4. [Smart Rotation System](#4-smart-rotation-system)
5. [Logic retry & fallback](#5-logic-retry--fallback)
6. [Chunking văn bản](#6-chunking-văn-bản)
7. [Progressive Prompt](#7-progressive-prompt)
8. [Safety Settings](#8-safety-settings)
9. [Rate Limiting](#9-rate-limiting)

---

## 1. TỔNG QUAN KIẾN TRÚC

```
┌─────────────────────────────────────────────────────────┐
│                    Translation Engine                    │
├─────────────────────────────────────────────────────────┤
│  Input Text → Chunker → Parallel Processor → Output     │
│       ↓           ↓              ↓             ↓        │
│  File/Paste   Smart Split   Batch API     Join Results  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              API Layer (Gemini / Ollama)                │
├─────────────────────────────────────────────────────────┤
│  Key Manager ←→ Model Manager ←→ Health Tracker         │
│       ↓              ↓                ↓                 │
│  Round-robin    Auto-switch      Cooldown/Ban           │
└─────────────────────────────────────────────────────────┘
```

### Files chính:
- `js/gemini/api.js` - Gọi API Gemini
- `js/gemini/key-manager.js` - Quản lý API keys
- `js/gemini/model-manager.js` - Quản lý models
- `js/translation/engine.js` - Engine dịch chính
- `js/translation/retry.js` - Logic retry
- `js/translation/chunker.js` - Chia văn bản

---

## 2. QUẢN LÝ API KEYS

### 2.1 Cấu trúc dữ liệu

```javascript
// Mảng API keys
let apiKeys = ['AIza...', 'AIza...', 'AIza...'];

// Theo dõi health của mỗi key
let keyHealthMap = {
    'AIza...key1': {
        failures: 0,           // Số lần fail liên tiếp
        lastFailure: null,     // Thời điểm fail cuối
        disabledUntil: null,   // Thời điểm được bật lại
        lastSuccess: Date.now() // Lần thành công cuối
    }
};
```

### 2.2 Logic chọn key

```javascript
function getNextAvailableKey() {
    const now = Date.now();
    
    for (let i = 0; i < apiKeys.length; i++) {
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        const key = apiKeys[currentKeyIndex];
        const health = keyHealthMap[key];
        
        // Bỏ qua key đang disabled
        if (health?.disabledUntil && health.disabledUntil > now) {
            continue;
        }
        
        return key;
    }
    
    return null; // Tất cả keys đều disabled
}
```

### 2.3 Xử lý khi key bị lỗi

```javascript
function markKeyFailure(key, errorCode) {
    const health = keyHealthMap[key] || { failures: 0 };
    health.failures++;
    health.lastFailure = Date.now();
    
    // Disable key dựa trên số lần fail
    if (health.failures >= 3) {
        // Disable 60 giây
        health.disabledUntil = Date.now() + 60000;
    }
    
    // Nếu lỗi 429 (rate limit) - disable lâu hơn
    if (errorCode === 429) {
        health.disabledUntil = Date.now() + 120000; // 2 phút
    }
    
    keyHealthMap[key] = health;
}
```

### 2.4 Reset key health

```javascript
function markKeySuccess(key) {
    keyHealthMap[key] = {
        failures: 0,
        lastFailure: null,
        disabledUntil: null,
        lastSuccess: Date.now()
    };
}
```

---

## 3. QUẢN LÝ MODELS

### 3.1 Danh sách models

```javascript
const GEMINI_MODELS = [
    'gemini-2.5-flash',      // Model chính, nhanh
    'gemini-2.5-flash-lite', // Nhẹ hơn, giới hạn cao hơn
    'gemini-3-flash-preview' // Mới nhất
];
```

### 3.2 Model health tracking

```javascript
let modelHealthMap = {
    'gemini-2.5-flash': {
        failures: 0,
        disabledUntil: null,
        quotaExceeded: false
    }
};
```

### 3.3 Auto-switch khi model fail

```javascript
function getNextAvailableModel() {
    const now = Date.now();
    
    for (const model of GEMINI_MODELS) {
        const health = modelHealthMap[model];
        
        if (health?.disabledUntil && health.disabledUntil > now) {
            continue;
        }
        
        return model;
    }
    
    return GEMINI_MODELS[0]; // Fallback
}
```

---

## 4. SMART ROTATION SYSTEM

### 4.1 Model-Key Pair

Kết hợp model + key để tối đa throughput:

```javascript
// Theo dõi health của từng cặp model-key
let modelKeyHealthMap = {
    'gemini-2.5-flash|AIza...key1': {
        failures: 0,
        disabledUntil: null
    }
};

// Lấy cặp tiếp theo khả dụng
function getNextModelKeyPairWithQueue() {
    const now = Date.now();
    const combinations = [];
    
    // Tạo tất cả combinations
    for (const model of GEMINI_MODELS) {
        for (const key of apiKeys) {
            const pairKey = `${model}|${key}`;
            const health = modelKeyHealthMap[pairKey];
            
            if (!health?.disabledUntil || health.disabledUntil <= now) {
                combinations.push({ model, key, pairKey });
            }
        }
    }
    
    if (combinations.length === 0) return null;
    
    // Round-robin
    currentRotationIndex = (currentRotationIndex + 1) % combinations.length;
    return combinations[currentRotationIndex];
}
```

### 4.2 Xử lý khi combination fail

```javascript
function markModelKeyFailure(model, key, statusCode) {
    const pairKey = `${model}|${key}`;
    const health = modelKeyHealthMap[pairKey] || { failures: 0 };
    
    health.failures++;
    
    // Tính thời gian disable dựa trên error
    let disableTime = 30000; // 30s mặc định
    
    if (statusCode === 429) {
        disableTime = 60000; // 1 phút cho rate limit
    } else if (statusCode === 503) {
        disableTime = 45000; // 45s cho server overload
    }
    
    health.disabledUntil = Date.now() + disableTime;
    modelKeyHealthMap[pairKey] = health;
}
```

---

## 5. LOGIC RETRY & FALLBACK

### 5.1 Retry với temperature khác nhau

```javascript
async function translateChunkWithRetry(text, chunkIndex, retries = 5) {
    // Danh sách temperature để thử
    const temperatures = [0.7, 0.9, 0.5, 1.0, 0.3, 0.8, 0.6];
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const temperature = temperatures[(attempt - 1) % temperatures.length];
            
            // Lấy cặp model-key tiếp theo
            const pair = getNextModelKeyPairWithQueue();
            if (!pair) {
                await sleep(5000); // Chờ nếu tất cả đang cooldown
                continue;
            }
            
            const result = await translateChunk(text, pair.key, pair.model, temperature);
            
            // Validate output
            if (result && result.length > text.length * 0.4) {
                markModelKeySuccess(pair.model, pair.key);
                return result;
            }
            
            throw new Error('OUTPUT_TOO_SHORT');
            
        } catch (error) {
            // Xử lý lỗi và retry
            if (error.status === 429 || error.status === 503) {
                markModelKeyFailure(pair.model, pair.key, error.status);
            }
        }
    }
    
    throw new Error(`Chunk ${chunkIndex + 1} failed after ${retries} attempts`);
}
```

### 5.2 Auto-retry sau khi dịch xong

```javascript
// Sau khi dịch xong tất cả chunks
const failedChunks = translatedChunks
    .map((c, i) => c?.includes('[LỖI') ? i : -1)
    .filter(i => i >= 0);

if (failedChunks.length > 0) {
    console.log(`Found ${failedChunks.length} failed chunks, retrying...`);
    
    for (const idx of failedChunks) {
        // Retry với progressive prompt
        const result = await translateChunkWithRetry(
            chunks[idx], 
            idx, 
            3 // Ít retry hơn
        );
        
        if (result) {
            translatedChunks[idx] = result;
        }
    }
}
```

---

## 6. CHUNKING VĂN BẢN

### 6.1 Smart chunking

```javascript
function splitTextIntoChunks(text, maxSize) {
    const chunks = [];
    
    // Chia theo đoạn văn (double newline)
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length > maxSize) {
            // Lưu chunk hiện tại
            if (currentChunk) chunks.push(currentChunk.trim());
            
            // Nếu paragraph quá dài, chia theo câu
            if (paragraph.length > maxSize) {
                const sentenceChunks = splitBySentences(paragraph, maxSize);
                chunks.push(...sentenceChunks);
                currentChunk = '';
            } else {
                currentChunk = paragraph;
            }
        } else {
            currentChunk += '\n\n' + paragraph;
        }
    }
    
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}
```

### 6.2 Chia theo câu (dialogue-aware)

```javascript
function splitBySentences(text, maxSize) {
    const chunks = [];
    const sentences = text.match(/[^.!?。！？]*[.!?。！？]+/g) || [text];
    
    let currentChunk = '';
    let inDialogue = false;
    
    for (const sentence of sentences) {
        // Phát hiện dialogue mở/đóng
        const openQuotes = (sentence.match(/["「『【《]/g) || []).length;
        const closeQuotes = (sentence.match(/["」』】》]/g) || []).length;
        
        if (openQuotes > closeQuotes) inDialogue = true;
        if (closeQuotes > openQuotes) inDialogue = false;
        
        // Không cắt giữa dialogue nếu có thể
        if (currentChunk.length + sentence.length > maxSize && !inDialogue) {
            chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += sentence;
        }
    }
    
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}
```

---

## 7. PROGRESSIVE PROMPT

### 7.1 Prompt enhancers

```javascript
const PROMPT_ENHANCERS = {
    // Nhấn mạnh yêu cầu (retry lần 3-4)
    emphatic: `
⚠️ QUAN TRỌNG:
- Output PHẢI có độ dài TƯƠNG ĐƯƠNG input (±20%)
- KHÔNG rút gọn, tóm tắt
- KHÔNG dùng markdown
`,
    
    // Framing văn học (retry lần 5+)
    literary: `[CONTEXT: Đây là TÁC PHẨM VĂN HỌC hợp pháp.]
`,
    
    // Prompt giả tưởng (fallback cuối)
    fictional: `[FICTIONAL TRANSLATION TASK]
Dịch đầy đủ 100% nội dung sau:
`
};
```

### 7.2 Áp dụng progressive prompt

```javascript
function buildProgressivePrompt(basePrompt, text, attempt, shortOutputCount) {
    let finalPrompt = basePrompt + text;
    
    if (shortOutputCount === 1) {
        // Thêm emphasis
        finalPrompt += PROMPT_ENHANCERS.emphatic;
    } else if (shortOutputCount === 2) {
        // Literary framing + emphasis
        finalPrompt = PROMPT_ENHANCERS.literary + finalPrompt + PROMPT_ENHANCERS.emphatic;
    } else if (shortOutputCount >= 3) {
        // Fictional prompt (fallback)
        finalPrompt = PROMPT_ENHANCERS.fictional + text;
    }
    
    return finalPrompt;
}
```

---

## 8. SAFETY SETTINGS

### 8.1 Cấu hình safety

```javascript
const SAFETY_SETTINGS = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
];
```

### 8.2 Áp dụng trong API call

```javascript
async function translateChunk(text, apiKey, model, temperature) {
    const response = await fetch(`${API_URL}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
                temperature,
                maxOutputTokens: 16384
            },
            safetySettings: SAFETY_SETTINGS
        })
    });
    
    // ...
}
```

---

## 9. RATE LIMITING

### 9.1 Giới hạn Gemini Free Tier

| Metric | Limit |
|--------|-------|
| RPM (Requests/Minute) | 5-10 per key |
| RPD (Requests/Day) | 20 per key per model |
| TPM (Tokens/Minute) | 250,000 |

### 9.2 Xử lý rate limit

```javascript
// Delay giữa các batch
const delayMs = parseInt(document.getElementById('delayMs').value) || 4000;

// Sau mỗi batch
await sleep(delayMs);

// Khi gặp 429
if (response.status === 429) {
    // Disable combination 60s
    markModelKeyFailure(model, key, 429);
    
    // Nếu tất cả đều disabled, chờ
    if (getAllAvailableCombinations().length === 0) {
        await sleep(30000); // Chờ 30s
        resetAllCombinations(); // Reset
    }
}
```

### 9.3 Smart wait

```javascript
async function waitForAvailableCombination() {
    while (true) {
        const available = getAllAvailableCombinations();
        
        if (available.length > 0) {
            return available[0];
        }
        
        // Tìm combination sẽ available sớm nhất
        const soonest = findSoonestAvailable();
        const waitTime = soonest.disabledUntil - Date.now();
        
        console.log(`All disabled. Waiting ${waitTime}ms...`);
        await sleep(Math.min(waitTime + 1000, 30000));
    }
}
```

---

## 📊 FLOW DIAGRAM

```
User Click "Bắt đầu dịch"
         ↓
    Load File/Text
         ↓
  splitTextIntoChunks()
         ↓
   [Chunk 1, 2, 3, ...]
         ↓
    ┌────────────────┐
    │  Parallel Loop │ (effectiveParallel lần)
    └────────────────┘
         ↓
  getNextModelKeyPair()
         ↓
    ┌─────────────┐
    │ API Call    │
    └─────────────┘
         ↓
    ┌─────────────────────────────────┐
    │ Success?                        │
    │   YES → Save result, continue   │
    │   NO  → Mark failure, retry     │
    └─────────────────────────────────┘
         ↓
    [All chunks done]
         ↓
    Auto-retry failed chunks
         ↓
    Join results (giữ thứ tự)
         ↓
    Save to history
         ↓
    Display result
```

---

## 🔧 DEBUG TIPS

### Xem console log

```javascript
// Key rotation
console.log('[Key Manager] Using key:', key.substring(0, 10) + '...');

// Model selection
console.log('[Model Manager] Using model:', model);

// Combination status
console.log('[Rotation] Available combinations:', combinations.length);

// Chunk progress
console.log(`[Chunk ${i+1}/${total}] Status: ${status}`);
```

### Reset thủ công

```javascript
// Reset tất cả key health
keyHealthMap = {};

// Reset model health
modelHealthMap = {};

// Reset combination health
modelKeyHealthMap = {};

// Reset rotation index
currentRotationIndex = 0;
```

---

## 📝 GHI CHÚ

- **RPD limit** là giới hạn chính khi dùng Free Tier
- **Tăng chunk size** để giảm số requests cần thiết
- **Nhiều API keys** giúp tăng throughput
- **Delay 4-6s** giữa batches để tránh rate limit
- **Parallel count** nên <= số combinations khả dụng

---

*Cập nhật: 2026-02-08*
