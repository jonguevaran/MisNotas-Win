const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getTree: () => ipcRenderer.invoke('get-tree'),
    createNotebook: (name) => ipcRenderer.invoke('create-notebook', name),
    createCategory: (nb, name) => ipcRenderer.invoke('create-category', nb, name),
    createNote: (nb, cat, name) => ipcRenderer.invoke('create-note', nb, cat, name),
    readNote: (path) => ipcRenderer.invoke('read-note', path),
    saveNote: (path, content) => ipcRenderer.invoke('save-note', path, content),
    processImage: (notePath, src) => ipcRenderer.invoke('process-image', notePath, src),
    getConfig: () => ipcRenderer.invoke('get-config'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    exportNote: (content) => ipcRenderer.invoke('export-note', content),
    deleteNode: (path) => ipcRenderer.invoke('delete-node', path),
    moveNode: (oldPath, newNb, newCat) => ipcRenderer.invoke('move-node', oldPath, newNb, newCat),
    selectLocalImage: (notePath) => ipcRenderer.invoke('select-local-image', notePath),
    cleanupImages: (notePath, content) => ipcRenderer.invoke('cleanup-images', notePath, content),
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
