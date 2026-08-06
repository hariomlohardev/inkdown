[Setup]
AppName=Inkdown
AppVersion=1.0.0
DefaultDirName={autopf}\Inkdown
DefaultGroupName=Inkdown
OutputBaseFilename=Inkdown-Setup
SetupIconFile=icon.ico
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "dist\Inkdown\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\Inkdown"; Filename: "{app}\Inkdown.exe"
Name: "{autodesktop}\Inkdown"; Filename: "{app}\Inkdown.exe"

[Run]
Filename: "{app}\Inkdown.exe"; Description: "Launch Inkdown"; Flags: nowait postinstall skipifsilent