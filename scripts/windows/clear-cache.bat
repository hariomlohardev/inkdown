@echo off
echo Clearing WebView cache...
rmdir /s /q "%APPDATA%\Inkdown\webview" 2>nul
echo Done! Run python main.py now.
pause
