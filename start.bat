@echo off
setlocal enabledelayedexpansion
title Antigravity Office Viewer - Installer

echo ========================================================
echo       Antigravity Office Viewer - One-Click Installer
echo ========================================================
echo.

echo [Info] Detecting Antigravity installation path...
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$p = (Get-Process Antigravity -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path); if (-not $p) { $reg = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Antigravity \d' } | Select-Object -First 1; if ($reg -and $reg.DisplayIcon) { $p = ($reg.DisplayIcon -split ',')[0] } }; if (-not $p -and (Test-Path \"$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe\")) { $p = \"$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe\" }; if ($p) { Split-Path -Parent $p }"`) do (
    set "TARGET_DIR=%%I"
)

if not defined TARGET_DIR (
    set "TARGET_DIR=%LOCALAPPDATA%\Programs\antigravity"
)

if not exist "!TARGET_DIR!\Antigravity.exe" (
    echo [WARNING] Could not automatically locate Antigravity.
    echo Please drag and drop your Antigravity folder or Antigravity.exe here:
    set /p "USER_INPUT=> "
    set "USER_INPUT=!USER_INPUT:"=!"
    if exist "!USER_INPUT!\Antigravity.exe" (
        set "TARGET_DIR=!USER_INPUT!"
    ) else if exist "!USER_INPUT!" (
        for %%F in ("!USER_INPUT!") do set "TARGET_DIR=%%~dpF"
        set "TARGET_DIR=!TARGET_DIR:~0,-1!"
    )
)

if not exist "!TARGET_DIR!\Antigravity.exe" (
    echo [ERROR] Antigravity.exe not found. Installation cancelled.
    pause
    exit /b 1
)

echo [Found] Antigravity at: !TARGET_DIR!
echo.

echo [1/3] Deploying DLL Loader (winmm.dll)...
copy /y "%~dp0bin\winmm.dll" "!TARGET_DIR!\winmm.dll" >nul
if errorlevel 1 (
    echo [WARNING] winmm.dll is currently locked by a running Antigravity process.
    echo Please close Antigravity completely and re-run start.bat to update the DLL.
) else (
    echo [OK] winmm.dll deployed successfully.
)

echo [2/3] Deploying core rendering engine...
if not exist "!TARGET_DIR!\office-viewer" mkdir "!TARGET_DIR!\office-viewer"
copy /y "%~dp0index.js" "!TARGET_DIR!\office-viewer\index.js" >nul
copy /y "%~dp0package.json" "!TARGET_DIR!\office-viewer\package.json" >nul

echo [3/3] Deploying Webview static assets...
xcopy /s /e /y /q "%~dp0webview" "!TARGET_DIR!\office-viewer\webview\" >nul

echo.
echo ========================================================
echo  Installation completed successfully!
echo  Just launch Antigravity normally. winmm.dll will boot
echo  the Office preview engine silently in the background.
echo ========================================================
echo.
pause
