@echo off
echo Deploying Firebase Storage CORS configuration...

REM Deploy storage rules
firebase deploy --only storage

REM Set CORS configuration for Firebase Storage
REM Note: Use the correct storage bucket from your Firebase config
gsutil cors set firebase-storage-cors.json gs://zica-zima-crm.firebasestorage.app

echo Firebase Storage CORS configuration deployed successfully!
pause 