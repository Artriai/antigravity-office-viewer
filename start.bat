@echo off
setlocal enabledelayedexpansion
title Antigravity Office Viewer - Installer

echo ========================================================
echo       Antigravity Office Viewer - One-Click Installer
echo ========================================================
echo.

set "TARGET_DIR=%LOCALAPPDATA%\Programs\antigravity"

if not exist "%TARGET_DIR%\Antigravity.exe" (
    set "TARGET_DIR=%USERPROFILE%\AppData\Local\Programs\antigravity"
)

if not exist "%TARGET_DIR%\Antigravity.exe" (
    echo [ERROR] Antigravity installation not found at default location.
    pause
    exit /b 1
)

echo [Target Directory] %TARGET_DIR%
echo.

echo [1/3] Deploying DLL Loader (winmm.dll)...
copy /y "%~dp0bin\winmm.dll" "%TARGET_DIR%\winmm.dll" >nul
if errorlevel 1 (
    echo [WARNING] winmm.dll is locked by running Antigravity.
    echo Please exit Antigravity completely and re-run start.bat.
) else (
    echo [OK] winmm.dll deployed successfully.
)

echo [2/3] Deploying core rendering engine...
if not exist "%TARGET_DIR%\office-viewer" mkdir "%TARGET_DIR%\office-viewer"
copy /y "%~dp0index.js" "%TARGET_DIR%\office-viewer\index.js" >nul
copy /y "%~dp0package.json" "%TARGET_DIR%\office-viewer\package.json" >nul

echo [3/3] Deploying Webview static assets...
xcopy /s /e /y /q "%~dp0webview" "%TARGET_DIR%\office-viewer\webview\" >nul

echo.
echo ========================================================
echo  Installation completed successfully!
echo  Just launch Antigravity normally. winmm.dll will boot
echo  the Office preview engine silently in the background.
echo ========================================================
echo.
pause
