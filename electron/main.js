// ✅ load .env ASAP (before reading process.env)
const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch (_) {}

const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const isDev = require("electron-is-dev");
const { spawn } = require("child_process");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");
const https = require("https");

const githubToken = process.env.GH_TOKEN || process.env.ELECTRON_GH_TOKEN || null;
const UPDATE_USER_AGENT = "GoveeLANController-Updater";

let mainWindow;
let backendProcess;
let updateAvailable = false;

// -------------------------
// Window
// -------------------------
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
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../assets/icon.ico"),
  });

  const url = isDev ? "http://localhost:5000" : `file://${path.join(__dirname, "../src/index.html")}`;
  mainWindow.loadURL(url);

  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// -------------------------
// Backend (FIXED)
// -------------------------
function resolveBackendPath() {
  if (isDev) {
    const scriptPath = path.join(__dirname, "../app_backend.py");
    if (!fs.existsSync(scriptPath)) throw new Error(`Backend file not found at ${scriptPath}`);
    return { path: scriptPath, type: "script" };
  }

  const binaryName = process.platform === "win32" ? "govee-backend.exe" : "govee-backend";

  const candidates = [
    path.join(process.resourcesPath, binaryName),
    path.join(process.resourcesPath, "backend", binaryName),
    path.join(__dirname, "..", "dist", binaryName),
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`Backend executable not found.\nChecked:\n- ${candidates.join("\n- ")}`);
  }

  return { path: found, type: "binary" };
}

function startBackend() {
  let backendTarget;
  try {
    backendTarget = resolveBackendPath();
  } catch (err) {
    console.error("[BACKEND] Resolve error:", err);
    dialog.showErrorBox("Backend missing", err.message);
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    console.log("[BACKEND] Starting:", backendTarget.path);

    if (backendTarget.type === "script") {
      const pythonCmd = process.platform === "win32" ? "python" : "python3";
      backendProcess = spawn(pythonCmd, [backendTarget.path], {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
        detached: false,
        shell: process.platform === "win32",
      });
    } else {
      backendProcess = spawn(backendTarget.path, [], {
        cwd: path.dirname(backendTarget.path),
        stdio: "inherit",
        detached: false,
      });
    }

    backendProcess.on("error", (err) => {
      console.error("[BACKEND] Error:", err);
      dialog.showErrorBox("Backend Error", `Failed to start the Govee backend.\n\n${err.message}`);
      reject(err);
    });

    // soft wait
    const maxWait = isDev ? 5000 : 8000;
    const startTime = Date.now();

    const checkBackend = setInterval(() => {
      const elapsed = Date.now() - startTime;
      console.log(`[BACKEND] Waiting... ${elapsed}ms`);
      if (elapsed > maxWait) {
        clearInterval(checkBackend);
        console.log("[BACKEND] Assumed ready after timeout");
        resolve();
      }
    }, 1000);

    // ping backend
    const pingInterval = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:5000/api/device/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip: "127.0.0.1" }),
        }).catch(() => null);

        if (res) {
          console.log("[BACKEND] Backend responding! Ready.");
          clearInterval(pingInterval);
          clearInterval(checkBackend);
          resolve();
        }
      } catch (_) {}
    }, 500);
  });
}

// -------------------------
// Updater (FIX 406 + parsing)
// -------------------------
function sendUpdateStatus(payload) {
  if (mainWindow) mainWindow.webContents.send("update-status", payload);
}

async function checkForUpdatesNow() {
  if (isDev) {
    sendUpdateStatus({ status: "unavailable", reason: "development" });
    return { status: "unavailable" };
  }
  try {
    sendUpdateStatus({ status: "checking" });
    await autoUpdater.checkForUpdates();
    return { status: "checking" };
  } catch (err) {
    console.error("[UPDATE] Error checking for updates:", err);
    sendUpdateStatus({ status: "error", message: err.message });
    return { status: "error", message: err.message };
  }
}

function setupAutoUpdater() {
  if (isDev) {
    console.log("[UPDATE] Skipping auto-update in development");
    sendUpdateStatus({ status: "unavailable", reason: "development" });
    return;
  }

  // ✅ GitHub API needs UA; token only for publishing / private repos / rate limits
  autoUpdater.requestHeaders = githubToken
    ? { Authorization: `token ${githubToken}`, "User-Agent": UPDATE_USER_AGENT }
    : { "User-Agent": UPDATE_USER_AGENT };

  // ✅ do NOT setFeedURL for github provider (electron-updater already uses build.publish)
  autoUpdater.autoDownload = false;

  autoUpdater.on("checking-for-update", () => sendUpdateStatus({ status: "checking" }));

  autoUpdater.on("update-available", (info) => {
    updateAvailable = true;
    sendUpdateStatus({ status: "available", version: info.version, releaseDate: info.releaseDate });
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available",
        message: `Govee LAN Controller ${info.version} is available`,
        detail: 'Click "Download Update" to start downloading.',
        buttons: ["OK"],
      });
    }
  });

  autoUpdater.on("update-not-available", (info) => {
    updateAvailable = false;
    sendUpdateStatus({ status: "not-available", current: app.getVersion(), info });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus({
      status: "downloading",
      progress: {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      },
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateAvailable = true;
    sendUpdateStatus({ status: "downloaded", version: info.version });
    if (mainWindow) {
      dialog
        .showMessageBox(mainWindow, {
          type: "info",
          title: "Update Ready",
          message: `Govee LAN Controller ${info.version} is ready to install`,
          detail: 'Click "Restart Now" to install the update.',
          buttons: ["Restart Now", "Later"],
          defaultId: 0,
        })
        .then((result) => {
          if (result.response === 0) autoUpdater.quitAndInstall();
        });
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[UPDATE] Error:", err);
    sendUpdateStatus({ status: "error", message: err.message });
  });

  checkForUpdatesNow();
  setInterval(checkForUpdatesNow, 3600000);
}

ipcMain.handle("update:check", () => checkForUpdatesNow());

ipcMain.handle("update:download", async () => {
  if (isDev) return { status: "unavailable", reason: "development" };
  if (!updateAvailable) return { status: "no-update" };
  try {
    sendUpdateStatus({ status: "downloading" });
    await autoUpdater.downloadUpdate();
    return { status: "downloading" };
  } catch (err) {
    sendUpdateStatus({ status: "error", message: err.message });
    return { status: "error", message: err.message };
  }
});

ipcMain.handle("update:install", () => {
  if (!updateAvailable) return { status: "no-update" };
  autoUpdater.quitAndInstall();
  return { status: "installing" };
});

// -------------------------
// Presets sync (GitHub raw)
// -------------------------
const PRESETS_OWNER = process.env.PRESETS_OWNER || "TheMich157";
const PRESETS_REPO = process.env.PRESETS_REPO || "matter";
const PRESETS_BRANCH = process.env.PRESETS_BRANCH || "main";
const PRESETS_PATH = process.env.PRESETS_PATH || "presets/presets.json";

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "GoveeLANController" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
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
  try {
    const remote = await fetchPresetsFromGitHub();
    fs.writeFileSync(cachePath, JSON.stringify(remote, null, 2), "utf-8");
    return { source: "github", data: remote };
  } catch (e) {
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
  current.presets = current.presets.filter((x) => x.id !== preset.id);
  current.presets.push(preset);
  fs.writeFileSync(p, JSON.stringify(current, null, 2), "utf-8");
  return { ok: true };
});

ipcMain.handle("presets:getUserPresets", async () => {
  const p = path.join(app.getPath("userData"), "user_presets.json");
  if (!fs.existsSync(p)) return { presets: [] };
  return JSON.parse(fs.readFileSync(p, "utf-8"));
});

// -------------------------
// App lifecycle
// -------------------------
app.on("ready", async () => {
  try {
    await startBackend();
  } catch (err) {
    console.error("[APP] Failed to start backend:", err);
  }
  createWindow();
  createMenu();
  setupAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

app.on("before-quit", () => {
  if (!backendProcess) return;
  try {
    if (process.platform === "win32") {
      require("child_process").execSync(`taskkill /PID ${backendProcess.pid} /T /F`, { stdio: "ignore" });
    } else {
      backendProcess.kill("SIGTERM");
    }
  } catch (e) {
    console.error("[BACKEND] Error killing process:", e.message);
  }
});

// -------------------------
// Menu
// -------------------------
function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [{ label: "Exit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() }],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => mainWindow?.reload() },
        { label: "DevTools", accelerator: "CmdOrCtrl+Shift+I", click: () => mainWindow?.webContents.toggleDevTools() },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Check for Updates", click: () => checkForUpdatesNow() },
        { type: "separator" },
        {
          label: "About",
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About Govee LAN Controller",
              message: "Govee LAN Controller",
              detail: `Professional local control for Govee lights.\nVersion: ${app.getVersion()}\nLocal • Fast • Private • No Cloud`,
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// rules export/import
ipcMain.handle("export-rules", async (_event, rulesData) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `govee-rules-${new Date().toISOString().split("T")[0]}.json`,
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(rulesData, null, 2));
      return { success: true, path: filePath };
    }
    return { success: false };
  } catch (err) {
    console.error("[IPC] Export error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("import-rules", async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (filePaths && filePaths.length > 0) {
      const content = fs.readFileSync(filePaths[0], "utf-8");
      const data = JSON.parse(content);
      return { success: true, data };
    }
    return { success: false };
  } catch (err) {
    console.error("[IPC] Import error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-app-version", () => app.getVersion());
