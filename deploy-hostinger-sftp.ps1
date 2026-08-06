# Build client and deploy to Hostinger via SFTP (port 65002).
# Prerequisites: hPanel → Advanced → SSH Access enabled
#
# Create .env.deploy in project root:
#   SFTP_HOST=your.server.ip.from.hpanel
#   SFTP_USER=u123456789
#   SFTP_PASSWORD=your-ssh-password
#   SFTP_PORT=65002
#   SFTP_REMOTE_PATH=domains/homeishome.in/public_html/

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env.deploy")) {
    Write-Host "ERROR: .env.deploy not found. Copy credentials from hPanel SSH Access." -ForegroundColor Red
    exit 1
}

Write-Host "Building client..." -ForegroundColor Cyan
npm run build:client
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (Test-Path "client/public/.htaccess") {
    Copy-Item "client/public/.htaccess" "dist/public/.htaccess" -Force
    Write-Host "Copied .htaccess" -ForegroundColor Green
}

if (Test-Path "client/.env") {
    Get-Content "client/.env" | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            Set-Item -Path "env:$name" -Value $value
        }
    }
    $configDir = "dist/public/config"
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    $firebase = @{
        apiKey            = $env:VITE_FIREBASE_API_KEY
        authDomain        = $env:VITE_FIREBASE_AUTH_DOMAIN
        projectId         = $env:VITE_FIREBASE_PROJECT_ID
        storageBucket     = $env:VITE_FIREBASE_STORAGE_BUCKET
        messagingSenderId = $env:VITE_FIREBASE_MESSAGING_SENDER_ID
        appId             = $env:VITE_FIREBASE_APP_ID
        measurementId     = $env:VITE_FIREBASE_MEASUREMENT_ID
    } | ConvertTo-Json
    Set-Content -Path "$configDir/firebase.json" -Value $firebase -Encoding UTF8
    Write-Host "Wrote config/firebase.json" -ForegroundColor Green
}

Write-Host "Uploading via SFTP..." -ForegroundColor Cyan
node scripts/deploy-hostinger-sftp.mjs
exit $LASTEXITCODE
