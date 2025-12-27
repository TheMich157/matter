# Scripts & Automation Tools

All scripts are PowerShell (.ps1) files. Run from project root.

## Master Launcher

**`.\go.ps1`** - Universal launcher for all tools
```powershell
.\go.ps1              # Show all commands
.\go.ps1 setup        # GitHub setup
.\go.ps1 dev          # Start dev server
.\go.ps1 build        # Build installers
.\go.ps1 release      # Release to GitHub
.\go.ps1 tools        # Interactive menu
```

## Development Scripts

### `.\dev.ps1` - Development Server
Starts Python backend + Electron frontend with hot reload.
```powershell
.\dev.ps1
# Opens Electron window connected to Flask backend
# Press Ctrl+C to stop
```

### `.\build.ps1` - Full Build
Installs dependencies, builds Python exe, bundles everything.
```powershell
.\build.ps1
# Takes 5-10 minutes
# Outputs installers to dist/
```

## Release Scripts

### `.\release.ps1` - Release Pipeline
Complete release: bump version, build, verify, upload to GitHub.
```powershell
.\release.ps1                              # Interactive
.\release.ps1 -Version 1.0.1               # Specify version
.\release.ps1 -Version 1.0.1 -Notes "..."  # Specify version + notes
.\release.ps1 -SkipBuild                   # Skip building (just package)
```

### `.\bump_version.ps1` - Version Bumper
Updates version in package.json & code automatically.
```powershell
.\bump_version.ps1              # Defaults to patch bump (1.0.0 → 1.0.1)
.\bump_version.ps1 -Type minor  # Minor bump (1.0.0 → 1.1.0)
.\bump_version.ps1 -Type major  # Major bump (1.0.0 → 2.0.0)
.\bump_version.ps1 -NoCommit    # Don't git commit
```

## GitHub Setup Scripts

### `.\setup_wizard.ps1` - Interactive Setup
Step-by-step wizard for first-time GitHub setup.
```powershell
.\setup_wizard.ps1
# Guides you through:
# - Creating GitHub personal access token
# - Configuring package.json
# - Setting environment variable
# - Making first release
```

### `.\setup_github.ps1` - Configuration Validator
Checks and fixes GitHub auto-update configuration.
```powershell
.\setup_github.ps1
# Reports:
# - What's configured correctly (✓)
# - What's missing (❌)
# - Recommended fixes (📋)
```

## Testing Scripts

### `.\test_update.ps1` - Update Check Tester
Simulates app update check against GitHub.
```powershell
.\test_update.ps1
# Reports:
# - Current version
# - Latest release on GitHub
# - Available updates
# - Release assets attached
```

## Interactive Menu

### `.\tools.ps1` - Full Tool Menu
Interactive menu for all common tasks.
```powershell
.\tools.ps1
# Shows numbered menu (1-10)
# Select option to run corresponding script
```

## Common Workflows

### First-Time Setup (30 minutes)
```powershell
.\go.ps1 setup       # Configure GitHub
.\go.ps1 dev         # Test development
.\go.ps1 build       # Build installers
.\go.ps1 release     # Make first release
```

### Daily Development
```powershell
.\go.ps1 dev         # Code & test locally
```

### Make a New Release (10 minutes)
```powershell
# Option 1: Guided
.\go.ps1 bump        # Bump version
.\go.ps1 release     # Full release pipeline

# Option 2: Quick
.\go.ps1 release -Version 1.0.1 -Notes "Bug fixes"

# Option 3: Manual
.\bump_version.ps1 -Type patch   # 1.0.0 → 1.0.1
.\release.ps1                    # Build & release
```

### Just Build (No Release)
```powershell
.\go.ps1 build       # Create installers in dist/
```

### Just Test Updates
```powershell
.\go.ps1 test        # Check GitHub for latest
```

## Script Details

| Script | Time | Output | Uses |
|--------|------|--------|------|
| go.ps1 | <1s | Launcher | Calls other scripts |
| dev.ps1 | ∞ | Electron window | Flask backend |
| build.ps1 | 5-10min | dist/*.exe | npm build |
| release.ps1 | Manual | GitHub release | git + npm |
| bump_version.ps1 | <1s | Updated files | git |
| setup_wizard.ps1 | 5min | Configured env | GitHub API |
| setup_github.ps1 | <1s | Status report | package.json check |
| test_update.ps1 | 2s | Version check | GitHub API |
| tools.ps1 | ∞ | Interactive menu | Calls other scripts |

## Requirements

- PowerShell 5.0+
- Node.js 14+ (npm)
- Python 3.7+
- Git (for version bumping & releases)
- GitHub account (for auto-updates)
- GitHub Personal Access Token (for publishing)

## Environment Variables

Set these for automation:

```powershell
$env:GH_TOKEN = "ghp_xxxxxxxxxxxxxxxxx"    # GitHub token
```

Or permanently:
```powershell
[Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_...", "User")
```

## Error Handling

All scripts:
- ✓ Check prerequisites before running
- ✓ Validate configuration
- ✓ Report clear errors
- ✓ Suggest fixes
- ✓ Exit cleanly on failures

Example error handling:
```powershell
.\build.ps1
# ❌ Python not found!
# → Suggests installing Python

.\release.ps1
# ⚠️  GH_TOKEN not set
# → Shows how to set it

.\setup_github.ps1
# ✓ Everything looks good!
# Ready to release: .\release.ps1
```

## Tips & Tricks

**Run any script without interaction:**
```powershell
.\release.ps1 -Version 1.0.1 -Notes "Bug fixes" -SkipBuild
# Builds version 1.0.1 with notes, then opens GitHub release page
```

**Run multiple commands:**
```powershell
.\bump_version.ps1 -Type minor; .\release.ps1
# Bump version, then release it
```

**See what a script does before running:**
```powershell
Get-Content build.ps1 | Select-String "^Write-Host" | head -20
# Shows first 20 Write-Host lines (the output)
```

**Run in parallel (for testing):**
```powershell
Start-Job { .\build.ps1 }
Start-Job { .\dev.ps1 }
Get-Job | Wait-Job
# Runs build and dev in parallel
```

## Troubleshooting

**"Scripts are disabled on this system"**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Then try again
```

**"Module not found"**
```powershell
# Make sure you're in project root:
cd C:\Users\pokem\matter
.\go.ps1
```

**Script hangs**
```powershell
# Press Ctrl+C to stop
# (Most scripts handle Ctrl+C gracefully)
```

## Next Steps

1. **First time?** Run: `.\go.ps1 setup`
2. **Want to code?** Run: `.\go.ps1 dev`
3. **Ready to release?** Run: `.\go.ps1 release`
4. **Need help?** Run: `.\go.ps1 tools`

All scripts are self-documenting - run without arguments to see help!
