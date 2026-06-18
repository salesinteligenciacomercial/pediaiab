import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import { autoUpdater } from 'electron-updater';
let mainWindow = null;
// Log de auto-updates
autoUpdater.logger = require('electron-log');
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, '../icon.png'),
    });
    const startUrl = isDev
        ? 'http://localhost:5173' // Vite dev server
        : `file://${path.join(__dirname, '../../dist/index.html')}`; // Prod build
    mainWindow.loadURL(startUrl);
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};
app.on('ready', () => {
    createWindow();
    createMenu();
    // Verificar atualizações
    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// Menu
const createMenu = () => {
    const template = [
        {
            label: 'Arquivo',
            submenu: [
                {
                    label: 'Sair',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit(),
                },
            ],
        },
        {
            label: 'Editar',
            submenu: [
                { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
                { label: 'Refazer', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
                { type: 'separator' },
                { label: 'Cortar', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
                { label: 'Copiar', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
                { label: 'Colar', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
            ],
        },
        {
            label: 'Ajuda',
            submenu: [
                {
                    label: 'Sobre',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Sobre Rosh Pizzaria',
                            message: 'Rosh Pizzaria PdV',
                            detail: `Versão: ${app.getVersion()}\nElectron: ${process.versions.electron}`,
                        });
                    },
                },
            ],
        },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};
// IPC Handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:check-updates', async () => {
    if (isDev)
        return { available: false };
    const result = await autoUpdater.checkForUpdates();
    return { available: result?.updateInfo?.version !== app.getVersion() };
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
