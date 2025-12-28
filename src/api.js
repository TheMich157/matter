/**
 * API client for communicating with Flask backend
 */

const API_URL = 'http://localhost:5000/api';

class GoveeAPI {
  constructor() {
    this.deviceIp = localStorage.getItem('deviceIp') || '192.168.1.66';
    this.deviceId = localStorage.getItem('lanDeviceId') || '';
    this.sku = localStorage.getItem('lanSku') || '';
    this.commandLog = [];
    this.onCommandSent = null; // callback for UI logging
  }

  logCommand(action, data, status = 'sent') {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      action,
      data: JSON.stringify(data).substring(0, 80),
      status
    };
    this.commandLog.push(entry);
    if (this.commandLog.length > 50) {
      this.commandLog.shift(); // keep last 50 only
    }
    if (this.onCommandSent) {
      this.onCommandSent(entry);
    }
  }

  async request(endpoint, method = 'GET', data = null) {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const options = {
          method,
          headers: { 'Content-Type': 'application/json' },
        };

        if (data || method === 'POST' || method === 'PUT') {
          options.body = JSON.stringify({
            ...(data || {}),
            ip: this.deviceIp,
          });
        }

        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        console.log(`[API] Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff: 500ms, 1s, 2s)
          const waitTime = 500 * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }
    
    throw new Error(`API Error: ${lastError?.message || 'Failed to fetch'}`);
  }

  setDeviceIp(ip) {
    // Validate IP format
    if (!this.isValidIp(ip)) {
      throw new Error('Invalid IP format. Expected: 192.168.1.1');
    }
    this.deviceIp = ip;
    localStorage.setItem('deviceIp', ip);
  }

  setDeviceIdentity(deviceId = '', sku = '') {
    this.deviceId = deviceId || '';
    this.sku = sku || '';
    localStorage.setItem('lanDeviceId', this.deviceId);
    localStorage.setItem('lanSku', this.sku);
  }

  getDeviceIdentity() {
    return {
      device: this.deviceId || undefined,
      sku: this.sku || undefined,
    };
  }

  isValidIp(ip) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;
    
    const parts = ip.split('.').map(Number);
    return parts.every(part => part >= 0 && part <= 255);
  }

  // Device Control
  async deviceOn() {
    this.logCommand('turn', { value: 1 });
    return this.request('/device/on', 'POST', {});
  }

  async deviceOff() {
    this.logCommand('turn', { value: 0 });
    return this.request('/device/off', 'POST', {});
  }

  async setDeviceBrightness(value) {
    this.logCommand('brightness', { value });
    return this.request('/device/brightness', 'POST', { value });
  }

  async setDeviceColor(r, g, b) {
    this.logCommand('colorwc', { r, g, b });
    return this.request('/device/color', 'POST', { r, g, b });
  }

  async setColorTemperature(value, extra = {}) {
    this.logCommand('colorwc', { colorTemInKelvin: value });
    return this.request('/device/color-temperature', 'POST', {
      value,
      ...this.getDeviceIdentity(),
      ...extra,
    });
  }

  async getDeviceStatus() {
    this.logCommand('devStatus', {});
    return this.request('/device/status', 'POST', {});
  }

  async sendLanCommand(cmd, data = {}, options = {}) {
    const payload = {
      cmd,
      data,
      expect_reply: options.expectReply ?? true,
      timeout: options.timeout ?? 1.0,
      ...this.getDeviceIdentity(),
    };

    if (options.device) payload.device = options.device;
    if (options.sku) payload.sku = options.sku;

    this.logCommand(cmd, data);
    return this.request('/device/raw', 'POST', payload);
  }

  async sendLanPayload(payload, options = {}) {
    if (!payload || typeof payload !== "object") {
      throw new Error("payload must be an object");
    }

    const body = {
      payload,
      expect_reply: options.expectReply ?? true,
      timeout: options.timeout ?? 1.0,
      ...this.getDeviceIdentity(),
    };

    if (options.device) body.device = options.device;
    if (options.sku) body.sku = options.sku;

    this.logCommand(payload?.msg?.cmd || "custom", payload);
    return this.request('/device/raw', 'POST', body);
  }

  // Rules/Automation
  async getRules() {
    return this.request('/rules', 'GET');
  }

  async addRule(time, action, value = null) {
    const data = { time, action };
    if (action === 'brightness') {
      data.value = value || 50;
    } else if (action === 'rgb') {
      const [r, g, b] = (value || '255,0,0').split(',').map(Number);
      data.r = r;
      data.g = g;
      data.b = b;
    }
    return this.request('/rules', 'POST', data);
  }

  async deleteRule(index) {
    return this.request(`/rules/${index}`, 'DELETE');
  }

  async updateRules(rules) {
    return this.request('/rules', 'PUT', { rules, device_ip: this.deviceIp });
  }

  // Automation
  async startAutomation() {
    return this.request('/automation/start', 'POST', {});
  }

  async stopAutomation() {
    return this.request('/automation/stop', 'POST', {});
  }

  async getAutomationStatus() {
    return this.request('/automation/status', 'GET');
  }

  // Packet monitoring
  async getPackets() {
    return this.request('/packets', 'GET');
  }

  async clearPackets() {
    return this.request('/packets', 'DELETE');
  }

  // Device discovery
  async discoverDevices() {
    return this.request('/discover', 'GET');
  }
}

// Create global instance
const api = new GoveeAPI();
