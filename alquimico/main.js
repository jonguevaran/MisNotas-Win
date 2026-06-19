const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Alquímico",
    icon: nativeImage.createEmpty(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setIcon(nativeImage.createEmpty());
  mainWindow.loadFile('index.html');

  // Abrir enlaces externos en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
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

const dataDirDefault = path.join(__dirname, 'data');
const configPath = path.join(app.getPath('userData'), 'alquimico-config.json');

function getConfig() {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            return { dataDir: dataDirDefault };
        }
    }
    return { dataDir: dataDirDefault };
}

function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config), 'utf8');
}

let currentConfig = getConfig();
let dataDir = currentConfig.dataDir || dataDirDefault;

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// IPC Handlers
ipcMain.handle('get-config', () => {
    return currentConfig;
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        defaultPath: dataDir,
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const newDir = result.filePaths[0];
        currentConfig.dataDir = newDir;
        dataDir = newDir;
        saveConfig(currentConfig);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        return newDir;
    }
    return null;
});

ipcMain.handle('export-note', async (event, content) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Exportar a Markdown',
        defaultPath: 'nota.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf8');
        return true;
    }
    return false;
});

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
                
                // Migrar .md a .txt si existe
                const oldMdPath = path.join(notePath, noteItem.name + '.md');
                const newTxtPath = path.join(notePath, noteItem.name + '.txt');
                if (fs.existsSync(oldMdPath) && !fs.existsSync(newTxtPath)) {
                    fs.renameSync(oldMdPath, newTxtPath);
                }
                
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
        fs.writeFileSync(path.join(p, name + '.txt'), '');
    }
    return p;
});

ipcMain.handle('read-note', (event, notePath) => {
    const name = path.basename(notePath);
    const txtPath = path.join(notePath, name + '.txt');
    if (fs.existsSync(txtPath)) {
        return fs.readFileSync(txtPath, 'utf8');
    }
    return '';
});

ipcMain.handle('save-note', (event, notePath, content) => {
    const name = path.basename(notePath);
    const txtPath = path.join(notePath, name + '.txt');
    fs.writeFileSync(txtPath, content, 'utf8');
    return true;
});

ipcMain.handle('rename-node', (event, oldPath, newName, type) => {
    if (!fs.existsSync(oldPath)) return false;
    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName);
    
    fs.renameSync(oldPath, newPath);
    
    if (type === 'note') {
        const oldName = path.basename(oldPath);
        const oldTxtPath = path.join(newPath, oldName + '.txt');
        const newTxtPath = path.join(newPath, newName + '.txt');
        if (fs.existsSync(oldTxtPath)) {
            fs.renameSync(oldTxtPath, newTxtPath);
        }
    }
    return newPath;
});

ipcMain.handle('delete-node', (event, nodePath) => {
    if (fs.existsSync(nodePath)) {
        fs.rmSync(nodePath, { recursive: true, force: true });
        return true;
    }
    return false;
});

ipcMain.handle('move-node', (event, oldPath, newNb, newCat) => {
    if (!fs.existsSync(oldPath)) return false;
    const noteName = path.basename(oldPath);
    
    let destPath = path.join(dataDir, newNb);
    if (newCat) destPath = path.join(destPath, newCat);
    destPath = path.join(destPath, noteName);
    
    if (!fs.existsSync(destPath)) {
        fs.renameSync(oldPath, destPath);
        return destPath;
    }
    return false;
});

ipcMain.handle('select-local-image', async (event, notePath) => {
    const imgDir = path.join(notePath, 'img');
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
    
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Seleccionar Imagen',
        defaultPath: imgDir,
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'jpeg'] }]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        const sourcePath = result.filePaths[0];
        const originalFileName = path.basename(sourcePath);
        let destPath = path.join(imgDir, originalFileName);
        let finalFileName = originalFileName;
        
        if (sourcePath !== destPath) {
            let counter = 1;
            while (fs.existsSync(destPath)) {
                const ext = path.extname(originalFileName);
                const base = path.basename(originalFileName, ext);
                finalFileName = `${base}_${counter}${ext}`;
                destPath = path.join(imgDir, finalFileName);
                counter++;
            }
            fs.copyFileSync(sourcePath, destPath);
        }
        
        return finalFileName;
    }
    return null;
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

ipcMain.handle('open-external', (event, url) => {
    shell.openExternal(url);
});

ipcMain.handle('cleanup-images', async (event, notePath, content) => {
    const imgDir = path.join(notePath, 'img');
    if (!fs.existsSync(imgDir)) return { count: 0, deleted: false };
    
    const files = fs.readdirSync(imgDir);
    let unusedFiles = [];
    for (const file of files) {
        if (!content.includes(file)) {
            unusedFiles.push(file);
        }
    }
    
    if (unusedFiles.length > 0) {
        const response = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Aceptar', 'Cancelar'],
            title: 'Limpiar Imágenes',
            message: `Se han encontrado ${unusedFiles.length} imagen(es) en la carpeta local que no están referenciadas en tu nota actual.\n\nSerán eliminadas permanentemente para mantener la salud y el peso de la nota.\n\n¿Deseas continuar y eliminarlas?`
        });
        
        if (response.response === 0) { // Aceptar
            for (const file of unusedFiles) {
                try {
                    fs.unlinkSync(path.join(imgDir, file));
                } catch (err) {
                    console.error("Error al eliminar", file, err);
                }
            }
            return { count: unusedFiles.length, deleted: true };
        } else {
            return { count: unusedFiles.length, deleted: false };
        }
    }
    
    return { count: 0, deleted: false };
});
