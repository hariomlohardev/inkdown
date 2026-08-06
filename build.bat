@echo off
echo [1/5] Installing build tools...
pip install pywebview pyinstaller pillow

echo [2/5] Generating app icon...
python make_icon.py
if not exist icon.ico (
  echo ERROR: icon.ico was not created. Aborting.
  pause & exit /b 1
)

echo [3/5] Fetching offline libraries...
python fetch_vendor.py

echo [4/5] Building EXE...
pyinstaller --noconfirm --onedir --windowed --name Inkdown ^
  --icon icon.ico ^
  --version-file version_info.txt ^
  --collect-all webview ^
  --add-data "app;app" ^
  --add-data "version.txt;." ^
  main.py

echo [5/5] Build complete: dist\Inkdown\Inkdown.exe
echo Next: compile installer.iss with Inno Setup, then REINSTALL.
pause