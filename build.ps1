# build.ps1 - Universal Build Script (Windows)
[CmdletBinding()]
param(
    [switch]$SkipDeps,
    [switch]$SkipBuild,
    [switch]$Publish
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Info([string]$msg) { Write-Host $msg -ForegroundColor Cyan }
function Ok([string]$msg)   { Write-Host $msg -ForegroundColor Green }
function Warn([string]$msg) { Write-Host $msg -ForegroundColor Yellow }
function Fail([string]$msg) { Write-Host $msg -ForegroundColor Red; exit 1 }

# Always run relative to script directory
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $ROOT

try {
    # Version from package.json if possible, fallback otherwise
    $VERSION = "1.1.8"
    $pkgPath = Join-Path $ROOT "package.json"
    if (Test-Path $pkgPath) {
        try {
            $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
            if ($pkg -and $pkg.version) { $VERSION = [string]$pkg.version }
        } catch { }
    }

    Info "========================================"
    Info "  GOVEE BUILD SCRIPT - Production Build "
    Info "========================================"

    # Check tools
    Warn "Checking prerequisites..."
    foreach ($tool in @("python", "npm")) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            Fail "ERROR: $tool not found in PATH"
        }
        Ok "OK: $tool"
    }

    # Install dependencies
    if (-not $SkipDeps) {
        Warn "Installing dependencies..."

        Info "-> Python packages..."
        & python -m pip install -q -r (Join-Path $ROOT "requirements.txt")
        if ($LASTEXITCODE -ne 0) { Fail "pip install failed" }
        Ok "OK: Python deps"

        Info "-> Node packages..."
        & npm install --silent
        if ($LASTEXITCODE -ne 0) { Fail "npm install failed" }
        Ok "OK: Node deps"
    }

    # Build backend + frontend
    if (-not $SkipBuild) {
        Warn "Building Python backend..."

        $distDir  = Join-Path $ROOT "dist"
        $buildDir = Join-Path $ROOT "build"

        # Clean PyInstaller outputs
        if (Test-Path $buildDir) {
            Remove-Item $buildDir -Recurse -Force -ErrorAction SilentlyContinue
        }

        # Remove only backend artifacts (keep electron outputs)
        foreach ($p in @(
            (Join-Path $distDir "govee-backend.exe"),
            (Join-Path $distDir "govee-backend"),
            (Join-Path $distDir "govee-backend\govee-backend.exe")
        )) {
            if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue }
        }

        & python -m PyInstaller (Join-Path $ROOT "backend.spec") -y --noconfirm --clean
        if ($LASTEXITCODE -ne 0) { Fail "PyInstaller failed" }

        $backendExe = @(
            (Join-Path $distDir "govee-backend.exe"),
            (Join-Path $distDir "govee-backend\govee-backend.exe")
        ) | Where-Object { Test-Path $_ } | Select-Object -First 1

        if (-not $backendExe) { Fail "Backend exe not found in dist/" }

        # Ensure a flat copy exists for electron-builder extraResources
        $flatBackend = Join-Path $distDir "govee-backend.exe"
        if ($backendExe -ne $flatBackend) {
            Copy-Item $backendExe $flatBackend -Force
        }

        $backendSize = [math]::Round((Get-Item $backendExe).Length / 1MB, 1)
        Ok ("OK: Backend built (" + $backendSize + " MB)")

        Warn "Building Electron frontend..."
        $start = Get-Date

        & npm run build -- --win --publish never
        if ($LASTEXITCODE -ne 0) { Fail "Electron build failed" }

        $elapsed = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)
        Ok ("OK: Frontend built (" + $elapsed + " min)")
    }

    # Verify output
    Warn "Verifying output..."
    $distDir = Join-Path $ROOT "dist"
    if (-not (Test-Path $distDir)) { Fail "dist/ folder not found" }

    $outputs = Get-ChildItem $distDir -File -Filter "*.exe" |
        Where-Object { $_.Name -notmatch "^govee-backend(\.exe)?$" } |
        Sort-Object Length -Descending

    if (-not $outputs -or $outputs.Count -eq 0) {
        Fail "No Electron output .exe files found in dist/"
    }

    foreach ($f in $outputs) {
        $size = [math]::Round($f.Length / 1MB, 1)
        Ok ("OK: " + $f.Name + " (" + $size + " MB)")
    }

    # Publish (optional)
    if ($Publish) {
        Warn "Publishing to GitHub..."
        if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
            Warn "WARN: GH_TOKEN not set, skipping publish"
        } else {
            & npm run build -- --win --publish always
            if ($LASTEXITCODE -ne 0) { Fail "Publish failed" }
            Ok "OK: Published"
        }
    }

    Write-Host ""
    Ok "BUILD COMPLETE"
    Info ("Version: " + $VERSION)
    Info "Output: dist/"
}
finally {
    Pop-Location
}
