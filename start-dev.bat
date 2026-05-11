@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Property Rental System - Development Mode
echo ============================================================
echo.

echo   Make sure MySQL and Redis are running before starting:
echo     MySQL: net start MySQL80
echo     Redis: redis-server.exe
echo.

:: Create .env if needed
if not exist .env (
    echo   Creating .env from template...
    copy .env.example .env >nul 2>nul
)

:: Create uploads dir
if not exist uploads mkdir uploads 2>nul

:: Start backend
echo   Starting backend API server (port 3001)...
echo   The backend will auto-create database and admin user
echo.
start "Backend-API" cmd /c "cd /d \"%~dp0backend\" && title Backend API :3001 && npx tsx src/index.ts"

:: Wait for backend
echo   Waiting for backend to start...
timeout /t 5 /nobreak >nul

:: Start frontend
echo.
echo ============================================================
echo   Backend  API: http://localhost:3001
echo   Frontend App: http://localhost:5173
echo   Login:        admin / admin123
echo.
echo   Keep this window open. Press Ctrl+C to stop.
echo ============================================================
echo.

cd /d "%~dp0frontend"
npx vite --host 2>&1
