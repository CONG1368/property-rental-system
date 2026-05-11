@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Property Rental System v1.0.0
echo ============================================================
echo.

:: Check .env
if not exist .env (
    echo [WARN] .env file not found, creating from template...
    copy .env.example .env >nul 2>nul
)

:: Check MySQL
echo [1/4] Checking MySQL...
set "NODE_PATH=%~dp0backend\node_modules;%NODE_PATH%"
node -e "try{var m=require('mysql2/promise');m.createConnection({host:'127.0.0.1',port:3306,user:'root',password:''}).then(c=>{console.log('  OK: MySQL connected');c.end()}).catch(e=>{console.log('  ERROR: MySQL not running');process.exit(1)})}catch(e){console.log('  ERROR: mysql2 not installed, run setup.bat first');process.exit(1)}" 2>nul
if %errorlevel% neq 0 (
    echo   Please start MySQL service first: net start MySQL80
    echo   Or run setup.bat to install dependencies
    pause
    exit /b 1
)

:: Check Redis
echo [2/4] Checking Redis...
node -e "try{var r=new (require('ioredis'))({host:'127.0.0.1',port:6379,maxRetriesPerRequest:1,lazyConnect:true,retryStrategy:()=>null});r.connect().then(()=>{console.log('  OK: Redis connected');r.quit()}).catch(e=>{console.log('  ERROR: Redis not running');process.exit(1)})}catch(e){console.log('  ERROR: ioredis not installed, run setup.bat first');process.exit(1)}" 2>nul
if %errorlevel% neq 0 (
    echo   Please start Redis first: redis-server.exe
    pause
    exit /b 1
)

:: Build frontend
echo [3/4] Building frontend...
cd /d "%~dp0frontend"
call npx vite build --logLevel error 2>nul
cd /d "%~dp0"
echo   OK: Frontend build complete

:: Start services
echo [4/4] Starting services...
echo.
echo ============================================================
echo   Backend API:  http://localhost:3001
echo   Frontend App: http://localhost:5173
echo   Login:        admin / admin123
echo ============================================================
echo.

start "Backend-API" cmd /c "cd /d \"%~dp0backend\" && title Backend API Server && node -e \"require('./dist/index.js')\" 2>nul || npx tsx src/index.ts"

:: Wait, then start frontend
timeout /t 3 /nobreak >nul
cd /d "%~dp0frontend"
npx vite preview --host --port 5173
