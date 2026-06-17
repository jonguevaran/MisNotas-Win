const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Alquímico",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// IPC Handlers
ipcMain.handle('get-tree', () => {
    const tree = [];
    if (!fs.existsSync(dataDir)) return tree;

    const notebooks = fs.readdirSync(dataDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const nb of notebooks) {
        const nbPath = path.join(dataDir, nb.name);
        const nbNode = { type: 'notebook', name: nb.name, path: nbPath, children: [] };
        
        const nbContents = fs.readdirSync(nbPath, { withFileTypes: true }).filter(d => d.isDirectory());
        for (const catItem of nbContents) {
            const catPath = path.join(nbPath, catItem.name);
            const catNode = { type: 'category', name: catItem.name, path: catPath, children: [] };
            
            const catContents = fs.readdirSync(catPath, { withFileTypes: true }).filter(d => d.isDirectory());
            for (const noteItem of catContents) {
                const notePath = path.join(catPath, noteItem.name);
                // Las notas son carpetas dentro de la categoría
                catNode.children.push({ type: 'note', name: noteItem.name, path: notePath });
            }
            nbNode.children.push(catNode);
        }
        tree.push(nbNode);
    }
    return tree;
});

ipcMain.handle('create-notebook', (event, name) => {
    const p = path.join(dataDir, name);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    return true;
});

ipcMain.handle('create-category', (event, notebook, name) => {
    const p = path.join(dataDir, notebook, name);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    return true;
});

ipcMain.handle('create-note', (event, notebook, category, name) => {
    let p = path.join(dataDir, notebook);
    if (category) p = path.join(p, category);
    p = path.join(p, name);
    
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        fs.mkdirSync(path.join(p, 'img'), { recursive: true });
        fs.writeFileSync(path.join(p, name + '.md'), '');
    }
    return p;
});

ipcMain.handle('read-note', (event, notePath) => {
    const name = path.basename(notePath);
    const mdPath = path.join(notePath, name + '.md');
    if (fs.existsSync(mdPath)) {
        return fs.readFileSync(mdPath, 'utf8');
    }
    return '';
});

ipcMain.handle('save-note', (event, notePath, content) => {
    const name = path.basename(notePath);
    const mdPath = path.join(notePath, name + '.md');
    fs.writeFileSync(mdPath, content, 'utf8');
    return true;
});

ipcMain.handle('rename-node', (event, oldPath, newName, type) => {
    if (!fs.existsSync(oldPath)) return false;
    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName);
    
    fs.renameSync(oldPath, newPath);
    
    if (type === 'note') {
        const oldName = path.basename(oldPath);
        const oldMdPath = path.join(newPath, oldName + '.md');
        const newMdPath = path.join(newPath, newName + '.md');
        if (fs.existsSync(oldMdPath)) {
            fs.renameSync(oldMdPath, newMdPath);
        }
    }
    return newPath;
});

ipcMain.handle('process-image', async (event, notePath, sourcePath) => {
    const imgDir = path.join(notePath, 'img');
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
    
    const ext = path.extname(sourcePath) || '.jpg';
    const filename = 'img_' + Date.now() + ext;
    const destPath = path.join(imgDir, filename);
    
    if (sourcePath.startsWith('http')) {
         const res = await fetch(sourcePath);
         const buffer = await res.arrayBuffer();
         fs.writeFileSync(destPath, Buffer.from(buffer));
    } else {
         let src = sourcePath.replace('file:///', '');
         src = decodeURI(src);
         fs.copyFileSync(src, destPath);
    }
    return 'file:///' + destPath.replace(/\\/g, '/');
});
