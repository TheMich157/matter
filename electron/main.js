const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const https = require("https");


let mainWindow;
let backendProcess;
let updateAvailable = false;

// Create the Electron window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.ico')
  });

  const url = isDev 
    ? 'http://localhost:5000'
    : `file://${path.join(__dirname, '../src/index.html')}`;

  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start Flask backend
function startBackend() {
  // Determine backend exe path based on environment
  let backendPath;
  
  if (isDev) {
    // Development: use Python script directly
    backendPath = path.join(__dirname, '../app_backend.py');
    if (!fs.existsSync(backendPath)) {
      console.error('[BACKEND] File not found:', backendPath);
      return Promise.reject('Backend file not found');
    }
  } else {
    // Production: use bundled exe
    backendPath = path.join(process.resourcesPath, 'govee-backend.exe');
    if (!fs.existsSync(backendPath)) {
      // Fallback: try in dist folder
      backendPath = path.join(__dirname, '../dist/govee-backend.exe');
      if (!fs.existsSync(backendPath)) {
        console.error('[BACKEND] Bundled exe not found:', backendPath);
        return Promise.reject('Backend executable not found');
      }
    }
  }
  
  return new Promise((resolve, reject) => {
    console.log('[BACKEND] Starting:', backendPath);
    
    if (isDev) {
      // Development: spawn Python directly
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      backendProcess = spawn(pythonCmd, [backendPath], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        detached: false,
        shell: process.platform === 'win32'
      });
    } else {
      // Production: spawn bundled exe
      backendProcess = spawn(backendPath, [], {
        cwd: path.dirname(backendPath),
        stdio: 'inherit',
        detached: false
      });
    }

    backendProcess.on('error', (err) => {
      console.error('[BACKEND] Error:', err);
      dialog.showErrorBox(
        'Backend Error',
        `Failed to start the Govee backend.\n\n${err.message}`
      );
      reject(err);
    });

    // Wait for backend to be ready (increased timeout for bundled exe)
    const maxWait = isDev ? 5000 : 8000;  // 5s dev, 8s production
    const startTime = Date.now();
    
    const checkBackend = setInterval(() => {
      const elapsed = Date.now() - startTime;
      console.log(`[BACKEND] Waiting... ${elapsed}ms`);
      
      if (elapsed > maxWait) {
        clearInterval(checkBackend);
        console.log('[BACKEND] Assumed ready after timeout');
        resolve();
      }
    }, 1000);
    
    // Also try to ping the backend to know when it's actually ready
    const pingInterval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:5000/api/device/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: '127.0.0.1' })
        }).catch(() => null);
        
        if (response) {
          console.log('[BACKEND] Backend responding! Ready to go.');
          clearInterval(pingInterval);
          clearInterval(checkBackend);
          resolve();
        }
      } catch (e) {
        // Still waiting...
      }
    }, 500);
  });
}

// Setup auto-updater
function setupAutoUpdater() {
  if (isDev) {
    console.log('[UPDATE] Skipping auto-update in development');
    return;
  }

  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', (info) => {
    console.log('[UPDATE] Update available:', info.version);
    updateAvailable = true;
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Govee LAN Controller ${info.version} is available`,
        detail: 'The new version will be downloaded in the background. Restart the app to apply.',
        buttons: ['OK']
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[UPDATE] Update downloaded:', info.version);
    updateAvailable = true;
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Govee LAN Controller ${info.version} is ready to install`,
        detail: 'Click "Restart Now" to install the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0
      }).then(result => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[UPDATE] Error:', err);
  });

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 3600000);
}

const PRESETS_OWNER = process.env.PRESETS_OWNER || "YOUR_GITHUB_USERNAME";
const PRESETS_REPO  = process.env.PRESETS_REPO  || "govee-lan-controller";
const PRESETS_BRANCH= process.env.PRESETS_BRANCH|| "main";
const PRESETS_PATH  = process.env.PRESETS_PATH  || "presets/presets.json";

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "GoveeLANController" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0,200)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function getPresetsCachePath() {
  return path.join(app.getPath("userData"), "presets_cache.json");
}

async function fetchPresetsFromGitHub() {
  const url = `https://raw.githubusercontent.com/${PRESETS_OWNER}/${PRESETS_REPO}/${PRESETS_BRANCH}/${PRESETS_PATH}`;
  return await httpsGetJson(url);
}

ipcMain.handle("presets:sync", async () => {
  const cachePath = getPresetsCachePath();

  // 1) try GitHub
  try {
    const remote = await fetchPresetsFromGitHub();
    fs.writeFileSync(cachePath, JSON.stringify(remote, null, 2), "utf-8");
    return { source: "github", data: remote };
  } catch (e) {
    // 2) fallback to cache
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      return { source: "cache", data: cached, warning: String(e.message || e) };
    }
    return { source: "none", data: { version: 0, presets: [] }, error: String(e.message || e) };
  }
});

ipcMain.handle("presets:saveUserPreset", async (_evt, preset) => {
  const p = path.join(app.getPath("userData"), "user_presets.json");
  const current = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : { presets: [] };
  current.presets = Array.isArray(current.presets) ? current.presets : [];
  current.presets = current.presets.filter(x => x.id !== preset.id);
  current.presets.push(preset);
  fs.writeFileSync(p, JSON.stringify(current, null, 2), "utf-8");
  return { ok: true };
});

ipcMain.handle("presets:getUserPresets", async () => {
  const p = path.join(app.getPath("userData"), "user_presets.json");
  if (!fs.existsSync(p)) return { presets: [] };
  return JSON.parse(fs.readFileSync(p, "utf-8"));
});


// App lifecycle
app.on('ready', async () => {
  try {
    await startBackend();
  } catch (err) {
    console.error('[APP] Failed to start backend:', err);
  }
  createWindow();
  createMenu();
  setupAutoUpdater();
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

// Kill backend on app quit
app.on('before-quit', () => {
  if (backendProcess) {
    try {
      if (process.platform === 'win32') {
        require('child_process').execSync(`taskkill /PID ${backendProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(-backendProcess.pid);
      }
    } catch (e) {
      console.error('[BACKEND] Error killing process:', e.message);
    }
  }
});

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'DevTools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.toggleDevTools() }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Govee LAN Controller',
              message: 'Govee LAN Controller',
              detail: 'Professional local control for Govee lights.\nVersion: 1.0.0\nLocal • Fast • Private • No Cloud'
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC handlers for file operations
ipcMain.handle('export-rules', async (event, rulesData) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `govee-rules-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(rulesData, null, 2));
      return { success: true, path: filePath };
    }
    return { success: false };
  } catch (err) {
    console.error('[IPC] Export error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('import-rules', async (event) => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (filePaths && filePaths.length > 0) {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const data = JSON.parse(content);
      return { success: true, data };
    }
    return { success: false };
  } catch (err) {
    console.error('[IPC] Import error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

