const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// Tắt hardware acceleration nếu cần (fix một số lỗi đồ họa)
// app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        icon: path.join(__dirname, 'icons', 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        },
        show: false, // Ẩn cho đến khi sẵn sàng
        backgroundColor: '#1a1a2e'
    });

    // Load file index.html
    mainWindow.loadFile('index.html');

    // Hiển thị khi đã load xong
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Mở DevTools trong development
    // mainWindow.webContents.openDevTools();

    // Xử lý mở link ngoài trong trình duyệt mặc định
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Tạo menu
    createMenu();
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Mở file truyện',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        mainWindow.webContents.executeJavaScript('document.getElementById("file-input")?.click()');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Thoát',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Chỉnh sửa',
            submenu: [
                { label: 'Hoàn tác', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Làm lại', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
                { type: 'separator' },
                { label: 'Cắt', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Sao chép', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Dán', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { label: 'Chọn tất cả', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
            ]
        },
        {
            label: 'Xem',
            submenu: [
                { label: 'Tải lại', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                { label: 'Tải lại hoàn toàn', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
                { type: 'separator' },
                { label: 'Phóng to', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
                { label: 'Thu nhỏ', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                { label: 'Kích thước gốc', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
                { type: 'separator' },
                { label: 'Toàn màn hình', accelerator: 'F11', role: 'togglefullscreen' },
                { type: 'separator' },
                {
                    label: 'Developer Tools',
                    accelerator: 'F12',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                }
            ]
        },
        {
            label: 'Trợ giúp',
            submenu: [
                {
                    label: 'Về ứng dụng',
                    click: () => {
                        const { dialog } = require('electron');
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Về Novel Translator Pro',
                            message: 'Novel Translator Pro',
                            detail: 'Phiên bản: 1.0.0\n\nỨng dụng dịch truyện chuyên nghiệp với Gemini AI.\n\n© 2024 Novel Translator Team'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Khi Electron đã sẵn sàng
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Thoát khi tất cả cửa sổ đóng (Windows & Linux)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Xử lý lỗi không mong muốn
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
