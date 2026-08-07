@echo off
setlocal
echo ==========================================
echo   Building Inkdown
echo ==========================================
echo.

echo [1/5] Installing build tools...
pip install pywebview pyinstaller >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies. Aborting.
    pause & exit /b 1
)

echo [2/5] Generating app icon...
if exist make_icon.py (
    python make_icon.py >nul 2>&1
)
if not exist icon.ico (
    echo [WARN] icon.ico not found - building without custom icon.
    set "ICONFLAG="
) else (
    set "ICONFLAG=--icon icon.ico"
)

echo [3/5] Fetching offline libraries...
if exist fetch_vendor.py (
    python fetch_vendor.py >nul 2>&1
)

echo [4/5] Building EXE with PyInstaller...
pyinstaller --noconfirm --onedir --windowed --name Inkdown ^
  %ICONFLAG% ^
  --version-file version_info.txt ^
  --collect-all webview ^
  --add-data "app;app" ^
  --add-data "version.txt;." ^
  main.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build FAILED. Read the errors above.
    echo The exe was NOT created.
    pause & exit /b 1
)

if not exist "dist\Inkdown\Inkdown.exe" (
    echo.
    echo [ERROR] Build finished but Inkdown.exe is missing.
    pause & exit /b 1
)

echo.
echo ==========================================
echo   BUILD SUCCESSFUL
echo ==========================================
echo Output: dist\Inkdown\Inkdown.exe
echo.
echo Next: compile installer.iss with Inno Setup, then REINSTALL.
echo.
pause
endlocal