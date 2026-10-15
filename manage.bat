@echo off
setlocal
set "ACTION=%~1"
if not defined ACTION set "ACTION=status"
if /I "%ACTION%"=="status" goto run
if /I "%ACTION%"=="stop" goto run
echo Usage: manage.bat [status^|stop]
exit /b 1
:run
node "%~dp0index.js" --%ACTION%
set "MANAGE_RESULT=%ERRORLEVEL%"
if "%~1"=="" pause
exit /b %MANAGE_RESULT%
