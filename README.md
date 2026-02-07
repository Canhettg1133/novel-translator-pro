# 📚 Novel Translator Pro

Dịch và làm mượt truyện chữ siêu nhanh với Gemini AI

## 🌐 PWA (Progressive Web App)

### Cách host lên GitHub Pages (Miễn phí)

1. **Tạo repository trên GitHub:**
   ```
   1. Đăng nhập GitHub
   2. Click "New repository"
   3. Đặt tên: novel-translator-pro
   4. Public repository
   5. Create repository
   ```

2. **Upload code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/novel-translator-pro.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   ```
   1. Vào Settings > Pages
   2. Source: Deploy from a branch
   3. Branch: main, folder: / (root)
   4. Save
   ```

4. **Truy cập PWA:**
   - URL: `https://YOUR_USERNAME.github.io/novel-translator-pro/`
   - Có thể "Install" app từ browser

### Tạo Icons (Bắt buộc cho PWA)

Cần tạo các file PNG từ `icons/icon.svg`:
- `icons/icon-72.png`
- `icons/icon-96.png`
- `icons/icon-128.png`
- `icons/icon-144.png`
- `icons/icon-152.png`
- `icons/icon-192.png`
- `icons/icon-384.png`
- `icons/icon-512.png`

**Công cụ online:** https://realfavicongenerator.net/ hoặc https://favicon.io/

---

## 🖥️ Electron (Desktop App)

### Yêu cầu
- Node.js 18+ (https://nodejs.org/)

### Cách build

1. **Vào thư mục electron:**
   ```bash
   cd electron-app
   ```

2. **Cài dependencies:**
   ```bash
   npm install
   ```

3. **Chạy thử (development):**
   ```bash
   npm start
   ```

4. **Build file .exe (Windows):**
   ```bash
   npm run build:win
   ```
   
   File output: `electron-app/dist/Novel Translator Pro.exe`

5. **Build cho Mac/Linux:**
   ```bash
   npm run build:mac    # macOS
   npm run build:linux  # Linux
   ```

### Output files

Sau khi build, các file sẽ nằm trong `electron-app/dist/`:
- `Novel Translator Pro.exe` - Portable version (không cần cài)
- `Novel Translator Pro Setup.exe` - Installer version

---

## 📁 Cấu trúc thư mục

```
dichtruyen/
├── index.html          # Trang chính
├── style.css           # CSS styles
├── script.js           # JavaScript logic
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
├── icons/              # App icons
│   └── icon.svg        # Icon gốc (cần convert sang PNG)
├── electron-app/       # Electron desktop app
│   ├── package.json    # Electron config
│   ├── main.js         # Main process
│   ├── preload.js      # Preload script
│   └── web/            # Copy của web files
└── README.md           # File này
```

---

## 🔑 API Keys

App sử dụng Gemini API. Mỗi tài khoản Google được:
- 20 requests/ngày/model (Free tier)
- 3 models × 20 = 60 requests/ngày/tài khoản

**Lấy API key:** https://aistudio.google.com/app/apikey

---

## ❤️ Made with love for Novel Lovers
