@echo off
echo ╔═══════════════════════════════════════════════╗
echo ║   Speed Violation Detector - Starting...      ║
echo ╚═══════════════════════════════════════════════╝
echo.

:: Start ML service
echo [1/3] Starting ML prediction service...
cd /d "%~dp0backend\ml"
start "ML-Service" cmd /c "python predict.py"
timeout /t 3 /nobreak >nul

:: Start Backend
echo [2/3] Starting backend server...
cd /d "%~dp0backend"
start "Backend" cmd /c "node server.js"
timeout /t 2 /nobreak >nul

:: Start Frontend
echo [3/3] Starting frontend dev server...
cd /d "%~dp0frontend"
start "Frontend" cmd /c "npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ╔═══════════════════════════════════════════════╗
echo ║   All services started!                       ║
echo ║   Frontend: http://localhost:5173             ║
echo ║   Backend:  http://localhost:3001             ║
echo ║   ML Model: http://localhost:5000             ║
echo ╚═══════════════════════════════════════════════╝
echo.
echo Press any key to stop all services...
pause >nul

:: Kill all services
taskkill /FI "WINDOWTITLE eq ML-Service*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend*" /F >nul 2>&1
echo All services stopped.
