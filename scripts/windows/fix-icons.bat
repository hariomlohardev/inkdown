@echo off
echo ==========================================
echo   Fixing .md file icons
echo ==========================================
echo.

set "APP=%ProgramFiles%\Inkdown\Inkdown.exe"
if not exist "%APP%" set "APP=%ProgramFiles(x86)%\Inkdown\Inkdown.exe"
if not exist "%APP%" (
    echo [ERROR] Could not find Inkdown.exe in Program Files.
    echo Please install Inkdown first.
    pause
    exit /b 1
)

echo Found Inkdown at: %APP%
echo.

echo [1/4] Setting .md file association...
reg add "HKCU\Software\Classes\.md" /ve /d "Inkdown.Markdown" /f >nul
reg add "HKCU\Software\Classes\.md" /v "Content Type" /d "text/markdown" /f >nul

echo [2/4] Setting .markdown file association...
reg add "HKCU\Software\Classes\.markdown" /ve /d "Inkdown.Markdown" /f >nul
reg add "HKCU\Software\Classes\.markdown" /v "Content Type" /d "text/markdown" /f >nul

echo [3/4] Setting Inkdown.Markdown class with icon...
reg add "HKCU\Software\Classes\Inkdown.Markdown" /ve /d "Markdown Document" /f >nul
reg add "HKCU\Software\Classes\Inkdown.Markdown\DefaultIcon" /ve /d "\"%APP%\",0" /f >nul
reg add "HKCU\Software\Classes\Inkdown.Markdown\shell\open\command" /ve /d "\"%APP%\" \"%%1\"" /f >nul

echo [4/4] Refreshing Windows icon cache...
ie4uinit.exe -show
taskkill /f /im explorer.exe >nul 2>&1
start explorer.exe

echo.
echo ==========================================
echo   Done! .md files should now show the
echo   Inkdown icon in File Explorer.
echo ==========================================
echo.
echo If icons still don't show, restart your computer.
echo.
pause