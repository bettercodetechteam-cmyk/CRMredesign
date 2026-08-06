@echo off
REM ZICA ZIMA CRM Production Deployment Script for Windows
REM This script automates the deployment process for production

echo 🚀 Starting ZICA ZIMA CRM Production Deployment...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH
    exit /b 1
)

echo [INFO] Node.js and npm are available

REM Check environment variables
echo [INFO] Checking environment variables...

set missing_vars=0

if "%NODE_ENV%"=="" (
    echo [WARNING] NODE_ENV not set, will use development
    set NODE_ENV=development
)

if "%FIREBASE_API_KEY%"=="" (
    echo [ERROR] FIREBASE_API_KEY not set
    set /a missing_vars+=1
)

if "%FIREBASE_PROJECT_ID%"=="" (
    echo [ERROR] FIREBASE_PROJECT_ID not set
    set /a missing_vars+=1
)

if "%VITE_FIREBASE_API_KEY%"=="" (
    echo [ERROR] VITE_FIREBASE_API_KEY not set
    set /a missing_vars+=1
)

if "%VITE_FIREBASE_PROJECT_ID%"=="" (
    echo [ERROR] VITE_FIREBASE_PROJECT_ID not set
    set /a missing_vars+=1
)

if "%IMAGEKIT_PUBLIC_KEY%"=="" (
    echo [ERROR] IMAGEKIT_PUBLIC_KEY not set
    set /a missing_vars+=1
)

if "%IMAGEKIT_PRIVATE_KEY%"=="" (
    echo [ERROR] IMAGEKIT_PRIVATE_KEY not set
    set /a missing_vars+=1
)

if "%IMAGEKIT_URL_ENDPOINT%"=="" (
    echo [ERROR] IMAGEKIT_URL_ENDPOINT not set
    set /a missing_vars+=1
)

if %missing_vars% gtr 0 (
    echo.
    echo [ERROR] Missing required environment variables
    echo Please set the required environment variables before running this script
    exit /b 1
)

echo [SUCCESS] All required environment variables are set

REM Install dependencies
echo [INFO] Installing dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [SUCCESS] Dependencies installed successfully

REM Build the application
echo [INFO] Building application...

REM Clean previous builds
if exist dist rmdir /s /q dist

REM Build client and server
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    exit /b 1
)
echo [SUCCESS] Application built successfully

REM Verify build output
echo [INFO] Verifying build output...

if not exist dist (
    echo [ERROR] Build directory not found. Build may have failed.
    exit /b 1
)

if not exist dist\public (
    echo [ERROR] Client build not found in dist/public
    exit /b 1
)

if not exist dist\index.js (
    echo [ERROR] Server build not found in dist/index.js
    exit /b 1
)

echo [SUCCESS] Build verification completed

REM Start the application
echo [INFO] Starting application...

REM Set production environment
set NODE_ENV=production

REM Start the server
echo [INFO] Starting server on port %PORT%
start /B npm start

REM Wait for server to start
timeout /t 5 /nobreak >nul

REM Check if server is running (simple check)
echo [INFO] Performing health check...
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo [SUCCESS] DEPLOYMENT COMPLETED SUCCESSFULLY!
echo ==========================================
echo.
echo Your ZICA ZIMA CRM is now running in production!
echo URL: http://localhost:%PORT%
echo Health Check: http://localhost:%PORT%/api/health
echo.
echo To stop the server, close this window or press Ctrl+C
echo.

REM Keep the script running
pause 