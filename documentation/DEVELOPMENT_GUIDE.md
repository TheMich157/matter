# Development Guide

Complete guide for developers working on Govee LAN Controller.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│        Govee LAN Controller App          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │    Electron (UI Layer)          │   │
│  │  ┌─────────────────────────┐    │   │
│  │  │ HTML/CSS/JavaScript     │    │   │
│  │  │ - index.html            │    │   │
│  │  │ - styles.css            │    │   │
│  │  │ - app.js (GoveeApp)     │    │   │
│  │  │ - api.js (HTTP client)  │    │   │
│  │  └─────────────────────────┘    │   │
│  │          ↕ HTTP                 │   │
│  │  ┌─────────────────────────┐    │   │
│  │  │ electron/main.js        │    │   │
│  │  │ - Window management     │    │   │
│  │  │ - Menu & IPC handlers   │    │   │
│  │  │ - Backend lifecycle     │    │   │
│  │  └─────────────────────────┘    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │    Flask Backend (API Layer)    │   │
│  │  ┌─────────────────────────┐    │   │
│  │  │ app_backend.py          │    │   │
│  │  │ - HTTP Server (5000)    │    │   │
│  │  │ - REST endpoints (/api) │    │   │
│  │  │ - GoveeLAN class        │    │   │
│  │  │ - PacketMonitor         │    │   │
│  │  │ - Device discovery      │    │   │
│  │  │ - Automation thread     │    │   │
│  │  └─────────────────────────┘    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │    Data Layer                   │   │
│  │  - rules.json (automation)      │   │
│  │  - localStorage (browser cache) │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↕ UDP (Port 4003)
         ┌──────────────────┐
         │  Govee Device    │
         │  (LAN Network)   │
         └──────────────────┘
```

## Project Structure

```
matter/
├── app_backend.py              # Flask backend + GoveeLAN library
├── package.json                # Node.js + Electron config
├── requirements.txt            # Python dependencies
├── rules.json                  # User's automation rules
│
├── electron/
│   ├── main.js                # Electron main process
│   └── preload.js             # IPC bridge
│
├── src/
│   ├── index.html             # UI markup
│   ├── styles.css             # Styling (CSS variables)
│   ├── api.js                 # HTTP client (GoveeAPI class)
│   └── app.js                 # Main logic (GoveeApp class)
│
├── BUILD_INSTRUCTIONS.md      # Build guide
├── README_PRODUCTION.md       # User documentation
├── PRODUCTION_CHECKLIST.md   # Release tracking
└── [this file]               # Development guide
```

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/govee-lan-controller.git
cd govee-lan-controller
```

### 2. Install Dependencies

```bash
# Node.js + Electron
npm install

# Python + Flask
pip install -r requirements.txt

# Or with virtual environment (recommended)
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

### 3. Run in Development

```bash
npm run dev
```

This starts:
- Flask backend (Python) on localhost:5000
- Electron app with DevTools
- Hot-reload enabled for JS/CSS changes

## Code Structure

### Backend: `app_backend.py` (585 lines)

**Key Classes**:

#### `PacketMonitor`
Captures all UDP packets sent to device.
```python
class PacketMonitor:
    def log_packet(self, ip, port, payload_dict, payload_bytes)
    def get_packets(self) -> list
    def clear()
```

**Usage**: Every time `_send()` is called, packet is logged.

#### `GoveeLAN`
Core device communication via UDP.
```python
class GoveeLAN:
    def set_ip(ip: str)
    def on() / off()
    def brightness(value: int)  # 1-100
    def rgb(r: int, g: int, b: int)  # 0-255 each
    def status() -> dict
    def _send(payload: dict) -> dict
```

**Usage**: Sends JSON-encoded UDP packets to device port 4003.

**Flask Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/device/on` | POST | Turn device on |
| `/api/device/off` | POST | Turn device off |
| `/api/device/brightness` | POST | Set brightness |
| `/api/device/color` | POST | Set RGB color |
| `/api/device/status` | POST | Get device status |
| `/api/rules` | GET/POST/PUT/DELETE | Rule management |
| `/api/automation/start` | POST | Start automation |
| `/api/automation/stop` | POST | Stop automation |
| `/api/automation/status` | GET | Check if running |
| `/api/packets` | GET/DELETE | Packet monitoring |
| `/api/discover` | GET | Find devices on network |

### Frontend: `src/` (4 files)

#### `index.html` (187 lines)
Structure and layout. Main sections:
- Header (IP input, discovery, status)
- Left panel (power, brightness, color, log)
- Right panel (presets, monitor, packets, automation)
- Discovery modal

#### `styles.css` (650+ lines)
Styling with:
- CSS variables for colors/spacing
- Dark theme with glassmorphism
- Responsive card layout
- Animations and transitions
- Packet inspector styling

#### `api.js` (GoveeAPI class, 100+ lines)
HTTP client wrapping Flask API.

**Key Methods**:
```javascript
class GoveeAPI {
  setDeviceIp(ip)        // Update device target
  isValidIp(ip) -> bool  // Validate IP format
  
  // Device control
  deviceOn/Off()
  setDeviceBrightness(value)
  setDeviceColor(r, g, b)
  getDeviceStatus()
  
  // Rules
  getRules() -> list
  addRule(time, action, value)
  deleteRule(index)
  updateRules(rules)
  
  // Automation
  startAutomation()
  stopAutomation()
  getAutomationStatus()
  
  // Diagnostics
  getPackets() -> list
  clearPackets()
  
  // Discovery
  discoverDevices() -> list
}
```

#### `app.js` (GoveeApp class, 770+ lines)
Main application logic and UI management.

**Key Methods**:

**Control**:
```javascript
async deviceOn/Off()
async setBrightness(value)
async setColor(r, g, b)
async checkDeviceStatus()
updateColorInputs(r, g, b)
```

**Rules & Automation**:
```javascript
validateRule(time, action, value) -> error|null
async addRule()
async deleteRule(index)
async loadRules()
async saveRules()
async exportRules()  // New: File export
async importRules()  // New: File import
renderRulesList()
```

**UI & Events**:
```javascript
showPacketList/Detail()
showPacketTab(tab)
analyzePacket(packet) -> analysis
formatHexDumpPretty(hex) -> formatted
showDiscoveryModal/hideDiscoveryModal()
async scanDevices()
displayDiscoveredDevices(devices)
```

**Dialogs** (New):
```javascript
showErrorDialog(title, message)
showSuccessDialog(title, message)
```

### Electron: `electron/` (2 files)

#### `main.js` (150+ lines)
Main process managing app lifecycle.

**Key Functions**:
```javascript
createWindow()                // Create Electron window
startBackend()               // Spawn Python process
createMenu()                 // Application menu
ipcMain.handle('export-rules', ...)  // IPC handler
ipcMain.handle('import-rules', ...)  // IPC handler
```

**Lifecycle**:
1. `app.on('ready')` → Start backend + create window
2. Backend spawns Python process
3. Window loads http://localhost:5000
4. IPC handlers for file dialogs

#### `preload.js` (10 lines)
Security bridge exposing IPC to renderer.

**Exposed API**:
```javascript
window.electron.exportRules(data)
window.electron.importRules()
window.electron.getAppVersion()
```

## Development Workflow

### Adding a Feature

**1. Frontend (UI)**:
- Edit `src/index.html` for new elements
- Add CSS to `src/styles.css`
- Implement logic in `src/app.js`

**2. Backend (Logic)**:
- Add Flask route in `app_backend.py`
- Implement device control if needed
- Test with curl/Postman

**3. API Bridge**:
- Add method in `src/api.js`
- Wire in `src/app.js` event listener

**4. Test**:
```bash
npm run dev
# Test in running app
```

### Example: Adding "Favorite Color" Feature

**Step 1: Backend (app_backend.py)**
```python
favorite_color = {"r": 255, "g": 0, "b": 0}  # global

@app.route('/api/device/favorite', methods=['POST'])
def device_favorite():
    """Set device to favorite color"""
    data = request.get_json()
    govee.set_ip(data.get('ip'))
    govee.rgb(favorite_color['r'], favorite_color['g'], favorite_color['b'])
    return jsonify({"status": "ok"})
```

**Step 2: API Client (src/api.js)**
```javascript
async setFavoriteColor() {
    this.logCommand('favorite', this.lastFavoriteColor);
    return this.request('/device/favorite', 'POST', {});
}
```

**Step 3: UI (src/index.html)**
```html
<button id="favoriteBtn" class="btn btn-preset">★ Favorite</button>
```

**Step 4: Logic (src/app.js)**
```javascript
this.favoriteBtn = document.getElementById('favoriteBtn');
this.favoriteBtn.addEventListener('click', () => this.setFavoriteColor());

async setFavoriteColor() {
    try {
        await api.setFavoriteColor();
        this.log('Set to favorite color');
    } catch (error) {
        this.showErrorDialog('Error', error.message);
    }
}
```

## Common Tasks

### Debugging Backend

```bash
# Run Flask directly with debug output
FLASK_ENV=development python app_backend.py

# Test endpoint with curl
curl -X POST http://localhost:5000/api/device/on \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.66"}'
```

### Debugging Frontend

In development mode, DevTools open automatically:
- Press `F12` to open developer tools
- Check Console for JavaScript errors
- Use Network tab to inspect HTTP requests
- Use Application tab to inspect localStorage

### Debugging Packets

```javascript
// In browser console
api.getPackets().then(r => {
  r.packets.forEach(p => console.log(p));
});
```

### Testing Device Discovery

```bash
# Manually scan network
python app_backend.py

# In another terminal
curl http://localhost:5000/api/discover

# Should return JSON with device list
```

## Performance Optimization Tips

### Frontend

1. **Minimize DOM updates**: Cache element references
2. **Debounce input**: Use timeout for slider updates
3. **Batch API calls**: Don't call API on every keystroke
4. **Lazy load tabs**: Only render tab content when visible

### Backend

1. **Cache device status**: Don't query on every request
2. **Multicast optimization**: Increase timeout if network is slow
3. **Rule deduplication**: Prevent duplicate executions
4. **Packet buffer limit**: Keep at 100 packets max

### Electron

1. **Preload script slim**: Only expose necessary functions
2. **Worker thread for discovery**: Don't block UI during scan
3. **Lazy load heavy modules**: Load Python interpreter only once

## Testing

### Unit Tests (Python)

```bash
# Create test file: test_backend.py
python -m pytest test_backend.py -v
```

### Manual Testing Checklist

- [ ] Device power ON/OFF
- [ ] Brightness 0%, 50%, 100%
- [ ] All color presets
- [ ] RGB input validation
- [ ] Device discovery finds device
- [ ] Rules validation prevents bad entries
- [ ] Automation executes on time
- [ ] Packets show correct data
- [ ] Export/import rules works
- [ ] Error dialogs appear on failure

### Integration Test

```bash
# Terminal 1: Start backend
npm run start

# Terminal 2: Start Electron
npm run dev

# Terminal 3: Run automation
curl -X POST http://localhost:5000/api/automation/start
```

## Debugging Common Issues

### "Module not found" (Python)

```bash
# Install missing module
pip install module_name

# Or reinstall requirements
pip install -r requirements.txt --force-reinstall
```

### Port 5000 Already in Use

```powershell
# Find process using port
netstat -ano | findstr :5000

# Kill process
taskkill /PID 12345 /F
```

### Device Not Found in Discovery

```bash
# Check if device responds to multicast
# On Windows:
netsh interface ipv4 show config

# Verify device is on same subnet
ping 239.255.255.250

# Check firewall allows UDP 4001
netsh advfirewall firewall add rule name="Govee" dir=in action=allow protocol=udp localport=4001
```

### Electron Won't Start

```bash
# Check if Python is in PATH
python --version

# Try running backend manually first
python app_backend.py

# Then check if it's accessible
curl http://localhost:5000

# If that works, run Electron
npm run dev
```

## Build & Distribution

### Local Build

```bash
npm run dist
```

Creates executables in `dist/`:
- `Govee LAN Controller-1.0.0.exe` (NSIS installer)
- `Govee LAN Controller-1.0.0-portable.exe` (portable)

### Testing Build

```bash
# Create unpacked dist for testing
npm run pack

# Then run the unpacked app
dist/Govee LAN Controller-1.0.0/Govee LAN Controller.exe
```

### Release Process

1. Update version in `package.json`
2. Update `PRODUCTION_CHECKLIST.md`
3. Build: `npm run dist`
4. Test both `.exe` files
5. Upload to GitHub Releases
6. Update download page

## Git Workflow

```bash
# Feature branch
git checkout -b feature/my-feature

# Make changes
git add .
git commit -m "Add my feature"

# Push
git push origin feature/my-feature

# Create Pull Request on GitHub
# After review & merge, delete branch
git checkout main
git pull
git branch -d feature/my-feature
```

## Resources

- **Electron Docs**: https://www.electronjs.org/docs
- **Flask Docs**: https://flask.palletsprojects.com
- **Govee Protocol**: Study `govee_lan.py` for UDP format
- **Socket Programming**: https://docs.python.org/3/library/socket.html

## Support for Contributors

- Ask questions in GitHub Issues
- Check existing issues before creating new ones
- Include error messages and device info
- Be descriptive in commit messages
- Follow existing code style

## License

MIT - See LICENSE file

---

Happy coding! 🚀
