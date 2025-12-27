# Complete Standalone Build Guide

**Everything in ONE .EXE file** - No dependencies needed for end users!

## What's Included

The final `.exe` contains:
- ✅ Python 3 runtime (embedded)
- ✅ Flask web framework
- ✅ All Python libraries
- ✅ GoveeLAN library (enhanced with scene management, error recovery)
- ✅ Electron application shell
- ✅ Complete HTML/CSS/JavaScript UI
- ✅ Automation engine
- ✅ Device discovery
- ✅ Packet monitor

**Result**: Single file, ~120-150 MB, no installation needed (portable version) or NSIS installer available.

## Build Prerequisites

### What You Need (One Time Only)

1. **Node.js 14+** - https://nodejs.org/
   ```powershell
   node --version  # Should show v14+ or v16+
   ```

2. **Python 3.8+** - https://www.python.org/
   ```powershell
   python --version  # Should show 3.8+
   ```

That's it! The build script handles everything else.

### Installation Steps

#### Windows

1. **Install Node.js**
   - Download: https://nodejs.org/en/download/
   - Run installer, keep defaults
   - Restart terminal/PowerShell

2. **Install Python**
   - Download: https://www.python.org/downloads/
   - Run installer
   - **IMPORTANT**: Check "Add Python to PATH"
   - Restart terminal/PowerShell

3. **Verify Installation**
   ```powershell
   node --version
   npm --version
   python --version
   pip --version
   ```
   All should show version numbers (no errors).

## Building (Automated)

### Option 1: One-Click Build (Easiest) ⭐

```powershell
# Open PowerShell in project folder
cd C:\path\to\matter

# Run the build script
.\build_all.ps1
```

This script automatically:
1. ✓ Checks prerequisites
2. ✓ Installs Python dependencies
3. ✓ Installs PyInstaller
4. ✓ Bundles Python backend with PyInstaller → `dist/govee-backend.exe`
5. ✓ Installs npm dependencies
6. ✓ Builds Electron app
7. ✓ Creates final .exe installers

**Total time**: 5-10 minutes (first time longer due to downloads)

### Option 2: Manual Build (For Developers)

```powershell
# 1. Install all dependencies
pip install -r requirements.txt
npm install

# 2. Build Python backend executable
pyinstaller backend.spec

# 3. Build Electron application
npm run dist
```

## Output Files

After build, you'll find in `dist/` folder:

```
dist/
├── Govee LAN Controller-1.0.0.exe           (NSIS Installer, ~80 MB)
├── Govee LAN Controller-1.0.0-portable.exe  (Portable, ~100 MB)
├── govee-backend.exe                         (Backend, ~80 MB - bundled in above)
└── [other build artifacts]
```

### Which File to Use?

| File | Best For | Size | Notes |
|------|----------|------|-------|
| **installer.exe** | End users | 80 MB | Creates Start Menu shortcut, can uninstall |
| **portable.exe** | Quick deployment | 100 MB | No installation, just run it |

## User Installation

### For End Users

**With installer**:
1. Download `Govee LAN Controller-1.0.0.exe`
2. Double-click to run
3. Click "Install"
4. Find app in Start Menu

**Portable version**:
1. Download `Govee LAN Controller-1.0.0-portable.exe`
2. Double-click to run (no installation!)
3. Use immediately

### System Requirements (End Users)

- **OS**: Windows 10, 11
- **RAM**: 200 MB free
- **Disk**: 150 MB free
- **Network**: Same WiFi as Govee device
- **Python**: NOT required (embedded)
- **Node.js**: NOT required

Users don't need to install anything except the .exe!

## Customization

### Change App Icon

1. Create 512×512 PNG image of your icon
2. Place in `assets/icon.png`
3. Run build script
4. Icon will auto-embed in .exe

### Change App Name/Version

Edit `package.json`:
```json
{
  "name": "govee-lan-controller",
  "version": "1.0.1",
  "productName": "Govee LAN Controller"
}
```

Then rebuild.

### Change Python Backend

Edit `backend.spec`:
```python
a = Analysis(
    ['app_backend.py'],  # Change this
    # ... rest stays same
)
```

## Troubleshooting Build

### "Node.js not found"
```powershell
# Verify installation
node --version

# If not found, reinstall from https://nodejs.org
# Important: Restart PowerShell after install
```

### "Python not found"
```powershell
python --version

# If not found, check:
# 1. Python installed from https://www.python.org
# 2. "Add Python to PATH" was checked during install
# 3. Restart PowerShell
```

### "PyInstaller failed"
```powershell
# Reinstall PyInstaller
pip uninstall pyinstaller -y
pip install pyinstaller

# Then retry build
.\build_all.ps1
```

### "npm install failed"
```powershell
# Clear cache and retry
npm cache clean --force
npm install

# If still fails, delete node_modules
rm -r node_modules package-lock.json
npm install
```

### Build Takes Too Long
- First build is slow (downloads Python, deps, Electron)
- Subsequent builds are faster
- Normal time: 5-10 minutes

### exe Won't Start
Check for errors:
```powershell
# Run portable exe from PowerShell to see errors
& '.\dist\Govee LAN Controller-1.0.0-portable.exe'
```

## How It Works (Technical Details)

### Build Architecture

```
Python Backend:
  app_backend.py
  ├── Flask server
  ├── GoveeLAN library
  └── Device discovery
        ↓ (PyInstaller)
    govee-backend.exe (single file, 80 MB)
        ↓ (Reference in electron/main.js)
    
Electron Frontend:
  src/ (HTML/CSS/JS)
  electron/ (main.js + preload.js)
        ↓ (electron-builder)
    Govee LAN Controller-1.0.0.exe (installer or portable)
```

### Runtime Flow

When user runs the .exe:
1. Electron window launches
2. electron/main.js spawns `govee-backend.exe`
3. Backend starts Flask on localhost:5000
4. Frontend connects via HTTP
5. All communication local (no internet)

### Size Breakdown

Typical .exe sizes:
- Python runtime: ~40 MB
- Flask + deps: ~20 MB
- Electron app: ~40 MB
- Frontend files: ~5 MB
- Compression: ~50% reduction
- **Total**: 80-100 MB .exe

## Advanced Topics

### Building Without PyInstaller

If you want traditional installer with Python requirement:

```powershell
# Skip PyInstaller step
# Just run:
npm install
npm run dist
```

This creates .exe that requires Python installed on user's system. Not recommended for distribution.

### Code Signing (Windows)

For production release:

1. Get code signing certificate
2. Update `electron-builder` config:
```json
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "password"
}
```

### Auto-Update (Future)

To add auto-update capability:
```javascript
// In electron/main.js
const { autoUpdater } = require('electron-updater');
autoUpdater.checkForUpdatesAndNotify();
```

## Distribution

### GitHub Releases

```bash
# Tag the release
git tag v1.0.0
git push --tags

# Upload .exe files to GitHub Releases
# Users can download from Releases tab
```

### Your Website

Host the .exe files on your website:
- Store in `downloads/` folder
- Link from main page
- Show file size and version
- Users download and run

### Direct Sharing

Send .exe file directly to users:
- Email
- Cloud storage (Dropbox, OneDrive, Google Drive)
- USB drive
- Portable enough to fit on USB

## Version Updates

When you update the app:

1. Edit `package.json`:
```json
"version": "1.0.1"
```

2. Rebuild:
```powershell
.\build_all.ps1
```

3. New .exe files created:
   - `Govee LAN Controller-1.0.1.exe`
   - `Govee LAN Controller-1.0.1-portable.exe`

4. Users download and run new version
5. Old settings/rules preserved automatically

## Performance Notes

### Startup Time
- First time: 3-5 seconds (Python initialization)
- Subsequent: 2-3 seconds
- Network scan: 5-10 seconds

### Memory Usage
- Python runtime: ~40 MB
- Flask app: ~20 MB
- Electron UI: ~60 MB
- **Total**: ~120 MB (acceptable)

### Network Performance
- Command execution: <100 ms
- Device discovery: 5-10 seconds per interface
- Packet monitoring: Real-time

## Deployment Checklist

- [ ] Build script runs without errors
- [ ] .exe file created and non-zero size
- [ ] Test .exe on clean Windows machine
- [ ] Power ON/OFF works
- [ ] Device discovery finds devices
- [ ] Colors and brightness control work
- [ ] Automation rules save/load
- [ ] Import/export rules works
- [ ] Update version number before release
- [ ] Test on Windows 10 and 11

## Security Considerations

✅ **What's Secure**:
- No internet communication (all local network)
- No telemetry or tracking
- No external API calls
- No user data stored in cloud
- Code is open source (auditable)

❌ **Limitations**:
- No encryption of rules.json (local file)
- Network traffic not encrypted (both devices on same LAN)
- No user authentication needed (local use assumed)

## Support

For build issues:
1. Check prerequisites are installed correctly
2. Make sure versions are recent
3. Try cleaning and rebuilding
4. Check error output carefully
5. Post issue on GitHub with full error message

---

**You now have a professional, standalone application your users can easily install and run!** 🎉
