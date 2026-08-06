@echo off
echo Starting ZICA ZIMA CRM Development Environment...
echo.

echo Starting Backend Server (Port 5000)...
start "Backend Server" cmd /k "npm run dev"

echo.
echo Starting Frontend Server (Port 3000)...
start "Frontend Server" cmd /k "npx vite"

echo.
echo Both servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this window...
pause > nul 