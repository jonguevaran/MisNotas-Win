const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let db;
let mainWindow;
let settingsWindow;
let dbPath;
const configPath = path.join(app.getPath('userData'), 'config.json');
let userConfig = { language: 'es', theme: 'light' };

function loadConfig() {
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.dbPath) {
                dbPath = config.dbPath;
            }
            if (config.userConfig) {
                userConfig = { ...userConfig, ...config.userConfig };
            }
        } catch (e) {
            console.error("Error reading config", e);
        }
    }
    if (!dbPath) {
        dbPath = path.join(app.getPath('userData'), 'devnotes_db.sqlite');
    }
    saveConfig();
}

function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify({ dbPath, userConfig }, null, 2));
}

async function initDB() {
    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
        const filebuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(filebuffer);
        
        // We might be migrating from the old schema. 
        // We can just ignore the old table 'store' and create 'notebooks'
        db.run("CREATE TABLE IF NOT EXISTS notebooks (id TEXT PRIMARY KEY, title TEXT, folderName TEXT, isDeleted INTEGER, color TEXT, isCollapsed INTEGER)");
    } else {
        db = new SQL.Database();
        db.run("CREATE TABLE IF NOT EXISTS notebooks (id TEXT PRIMARY KEY, title TEXT, folderName TEXT, isDeleted INTEGER, color TEXT, isCollapsed INTEGER)");
        saveDB();
    }
}

function saveDB() {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
}

function getWorkspacesDir() {
    const dbDir = path.dirname(dbPath);
    const workspacesDir = path.join(dbDir, 'notebooks');
    if (!fs.existsSync(workspacesDir)) {
        fs.mkdirSync(workspacesDir, { recursive: true });
    }
    return workspacesDir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "MisNotas-E",
    icon: path.join(__dirname, 'icoEitrion.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);
  mainWindow.loadFile('index.html');
}

function createSettingsWindow() {
  if (settingsWindow) {
      settingsWindow.focus();
      return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    parent: mainWindow,
    modal: true,
    show: false,
    title: "Configuraciones",
    icon: path.join(__dirname, 'icoEitrion.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.setMenu(null);
  settingsWindow.loadFile('settings.html');
  
  settingsWindow.once('ready-to-show', () => {
      settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
      settingsWindow = null;
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
      app.setAppUserModelId("MisNotas-E");
  }
  
  loadConfig();
  await initDB();

  // IPC Handlers
  ipcMain.handle('get-app-data', () => {
      const stmt = db.prepare("SELECT * FROM notebooks");
      const appData = [];
      while(stmt.step()) {
          const row = stmt.getAsObject();
          
          let notes = [];
          if (row.folderName) {
              const folderPath = path.join(getWorkspacesDir(), row.folderName);
              const dataFilePath = path.join(folderPath, 'data.json');
              
              if (fs.existsSync(dataFilePath)) {
                  try {
                      notes = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
                  } catch(e) {
                      console.error("Error reading data.json for notebook", row.id);
                  }
              }
          }
          
          appData.push({
              id: row.id,
              title: row.title,
              isDeleted: !!row.isDeleted,
              color: row.color,
              isCollapsed: !!row.isCollapsed,
              folderName: row.folderName,
              notes: notes
          });
      }
      stmt.free();
      return appData;
  });

  ipcMain.handle('save-app-data', (event, data) => {
      const stmt = db.prepare("INSERT OR REPLACE INTO notebooks (id, title, folderName, isDeleted, color, isCollapsed) VALUES (?, ?, ?, ?, ?, ?)");
      
      data.forEach(nb => {
          let folderName = nb.folderName;
          if (!folderName) {
             folderName = nb.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + Date.now();
             nb.folderName = folderName;
          }
          
          const isDeleted = nb.isDeleted ? 1 : 0;
          const isCollapsed = nb.isCollapsed ? 1 : 0;
          const color = nb.color || '#60a5fa';
          
          stmt.run([nb.id, nb.title, folderName, isDeleted, color, isCollapsed]);
          
          const folderPath = path.join(getWorkspacesDir(), folderName);
          if (!fs.existsSync(folderPath)) {
              fs.mkdirSync(folderPath, { recursive: true });
          }
          const imgPath = path.join(folderPath, 'img');
          if (!fs.existsSync(imgPath)) {
              fs.mkdirSync(imgPath, { recursive: true });
          }
          
          fs.writeFileSync(path.join(folderPath, 'data.json'), JSON.stringify(nb.notes || [], null, 2), 'utf8');
      });
      stmt.free();
      saveDB();
      
      BrowserWindow.getAllWindows().forEach(win => {
          if (win.webContents !== event.sender) {
              win.webContents.send('app-data-updated');
          }
      });
      return true;
  });

  ipcMain.handle('permanent-delete-notebook', (event, notebookId) => {
      const stmt = db.prepare("SELECT folderName FROM notebooks WHERE id = ?");
      stmt.bind([notebookId]);
      if (stmt.step()) {
          const row = stmt.getAsObject();
          if (row.folderName) {
              const folderPath = path.join(getWorkspacesDir(), row.folderName);
              if (fs.existsSync(folderPath)) {
                  fs.rmSync(folderPath, { recursive: true, force: true });
              }
          }
      }
      stmt.free();
      
      db.run("DELETE FROM notebooks WHERE id = ?", [notebookId]);
      saveDB();
      return true;
  });

  ipcMain.handle('open-settings-window', () => {
      createSettingsWindow();
  });

  ipcMain.handle('get-db-path', () => dbPath);
  
  ipcMain.handle('get-user-config', () => userConfig);
  
  ipcMain.handle('save-user-config', (event, newConfig) => {
      userConfig = { ...userConfig, ...newConfig };
      saveConfig();
      BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('config-updated', userConfig);
      });
      return true;
  });

  ipcMain.handle('export-data', async (event, data) => {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow || settingsWindow, {
          title: 'Exportar Datos',
          defaultPath: 'misnotas_export.json',
          filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (!canceled && filePath) {
          try {
              fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
              return true;
          } catch (err) {
              console.error("Error al exportar datos:", err);
              return false;
          }
      }
      return false;
  });

  ipcMain.handle('change-db-path', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: 'Seleccionar Carpeta para la Base de Datos',
          properties: ['openDirectory']
      });

      if (!canceled && filePaths.length > 0) {
          const newDir = filePaths[0];
          const newDbPath = path.join(newDir, 'devnotes_db.sqlite');
          
          if (newDbPath !== dbPath) {
              const oldDbPath = dbPath;
              dbPath = newDbPath;
              saveConfig();
              saveDB();
              return dbPath;
          }
      }
      return null;
  });

  ipcMain.handle('select-image', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: 'Seleccionar Imagen',
          filters: [
              { name: 'Imágenes', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp', 'svg'] },
              { name: 'Todos los Archivos', extensions: ['*'] }
          ],
          properties: ['openFile']
      });
      if (!canceled && filePaths.length > 0) {
          return filePaths[0];
      }
      return null;
  });

  ipcMain.handle('process-image', async (event, urlOrPath, notebookId) => {
      if (!urlOrPath || !notebookId) return null;
      
      const stmt = db.prepare("SELECT folderName FROM notebooks WHERE id = ?");
      stmt.bind([notebookId]);
      let folderName = '';
      if (stmt.step()) {
          folderName = stmt.getAsObject().folderName;
      }
      stmt.free();
      if (!folderName) return urlOrPath;

      const imgDir = path.join(getWorkspacesDir(), folderName, 'img');
      const normalizedImgDir = imgDir.replace(/\\/g, '/');
      if (urlOrPath.includes(normalizedImgDir) || urlOrPath.includes(encodeURI(normalizedImgDir))) {
          return urlOrPath;
      }

      try {
          if (!fs.existsSync(imgDir)) {
              fs.mkdirSync(imgDir, { recursive: true });
          }
          
          let ext = '.jpg';
          try {
              const parsedUrl = new URL(urlOrPath.startsWith('http') ? urlOrPath : 'file:///' + urlOrPath);
              ext = path.extname(parsedUrl.pathname) || '.jpg';
          } catch(e) {}
          
          const filename = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) + ext;
          const targetPath = path.join(imgDir, filename);

          if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
              const res = await fetch(urlOrPath);
              if (!res.ok) throw new Error(`Failed to fetch ${urlOrPath}: ${res.statusText}`);
              const buffer = await res.arrayBuffer();
              fs.writeFileSync(targetPath, Buffer.from(buffer));
          } else {
              let sourcePath = urlOrPath;
              if (sourcePath.startsWith('file:///')) {
                  sourcePath = decodeURI(sourcePath.replace('file:///', ''));
              }
              fs.copyFileSync(sourcePath, targetPath);
          }
          return 'file:///' + targetPath.replace(/\\/g, '/');
      } catch (err) {
          console.error('Error processing image:', err);
          return urlOrPath;
      }
  });

  ipcMain.handle('delete-image', (event, fileUrl, notebookId) => {
      if (!fileUrl || !fileUrl.startsWith('file:///')) return;
      try {
          let targetPath = decodeURI(fileUrl.replace('file:///', ''));
          if (fs.existsSync(targetPath)) {
              fs.unlinkSync(targetPath);
          }
      } catch (e) {
          console.error("Error deleting image:", e);
      }
  });

  ipcMain.on('relaunch-app', () => {
      app.relaunch();
      app.exit(0);
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

