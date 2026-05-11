@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Property Rental System - First Time Setup
echo   Wu Ye Zu Lin Zong He Guan Li Xi Tong
echo ============================================================
echo.

:: Step 1: Check Node.js
echo [1/5] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 20 LTS
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo   OK: Node.js %%i

:: Step 2: Check MySQL
echo.
echo [2/5] Checking MySQL service...
sc query MySQL80 >nul 2>nul
if %errorlevel% equ 0 (
    echo   OK: MySQL80 service found
) else (
    sc query MySQL >nul 2>nul
    if %errorlevel% equ 0 (
        echo   OK: MySQL service found
    ) else (
        echo   WARN: MySQL service not detected
        echo   Make sure MySQL 8.0 is installed and running
        echo   Download: https://dev.mysql.com/downloads/installer/
    )
)

:: Step 3: Check Redis
echo.
echo [3/5] Checking Redis...
sc query Redis >nul 2>nul
if %errorlevel% equ 0 (
    echo   OK: Redis service found
) else (
    echo   WARN: Redis service not detected
    echo   Windows download: https://github.com/tporadowski/redis/releases
)

:: Step 4: Create .env
echo.
echo [4/5] Creating .env config...
if not exist .env (
    copy .env.example .env >nul 2>nul
    echo   OK: .env file created from template
    echo   Please edit .env with your MySQL password if needed
) else (
    echo   OK: .env file already exists
)

:: Step 5: Install deps
echo.
echo [5/5] Installing dependencies...
echo   Installing frontend packages...
cd /d "%~dp0frontend"
call npm install --silent 2>nul
cd /d "%~dp0"

echo   Installing backend packages...
cd /d "%~dp0backend"
call npm install --silent 2>nul
cd /d "%~dp0"

echo.
echo ============================================================
echo   Setup complete!
echo.
echo   Quick start:
echo     Development: double-click start-dev.bat
echo     Production:  double-click start.bat
echo.
echo   Default login: admin / admin123
echo ============================================================
echo.
pause
