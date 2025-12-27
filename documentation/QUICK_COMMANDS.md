# Quick Command Reference

## One-Liner Commands

```powershell
# Setup (first time)
.\go.ps1 setup

# Development
.\go.ps1 dev

# Building
.\go.ps1 build

# Releasing
.\go.ps1 release
.\go.ps1 bump

# Testing
.\go.ps1 test

# Configuration
.\go.ps1 config

# Interactive menu
.\go.ps1 tools
```

## Script Purpose (Quick Lookup)

| Command | Does | When to Use |
|---------|------|-----------|
| `.\go.ps1` | Shows this menu | Need help |
| `.\go.ps1 setup` | GitHub setup wizard | First time only |
| `.\go.ps1 dev` | Start dev server | Testing locally |
| `.\go.ps1 build` | Build installers | Before release |
| `.\go.ps1 release` | Full release pipeline | Publishing update |
| `.\go.ps1 bump` | Version bump | Before release |
| `.\go.ps1 test` | Check for updates | Testing update system |
| `.\go.ps1 config` | Validate setup | Troubleshooting |
| `.\go.ps1 tools` | Interactive menu | Want GUI |

## Typical Workflows

### First Time (30 min)
```powershell
.\go.ps1 setup       # Setup GitHub
.\go.ps1 dev         # Test it works
.\go.ps1 build       # Build installers
.\go.ps1 release     # Make first release
```

### Make a Release (5 min)
```powershell
.\go.ps1 bump        # Bump version
.\go.ps1 release     # Release it
```

### Just Code (Daily)
```powershell
.\go.ps1 dev         # Start dev server
# (code, test, repeat)
# Ctrl+C to stop
```

## Advanced Usage

### Specify Version & Notes
```powershell
.\release.ps1 -Version 1.0.1 -Notes "Bug fixes"
```

### Bump to Minor Version
```powershell
.\bump_version.ps1 -Type minor
```

### Skip Build (Use Existing)
```powershell
.\release.ps1 -SkipBuild
```

### Just Build (No Release)
```powershell
.\build.ps1
# Creates dist/*.exe files
```

## Troubleshooting Commands

```powershell
# Check if everything is configured
.\go.ps1 config

# Test if updates work
.\go.ps1 test

# See all available tools
.\go.ps1 tools

# Full interactive menu
.\tools.ps1
```

## Settings

### Set GitHub Token
```powershell
$env:GH_TOKEN = "ghp_xxxxxxxxxxxxxxxx"
```

### Or Save Permanently
```powershell
[Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_...", "User")
# Restart terminal after
```

## File Locations

| What | Where |
|------|-------|
| Installers | `dist/` |
| Built app | `dist/` |
| Settings | `%APPDATA%/Govee LAN Controller/` |
| Temp files | `build/` |

## Common Issues

### "Scripts disabled"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Command not found"
```powershell
# Make sure you're in project directory
cd C:\Users\pokem\matter
```

### "GH_TOKEN not set"
```powershell
$env:GH_TOKEN = "your_token_here"
```

## Getting Help

```powershell
# From any script:
.\setup_github.ps1        # Shows status & recommendations
.\test_update.ps1         # Shows GitHub status
.\build.ps1              # Shows build status

# Or see full guide:
# SCRIPTS_GUIDE.md       # Detailed documentation
```

---

**TL;DR**: Run `.\go.ps1` to see all commands! 🚀
