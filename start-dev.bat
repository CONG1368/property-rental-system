@echo off
chcp 65001 >nul
title 物业租赁综合管理系统 - 开发模式

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║     物业租赁综合管理系统 - 开发模式启动中...       ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: 检查 .env 配置
if not exist .env (
    echo [警告] 未找到 .env 文件，正在从模板创建...
    copy .env.example .env >nul
)

:: 检查 MySQL
echo [检查] MySQL 数据库连接...
node -e "const m=require('mysql2/promise');m.createConnection({host:'127.0.0.1',port:3306,user:'root',password:''}).then(c=>{console.log('  [OK] MySQL 连接成功');c.end()}).catch(()=>console.log('  [警告] MySQL 连接失败，请检查MySQL服务'))" 2>nul

:: 检查 Redis
echo [检查] Redis 连接...
node -e "const r=new (require('ioredis'))({host:'127.0.0.1',port:6379,maxRetriesPerRequest:1,retryStrategy:()=>null});r.on('connect',()=>{console.log('  [OK] Redis 连接成功');r.quit()});r.on('error',()=>console.log('  [警告] Redis 连接失败，请检查Redis服务'))" 2>nul

:: 创建上传目录
if not exist uploads mkdir uploads

echo.
echo [启动] 后端服务 (端口 3001)...
start "物业租赁-后端" cmd /c "cd backend && npx tsx src/index.ts"

:: 等待后端启动
echo [等待] 等待后端服务就绪...
timeout /t 3 /nobreak >nul

echo [启动] 前端开发服务器 (端口 5173)...
cd frontend
npx vite --host
cd ..

echo.
echo 系统已停止
pause
