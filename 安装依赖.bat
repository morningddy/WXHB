@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Install Dependencies
echo ============================================
echo.

set "PYDIR=%~dp0python"
set "PYEXE=%PYDIR%\python.exe"

REM === Check bundled Python ===
if exist "%PYEXE%" (
    echo [OK] Found bundled Python.
    goto :install_deps
)

echo [INFO] Bundled Python not found, downloading portable Python...
echo.

REM === Call PowerShell to setup Python ===
if not exist "%~dp0setup_python.ps1" (
    echo [ERROR] setup_python.ps1 not found!
    pause
    exit /b 1
)

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0setup_python.ps1"

if not exist "%PYEXE%" (
    echo.
    echo [ERROR] Python setup failed.
    echo [Manual] Download Python embeddable from https://www.python.org/downloads/windows/
    echo   and extract to python/ folder.
    echo.
    pause
    exit /b 1
)

:install_deps
set "PYEXE=%PYDIR%\python.exe"
echo.
echo [INFO] Installing dependencies...
"%PYEXE%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies. Check network.
    pause
    exit /b 1
)

echo.
echo [INFO] Installing uvicorn[standard] (WebSocket)...
"%PYEXE%" -m pip install "uvicorn[standard]"

echo.
echo ============================================
echo   Done! Run run.bat to start.
echo ============================================
pause
