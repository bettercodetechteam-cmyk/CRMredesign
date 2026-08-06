# Script to verify .env file and rebuild
Write-Host "🔍 Checking .env file..." -ForegroundColor Cyan

if (Test-Path "client\.env") {
    Write-Host "✅ .env file found in client/ directory" -ForegroundColor Green
    
    $content = Get-Content "client\.env" -Raw
    
    # Check for duplicates
    $apiKeyMatches = [regex]::Matches($content, "VITE_FIREBASE_API_KEY")
    if ($apiKeyMatches.Count -gt 1) {
        Write-Host "⚠️  WARNING: Found $($apiKeyMatches.Count) VITE_FIREBASE_API_KEY entries (duplicate detected)" -ForegroundColor Yellow
        Write-Host "   Please remove duplicates from client/.env file" -ForegroundColor Yellow
    }
    
    # Check required variables
    $required = @(
        "VITE_FIREBASE_API_KEY",
        "VITE_FIREBASE_AUTH_DOMAIN", 
        "VITE_FIREBASE_PROJECT_ID",
        "VITE_FIREBASE_STORAGE_BUCKET",
        "VITE_FIREBASE_MESSAGING_SENDER_ID",
        "VITE_FIREBASE_APP_ID"
    )
    
    $missing = @()
    foreach ($var in $required) {
        if ($content -notmatch $var) {
            $missing += $var
        }
    }
    
    if ($missing.Count -eq 0) {
        Write-Host "✅ All required Firebase variables present" -ForegroundColor Green
        Write-Host "`n🔨 Rebuilding with environment variables..." -ForegroundColor Cyan
        npm run build:client
    } else {
        Write-Host "❌ Missing required variables: $($missing -join ', ')" -ForegroundColor Red
        Write-Host "Please add these to client/.env file" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ .env file not found in client/ directory" -ForegroundColor Red
    Write-Host "`n📝 Please:" -ForegroundColor Yellow
    Write-Host "   1. Save the .env file in VS Code (Ctrl+S)" -ForegroundColor Yellow
    Write-Host "   2. Ensure it's saved as: client/.env" -ForegroundColor Yellow
    Write-Host "   3. Run this script again" -ForegroundColor Yellow
}















