window.apiCallbacks = {};
let callbackIdCounter = 0;

function generateCallback(resolve) {
    const id = 'cb_' + (++callbackIdCounter);
    window.apiCallbacks[id] = (result) => {
        delete window.apiCallbacks[id];
        resolve(result);
    };
    return 'window.apiCallbacks.' + id;
}

window.api = {
    getAppData: async () => {
        try {
            const dataStr = AndroidNative.getAppData();
            return dataStr ? JSON.parse(dataStr) : [];
        } catch (e) {
            console.error("Error parsing app data", e);
            return [];
        }
    },
    saveAppData: async (data) => {
        AndroidNative.saveAppData(JSON.stringify(data));
        return true;
    },
    exportData: async (data) => {
        AndroidNative.exportData(JSON.stringify(data));
        return true;
    },
    importData: async (dataStr) => {
        return false;
    },
    openSettingsWindow: async () => {
        AndroidNative.openSettingsWindow();
    },
    getDbPath: async () => {
        return AndroidNative.getDbPath();
    },
    changeDbPath: async () => {
        return new Promise((resolve) => {
            const cb = generateCallback(resolve);
            AndroidNative.changeDbPath(cb);
        });
    },
    
    getImageDir: async () => {
        return AndroidNative.getImageDir();
    },
    changeImageDir: async () => {
        return new Promise((resolve) => {
            const cb = generateCallback(resolve);
            AndroidNative.changeImageDir(cb);
        });
    },

    onAppDataUpdated: (callback) => {
        window.androidOnAppDataUpdated = callback;
    },
    
    getUserConfig: async () => {
        try {
            const cfg = AndroidNative.getUserConfig();
            return cfg ? JSON.parse(cfg) : { language: 'es', theme: 'light' };
        } catch (e) {
            return { language: 'es', theme: 'light' };
        }
    },
    saveUserConfig: async (config) => {
        AndroidNative.saveUserConfig(JSON.stringify(config));
        if (window.androidOnConfigUpdated) {
            window.androidOnConfigUpdated(config);
        }
        return true;
    },
    onConfigUpdated: (callback) => {
        window.androidOnConfigUpdated = callback;
    },

    setStatusBarDarkIcons: (darkIcons) => {
        AndroidNative.setStatusBarDarkIcons(darkIcons);
    },
    
    selectImage: async () => {
        return new Promise((resolve) => {
            const cb = generateCallback(resolve);
            AndroidNative.selectImage(cb);
        });
    },
    processImage: async (url, nbId) => {
        return new Promise((resolve) => {
            const cb = generateCallback(resolve);
            AndroidNative.processImage(url, nbId, cb);
        });
    },
    deleteImage: async (fileUrl, nbId) => {
        AndroidNative.deleteImage(fileUrl);
    },
    
    permanentDeleteNotebook: async (nbId) => {
        AndroidNative.permanentDeleteNotebook(nbId);
    },
    
    relaunchApp: () => {
        AndroidNative.relaunchApp();
    }
};
