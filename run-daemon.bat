@echo off
title Inkdown Daemon Service
echo ==========================================
echo   Inkdown Daemon Service
echo ==========================================
echo.
echo This window runs the Inkdown background service.
echo It provides:
echo   - System tray icon
echo   - Global hotkeys (Ctrl+Alt+Space, Ctrl+Alt+C)
echo   - Quick Capture widget
echo.
echo DO NOT close this window unless you want to stop the service.
echo.
echo Starting watchdog...
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

:: Check dependencies
echo Checking dependencies...
python -c "import webview, keyboard, pystray, PIL" >nul 2>&1
if errorlevel 1 (
    echo Installing missing dependencies...
    pip install pywebview keyboard pystray pillow
)

:: Start watchdog
python watchdog.py

echo.
echo Service stopped.
pause