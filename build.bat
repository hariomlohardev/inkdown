@echo off
echo [1/4] Installing build tools...
pip install pywebview pyinstaller pillow

echo [2/4] Generating app icon...
python make_icon.py

echo [3/4] Fetching offline libraries...
python fetch_vendor.py

echo [4/4] Building EXE...
pyinstaller --noconfirm --onedir --windowed --name Inkdown ^
  --icon icon.ico ^
  --collect-all webview ^
  --add-data "app;app" ^
  --add-data "version.txt;." ^
  main.py

echo.
echo Build complete:  dist\Inkdown\Inkdown.exe
echo Next: compile installer.iss with Inno Setup.
pause