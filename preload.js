import { contextBridge, ipcRenderer } from 'electron';
// Expor API segura para React
contextBridge.exposeInMainWorld('electronAPI', {
    getVersion: () => ipcRenderer.invoke('app:version'),
    checkUpdates: () => ipcRenderer.invoke('app:check-updates'),
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update-available', (event, version) => callback(version));
    },
});
