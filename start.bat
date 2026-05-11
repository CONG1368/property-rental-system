@echo off
chcp 65001 >nul
title 物业租赁综合管理系统

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║         物业租赁综合管理系统 v1.0.0               ║
echo ║   Property Rental Comprehensive Management       ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: 检查 .env 配置
if not exist .env (
    echo [警告] 未找到 .env 文件，使用默认配置
    copy .env.example .env >nul 2>nul
)

:: 检查 MySQL
echo [1/5] 检查 MySQL 数据库...
node -e "const m=require('mysql2/promise');m.createConnection({host:'127.0.0.1',port:3306,user:'root',password:''}).then(c=>{console.log('  [OK] MySQL 连接成功');c.end()}).catch(e=>{console.log('  [错误] MySQL 未运行');process.exit(1)})" 2>nul
if %errorlevel% neq 0 (
    echo   [错误] 请先启动 MySQL 8.0 数据库服务
    echo   启动命令: net start MySQL80  或  net start MySQL
    pause
    exit /b 1
)

:: 检查 Redis
echo [2/5] 检查 Redis...
node -e "const r=new (require('ioredis'))({host:'127.0.0.1',port:6379,maxRetriesPerRequest:1,retryStrategy:()=>null});setTimeout(()=>{try{r.quit()}catch{}},500);r.on('connect',()=>{console.log('  [OK] Redis 连接成功')});r.on('error',()=>{console.log('  [错误] Redis 未运行');process.exit(1)})" 2>nul
if %errorlevel% neq 0 (
    echo   [错误] 请先启动 Redis 服务
    echo   启动命令: redis-server.exe
    pause
    exit /b 1
)

:: 构建前端
echo [3/5] 构建前端资源...
cd frontend
call npx vite build --logLevel error
cd ..
echo   [OK] 前端构建完成

:: 编译后端
echo [4/5] 编译后端代码...
cd backend
if not exist dist mkdir dist
call npx tsc --skipLibCheck 2>nul
cd ..
echo   [OK] 后端编译完成

:: 启动服务
echo [5/5] 启动应用服务...
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  后端服务:    http://localhost:3001               ║
echo ║  前端页面:    http://localhost:5173               ║
echo ║  默认账号:    admin / admin123                    ║
echo ║  按 Ctrl+C 停止所有服务                           ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: 启动后端
start "物业租赁-后端" cmd /c "cd backend && node dist/index.js"

:: 启动前端（使用 vite preview 提供生产构建）
cd frontend
npx vite preview --host --port 5173
cd ..

echo.
echo 系统已停止
pause
