const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Database Operations
    getAppData: () => ipcRenderer.invoke('get-app-data'),
    saveAppData: (data) => ipcRenderer.invoke('save-app-data', data),
    
    // Import / Export
    exportData: (data) => ipcRenderer.invoke('export-data', data),
    importData: (dataStr) => ipcRenderer.invoke('import-data', dataStr),
    
    // Settings
    openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
    getDbPath: () => ipcRenderer.invoke('get-db-path'),
    changeDbPath: () => ipcRenderer.invoke('change-db-path'),
    onAppDataUpdated: (callback) => ipcRenderer.on('app-data-updated', () => callback()),
    
    // Configs
    getUserConfig: () => ipcRenderer.invoke('get-user-config'),
    saveUserConfig: (config) => ipcRenderer.invoke('save-user-config', config),
    onConfigUpdated: (callback) => ipcRenderer.on('config-updated', (e, config) => callback(config)),
    
    // File Selection
    selectImage: () => ipcRenderer.invoke('select-image'),
    processImage: (url, nbId, noteId) => ipcRenderer.invoke('process-image', url, nbId, noteId),
    deleteImage: (fileUrl, nbId, noteId) => ipcRenderer.invoke('delete-image', fileUrl, nbId, noteId),
    
    // Deletion
    permanentDeleteNotebook: (nbId) => ipcRenderer.invoke('permanent-delete-notebook', nbId),
    
    // Utilities
    relaunchApp: () => ipcRenderer.send('relaunch-app')
});
