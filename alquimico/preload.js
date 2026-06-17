const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getTree: () => ipcRenderer.invoke('get-tree'),
    createNotebook: (name) => ipcRenderer.invoke('create-notebook', name),
    createCategory: (nb, name) => ipcRenderer.invoke('create-category', nb, name),
    createNote: (nb, cat, name) => ipcRenderer.invoke('create-note', nb, cat, name),
    readNote: (path) => ipcRenderer.invoke('read-note', path),
    saveNote: (path, content) => ipcRenderer.invoke('save-note', path, content),
    processImage: (notePath, src) => ipcRenderer.invoke('process-image', notePath, src)
});
