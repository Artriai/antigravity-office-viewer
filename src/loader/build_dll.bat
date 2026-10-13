@echo off
cd /d "%~dp0"
echo Compiling winmm.dll proxy loader...
gcc -shared -o "..\..\bin\winmm.dll" "winmm_proxy.c" "winmm_proxy.def" -s -O2
if %errorlevel% equ 0 (
    echo Successfully compiled winmm.dll to bin/winmm.dll!
) else (
    echo Compilation failed! Make sure GCC (MinGW-w64) is in PATH.
)
pause
