# Publish Release to GitHub
# This script helps you create and publish a new release

param(
    [string]$Version = "1.0.1",
    [string]$Notes = "Bug fixes and improvements"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Govee LAN Controller Release Tool  " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if version is provided
if ($Version -eq "1.0.1") {
    Write-Host "Usage: .\publish_release.ps1 -Version 1.0.1 -Notes 'Release notes here'" -ForegroundColor Yellow
    Write-Host ""
    $Version = Read-Host "Enter version (e.g., 1.0.1)"
    if ([string]::IsNullOrEmpty($Version)) {
        Write-Host "Cancelled." -ForegroundColor Red
        exit
    }
}

$Notes = Read-Host "Enter release notes (or press Enter for default)"
if ([string]::IsNullOrEmpty($Notes)) {
    $Notes = "Bug fixes and improvements"
}

# Check for GH_TOKEN
if ([string]::IsNullOrEmpty($env:GH_TOKEN)) {
    Write-Host ""
    Write-Host "⚠️  GitHub token not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "You need to set GH_TOKEN environment variable:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "PowerShell:" -ForegroundColor Cyan
    Write-Host '  $env:GH_TOKEN = "your_github_token"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Get token from: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "Scope needed: public_repo (or repo for private repos)" -ForegroundColor Yellow
    Write-Host ""
    
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit
    }
}

Write-Host ""
Write-Host "📋 Release Plan:" -ForegroundColor Cyan
Write-Host "  Version: $Version" -ForegroundColor Green
Write-Host "  Notes: $Notes" -ForegroundColor Green
Write-Host ""

# Confirmation
$confirm = Read-Host "Continue with release? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🔧 Step 1: Updating package.json..." -ForegroundColor Cyan
# Update package.json version
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
Write-Host "✓ package.json updated to version $Version" -ForegroundColor Green

Write-Host ""
Write-Host "🔨 Step 2: Building application..." -ForegroundColor Cyan
Write-Host "This may take 5-10 minutes..." -ForegroundColor Yellow
npm run build -- --win --publish always
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build completed successfully" -ForegroundColor Green

Write-Host ""
Write-Host "📦 Step 3: Checking built files..." -ForegroundColor Cyan
$installerPath = "dist\Govee LAN Controller Setup $Version.exe"
$portablePath = "dist\Govee LAN Controller-$Version.exe"

if (Test-Path $installerPath) {
    $size = (Get-Item $installerPath).Length / 1MB
    Write-Host "✓ Found installer: $(Get-Item $installerPath | ForEach-Object BaseName) ($([math]::Round($size, 1)) MB)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Installer not found at: $installerPath" -ForegroundColor Yellow
}

if (Test-Path $portablePath) {
    $size = (Get-Item $portablePath).Length / 1MB
    Write-Host "✓ Found portable: $(Get-Item $portablePath | ForEach-Object BaseName) ($([math]::Round($size, 1)) MB)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Portable not found at: $portablePath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Release preparation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Go to: https://github.com/YOUR_USERNAME/govee-lan-controller/releases" -ForegroundColor Gray
Write-Host "  2. Click 'Create a new release'" -ForegroundColor Gray
Write-Host "  3. Tag: v$Version" -ForegroundColor Gray
Write-Host "  4. Title: Govee LAN Controller $Version" -ForegroundColor Gray
Write-Host "  5. Description: $Notes" -ForegroundColor Gray
Write-Host "  6. Upload files from dist/ folder" -ForegroundColor Gray
Write-Host "  7. Click 'Publish release'" -ForegroundColor Gray
Write-Host ""
Write-Host "To test updates:" -ForegroundColor Cyan
Write-Host "  - Run the app" -ForegroundColor Gray
Write-Host "  - Go to Help → Check for Updates" -ForegroundColor Gray
Write-Host ""
