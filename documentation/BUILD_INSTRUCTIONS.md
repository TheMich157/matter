# Building Govee LAN Controller Executable

This guide explains how to build the Govee LAN Controller as a standalone Windows executable.

## Prerequisites

1. **Node.js 14+** - Download from https://nodejs.org/
2. **Python 3.7+** - Download from https://www.python.org/
3. **Git** (optional, for cloning)

Verify installation:
```powershell
node --version
npm --version
python --version
```

## Quick Build (Easiest)

### Option 1: One-Click Build Script (Recommended) ⭐

```powershell
# Run from project root directory
.\build_all.ps1
```

This script will:
- Check prerequisites (Node.js, Python)
- Install npm dependencies
- Install Python requirements
- Bundle Python backend with PyInstaller
- Build the Electron application
- Create `.exe` installers in the `dist/` folder

**Takes 5-10 minutes on first build.**

### Option 2: Manual Build (For Developers)

```powershell
# Install dependencies
npm install
pip install -r requirements.txt

# Build executable
npm run dist
```

## Output Files

After successful build, you'll find:

- **`dist/Govee LAN Controller Setup 1.0.0.exe`** - NSIS installer (recommended)
- **`dist/Govee LAN Controller-1.0.0.exe`** - Portable version (no installation needed)

### Auto-Updates

The app now includes automatic update checking:
- Checks GitHub Releases every hour
- Notifies users when updates are available
- Users can install updates with one click
- See [AUTO_UPDATE_SETUP.md](AUTO_UPDATE_SETUP.md) for GitHub setup

## Testing Before Build

Before building the full executable, test locally:

```powershell
npm run dev
```

This will:
1. Start the Flask backend (Python)
2. Launch the Electron app
3. Open DevTools for debugging

The app requires:
- Device IP on same network (or manually entered)
- No cloud services or internet connection needed
- Works entirely on your local network

## Troubleshooting

### `npm install` fails
- Make sure Node.js is installed: `node --version`
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules/` and `package-lock.json`, try again

### `pip install` fails
- Use: `pip install --user -r requirements.txt`
- Or: `python -m pip install -r requirements.txt`
- Check Python is 3.7+: `python --version`

### Build fails with "python not found"
- Ensure Python is in PATH
- Restart terminal/PowerShell after Python installation
- Or use: `python -m flask` instead of `flask` command

### Electron-builder not found
- Run: `npm install -g electron-builder`
- Or: `npx electron-builder`

## Distribution

Once built, you can:

1. **Share the installer** - Give others `Govee LAN Controller-1.0.0.exe`
2. **Portable version** - No installation, just run the `.exe`
3. **Update** - Users can run newer versions; settings are saved in `%APPDATA%/Govee LAN Controller/`

## Version Updates

To update the version:

1. Edit `package.json`: Update `"version": "1.0.1"`
2. Rebuild: `npm run dist`
3. New `.exe` files will be created with new version number

## Advanced: Custom Icon

To customize the app icon:

1. Create a 512x512 PNG image
2. Place as `assets/icon.png`
3. Run: `npm run dist`

The build system will automatically convert it for Windows.

## Performance Notes

- Startup: ~3-5 seconds (Python + Flask backend initialization)
- Device discovery: ~5-10 seconds (network scan)
- Commands: <100ms (local network)
- Memory: ~120-150 MB (Electron + Python)

## Architecture

```
Govee LAN Controller
├── Electron (UI)
│   └── localhost:5000 → Flask Backend
│       ├── HTTP API Server
│       ├── Python socket communication
│       └── Device discovery & control
└── Python Backend
    ├── Flask framework
    ├── GoveeLAN library
    └── UDP socket communication
```

The application bundles both Electron and Python into a single `.exe` file. When you run it:
1. Electron starts and launches the Flask backend
2. Flask runs a local HTTP server on port 5000
3. The Electron UI connects to Flask via localhost
4. All communication with Govee devices is local (no cloud)

## Security & Privacy

- ✅ No cloud servers
- ✅ No data collection
- ✅ All data stays on your network
- ✅ Open source (you can inspect the code)

## Support

For issues:
1. Check `npm` and `python` are installed
2. Run in PowerShell (not Command Prompt)
3. Ensure no port 5000 is already in use
4. Check device is on same WiFi network as computer
