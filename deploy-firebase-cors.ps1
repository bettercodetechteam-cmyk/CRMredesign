Write-Host "1. Deploying Storage Rules..." -ForegroundColor Cyan
firebase deploy --only storage

Write-Host "2. Setting CORS configuration..." -ForegroundColor Cyan
# Testing Bucket
Write-Host "Targeting: zica-zima-testing.firebasestorage.app"
gsutil cors set firebase-storage-cors.json gs://zica-zima-testing.firebasestorage.app

# Production Bucket
Write-Host "Targeting: zica-zima-crm.firebasestorage.app"
gsutil cors set firebase-storage-cors.json gs://zica-zima-crm.firebasestorage.app

Write-Host "Process completed!" -ForegroundColor Green
Read-Host "Press Enter to exit" 