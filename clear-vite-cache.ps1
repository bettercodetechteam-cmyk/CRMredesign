# Clear Vite cache script
Write-Host "🧹 Clearing Vite cache..." -ForegroundColor Yellow

# Remove Vite cache directories
$cachePaths = @(
    "node_modules\.vite",
    "client\node_modules\.vite",
    ".vite"
)

foreach ($path in $cachePaths) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
        Write-Host "✅ Removed: $path" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Not found: $path" -ForegroundColor Gray
    }
}

Write-Host "`n✅ Vite cache cleared! Restart your dev server with: npm run dev" -ForegroundColor Green

