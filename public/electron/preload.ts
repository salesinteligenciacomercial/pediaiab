import { contextBridge, ipcRenderer } from 'electron';

// Expor API segura para React
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkUpdates: () => ipcRenderer.invoke('app:check-updates'),
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update-available', (event, version) => callback(version));
  },
});

declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      checkUpdates: () => Promise<{ available: boolean }>;
      onUpdateAvailable: (callback: (version: string) => void) => void;
    };
  }
}
