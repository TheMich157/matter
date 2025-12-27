const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  exportRules: (rulesData) => ipcRenderer.invoke('export-rules', rulesData),
  importRules: () => ipcRenderer.invoke('import-rules'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  presetsSync: () => ipcRenderer.invoke("presets:sync"),
  getUserPresets: () => ipcRenderer.invoke("presets:getUserPresets"),
  saveUserPreset: (preset) => ipcRenderer.invoke("presets:saveUserPreset", preset),

  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, payload) => callback(payload))
});
