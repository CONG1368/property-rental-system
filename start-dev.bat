@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Property Rental System - Development Mode
echo ============================================================
echo.

:: Check .env
if not exist .env (
    echo [WARN] .env file not found, creating from template...
    copy .env.example .env >nul 2>nul
)

:: Check MySQL with proper path
echo [Check] Testing MySQL connection...
set "NODE_PATH=%~dp0backend\node_modules;%NODE_PATH%"
node -e "var m;try{m=require('mysql2/promise')}catch(e){console.log('  MySQL2 not installed yet, skipping check');process.exit(0)};m.createConnection({host:'127.0.0.1',port:3306,user:'root',password:''}).then(c=>{console.log('  OK: MySQL connected');c.end()}).catch(e=>console.log('  WARN: MySQL not reachable - please start MySQL service'))" 2>nul

:: Check Redis
echo [Check] Testing Redis connection...
node -e "try{var r=new (require('ioredis'))({host:'127.0.0.1',port:6379,maxRetriesPerRequest:1,lazyConnect:true,retryStrategy:()=>null});r.connect().then(()=>{console.log('  OK: Redis connected');r.quit()}).catch(()=>console.log('  WARN: Redis not reachable - please start redis-server.exe'))}catch(e){console.log('  Redis module not installed yet, skipping')}" 2>nul

:: Create uploads dir
if not exist uploads mkdir uploads 2>nul

echo.
echo [Start] Launching backend server on port 3001...
start "Backend-API" cmd /c "cd /d \"%~dp0backend\" && title Backend API Server && npx tsx src/index.ts"

:: Wait for backend
echo [Wait] Waiting for backend to be ready...
timeout /t 4 /nobreak >nul

echo [Start] Launching frontend dev server on port 5173...
echo.
echo ============================================================
echo   Backend API:  http://localhost:3001
echo   Frontend App: http://localhost:5173
echo   Login:        admin / admin123
echo   Press Ctrl+C to stop
echo ============================================================
echo.

cd /d "%~dp0frontend"
npx vite --host
