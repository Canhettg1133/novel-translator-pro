# 📚 Novel Translator Pro

**Ứng dụng dịch và làm mượt truyện chữ siêu nhanh với Gemini AI & Ollama Local**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Canhettg1133/novel-translator-pro)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20|%20Web-lightgrey.svg)]()

---

## ✨ Tính năng chính

### 🌐 Dịch thuật thông minh
- **Gemini AI Cloud** - Dịch nhanh với nhiều models (2.5 Flash, 2.0 Flash, 1.5 Flash, 1.5 Pro)
- **Ollama Local** - Dịch offline không giới hạn với Qwen3, Llama3, Gemma2...
- **Multi-key rotation** - Xoay vòng nhiều API keys tự động
- **Smart retry** - Tự động thử lại khi gặp lỗi

### 📖 Làm mượt truyện Convert
- Chuyển đổi văn phong cứng nhắc thành văn phong tiểu thuyết mượt mà
- Hỗ trợ nhiều thể loại: Tiểu thuyết, 18+, Sắc Hiệp, Tu tiên/Kiếm hiệp, Ngôn tình
- Custom prompt tùy chỉnh theo ý muốn

### ⚡ Hiệu suất cao
- Dịch song song nhiều chunks cùng lúc
- Tự động chia văn bản thành chunks tối ưu
- Hiển thị tiến độ real-time với ETA

### 🔧 Quản lý API Keys
- **Nhập nhiều keys** - Paste danh sách 10+ keys cùng lúc
- **Xuất keys** - Backup danh sách keys dễ dàng
- **Health tracking** - Theo dõi trạng thái từng key
- **Auto-disable** - Tự động tắt key lỗi tạm thời

### 💾 Tiện ích
- Lưu lịch sử dịch thuật
- Import/Export lịch sử
- Tiếp tục dịch từ vị trí đã dừng
- Tải xuống file kết quả (.txt)

---

## 🖥️ Cài đặt

### Phương pháp 1: Ứng dụng Desktop (Portable .exe)

1. **Tải file exe** từ [Releases](https://github.com/Canhettg1133/novel-translator-pro/releases)
2. **Chạy trực tiếp** - Không cần cài đặt
3. **Yêu cầu:** Windows 10/11 64-bit

### Phương pháp 2: Chạy từ Source Code

```bash
# Clone repository
git clone https://github.com/Canhettg1133/novel-translator-pro.git
cd novel-translator-pro

# Cài dependencies
npm install

# Chạy development mode
npm start

# Build exe
npm run build
```

### Phương pháp 3: Web Browser (PWA)

1. Host lên **GitHub Pages** hoặc server của bạn
2. Mở bằng trình duyệt và "Install" như app

---

## 🚀 Hướng dẫn sử dụng

### 1. Thêm API Keys

#### Gemini Cloud API (Khuyến nghị)
1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Đăng nhập tài khoản Google
3. Tạo API Key mới
4. Copy và paste vào app

**💡 Mẹo:** Tạo nhiều tài khoản Google → Nhiều keys → Dịch nhanh hơn!

#### Nhập nhiều keys cùng lúc
1. Click nút **📥 Nhập nhiều**
2. Paste danh sách keys (mỗi dòng 1 key hoặc phân cách bằng dấu phẩy)
3. Xem preview và click **Nhập keys**

#### Xuất/Backup keys
1. Click nút **📋 Xuất**
2. Copy danh sách keys
3. Lưu vào nơi an toàn

### 2. Sử dụng Ollama Local (Tùy chọn)

1. Cài đặt [Ollama](https://ollama.com/download)
2. Chạy model: `ollama run huihui_ai/qwen3-abliterated:4b`
3. Bật toggle **"Sử dụng Ollama Local"** trong app
4. Test kết nối và bắt đầu dịch

**Models khuyến nghị:**
- `huihui_ai/qwen3-abliterated:4b` - Tốt nhất cho dịch 18+
- `llama3:8b` - Đa năng
- `gemma2:9b` - Chất lượng cao

### 3. Dịch truyện

1. **Chọn file** hoặc paste nội dung vào textarea
2. **Chọn ngôn ngữ gốc** (mặc định: Tiếng Trung)
3. **Chọn prompt template** phù hợp với thể loại truyện
4. **Click "Bắt đầu dịch"**
5. **Tải xuống kết quả** khi hoàn thành

---

## ⚙️ Cấu hình tối ưu

| Thông số | Gemini Cloud | Ollama Local |
|----------|--------------|--------------|
| Parallel requests | 2-3 | 1 |
| Chunk size | 3000-4000 | 1500-2500 |
| Delay (ms) | 4000-5000 | 500-1000 |

---

## 📁 Cấu trúc dự án

```
novel-translator-pro/
├── index.html              # Trang chính
├── style.css               # CSS styles
├── sw.js                   # Service Worker (PWA)
├── manifest.json           # PWA manifest
├── package.json            # Electron config
├── main.js                 # Electron main process
├── icons/                  # App icons
│   ├── icon.svg            # Icon gốc (SVG)
│   ├── icon.png            # Icon PNG
│   └── icon.ico            # Icon Windows
├── js/                     # JavaScript modules
│   ├── app.js              # Global variables, templates
│   ├── init.js             # Initialize & expose functions
│   ├── gemini/             # Gemini API handling
│   │   ├── api.js          # API calls
│   │   └── model-rotation.js # Key/Model rotation
│   ├── translation/        # Translation engine
│   │   ├── chunker.js      # Text chunking
│   │   ├── engine.js       # Main translation logic
│   │   └── retry.js        # Retry mechanism
│   ├── local-ai/           # Ollama support
│   │   └── ollama.js       # Ollama API
│   ├── ui/                 # UI components
│   │   ├── controls.js     # Buttons, inputs
│   │   ├── file-handler.js # File upload
│   │   ├── progress.js     # Progress bar
│   │   └── settings.js     # Settings management
│   └── history/            # History management
│       └── history.js      # Save/load history
├── docs/                   # Documentation
├── dist/                   # Build output (exe)
└── README.md               # This file
```

---

## 🔧 Build từ Source

### Yêu cầu
- Node.js 18+ ([Download](https://nodejs.org/))

### Commands

```bash
# Cài dependencies
npm install

# Chạy development
npm start

# Build exe portable
npm run build

# Build exe với installer
npm run build:portable
```

### Output
- `dist/Novel Translator Pro-1.0.0-Portable.exe` - Chạy trực tiếp, không cần cài đặt

---

## 🔑 Quota API Gemini (Free Tier)

| Model | Requests/phút | Requests/ngày |
|-------|---------------|---------------|
| Gemini 2.5 Flash | 5 | ~100 |
| Gemini 2.0 Flash | 10 | ~1000 |
| Gemini 1.5 Flash | 15 | ~1500 |
| Gemini 1.5 Pro | 2 | ~50 |

**💡 Quota tính theo TÀI KHOẢN, không phải key!**
- 1 tài khoản = 1 quota (dù có nhiều key)
- Muốn tăng quota → Dùng nhiều tài khoản Google

---

## 📝 Changelog

### v1.0.0 (2026-02-08)
- ✅ Thêm tính năng **Nhập nhiều API keys** cùng lúc
- ✅ Đơn giản hóa **Xuất API keys** (chỉ xuất danh sách key thuần)
- ✅ Hỗ trợ **Ollama Local AI** - Dịch offline không giới hạn
- ✅ **Smart Model Rotation** - Xoay vòng thông minh giữa models và keys
- ✅ **Health Tracking** - Theo dõi trạng thái từng key
- ✅ **Multiple prompt templates** - Convert, Tiểu thuyết, 18+, Sắc Hiệp, Tu tiên, Ngôn tình
- ✅ Build **Portable .exe** cho Windows

---

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng:
1. Fork repository
2. Tạo branch mới
3. Commit changes
4. Tạo Pull Request

---

## 📄 License

MIT License - Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

## ❤️ Made with love for Novel Lovers

Nếu thấy hữu ích, hãy ⭐ star repository này!
