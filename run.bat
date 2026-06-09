@echo off
cd /d "%~dp0"

set "PYEXE=%~dp0python\python.exe"
if not exist "%PYEXE%" (
    python --version >nul 2>&1
    if not errorlevel 1 (
        set "PYEXE=python"
    ) else (
        set "PYEXE=C:\Users\Administrator\.workbuddy\binaries\python\versions\3.13.12\python.exe"
    )
)

echo Starting ComfyUI-API-Modelscope...
echo Visit: http://127.0.0.1:3000/
echo Press Ctrl+C to stop.
echo.

start /b cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:3000/"
"%PYEXE%" main.py

echo.
echo Server stopped.
pause
