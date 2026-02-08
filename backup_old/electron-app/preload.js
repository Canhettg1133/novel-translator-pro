/**
 * Novel Translator Pro - Electron Preload Script
 * Safely expose APIs to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Platform info
    platform: process.platform,
    isElectron: true,

    // App version
    getVersion: () => require('./package.json').version,

    // Utility functions
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Notification
    showNotification: (title, body) => {
        new Notification(title, { body });
    }
});

console.log('✅ Electron preload script loaded');
