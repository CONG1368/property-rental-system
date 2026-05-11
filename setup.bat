@echo off
setlocal enabledelapsedion
cd /d "%~dp0"

echo ============================================================
echo   Property Rental System - Setup
echo ============================================================
echo.

:: Check Node.js
echo [1/4] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ERROR: Node.js not found
    echo   Please install Node.js 20 LTS from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo   Node.js %%i

:: Check MySQL
echo.
echo [2/4] Checking MySQL...
sc query MySQL80 >nul 2>nul
if %errorlevel% equ 0 (
    echo   MySQL80 service found
) else (
    sc query MySQL >nul 2>nul
    if %errorlevel% equ 0 (
        echo   MySQL service found
    ) else (
        echo   WARN: MySQL service not found
        echo   Install MySQL 8.0 from https://dev.mysql.com/downloads/installer/
    )
)

:: Check Redis
echo.
echo [3/4] Checking Redis...
sc query Redis >nul 2>nul
if %errorlevel% equ 0 (
    echo   Redis service found
) else (
    where redis-server >nul 2>nul
    if %errorlevel% equ 0 (
        echo   redis-server.exe found in PATH
    ) else (
        echo   WARN: Redis not found
        echo   Download from https://github.com/tporadowski/redis/releases
    )
)

:: Create .env
echo.
echo [4/4] Creating config and installing dependencies...
if not exist .env (
    copy .env.example .env >nul 2>nul
    echo   .env created from template
)

:: Install deps
echo   Installing frontend packages...
cd /d "%~dp0frontend"
call npm install 2>nul
cd /d "%~dp0"

echo   Installing backend packages...
cd /d "%~dp0backend"
call npm install 2>nul
cd /d "%~dp0"

echo.
echo ============================================================
echo   Setup complete!
echo.
echo   Before starting, make sure MySQL and Redis are running:
echo     MySQL: net start MySQL80
echo     Redis: redis-server.exe
echo.
echo   Then double-click: start-dev.bat
echo   Login: admin / admin123
echo ============================================================
echo.
pause
