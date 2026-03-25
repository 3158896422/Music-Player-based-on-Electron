@echo off
chcp 65001 >nul
echo ========================================
echo   Music Player 快速打包工具
echo ========================================
echo.

echo [重要] 正在准备打包环境...
echo.

echo [1/5] 检查进程...
tasklist /FI "IMAGENAME eq explorer.exe" 2>nul | find /i "explorer.exe" >nul
if %errorlevel% neq 0 (
    echo 错误：资源管理器未运行，无法继续
    pause
    exit /b 1
)

echo [2/5] 关闭资源管理器...
taskkill /F /IM "explorer.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
echo       已关闭资源管理器

echo [3/5] 清理旧的打包文件...
if exist release (
    rmdir /s /q release
    echo       已删除 release 目录
) else (
    echo       release 目录不存在，跳过
)

if exist dist (
    rmdir /s /q dist
    echo       已删除 dist 目录
) else (
    echo       dist 目录不存在，跳过
)

echo [4/5] 重启资源管理器...
start explorer.exe
timeout /t 2 /nobreak >nul
echo       资源管理器已重启

echo [5/5] 开始打包...
echo.
echo 注意：这可能需要 5-10 分钟，请耐心等待
echo.

set CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:win

echo.
echo ========================================
if %ERRORLEVEL% EQU 0 (
    echo   ✓ 打包成功完成！
    echo.
    echo   安装包位置:
    echo   release\Music Player Setup 1.0.0.exe
    echo.
    echo   你可以将这个文件分发给用户了！
) else (
    echo   ✗ 打包失败
    echo.
    echo   请检查上方的错误信息
    echo   常见问题:
    echo   1. 音乐播放器程序未关闭
    echo   2. 网络连接问题
    echo   3. 磁盘空间不足
)
echo ========================================
echo.
pause
