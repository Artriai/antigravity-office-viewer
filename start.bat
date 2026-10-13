@echo off
setlocal enabledelayedexpansion
title Antigravity Office Viewer - 一键部署

echo ========================================================
echo       Antigravity Office Viewer - 自动部署至 Antigravity
echo ========================================================
echo.

set "TARGET_DIR=%LOCALAPPDATA%\Programs\antigravity"

if not exist "%TARGET_DIR%\Antigravity.exe" (
    echo [提示] 正在检测 Antigravity 安装目录...
    if exist "%USERPROFILE%\AppData\Local\Programs\antigravity\Antigravity.exe" (
        set "TARGET_DIR=%USERPROFILE%\AppData\Local\Programs\antigravity"
    ) else (
        echo [错误] 未找到默认安装路径，请输入 Antigravity.exe 所在目录:
        set /p "TARGET_DIR=> "
    )
)

echo [目标目录] %TARGET_DIR%
echo.

echo [1/3] 部署 DLL 加载器 (winmm.dll)...
copy /y "%~dp0bin\winmm.dll" "%TARGET_DIR%\winmm.dll" >nul
if %errorlevel% neq 0 (
    echo [提示] winmm.dll 正在被 Antigravity 占用，尝试终止进程后覆盖...
    taskkill /f /im Antigravity.exe >nul 2>&1
    timeout /t 1 /nobreak >nul
    copy /y "%~dp0bin\winmm.dll" "%TARGET_DIR%\winmm.dll" >nul
    if %errorlevel% neq 0 (
        echo [错误] 复制 winmm.dll 失败，请先手动关闭 Antigravity！
        pause
        exit /b 1
    )
)

echo [2/3] 部署核心渲染组件 (index.js)...
if not exist "%TARGET_DIR%\office-viewer" mkdir "%TARGET_DIR%\office-viewer"
copy /y "%~dp0index.js" "%TARGET_DIR%\office-viewer\index.js" >nul
copy /y "%~dp0package.json" "%TARGET_DIR%\office-viewer\package.json" >nul

echo [3/3] 部署 Webview 静态资源包...
xcopy /s /e /y /q "%~dp0webview" "%TARGET_DIR%\office-viewer\webview\" >nul

echo.
echo ========================================================
echo  部署成功！
echo  现在只需正常打开 Antigravity，DLL 将在后台自动静默拉起
echo  Office (Word / Excel / PPT) 预览引擎！
echo ========================================================
echo.
pause
