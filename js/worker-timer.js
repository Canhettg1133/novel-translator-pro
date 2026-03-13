/**
 * Novel Translator Pro - Worker-Based Timer
 * Giải quyết vấn đề trình duyệt throttle setTimeout khi tab bị ẩn (background).
 * 
 * Web Workers KHÔNG bị throttle, nên timer luôn chính xác dù user chuyển tab.
 */

// ============================================
// INLINE WEB WORKER (không cần file riêng)
// ============================================
const WORKER_BLOB = new Blob([`
    // Worker timer - Không bị throttle khi tab ẩn
    const timers = new Map();
    let nextId = 1;

    self.onmessage = function(e) {
        const { type, id, ms } = e.data;

        if (type === 'setTimeout') {
            const timerId = id || nextId++;
            const timer = setTimeout(() => {
                timers.delete(timerId);
                self.postMessage({ type: 'timeout', id: timerId });
            }, ms);
            timers.set(timerId, timer);
            self.postMessage({ type: 'timerCreated', id: timerId });
        }

        if (type === 'clearTimeout') {
            if (timers.has(id)) {
                clearTimeout(timers.get(id));
                timers.delete(id);
            }
        }

        if (type === 'clearAll') {
            timers.forEach(timer => clearTimeout(timer));
            timers.clear();
        }
    };
`], { type: 'application/javascript' });

let timerWorker = null;
let workerCallbacks = new Map();
let workerTimerId = 1;
let workerAvailable = false;

/**
 * Khởi tạo Worker Timer
 */
function initWorkerTimer() {
    try {
        const workerUrl = URL.createObjectURL(WORKER_BLOB);
        timerWorker = new Worker(workerUrl);
        URL.revokeObjectURL(workerUrl);

        timerWorker.onmessage = function(e) {
            const { type, id } = e.data;
            if (type === 'timeout') {
                const callback = workerCallbacks.get(id);
                if (callback) {
                    workerCallbacks.delete(id);
                    callback();
                }
            }
        };

        timerWorker.onerror = function(err) {
            console.warn('[WorkerTimer] Worker error, falling back to setTimeout:', err);
            workerAvailable = false;
        };

        workerAvailable = true;
        console.log('✅ [WorkerTimer] Web Worker timer initialized - tab ẩn sẽ không bị chậm!');
    } catch (e) {
        console.warn('[WorkerTimer] Cannot create Web Worker, using fallback setTimeout:', e);
        workerAvailable = false;
    }
}

/**
 * setTimeout qua Web Worker (không bị throttle)
 * Fallback sang setTimeout thường nếu Worker không khả dụng
 */
function workerSetTimeout(callback, ms) {
    if (workerAvailable && timerWorker) {
        const id = workerTimerId++;
        workerCallbacks.set(id, callback);
        timerWorker.postMessage({ type: 'setTimeout', id, ms });
        return id;
    }
    // Fallback
    return setTimeout(callback, ms);
}

/**
 * clearTimeout qua Web Worker
 */
function workerClearTimeout(id) {
    if (workerAvailable && timerWorker) {
        workerCallbacks.delete(id);
        timerWorker.postMessage({ type: 'clearTimeout', id });
    } else {
        clearTimeout(id);
    }
}

/**
 * Sleep sử dụng Worker Timer - KHÔNG bị throttle khi tab ẩn!
 * Thay thế cho hàm sleep() cũ dùng setTimeout
 */
function sleep(ms) {
    const duration = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    if (duration === 0) {
        return Promise.resolve();
    }

    // Sử dụng Web Worker timer khi có thể
    if (workerAvailable && timerWorker) {
        return new Promise(resolve => {
            // Chia thành các bước nhỏ để hỗ trợ cancel
            const stepMs = 200; // Kiểm tra cancel mỗi 200ms
            let elapsed = 0;

            const tick = () => {
                if (cancelRequested) {
                    resolve();
                    return;
                }
                if (elapsed >= duration) {
                    resolve();
                    return;
                }

                const wait = Math.min(stepMs, duration - elapsed);
                const timerId = workerTimerId++;
                workerCallbacks.set(timerId, () => {
                    elapsed += wait;
                    tick();
                });
                timerWorker.postMessage({ type: 'setTimeout', id: timerId, ms: wait });
            };

            tick();
        });
    }

    // Fallback: dùng setTimeout thường (bị throttle khi tab ẩn)
    return new Promise(resolve => {
        const stepMs = 100;
        let elapsed = 0;

        const tick = () => {
            if (cancelRequested) {
                resolve();
                return;
            }
            if (elapsed >= duration) {
                resolve();
                return;
            }

            const wait = Math.min(stepMs, duration - elapsed);
            setTimeout(() => {
                elapsed += wait;
                tick();
            }, wait);
        };

        tick();
    });
}

/**
 * Sleep với countdown hiển thị trên UI
 * Cũng sử dụng Worker Timer
 */
async function sleepWithCountdown(ms, statusPrefix = '⏳ Chờ quota reset') {
    const totalSeconds = Math.ceil(ms / 1000);
    for (let remaining = totalSeconds; remaining > 0; remaining--) {
        updateProgress(completedChunks, totalChunksCount, `${statusPrefix}... ${remaining}s`);
        await sleep(1000);

        if (cancelRequested) {
            console.log('[Countdown] Cancelled!');
            return;
        }
    }
}

// ============================================
// VISIBILITY CHANGE MONITOR
// ============================================
let tabHiddenSince = null;

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        tabHiddenSince = Date.now();
        if (isTranslating) {
            console.log('[WorkerTimer] 📋 Tab ẩn - Worker timer vẫn hoạt động bình thường!');
        }
    } else {
        if (tabHiddenSince && isTranslating) {
            const hiddenDuration = ((Date.now() - tabHiddenSince) / 1000).toFixed(1);
            console.log(`[WorkerTimer] 👁️ Tab hiện lại (đã ẩn ${hiddenDuration}s) - dịch vẫn đang chạy!`);
        }
        tabHiddenSince = null;
    }
});

// Tự động init khi load
initWorkerTimer();
