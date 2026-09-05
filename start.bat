@echo off
chcp 65001 >nul
title Music Player 启动器
cd /d "%~dp0"

echo ============================================
echo          Music Player 一键启动
echo ============================================

rem 检查 Node.js 是否安装
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

rem 检查依赖是否已安装
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖，请耐心等待...
    rem 设置 Electron 二进制下载镜像（加速国内下载）
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    call npm install --registry=https://registry.npmmirror.com
    if errorlevel 1 (
        echo [错误] 依赖安装失败，请检查网络后重试
        pause
        exit /b 1
    )
)

echo [提示] 正在启动音乐播放器...
call npm start

pause
