@echo off
chcp 65001 >nul
echo ========================================
echo   Music Player 打包工具
echo ========================================
echo.

echo [1/3] 设置环境变量...
set CSC_IDENTITY_AUTO_DISCOVERY=false

echo [2/3] 进入项目目录...
cd /d "%~dp0"

echo [3/3] 开始打包 Windows 版本...
echo.
echo 注意：这可能需要 5-10 分钟，请耐心等待
echo.

npm run build:win

echo.
echo ========================================
if %ERRORLEVEL% EQU 0 (
    echo   打包成功完成！
    echo   安装包位置：dist\
) else (
    echo   打包失败，请检查错误信息
)
echo ========================================
echo.
pause
