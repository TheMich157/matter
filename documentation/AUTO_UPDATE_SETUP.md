# Auto-Update Setup Guide

The Govee LAN Controller now has built-in auto-update functionality! Here's how to set it up.

## How It Works

- **Automatic checking**: The app checks for updates every hour when running
- **User notifications**: Users get notified when updates are available
- **One-click install**: Users can restart the app to install updates
- **Background download**: New versions download automatically in the background
- **GitHub-based**: Updates are hosted on GitHub Releases

## Setup Instructions

### Step 1: Configure GitHub Repository

1. Create a GitHub repository (or use existing):
   ```
   https://github.com/YOUR_USERNAME/govee-lan-controller
   ```

2. Edit `package.json` and update the publish config:
   ```json
   "publish": {
     "provider": "github",
     "owner": "YOUR_USERNAME",
     "repo": "govee-lan-controller"
   }
   ```

### Step 2: Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - URL: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scope: `public_repo` (or `repo` for private repos)
4. Copy the token (you'll need it for publishing)

### Step 3: Set Environment Variable

Before building, set the GitHub token:

**PowerShell:**
```powershell
$env:GH_TOKEN = "your_github_token_here"
npm run dist
```

**Command Prompt:**
```cmd
set GH_TOKEN=your_github_token_here
npm run dist
```

**Or permanently in system (Windows):**
- Settings → System → Environment Variables
- New variable: `GH_TOKEN` = your token
- Restart PowerShell/terminal

### Step 4: Build and Publish

```powershell
# Full build with publishing to GitHub
npm run build -- --win --publish always

# Or for testing without publishing:
npm run dist
```

### Step 5: Create GitHub Release

After building, create a release on GitHub:

1. Go to your repo: `https://github.com/YOUR_USERNAME/govee-lan-controller`
2. Click "Releases" → "Create a new release"
3. Tag version: `v1.0.0` (must match `package.json` version)
4. Title: `Govee LAN Controller 1.0.0`
5. Upload built files from `dist/`:
   - `Govee LAN Controller Setup 1.0.0.exe` (installer)
   - `Govee LAN Controller-1.0.0.exe` (portable)

## Manual Update Check

Users can manually check for updates via the menu:
- Click "Help" → "Check for Updates"

## For Users

Once you have updates published:

1. **Automatic**: App checks every hour and notifies automatically
2. **Manual**: Use Help → Check for Updates menu
3. **Installation**: Click "Restart Now" when prompted, app restarts with new version
4. **Settings preserved**: User data in `%APPDATA%/Govee LAN Controller/` is preserved

## Update Flow Diagram

```
User runs app
    ↓
App checks GitHub for new releases
    ↓
No update? → Continue normally
Update available? → Notify user
    ↓
User clicks "Check for Updates" (or auto-prompt)
    ↓
Download in background
    ↓
Download complete → "Update Ready" dialog
    ↓
User clicks "Restart Now"
    ↓
App installs update & restarts
    ↓
New version running
```

## Version Numbering

Follow semantic versioning (semver):

- **Patch**: `1.0.1` (bug fixes, small improvements)
- **Minor**: `1.1.0` (new features, backwards compatible)
- **Major**: `2.0.0` (breaking changes)

Update both:
1. `package.json`: `"version": "1.0.1"`
2. `electron/main.js`: In About dialog (optional but good practice)

## Troubleshooting

### "No update found" but I released a new version

- Check tag format in GitHub: `v1.0.1` (with `v` prefix)
- Verify `package.json` version matches release
- Check your GitHub token has `public_repo` scope
- Try manual check: Help → Check for Updates (waits 60 sec)

### "Failed to find executable" or "Cannot find binary"

- Make sure both .exe files are in the release:
  - `Govee LAN Controller Setup 1.0.0.exe`
  - `Govee LAN Controller-1.0.0.exe`
- The updater needs the portable version (`.exe` not `-setup`)

### Update notifies but won't install

- Ensure user has write permissions to app folder
- For installed version, may need admin rights to restart
- Try uninstalling and using portable `.exe` instead

### "GH_TOKEN not set"

- You need to set the environment variable before building
- PowerShell: `$env:GH_TOKEN = "token"`
- Or use `npm run dist` (builds but doesn't publish automatically)

## Example Release Checklist

```
☐ Update version in package.json (e.g., 1.0.1)
☐ Update version in main.js About dialog
☐ Commit changes: git commit -m "Release v1.0.1"
☐ Set GH_TOKEN environment variable
☐ Run: npm run build -- --win --publish always
☐ Verify files in dist/
☐ Go to GitHub Releases
☐ Create new release with tag v1.0.1
☐ Upload Govee LAN Controller Setup 1.0.1.exe
☐ Upload Govee LAN Controller-1.0.1.exe
☐ Write release notes
☐ Publish release
☐ Test update in app: Help → Check for Updates
```

## Advanced: CI/CD Pipeline (Optional)

For automated releases, you can use GitHub Actions:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 16
      - run: npm install
      - run: npm run build -- --win --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This automatically builds and publishes when you push a tag like `v1.0.1`.

## Security Notes

- ✅ Token only has `public_repo` scope (can't access private data)
- ✅ Updates are signed by GitHub (HTTPS verified)
- ✅ Users can see what they're installing (GitHub Releases page)
- ✅ Portable .exe can be redistributed without installation
- ❌ Don't commit your GH_TOKEN to git!

## Support

Questions about electron-updater?
- https://www.electron.build/auto-update
- https://github.com/electron-userland/electron-builder/wiki/Auto-Update
