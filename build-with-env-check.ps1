# Build script with environment variable check
Write-Host "🔍 Checking Firebase environment variables..." -ForegroundColor Cyan

$requiredVars = @(
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID"
)

$missing = @()
foreach ($var in $requiredVars) {
    $value = [Environment]::GetEnvironmentVariable($var, "Process")
    if (-not $value -or $value -eq "") {
        $missing += $var
    } else {
        Write-Host "✅ $var is set" -ForegroundColor Green
    }
}

if ($missing.Count -gt 0) {
    Write-Host "`n❌ Missing required environment variables:" -ForegroundColor Red
    foreach ($var in $missing) {
        Write-Host "   - $var" -ForegroundColor Yellow
    }
    Write-Host "`n📝 To fix:" -ForegroundColor Yellow
    Write-Host "   1. Create a .env file in the project root" -ForegroundColor Yellow
    Write-Host "   2. Add all VITE_FIREBASE_* variables" -ForegroundColor Yellow
    Write-Host "   3. Or set them as environment variables before building" -ForegroundColor Yellow
    Write-Host "`n⚠️  Building without Firebase config will cause errors in production!" -ForegroundColor Red
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Build cancelled." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "`n✅ All Firebase environment variables are set!" -ForegroundColor Green
}

Write-Host "`n🔨 Building client..." -ForegroundColor Cyan
npm run build:client

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Build completed successfully!" -ForegroundColor Green
    Write-Host "📦 Built files are in: dist/public" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Build failed!" -ForegroundColor Red
    exit 1
}

