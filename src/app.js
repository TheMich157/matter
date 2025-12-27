/**
 * Main Electron + Govee App
 */
import { createScenePreset, saveScenePreset } from "./presets/creator.js";
import { MusicReactive } from "./audio/musicReactive.js";

class GoveeApp {
  constructor() {
    this.automationRunning = false;
    this.rules = [];
    this.lastColor = { r: 255, g: 0, b: 0 };
    this.lastBrightness = 50;

    // runtime state
    this.currentPacket = null;
    this.scenePlaying = false;
    this.updateState = "idle";

    this.initElements();
    this.setupUpdaterUi();
    this.attachEventListeners();

    this.loadRules();
    this.loadDynamicPresets();
  
    

    // Wait for backend to be ready before making API calls
    setTimeout(() => {
      this.checkDeviceStatus();
      this.refreshAutomationStatus();
      this.loadPackets();
    }, 1500);
  }
setSceneMsg(text, type = "") {
  if (!this.sceneEditorMsg) return;
  this.sceneEditorMsg.className = "scene-msg " + (type || "");
  this.sceneEditorMsg.textContent = text || "";
}

openSceneEditor(existingScene = null) {
  if (!this.sceneEditorModal) return;

  this.setSceneMsg("");

  if (existingScene) {
    this.editingSceneId = existingScene.id || null;
    if (this.sceneEditorTitle) this.sceneEditorTitle.textContent = "Edit Scene";
    if (this.sceneNameInput) this.sceneNameInput.value = existingScene.name || "";
    if (this.sceneDefaultBrightness) this.sceneDefaultBrightness.value =
      existingScene.defaultBrightness != null ? String(existingScene.defaultBrightness) : "";
    if (this.sceneLoopSelect) this.sceneLoopSelect.value = existingScene.loop ? "on" : "off";

    this.editorSteps = (existingScene.steps || []).map(s => ({
      color: this.rgbArrToHex(s.color || [255,0,0]),
      brightness: s.brightness ?? 80,
      ms: s.ms ?? 300
    }));
  } else {
    this.editingSceneId = null;
    if (this.sceneEditorTitle) this.sceneEditorTitle.textContent = "New Scene";
    if (this.sceneNameInput) this.sceneNameInput.value = "";
    if (this.sceneDefaultBrightness) this.sceneDefaultBrightness.value = "";
    if (this.sceneLoopSelect) this.sceneLoopSelect.value = "off";

    this.editorSteps = [
      { color: "#ff0000", brightness: 80, ms: 300 },
      { color: "#0000ff", brightness: 100, ms: 300 }
    ];
  }

  this.renderSceneSteps();
  this.sceneEditorModal.style.display = "flex";
}

closeSceneEditor() {
  if (!this.sceneEditorModal) return;
  this.sceneEditorModal.style.display = "none";
}

renderSceneSteps() {
  if (!this.sceneStepsList) return;
  this.sceneStepsList.innerHTML = "";

  if (!this.editorSteps.length) {
    this.sceneStepsList.innerHTML = `<div style="color: var(--muted); font-size: 12px;">No steps yet.</div>`;
    return;
  }

  this.editorSteps.forEach((step, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "scene-step";

    wrap.innerHTML = `
      <div class="scene-step-top">
        <div class="scene-step-title">Step #${idx + 1}</div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-small btn-secondary" data-act="up">↑</button>
          <button class="btn btn-small btn-secondary" data-act="down">↓</button>
          <button class="btn btn-small" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color:#ef4444;" data-act="del">Delete</button>
        </div>
      </div>

      <div class="scene-step-grid">
        <input type="color" value="${step.color}">
        <input type="number" min="1" max="100" value="${step.brightness}" placeholder="Brightness">
        <input type="number" min="50" max="60000" value="${step.ms}" placeholder="ms">
        <button class="btn btn-small btn-secondary" data-act="test">Test step</button>
      </div>
    `;

    const colorInput = wrap.querySelector('input[type="color"]');
    const bInput = wrap.querySelectorAll('input[type="number"]')[0];
    const msInput = wrap.querySelectorAll('input[type="number"]')[1];

    colorInput.addEventListener("input", (e) => {
      this.editorSteps[idx].color = e.target.value;
    });
    bInput.addEventListener("input", (e) => {
      this.editorSteps[idx].brightness = Math.max(1, Math.min(100, parseInt(e.target.value || "1")));
    });
    msInput.addEventListener("input", (e) => {
      this.editorSteps[idx].ms = Math.max(50, Math.min(60000, parseInt(e.target.value || "300")));
    });

    wrap.querySelectorAll("button").forEach(btn => {
      const act = btn.dataset.act;
      if (!act) return;

      btn.addEventListener("click", async () => {
        if (act === "del") {
          this.editorSteps.splice(idx, 1);
          this.renderSceneSteps();
        } else if (act === "up" && idx > 0) {
          const tmp = this.editorSteps[idx - 1];
          this.editorSteps[idx - 1] = this.editorSteps[idx];
          this.editorSteps[idx] = tmp;
          this.renderSceneSteps();
        } else if (act === "down" && idx < this.editorSteps.length - 1) {
          const tmp = this.editorSteps[idx + 1];
          this.editorSteps[idx + 1] = this.editorSteps[idx];
          this.editorSteps[idx] = tmp;
          this.renderSceneSteps();
        } else if (act === "test") {
          await this.testSingleStep(this.editorSteps[idx]);
        }
      });
    });

    this.sceneStepsList.appendChild(wrap);
  });
}

async testSingleStep(step) {
  try {
    this.stopAllModes();
    const [r,g,b] = this.hexToRgb(step.color);
    await this.setColor(r,g,b);
    if (step.brightness != null) await this.setBrightness(step.brightness);
    this.setSceneMsg("Step tested ✅", "ok");
  } catch (e) {
    this.setSceneMsg("Test failed: " + String(e.message || e), "error");
  }
}

stopAllModes() {
  // stop scene + music
  this.scenePlaying = false;
  this.music?.stop?.();

  if (this.musicModeBtn) {
    this.musicModeBtn.classList.remove("btn-music-active");
    this.musicModeBtn.disabled = false;
  }
  if (this.stopMusicBtn) this.stopMusicBtn.disabled = true;

  this.setSceneMsg("Stopped.", "ok");
}

buildSceneFromEditor() {
  const name = (this.sceneNameInput?.value || "").trim();
  if (!name) throw new Error("Scene name is required");

  if (!this.editorSteps.length) throw new Error("Add at least 1 step");

  const defB = this.sceneDefaultBrightness?.value;
  const defaultBrightness = defB !== "" ? parseInt(defB) : null;

  const scene = {
    id: this.editingSceneId || `scene_${Date.now()}`,
    type: "scene",
    name,
    loop: (this.sceneLoopSelect?.value === "on"),
    defaultBrightness: defaultBrightness != null && !Number.isNaN(defaultBrightness) ? defaultBrightness : null,
    steps: this.editorSteps.map(s => ({
      color: this.hexToRgb(s.color),
      brightness: s.brightness ?? null,
      ms: s.ms ?? 300
    }))
  };

  return scene;
}

async previewEditorScene() {
  try {
    const scene = this.buildSceneFromEditor();
    this.setSceneMsg("Playing...", "ok");

    // play using your existing playScene logic but from built object
    await this.playScene(scene);

    if (scene.loop) {
      // simple loop: keep playing until Stop clicked
      while (this.scenePlaying) {
        await this.playScene(scene);
      }
    }
  } catch (e) {
    this.setSceneMsg(String(e.message || e), "error");
  }
}

async saveEditorScene() {
  try {
    if (!window.electron) {
      this.setSceneMsg("Electron required to save presets.", "error");
      return;
    }

    const scene = this.buildSceneFromEditor();

    // uses your existing creator helper
    await saveScenePreset(scene);

    this.setSceneMsg("Saved ✅", "ok");
    this.log(`Scene saved: ${scene.name}`, "success");

    await this.loadDynamicPresets();
    this.closeSceneEditor();
  } catch (e) {
    this.setSceneMsg(String(e.message || e), "error");
  }
}

rgbArrToHex(arr) {
  const [r,g,b] = arr || [255,0,0];
  return this.rgbToHex(r,g,b);
}

  initElements() {
    // Header
    this.ipInput = document.getElementById("ipInput");
    this.discoverBtn = document.getElementById("discoverBtn");
    this.statusBtn = document.getElementById("statusBtn");
    this.statusIndicator = document.getElementById("statusIndicator");
    this.updateBtn = document.getElementById("updateBtn");
    this.updateStatus = document.getElementById("updateStatus");
    this.versionLabel = document.getElementById("versionLabel");
    this.updateProgress = document.getElementById("updateProgress");
    this.updateProgressBar = document.getElementById("updateProgressBar");

    // Music system
    this.music = new MusicReactive(this);

    // Discovery Modal
    this.discoveryModal = document.getElementById("discoveryModal");
    this.closeDiscoveryBtn = document.getElementById("closeDiscoveryBtn");
    this.scanBtn = document.getElementById("scanBtn");
    this.discoveryStatus = document.getElementById("discoveryStatus");
    this.deviceList = document.getElementById("deviceList");

    // Power
    this.onBtn = document.getElementById("onBtn");
    this.offBtn = document.getElementById("offBtn");

    // Brightness
    this.brightnessSlider = document.getElementById("brightnessSlider");
    this.brightnessValue = document.getElementById("brightnessValue");

    // Color
    this.colorPicker = document.getElementById("colorPicker");
    this.applyColorBtn = document.getElementById("applyColorBtn");
    this.rInput = document.getElementById("rInput");
    this.gInput = document.getElementById("gInput");
    this.bInput = document.getElementById("bInput");
    this.applyRgbBtn = document.getElementById("applyRgbBtn");

    // Rules
    this.ruleTime = document.getElementById("ruleTime");
    this.ruleAction = document.getElementById("ruleAction");
    this.ruleValue = document.getElementById("ruleValue");
    this.addRuleBtn = document.getElementById("addRuleBtn");
    this.rulesList = document.getElementById("rulesList");

    // Automation
    this.startAutoBtn = document.getElementById("startAutoBtn");
    this.saveRulesBtn = document.getElementById("saveRulesBtn");
    this.loadRulesBtn = document.getElementById("loadRulesBtn");

    // Log
    this.logBox = document.getElementById("logBox");

    // Command Monitor
    this.commandLog = document.getElementById("commandLog");
    this.clearMonitorBtn = document.getElementById("clearMonitorBtn");

    // Packet Inspector
    this.packetList = document.getElementById("packetList");
    this.packetDetail = document.getElementById("packetDetail");
    this.packetContent = document.getElementById("packetContent");
    this.refreshPacketsBtn = document.getElementById("refreshPacketsBtn");
    this.clearPacketsBtn = document.getElementById("clearPacketsBtn");
    this.backPacketBtn = document.getElementById("backPacketBtn");

    // Presets grid
    this.presetsGrid = document.querySelector(".presets-grid");

    // Optional buttons
    this.createSceneBtn = document.getElementById("createScene");
    this.musicModeBtn = document.getElementById("musicMode");
    this.stopMusicBtn = document.getElementById("stopMusic");
    this.exportRulesBtn = document.getElementById("exportRulesBtn");
    this.importRulesBtn = document.getElementById("importRulesBtn");

    this.openSceneEditorBtn = document.getElementById("openSceneEditorBtn");
    this.sceneEditorModal = document.getElementById("sceneEditorModal");
    this.closeSceneEditorBtn = document.getElementById("closeSceneEditorBtn");
    this.sceneEditorTitle = document.getElementById("sceneEditorTitle");

    this.sceneNameInput = document.getElementById("sceneNameInput");
    this.sceneDefaultBrightness = document.getElementById("sceneDefaultBrightness");
    this.sceneLoopSelect = document.getElementById("sceneLoopSelect");
    this.sceneStepsList = document.getElementById("sceneStepsList");
    this.addSceneStepBtn = document.getElementById("addSceneStepBtn");

    this.previewSceneBtn = document.getElementById("previewSceneBtn");
    this.stopSceneBtn = document.getElementById("stopSceneBtn");
    this.saveSceneBtn = document.getElementById("saveSceneBtn");
    this.sceneEditorMsg = document.getElementById("sceneEditorMsg");

    // state for editor
    this.editingSceneId = null;
    this.editorSteps = [];
    this.userPresetsCache = null;
  }

  attachEventListeners() {
    // IP Input
    if (this.ipInput) {
      this.ipInput.addEventListener("change", (e) => {
        try {
          api.setDeviceIp(e.target.value);
          this.log("Device IP updated");
        } catch (error) {
          this.showErrorDialog("Invalid IP", error.message);
          this.ipInput.value = api.deviceIp;
        }
      });
    }
    // Scene Editor
    if (this.openSceneEditorBtn) {
      this.openSceneEditorBtn.addEventListener("click", () => this.openSceneEditor());
    }
    if (this.closeSceneEditorBtn) {
      this.closeSceneEditorBtn.addEventListener("click", () => this.closeSceneEditor());
    }
    if (this.addSceneStepBtn) {
      this.addSceneStepBtn.addEventListener("click", () => {
        this.editorSteps.push({ color: "#ff0000", brightness: 80, ms: 300 });
        this.renderSceneSteps();
      });
    }
    if (this.previewSceneBtn) {
      this.previewSceneBtn.addEventListener("click", async () => this.previewEditorScene());
    }
    if (this.stopSceneBtn) {
      this.stopSceneBtn.addEventListener("click", () => this.stopAllModes());
    }
    if (this.saveSceneBtn) {
      this.saveSceneBtn.addEventListener("click", async () => this.saveEditorScene());
    }

    // Discovery
    if (this.discoverBtn) this.discoverBtn.addEventListener("click", () => this.showDiscoveryModal());
    if (this.closeDiscoveryBtn) this.closeDiscoveryBtn.addEventListener("click", () => this.hideDiscoveryModal());
    if (this.scanBtn) this.scanBtn.addEventListener("click", () => this.scanDevices());

    // Status
    if (this.statusBtn) this.statusBtn.addEventListener("click", () => this.checkDeviceStatus());

    // Power
    if (this.onBtn) this.onBtn.addEventListener("click", () => this.deviceOn());
    if (this.offBtn) this.offBtn.addEventListener("click", () => this.deviceOff());

    // Brightness
    if (this.brightnessSlider) {
      this.brightnessSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        if (this.brightnessValue) this.brightnessValue.textContent = `${val}%`;
        this.setBrightness(val);
      });
    }

    // Color picker updates RGB inputs
    if (this.colorPicker) {
      this.colorPicker.addEventListener("input", (e) => {
        const hex = e.target.value;
        const [r, g, b] = this.hexToRgb(hex);
        if (this.rInput) this.rInput.value = r;
        if (this.gInput) this.gInput.value = g;
        if (this.bInput) this.bInput.value = b;
      });
    }

    // Apply HEX color
    if (this.applyColorBtn) {
      this.applyColorBtn.addEventListener("click", () => {
        const hex = this.colorPicker?.value;
        if (!hex) return;
        const [r, g, b] = this.hexToRgb(hex);
        this.setColor(r, g, b);
      });
    }

    // Apply RGB color
    if (this.applyRgbBtn) {
      this.applyRgbBtn.addEventListener("click", () => {
        const r = parseInt(this.rInput?.value) || 0;
        const g = parseInt(this.gInput?.value) || 0;
        const b = parseInt(this.bInput?.value) || 0;
        this.setColor(r, g, b);
      });
    }

    // Rules
    if (this.addRuleBtn) this.addRuleBtn.addEventListener("click", () => this.addRule());
    if (this.saveRulesBtn) this.saveRulesBtn.addEventListener("click", () => this.saveRules());
    if (this.loadRulesBtn) this.loadRulesBtn.addEventListener("click", () => this.loadRules());

    if (this.exportRulesBtn) this.exportRulesBtn.addEventListener("click", () => this.exportRules());
    if (this.importRulesBtn) this.importRulesBtn.addEventListener("click", () => this.importRules());

    // Automation
    if (this.startAutoBtn) this.startAutoBtn.addEventListener("click", () => this.toggleAutomation());

    // Command Monitor
    if (this.clearMonitorBtn) this.clearMonitorBtn.addEventListener("click", () => this.clearCommandLog());

    // Packet Inspector
    if (this.refreshPacketsBtn) this.refreshPacketsBtn.addEventListener("click", () => this.loadPackets());
    if (this.clearPacketsBtn) this.clearPacketsBtn.addEventListener("click", () => this.clearPacketsUI());
    if (this.backPacketBtn) this.backPacketBtn.addEventListener("click", () => this.showPacketList());

    // Enter key on rule value
    if (this.ruleValue) {
      this.ruleValue.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.addRule();
      });
    }

    // Wire API command logging
    if (window.api) api.onCommandSent = (entry) => this.logCommand(entry);

    // Hardcoded quick preset buttons (static HTML)
    document.querySelectorAll(".btn.btn-preset[data-color]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const [r, g, b] = String(btn.dataset.color).split(",").map(Number);
          await this.setColor(r, g, b);
          this.updateColorInputs(r, g, b);
        } catch (e) {
          this.log(`Preset click error: ${String(e.message || e)}`, "error");
        }
      });
    });

    // DIY Scene creator button
    if (this.createSceneBtn) {
      this.createSceneBtn.addEventListener("click", async () => {
        try {
          const scene = createScenePreset("My Scene", [
            { color: [255, 0, 0], brightness: 80, ms: 300 },
            { color: [0, 0, 255], brightness: 100, ms: 300 },
          ]);

          await saveScenePreset(scene);
          await this.loadDynamicPresets();
          this.log("DIY scene saved", "success");
        } catch (e) {
          this.showErrorDialog("Scene Save Failed", String(e?.message || e));
        }
      });
    }


    // Music mode buttons (also stops scene)
    if (this.musicModeBtn) {
      this.musicModeBtn.classList.remove("btn-music-active");
      this.musicModeBtn.disabled = false;

      this.musicModeBtn.addEventListener("click", () => {
        this.scenePlaying = false; // stop any running scene
        this.music.start();
        this.musicModeBtn.classList.add("btn-music-active");
        this.musicModeBtn.disabled = true;
        if (this.stopMusicBtn) this.stopMusicBtn.disabled = false;
      });
    }

    if (this.stopMusicBtn) {
      this.stopMusicBtn.disabled = true;

      this.stopMusicBtn.addEventListener("click", () => {
        this.scenePlaying = false; // stop scene too
        this.music.stop();

        if (this.musicModeBtn) {
          this.musicModeBtn.classList.remove("btn-music-active");
          this.musicModeBtn.disabled = false;
        }
        this.stopMusicBtn.disabled = true;
      });
    }
  }

  setupUpdaterUi() {
    if (this.updateBtn) {
      this.updateBtn.addEventListener("click", () => this.onUpdateButtonClick());
    }

    if (this.versionLabel && window.electron?.getAppVersion) {
      window.electron.getAppVersion().then((version) => {
        this.versionLabel.textContent = `v${version}`;
      });
    } else if (this.versionLabel) {
      this.versionLabel.textContent = "web";
    }

    if (window.electron?.onUpdateStatus) {
      window.electron.onUpdateStatus((payload) => this.applyUpdateStatus(payload));
    } else if (this.updateStatus) {
      this.updateStatus.textContent = "Update checks available in the desktop app.";
      this.updateStatus.classList.add("muted");
    }

    if (this.updateProgress) {
      this.setUpdateProgress(null);
    }
  }

  setUpdateMessage(text, type = "info") {
    if (!this.updateStatus) return;
    this.updateStatus.textContent = text || "";
    this.updateStatus.dataset.state = type;
  }

  setUpdateProgress(percent) {
    if (!this.updateProgress || !this.updateProgressBar) return;
    if (percent == null) {
      this.updateProgress.style.display = "none";
      this.updateProgressBar.style.width = "0%";
      return;
    }
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    this.updateProgress.style.display = "block";
    this.updateProgressBar.style.width = `${value}%`;
  }

  async onUpdateButtonClick() {
    if (!window.electron?.checkForUpdates) {
      this.setUpdateMessage("Updates are only available in the packaged app.", "muted");
      return;
    }

    if (this.updateState === "available") {
      this.updateBtn.disabled = true;
      this.updateBtn.textContent = "Downloading...";
      await window.electron.downloadUpdate();
      return;
    }

    if (this.updateState === "downloaded") {
      this.updateBtn.disabled = true;
      this.updateBtn.textContent = "Restarting...";
      await window.electron.installUpdate();
      return;
    }

    this.updateBtn.disabled = true;
    this.updateBtn.textContent = "Checking...";
    this.setUpdateMessage("Checking for updates...");
    const result = await window.electron.checkForUpdates();
    if (result?.status === "unavailable") {
      this.applyUpdateStatus({ status: "unavailable" });
    }
  }

  applyUpdateStatus(payload = {}) {
    const status = payload.status || "idle";
    this.updateState = status;

    if (!this.updateBtn) return;

    switch (status) {
      case "checking":
        this.updateBtn.disabled = true;
        this.updateBtn.textContent = "Checking...";
        this.setUpdateMessage("Checking for updates...");
        this.setUpdateProgress(null);
        break;
      case "available":
        this.updateBtn.disabled = false;
        this.updateBtn.textContent = "Download Update";
        this.setUpdateMessage(`Update ${payload.version || ""} available.`, "info");
        this.setUpdateProgress(null);
        break;
      case "downloading": {
        this.updateBtn.disabled = true;
        this.updateBtn.textContent = "Downloading...";
        const pct = payload.progress?.percent ?? 0;
        this.setUpdateMessage(`Downloading update... ${pct ? pct.toFixed(1) : "0"}%`, "info");
        this.setUpdateProgress(pct);
        break;
      }
      case "downloaded":
        this.updateBtn.disabled = false;
        this.updateBtn.textContent = "Restart to Update";
        this.setUpdateMessage("Update ready to install. Click to restart.", "ok");
        this.setUpdateProgress(100);
        break;
      case "not-available":
      case "no-update":
        this.updateBtn.disabled = false;
        this.updateBtn.textContent = "Check for Updates";
        this.setUpdateMessage("You are on the latest version.", "ok");
        this.setUpdateProgress(null);
        break;
      case "unavailable":
        this.updateBtn.disabled = true;
        this.updateBtn.textContent = "Check for Updates";
        this.setUpdateMessage("Updates disabled in development builds.", "muted");
        this.setUpdateProgress(null);
        break;
      case "error":
        this.updateBtn.disabled = false;
        this.updateBtn.textContent = "Retry";
        this.setUpdateMessage(`Update error: ${payload.message || "Unknown error"}`, "error");
        this.setUpdateProgress(null);
        break;
      default:
        this.updateBtn.disabled = false;
        this.updateBtn.textContent = "Check for Updates";
        this.setUpdateProgress(null);
        break;
    }
  }

  async fadeToTarget(target, durationMs = 0) {
    const fromColor = this.lastColor || { r: 255, g: 0, b: 0 };
    const fromBrightness = this.lastBrightness ?? 50;
    const frames = Math.max(2, Math.round((durationMs || 0) / 50));

    if (!durationMs || frames <= 2) {
      await this.setColor(target.r, target.g, target.b);
      if (target.brightness != null) await this.setBrightness(target.brightness);
      return;
    }

    for (let i = 1; i <= frames; i++) {
      const t = i / frames;
      const r = Math.round(fromColor.r + (target.r - fromColor.r) * t);
      const g = Math.round(fromColor.g + (target.g - fromColor.g) * t);
      const b = Math.round(fromColor.b + (target.b - fromColor.b) * t);
      const brightness = Math.round(fromBrightness + (target.brightness - fromBrightness) * t);
      await this.setColor(r, g, b);
      await this.setBrightness(brightness);
      await new Promise((res) => setTimeout(res, durationMs / frames));
    }
  }

  // -------------------------
  // Device Control
  // -------------------------
  async deviceOn() {
    try {
      await api.deviceOn();
      this.log("Device turned ON");
    } catch (error) {
      this.log(`Error: ${error.message}`, "error");
    }
  }

  async deviceOff() {
    try {
      await api.deviceOff();
      this.log("Device turned OFF");
    } catch (error) {
      this.log(`Error: ${error.message}`, "error");
    }
  }

  async setBrightness(value) {
    try {
      await api.setDeviceBrightness(value);
      this.lastBrightness = value;
      this.log(`Brightness → ${value}%`);
    } catch (error) {
      this.log(`Brightness error: ${error.message}`, "error");
    }
  }

  async setColor(r, g, b) {
    try {
      await api.setDeviceColor(r, g, b);
      this.lastColor = { r, g, b };
      if (this.colorPicker) this.colorPicker.value = this.rgbToHex(r, g, b);
      this.updateColorInputs(r, g, b);
      this.log(`Color → ${this.rgbToHex(r, g, b).toUpperCase()}`);
    } catch (error) {
      this.log(`Color error: ${error.message}`, "error");
    }
  }

  async checkDeviceStatus() {
    try {
      await api.getDeviceStatus();
      if (this.statusIndicator) {
        this.statusIndicator.classList.add("online");
        this.statusIndicator.classList.remove("offline");
      }
      this.log("Device is online");
      return true;
    } catch (error) {
      if (this.statusIndicator) {
        this.statusIndicator.classList.remove("online");
        this.statusIndicator.classList.add("offline");
      }
      if (!String(error.message || "").includes("Failed to fetch")) {
        this.log(`Device offline: ${error.message}`, "error");
      }
      return false;
    }
  }

  // -------------------------
  // Dynamic Presets (GitHub + user)
  // -------------------------
async loadDynamicPresets() {
  const grid = document.querySelector(".presets-grid");
  if (!grid) return;

  // keď app nejde v Electron, nechaj pôvodné HTML preset tlačidlá
  if (!window.electron?.presetsSync || !window.electron?.getUserPresets) {
    this.log("Dynamic presets not available (Electron IPC missing) — using static presets.", "info");
    return;
  }

  let remote = { data: { presets: [] } };
  let user = { presets: [] };

  try { remote = await window.electron.presetsSync(); } catch (e) {}
  try { user = await window.electron.getUserPresets(); } catch (e) {}

  const presets = [
    ...(remote?.data?.presets || []),
    ...(user?.presets || [])
  ];

  grid.innerHTML = "";

  if (!presets.length) {
    grid.innerHTML = `<div style="color: var(--muted); font-size: 12px; padding: 10px;">No presets yet</div>`;
    return;
  }

  for (const p of presets) {
    const btn = document.createElement("button");
    btn.className = "btn btn-preset";
    btn.textContent = p.name || "Preset";

    // ľavý klik = play/apply
    btn.addEventListener("click", async () => {
      try {
        if (p.type === "static") {
          const [r, g, b] = p.color || [255, 0, 0];
          await this.setColor(r, g, b);
          if (p.brightness != null) await this.setBrightness(p.brightness);
        } else if (p.type === "scene") {
          await this.playScene(p);
        } else if (p.type === "music") {
          this.music.start();
        }
      } catch (e) {
        this.log(`Preset error: ${String(e?.message || e)}`, "error");
      }
    });

    // pravý klik = edit scene
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (p.type === "scene") this.openSceneEditor(p);
    });

    grid.appendChild(btn);
  }

  this.log(`Presets loaded: ${presets.length}`, "success");
}

  async playScene(scene) {
    if (!Array.isArray(scene.steps)) return;

    // Stop music if running
    this.music.stop();
    if (this.musicModeBtn) {
      this.musicModeBtn.classList.remove("btn-music-active");
      this.musicModeBtn.disabled = false;
    }
    if (this.stopMusicBtn) this.stopMusicBtn.disabled = true;

    this.scenePlaying = true;

    for (const step of scene.steps) {
      if (!this.scenePlaying) break;

      const [r, g, b] = step.color || [255, 0, 0];
      const brightness = step.brightness != null ? step.brightness : this.lastBrightness;
      const transitionMs = step.transitionMs != null ? step.transitionMs : Math.min(step.ms || 300, 600);

      await this.fadeToTarget({ r, g, b, brightness }, transitionMs);
      await new Promise((res) => setTimeout(res, step.ms || 300));
    }

    this.scenePlaying = false;
  }

  // -------------------------
  // Rules & Automation
  // -------------------------
  validateRule(time, action, value) {
    if (!/^\d{2}:\d{2}$/.test(time)) return "Invalid time format (HH:MM)";

    const [hours, minutes] = time.split(":").map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "Invalid time values";

    if (action === "brightness") {
      const num = parseInt(value);
      if (isNaN(num) || num < 1 || num > 100) return "Brightness must be 1-100";
    } else if (action === "rgb") {
      const parts = value.split(",").map((v) => parseInt(v.trim()));
      if (parts.length !== 3 || parts.some((v) => isNaN(v) || v < 0 || v > 255)) {
        return "RGB must be: 255,100,50 (each 0-255)";
      }
    }

    return null;
  }

  async addRule() {
    const time = this.ruleTime?.value;
    const action = this.ruleAction?.value;
    const value = this.ruleValue?.value;

    const validationError = this.validateRule(time, action, value);
    if (validationError) {
      this.showErrorDialog("Invalid Rule", validationError);
      return;
    }

    try {
      await api.addRule(time, action, value);
      this.log(`Rule added: ${time} → ${action}`);
      if (this.ruleValue) this.ruleValue.value = "";
      this.loadRules();
    } catch (error) {
      this.showErrorDialog("Rule Error", error.message);
      this.log(`Rule error: ${error.message}`, "error");
    }
  }

  async deleteRule(index) {
    try {
      await api.deleteRule(index);
      this.log("Rule deleted");
      this.loadRules();
    } catch (error) {
      this.log(`Delete error: ${error.message}`, "error");
    }
  }

  async loadRules() {
    try {
      const result = await api.getRules();
      this.rules = result.rules || [];
      this.renderRulesList();
    } catch (error) {
      this.log(`Load rules error: ${error.message}`, "error");
    }
  }

  async saveRules() {
    try {
      await api.updateRules(this.rules);
      this.log("Rules saved to device (rules.json updated)");
    } catch (error) {
      this.log(`Save error: ${error.message}`, "error");
    }
  }

  async exportRules() {
    try {
      if (!window.electron) {
        this.showErrorDialog("Export Failed", "Electron API not available (not running as Electron app)");
        return;
      }
      const result = await window.electron.exportRules(this.rules);
      if (result.success) {
        this.log(`Rules exported to ${result.path}`);
        this.showSuccessDialog("Export Successful", `Rules saved to:\n${result.path}`);
      }
    } catch (error) {
      this.showErrorDialog("Export Error", error.message);
    }
  }

  async importRules() {
    try {
      if (!window.electron) {
        this.showErrorDialog("Import Failed", "Electron API not available (not running as Electron app)");
        return;
      }
      const result = await window.electron.importRules();
      if (result.success && result.data) {
        if (!Array.isArray(result.data)) {
          this.showErrorDialog("Import Failed", "Invalid format: expected array of rules");
          return;
        }
        this.rules = result.data;
        await api.updateRules(this.rules);
        this.renderRulesList();
        this.log(`${this.rules.length} rules imported`);
        this.showSuccessDialog("Import Successful", `Loaded ${this.rules.length} rules`);
      }
    } catch (error) {
      this.showErrorDialog("Import Error", error.message);
    }
  }

  async refreshAutomationStatus() {
    try {
      const resp = await api.getAutomationStatus();
      this.automationRunning = !!resp.running;
      if (this.startAutoBtn) {
        if (this.automationRunning) {
          this.startAutoBtn.textContent = "Stop";
          this.startAutoBtn.classList.add("active");
        } else {
          this.startAutoBtn.textContent = "Start";
          this.startAutoBtn.classList.remove("active");
        }
      }
    } catch {
      // ignore
    }
  }

  renderRulesList() {
    if (!this.rulesList) return;
    this.rulesList.innerHTML = "";
    this.rules.forEach((rule, idx) => {
      const li = document.createElement("li");
      const ruleText = this.formatRuleText(rule);
      li.innerHTML = `
        <span>${ruleText}</span>
        <button class="delete-btn" data-idx="${idx}">Delete</button>
      `;
      li.querySelector(".delete-btn").addEventListener("click", () => this.deleteRule(idx));
      this.rulesList.appendChild(li);
    });
  }

  formatRuleText(rule) {
    let text = `${rule.time} →`;
    if (rule.action === "brightness") text += ` Brightness ${rule.value}%`;
    else if (rule.action === "rgb") text += ` RGB ${rule.r},${rule.g},${rule.b}`;
    else text += ` ${String(rule.action || "").toUpperCase()}`;
    return text;
  }

  async toggleAutomation() {
    try {
      if (this.automationRunning) {
        await api.stopAutomation();
        this.automationRunning = false;
        if (this.startAutoBtn) {
          this.startAutoBtn.textContent = "Start";
          this.startAutoBtn.classList.remove("active");
        }
        this.log("Automation stopped");
      } else {
        await api.startAutomation();
        this.automationRunning = true;
        if (this.startAutoBtn) {
          this.startAutoBtn.textContent = "Stop";
          this.startAutoBtn.classList.add("active");
        }
        this.log("Automation started");
      }
    } catch (error) {
      this.log(`Automation error: ${error.message}`, "error");
    }
  }

  // -------------------------
  // Helpers
  // -------------------------
  hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  rgbToHex(r, g, b) {
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }

  updateColorInputs(r, g, b) {
    if (this.rInput) this.rInput.value = r;
    if (this.gInput) this.gInput.value = g;
    if (this.bInput) this.bInput.value = b;
    if (this.colorPicker) this.colorPicker.value = this.rgbToHex(r, g, b);
  }

  log(message, type = "info") {
    if (!this.logBox) return;
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    this.logBox.appendChild(entry);
    this.logBox.scrollTop = this.logBox.scrollHeight;

    while (this.logBox.children.length > 100) {
      this.logBox.removeChild(this.logBox.firstChild);
    }
  }

  logCommand(entry) {
    if (!this.commandLog) return;
    const div = document.createElement("div");
    div.className = `command-entry ${entry.status}`;
    div.innerHTML = `<span class="cmd-time">${entry.timestamp}</span><span class="cmd-action">${entry.action}</span> ${entry.data}`;
    this.commandLog.appendChild(div);
    this.commandLog.scrollTop = this.commandLog.scrollHeight;

    while (this.commandLog.children.length > 50) {
      this.commandLog.removeChild(this.commandLog.firstChild);
    }
  }

  clearCommandLog() {
    if (this.commandLog) this.commandLog.innerHTML = "";
    this.log("Command log cleared");
  }

  // -------------------------
  // Packets
  // -------------------------
  async loadPackets() {
    try {
      const result = await api.getPackets();
      this.displayPackets(result.packets || []);
      this.log("Packets refreshed");
    } catch (error) {
      this.log(`Packet load error: ${error.message}`, "error");
    }
  }

  displayPackets(packets) {
    if (!this.packetList) return;
    this.packetList.innerHTML = "";
    if (packets.length === 0) {
      this.packetList.innerHTML =
        '<div style="color: var(--muted); font-size: 12px; padding: 12px;">No packets captured yet</div>';
      return;
    }
    packets.forEach((pkt) => {
      const div = document.createElement("div");
      div.className = "packet-item";
      const time = new Date(pkt.timestamp).toLocaleTimeString();
      const cmd = pkt.payload_json?.msg?.cmd || "unknown";
      div.innerHTML = `
        <div class="packet-time">${time}</div>
        <div><span class="packet-dest">UDP</span> → ${pkt.destination_ip}:${pkt.destination_port}</div>
        <div>cmd: <strong>${cmd}</strong> | <span class="packet-size">${pkt.payload_size} bytes</span></div>
      `;
      div.addEventListener("click", () => this.showPacketDetail(pkt));
      this.packetList.appendChild(div);
    });
  }

  showPacketDetail(packet) {
    if (!this.packetList || !this.packetDetail) return;

    this.packetList.style.display = "none";
    this.packetDetail.style.display = "block";

    this.currentPacket = packet;

    this.showPacketTab("json");

    const tabs = this.packetDetail.querySelectorAll(".packet-tab-btn");
    tabs.forEach((btn) => {
      btn.classList.remove("active");
      btn.onclick = null;
      btn.addEventListener("click", (e) => {
        tabs.forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        this.showPacketTab(e.target.dataset.tab);
      });
    });
    if (tabs[0]) tabs[0].classList.add("active");
  }

  showPacketTab(tab) {
    const packet = this.currentPacket;
    if (!packet || !this.packetContent) return;

    const time = new Date(packet.timestamp).toLocaleTimeString();
    let html = "";

    if (tab === "json") {
      html = `
        <div class="packet-field">
          <div class="packet-field-label">Timestamp</div>
          <div class="packet-field-value">${time}</div>
        </div>
        <div class="packet-field">
          <div class="packet-field-label">Destination</div>
          <div class="packet-field-value">${packet.destination_ip}:${packet.destination_port}</div>
        </div>
        <div class="packet-field">
          <div class="packet-field-label">Payload (JSON)</div>
          <div class="packet-field-value"><pre>${JSON.stringify(packet.payload_json, null, 2)}</pre></div>
        </div>
      `;
    } else if (tab === "raw") {
      html = `
        <div class="packet-field">
          <div class="packet-field-label">Raw Text Payload</div>
          <div class="packet-field-value"><pre>${packet.payload_text}</pre></div>
        </div>
        <div class="packet-field">
          <div class="packet-field-label">Size</div>
          <div class="packet-field-value">${packet.payload_size} bytes</div>
        </div>
      `;
    } else if (tab === "hex") {
      html = `
        <div class="packet-field">
          <div class="packet-field-label">Hexadecimal Dump</div>
          <div class="hex-dump">${this.formatHexDumpPretty(packet.payload_hex)}</div>
        </div>
      `;
    } else if (tab === "analysis") {
      html = this.analyzePacket(packet);
    }

    this.packetContent.innerHTML = html;
  }

  formatHexDumpPretty(hexStr) {
    let result = "";
    const bytes = [];
    for (let i = 0; i < hexStr.length; i += 2) bytes.push(hexStr.substr(i, 2));

    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const offset = i.toString(16).padStart(8, "0");
      const hex = chunk.join(" ");
      const ascii = chunk
        .map((b) => {
          const char = String.fromCharCode(parseInt(b, 16));
          return /[\x20-\x7E]/.test(char) ? char : ".";
        })
        .join("");
      result += `${offset}  ${hex.padEnd(47, " ")}  ${ascii}\n`;
    }
    return result;
  }

  analyzePacket(packet) {
    const msg = packet.payload_json?.msg || {};
    const cmd = msg.cmd || "unknown";
    const data = msg.data || {};

    let analysis = `
      <div class="packet-field">
        <div class="packet-field-label">Command</div>
        <div class="packet-field-value">${cmd}</div>
      </div>
    `;

    if (cmd === "turn") {
      analysis += `
        <div class="packet-field">
          <div class="packet-field-label">Action</div>
          <div class="packet-field-value">${data.value === 1 ? "Turn ON" : "Turn OFF"}</div>
        </div>
      `;
    } else if (cmd === "brightness") {
      analysis += `
        <div class="packet-field">
          <div class="packet-field-label">Brightness Level</div>
          <div class="packet-field-value">${data.value || 0}%</div>
        </div>
      `;
    } else if (cmd === "colorwc") {
      const color = data.color || {};
      analysis += `
        <div class="packet-field">
          <div class="packet-field-label">RGB Color</div>
          <div class="packet-field-value">
            R: ${color.r || 0} | G: ${color.g || 0} | B: ${color.b || 0}<br>
            <div style="display:inline-block; width:40px; height:20px; background:rgb(${color.r},${color.g},${color.b}); border:1px solid rgba(255,255,255,0.2); border-radius:4px; margin-top:4px;"></div>
          </div>
        </div>
      `;
    } else if (cmd === "devStatus") {
      analysis += `
        <div class="packet-field">
          <div class="packet-field-label">Request</div>
          <div class="packet-field-value">Device Status Query</div>
        </div>
      `;
    }

    analysis += `
      <div class="packet-field">
        <div class="packet-field-label">Protocol Info</div>
        <div class="packet-field-value">
          Protocol: UDP/IP<br>
          Destination Port: 4003 (Govee LAN)<br>
          Payload Size: ${packet.payload_size} bytes
        </div>
      </div>
    `;

    return analysis;
  }

  showPacketList() {
    if (!this.packetDetail || !this.packetList) return;
    this.packetDetail.style.display = "none";
    this.packetList.style.display = "block";
  }

  async clearPacketsUI() {
    try {
      await api.clearPackets();
      if (this.packetList) {
        this.packetList.innerHTML =
          '<div style="color: var(--muted); font-size: 12px; padding: 12px;">Packet log cleared</div>';
      }
      this.log("Packet log cleared");
    } catch (error) {
      this.log(`Clear error: ${error.message}`, "error");
    }
  }

  // -------------------------
  // Discovery
  // -------------------------
  showDiscoveryModal() {
    if (!this.discoveryModal || !this.discoveryStatus || !this.deviceList) return;
    this.discoveryModal.style.display = "flex";
    this.deviceList.style.display = "none";
    this.discoveryStatus.innerHTML = '<button id="scanBtn" class="btn btn-auto">Start Scan</button>';

    this.scanBtn = document.getElementById("scanBtn");
    if (this.scanBtn) this.scanBtn.addEventListener("click", () => this.scanDevices());
  }

  hideDiscoveryModal() {
    if (!this.discoveryModal) return;
    this.discoveryModal.style.display = "none";
  }

  async scanDevices() {
    try {
      if (!this.discoveryStatus) return;

      this.discoveryStatus.innerHTML =
        '<div class="discovery-status scanning"><span class="discovery-spinner"></span>Scanning network (this may take 5-10 seconds)...</div>';

      if (this.scanBtn) this.scanBtn.disabled = true;

      const result = await api.discoverDevices();
      const devices = result.devices || [];

      if (devices.length === 0) {
        this.discoveryStatus.innerHTML =
          '<div class="no-devices">No devices found. Make sure your device is powered on and on the same network. You can also enter the IP manually above.</div>';
        return;
      }

      this.displayDiscoveredDevices(devices);
      this.log(`Found ${devices.length} device(s)`);
    } catch (error) {
      let errorMsg = error.message;

      if (String(errorMsg).includes("Failed to fetch")) {
        errorMsg = "Cannot connect to backend. Is the app running? Try restarting.";
      } else if (String(errorMsg).includes("timeout")) {
        errorMsg = "Network scan timed out. Device may not be on same network.";
      }

      if (this.discoveryStatus) {
        this.discoveryStatus.innerHTML = `<div class="no-devices">❌ Scan failed: ${errorMsg}</div>`;
      }
      this.showErrorDialog("Discovery Failed", errorMsg);
      this.log(`Discovery error: ${errorMsg}`, "error");
    }
  }

  displayDiscoveredDevices(devices) {
    if (!this.deviceList) return;

    this.deviceList.style.display = "flex";
    this.deviceList.innerHTML = "";

    devices.forEach((dev) => {
      const div = document.createElement("div");
      div.className = "device-item";

      const ip = dev.ip;
      const deviceType = dev.device_type || "Unknown";
      const deviceName = dev.device_name || `Govee Device (${ip})`;
      const sku = dev.sku || "N/A";

      div.innerHTML = `
        <div class="device-ip">${ip}</div>
        <div class="device-info">
          <div><strong>${deviceName}</strong></div>
          <div class="device-model">Type: ${deviceType} | SKU: ${sku}</div>
        </div>
      `;

      div.addEventListener("click", () => {
        if (this.ipInput) this.ipInput.value = ip;
        api.setDeviceIp(ip);
        this.log(`Connected to ${deviceName} (${ip})`, "success");
        this.hideDiscoveryModal();

        const subtitle = document.getElementById("deviceSubtitle");
        if (subtitle) subtitle.textContent = `${deviceType} • ${deviceName}`;
      });

      this.deviceList.appendChild(div);
    });
  }

  // -------------------------
  // Dialogs
  // -------------------------
  showErrorDialog(title, message) {
    if (window.electron) {
      const dialogHtml = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: var(--bg-800); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px; padding: 24px; z-index: 10000; max-width: 400px;
                    box-shadow: 0 20px 25px rgba(0,0,0,0.2);">
          <h3 style="color: #ef4444; margin: 0 0 8px 0;">${title}</h3>
          <p style="color: var(--muted); margin: 0 0 16px 0; line-height: 1.5;">${message}</p>
          <button onclick="this.parentElement.remove()" class="btn btn-small"
                  style="background: var(--primary); width: 100%;">OK</button>
        </div>
        <div onclick="this.remove()" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999;"></div>
      `;
      const temp = document.createElement("div");
      temp.innerHTML = dialogHtml;
      document.body.appendChild(temp.firstElementChild);
      document.body.appendChild(temp.lastElementChild);
    } else {
      alert(`${title}\n\n${message}`);
    }
  }

  showSuccessDialog(title, message) {
    const dialogHtml = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                  background: var(--bg-800); border: 1px solid rgba(255,255,255,0.1);
                  border-radius: 8px; padding: 24px; z-index: 10000; max-width: 400px;
                  box-shadow: 0 20px 25px rgba(0,0,0,0.2);">
        <h3 style="color: #22c55e; margin: 0 0 8px 0;">${title}</h3>
        <p style="color: var(--muted); margin: 0 0 16px 0; line-height: 1.5; white-space: pre-wrap;">${message}</p>
        <button onclick="this.parentElement.remove()" class="btn btn-small"
                style="background: #22c55e; width: 100%;">OK</button>
      </div>
      <div onclick="this.remove()" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999;"></div>
    `;
    const temp = document.createElement("div");
    temp.innerHTML = dialogHtml;
    document.body.appendChild(temp.firstElementChild);
    document.body.appendChild(temp.lastElementChild);
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new GoveeApp();
  window.app.log("Govee Controller initialized");
  if (window.app.ipInput) window.app.ipInput.value = api.deviceIp;
});
