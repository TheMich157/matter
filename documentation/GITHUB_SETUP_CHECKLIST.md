# GitHub Setup Checklist ✅

Complete this checklist to enable auto-updates for your app.

## Step 1: Create GitHub Repository ☐

- [ ] Go to https://github.com/new
- [ ] Name: `govee-lan-controller`
- [ ] Description: "Professional local control for Govee lights"
- [ ] Public or Private (auto-updates work either way)
- [ ] Click "Create repository"
- [ ] Copy the HTTPS URL

## Step 2: Update package.json ☐

Edit `package.json` line 93-97:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",  // ← Enter your username
  "repo": "govee-lan-controller"
}
```

Save the file.

## Step 3: Create GitHub Personal Access Token ☐

1. [ ] Go to https://github.com/settings/tokens
2. [ ] Click "Generate new token" → "Generate new token (classic)"
3. [ ] Name: `GOVEE_BUILD_TOKEN`
4. [ ] Expiration: 90 days or No expiration
5. [ ] Select scope: 
   - [ ] ✅ `public_repo` (recommended for public repos)
   - [ ] OR `repo` (for private repos)
6. [ ] Click "Generate token"
7. [ ] **COPY THE TOKEN** (you can only see it once!)
8. [ ] Save it somewhere safe (you'll need it for building)

**⚠️ NEVER commit this token to Git!**

## Step 4: Set Environment Variable ☐

### For Current Terminal Session Only

**PowerShell:**
```powershell
$env:GH_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Command Prompt:**
```cmd
set GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### For All Future Sessions (Windows)

1. [ ] Right-click "This PC" → "Properties"
2. [ ] Click "Advanced system settings"
3. [ ] Click "Environment Variables"
4. [ ] New User variable:
   - Name: `GH_TOKEN`
   - Value: `ghp_xxxxxxxxxxxxxxxxxxxx`
5. [ ] Click OK, OK, OK
6. [ ] **Restart all terminal windows**

## Step 5: Build and Publish ☐

```powershell
# Make sure you're in the project directory
cd C:\Users\pokem\matter

# Build (with token set)
npm run build -- --win --publish always
```

Or use the helper script:

```powershell
.\publish_release.ps1 -Version 1.0.0 -Notes "Initial release"
```

**This will:**
- Update package.json version
- Build the app (5-10 minutes)
- Upload to GitHub automatically

## Step 6: Create GitHub Release ☐

1. [ ] Go to https://github.com/YOUR_USERNAME/govee-lan-controller/releases
2. [ ] Click "Create a new release"
3. [ ] Tag version: `v1.0.0`
4. [ ] Release title: `Govee LAN Controller 1.0.0`
5. [ ] Description: 
   ```
   **Features:**
   - Auto-updates
   - Device discovery
   - Power control
   - Color/brightness
   
   **Downloads:**
   - Installer: Use this for first install
   - Portable: Use this for updates/USB
   ```
6. [ ] Upload files from `dist/`:
   - [ ] `Govee LAN Controller Setup 1.0.0.exe`
   - [ ] `Govee LAN Controller-1.0.0.exe`
7. [ ] Click "Publish release"

## Step 7: Test Auto-Update ☐

1. [ ] Run the app: `dist/Govee LAN Controller-1.0.0.exe`
2. [ ] Wait 5 seconds for startup
3. [ ] Click: Help → "Check for Updates"
4. [ ] Should say: "You're up to date!"

## Step 8: Future Releases ☐

For each new release:

```powershell
# Edit package.json version: "version": "1.0.1"

# Run:
$env:GH_TOKEN = "your_token"
.\publish_release.ps1 -Version 1.0.1 -Notes "Bug fixes"

# Create GitHub Release:
# - Tag: v1.0.1
# - Upload .exe files
# - Publish
```

## Step 9: Enable GitHub Actions (Optional) ☐

For fully automated CI/CD:

1. [ ] Commit `.github/workflows/release.yml` to your repo
2. [ ] Push to GitHub: `git push origin main`
3. [ ] Go to repository Settings → Secrets and variables
4. [ ] Add repository secret:
   - Name: `GH_TOKEN`
   - Value: Your token from Step 3
5. [ ] Now whenever you push a tag, it auto-builds and releases!

Example:
```powershell
git tag v1.0.1
git push origin v1.0.1
# GitHub Actions will automatically build and release!
```

## Verification Checklist ☐

- [ ] package.json has `"owner": "YOUR_USERNAME"`
- [ ] GitHub repository exists at correct URL
- [ ] Personal access token created with `public_repo` scope
- [ ] GH_TOKEN environment variable set
- [ ] First build completed and published
- [ ] GitHub Release created with v1.0.0 tag
- [ ] Both .exe files uploaded to release
- [ ] App runs and checks for updates successfully
- [ ] Help → "Check for Updates" works

## Troubleshooting

### "GH_TOKEN not found"
```powershell
$env:GH_TOKEN = "your_token_here"
npm run build -- --win --publish always
```

### "Could not find matching release"
- Check GitHub repo URL is correct
- Check GH_TOKEN is valid and not expired
- Check package.json version and GitHub tag match

### "Publish failed"
- Ensure GH_TOKEN has `public_repo` scope
- Try building with `--publish never` first, then manually create release

### "Update won't show in app"
- Restart app completely
- Check GitHub Release is published (not draft)
- Check version numbers match (package.json vs git tag)

## Security Reminder ⚠️

✅ **Do:**
- [ ] Store token securely
- [ ] Set as environment variable (not in code)
- [ ] Use `public_repo` scope (minimal permissions)
- [ ] Rotate token yearly
- [ ] Use GitHub Actions secrets for CI/CD

❌ **Don't:**
- [ ] Commit token to Git
- [ ] Share token with others
- [ ] Use tokens with `repo` scope for public repos
- [ ] Leave token in plaintext

## Support

- **electron-updater**: https://www.electron.build/auto-update
- **GitHub Tokens**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- **GitHub Releases**: https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository

---

**Need help? Check AUTO_UPDATE_SETUP.md for detailed guide**
