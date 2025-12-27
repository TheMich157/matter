# Govee H612C Controller — Electron UI

Modern desktop app for controlling Govee H612C LED devices over LAN.

## Architecture

- **Frontend**: Electron + HTML/CSS/JavaScript (modern dark theme UI)
- **Backend**: Python Flask server with embedded GoveeLAN library
- **Communication**: HTTP REST API (localhost:5000)

## Features

- Device control: ON/OFF/Brightness/RGB
- Color presets
- Daily automation rules
- Real-time device status
- Rule save/load
- Dark mode UI with animations

## Setup

### Prerequisites

- Node.js 16+ 
- Python 3.8+

### Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node dependencies
npm install
```

## Development

```bash
# Start both backend and Electron dev mode
npm run dev
```

This will:
1. Start Flask backend on `http://localhost:5000`
2. Launch Electron app pointing to the backend
3. Open DevTools for debugging

## Building EXE

```bash
# Build production binary
npm run build

# Output: dist/Govee Controller.exe
```

The exe includes:
- Complete Electron app
- Python runtime
- Flask backend
- All dependencies bundled

## File Structure

```
.
├── app_backend.py           # Flask HTTP API server
├── electron/
│   ├── main.js              # Electron entry point
│   └── preload.js           # IPC bridge
├── src/
│   ├── index.html           # UI template
│   ├── styles.css           # Modern dark theme
│   ├── app.js               # Frontend logic
│   └── api.js               # API client
├── package.json             # Electron config + build settings
└── requirements.txt         # Python dependencies
```

## Usage

1. Enter device IP (default: 192.168.1.66)
2. Click Status to verify connection
3. Use controls to:
   - Turn ON/OFF
   - Adjust brightness (1-100%)
   - Set color (picker, hex, or RGB)
   - Apply presets (Red, Green, Blue, Warm, Purple, Cyan)
4. Create daily automation rules
5. Save/Load rules

## Notes

- Device must be on same LAN
- Port 4003 (UDP) must be open
- Flask backend runs automatically with Electron app
- Rules saved to `rules.json`
