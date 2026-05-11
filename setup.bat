@echo off
chcp 65001 >nul
title 物业租赁综合管理系统 - 首次安装

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║       物业租赁综合管理系统 - 首次安装向导         ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: 检查 Node.js
echo [1/5] 检查 Node.js 环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 20 LTS
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo   [OK] Node.js 已安装:
node -v

:: 检查 MySQL
echo.
echo [2/5] 检查 MySQL 服务...
sc query MySQL80 >nul 2>nul
if %errorlevel% equ 0 (
    echo   [OK] MySQL80 服务已安装
) else (
    sc query MySQL >nul 2>nul
    if %errorlevel% equ 0 (
        echo   [OK] MySQL 服务已安装
    ) else (
        echo   [警告] 未检测到 MySQL 服务，请确保 MySQL 8.0 已安装并运行
        echo   下载地址: https://dev.mysql.com/downloads/installer/
    )
)

:: 检查 Redis
echo.
echo [3/5] 检查 Redis 服务...
sc query Redis >nul 2>nul
if %errorlevel% equ 0 (
    echo   [OK] Redis 服务已安装
) else (
    echo   [警告] 未检测到 Redis 服务，请确保 Redis 已安装并运行
    echo   Windows 下载: https://github.com/tporadowski/redis/releases
)

:: 复制环境配置
echo.
echo [4/5] 配置环境变量...
if not exist .env (
    copy .env.example .env >nul
    echo   [OK] 已创建 .env 文件，请根据需要修改配置
) else (
    echo   [OK] .env 文件已存在
)

:: 安装依赖
echo.
echo [5/5] 安装项目依赖...
echo   安装前端依赖...
cd frontend
call npm install --silent
cd ..
echo   安装后端依赖...
cd backend
call npm install --silent
cd ..

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                   安装完成！                      ║
echo ╠══════════════════════════════════════════════════╣
echo ║  启动方式:                                        ║
echo ║    开发模式: start-dev.bat                         ║
echo ║    生产模式: start.bat                             ║
echo ║                                                   ║
echo ║  默认管理员账号: admin / admin123                  ║
echo ╚══════════════════════════════════════════════════╝
echo.
pause
