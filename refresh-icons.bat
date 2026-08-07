@echo off
echo Refreshing Windows icon cache...
echo.

ie4uinit.exe -show
ie4uinit.exe -ClearIconCache

echo Clearing thumbnail cache...
del /a /q "%LocalAppData%\IconCache.db" >nul 2>&1
del /a /q "%LocalAppData%\Microsoft\Windows\Explorer\iconcache*.db" >nul 2>&1
del /a /q "%LocalAppData%\Microsoft\Windows\Explorer\thumbcache*.db" >nul 2>&1

echo Restarting Explorer...
taskkill /f /im explorer.exe >nul 2>&1
timeout /t 2 /nobreak >nul
start explorer.exe

echo.
echo Done! If icons still don't show, restart your computer.
pause