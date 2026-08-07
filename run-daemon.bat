@echo off
echo Starting Inkdown Daemon (tray + hotkeys + quick capture)...
echo.
echo Hotkeys:
echo   Ctrl+Alt+Space  = Open Inkdown
echo   Ctrl+Alt+C      = Quick Capture
echo.
echo The daemon runs in the system tray. Right-click the tray icon to exit.
echo.
python inkdown_daemon.py
pause