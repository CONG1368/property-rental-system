@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Property Rental System - Database Initialization
echo ============================================================
echo.

echo Creating database if not exists...
set "NODE_PATH=%~dp0backend\node_modules;%NODE_PATH%"
node -e "var m=require('mysql2/promise');m.createConnection({host:'127.0.0.1',port:3306,user:'root',password:''}).then(async c=>{await c.query('CREATE DATABASE IF NOT EXISTS property_rental CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');console.log('  OK: database property_rental created/verified');await c.end();console.log('');console.log('Database ready! You can now start the system with start-dev.bat')}).catch(e=>{console.log('  ERROR:',e.message);console.log('');console.log('Please make sure MySQL 8.0 is running:')})"
if %errorlevel% neq 0 (
    echo   Start MySQL: net start MySQL80
    pause
    exit /b 1
)

echo.
pause
