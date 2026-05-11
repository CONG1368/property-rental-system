@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Property Rental System v1.0.0
echo ============================================================
echo.

if not exist .env (
    copy .env.example .env >nul 2>nul
)

:: Build frontend
echo [1/2] Building frontend...
cd /d "%~dp0frontend"
call npx vite build --logLevel error 2>nul
cd /d "%~dp0"
echo   Done

:: Start services
echo [2/2] Starting services...
echo.
echo ============================================================
echo   Backend  API: http://localhost:3001
echo   Frontend App: http://localhost:5173
echo   Login:        admin / admin123
echo ============================================================
echo.

start "Backend-API" cmd /c "cd /d \"%~dp0backend\" && title Backend API :3001 && npx tsx src/index.ts"

timeout /t 5 /nobreak >nul
cd /d "%~dp0frontend"
npx vite preview --host --port 5173 2>&1
