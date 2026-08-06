[Setup]
AppName=Inkdown
AppVersion=1.0.0
DefaultDirName={autopf}\Inkdown
DefaultGroupName=Inkdown
OutputBaseFilename=Inkdown-Setup
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\Inkdown.exe
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "dist\Inkdown\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\Inkdown"; Filename: "{app}\Inkdown.exe"
Name: "{autodesktop}\Inkdown"; Filename: "{app}\Inkdown.exe"

[Registry]
Root: HKCU; Subkey: "Software\Classes\.md";        ValueType: string; ValueData: "Inkdown.Markdown"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\.markdown";  ValueType: string; ValueData: "Inkdown.Markdown"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Inkdown.Markdown";             ValueType: string; ValueData: "Markdown Document"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Inkdown.Markdown\DefaultIcon"; ValueType: string; ValueData: """{app}\Inkdown.exe"",0"
Root: HKCU; Subkey: "Software\Classes\Inkdown.Markdown\shell\open\command"; ValueType: string; ValueData: """{app}\Inkdown.exe"" ""%1"""

[Run]
Filename: "{app}\Inkdown.exe"; Description: "Launch Inkdown"; Flags: nowait postinstall skipifsilent