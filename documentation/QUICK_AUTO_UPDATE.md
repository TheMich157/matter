# 🚀 Quick Auto-Update Setup (5 minutes)

## For Developers: Enable Auto-Updates

### 1. Update package.json

Find the `"publish"` section and add your GitHub username:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",  // ← Change this!
  "repo": "govee-lan-controller"
}
```

### 2. Get GitHub Token

1. Go to: https://github.com/settings/tokens
2. Generate new token → Select `public_repo` scope
3. Copy the token

### 3. Build & Publish

**Windows PowerShell:**
```powershell
$env:GH_TOKEN = "your_token_here"
npm run build -- --win --publish always
```

### 4. Create Release on GitHub

1. Go to your repo Releases: `github.com/YOUR_USERNAME/govee-lan-controller/releases`
2. "Create new release" 
3. Tag: `v1.0.1` (matches package.json version)
4. Upload `.exe` files from `dist/` folder
5. Publish!

## For Users: Using Auto-Updates

✅ **Automatic**: App checks every hour for updates
✅ **Manual**: Go to Help → "Check for Updates"
✅ **Install**: Click "Restart Now" when prompted
✅ **Safe**: All settings preserved, just newer version

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No update found" | Check GitHub tag matches version in package.json (e.g., v1.0.1) |
| GH_TOKEN error | Set: `$env:GH_TOKEN = "token"` before building |
| Build won't publish | Make sure GitHub token has `public_repo` scope |
| Update won't install | User may need admin rights to restart app |

## Files Created/Modified

- ✅ `package.json` - Added auto-update config
- ✅ `electron/main.js` - Added updater code
- ✅ `AUTO_UPDATE_SETUP.md` - Detailed guide
- ✅ `publish_release.ps1` - Helper script for releases
- ✅ `.github/workflows/release.yml` - GitHub Actions (optional)

## What Actually Happens

```
User runs app
    ↓
App checks GitHub every hour
    ↓
[Update available?] → User gets notified
    ↓
User clicks "Restart Now"
    ↓
App downloads + installs new version
    ↓
App restarts with new version
```

Done! Your app now auto-updates. 🎉
