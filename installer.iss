[Setup]
AppName=Inkdown
AppVersion=1.1.0
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
; .md file association
Root: HKCU; Subkey: "Software\Classes\.md"; ValueType: string; ValueName: ""; ValueData: "Inkdown.Markdown"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.md"; ValueType: string; ValueName: "Content Type"; ValueData: "text/markdown"
Root: HKCU; Subkey: "Software\Classes\.md"; ValueType: string; ValueName: "PerceivedType"; ValueData: "text"

; .markdown file association
Root: HKCU; Subkey: "Software\Classes\.markdown"; ValueType: string; ValueName: ""; ValueData: "Inkdown.Markdown"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.markdown"; ValueType: string; ValueName: "Content Type"; ValueData: "text/markdown"
Root: HKCU; Subkey: "Software\Classes\.markdown"; ValueType: string; ValueName: "PerceivedType"; ValueData: "text"

; .mdown file association
Root: HKCU; Subkey: "Software\Classes\.mdown"; ValueType: string; ValueName: ""; ValueData: "Inkdown.Markdown"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.mdown"; ValueType: string; ValueName: "Content Type"; ValueData: "text/markdown"

; Inkdown.Markdown class definition
Root: HKCU; Subkey: "Software\Classes\Inkdown.Markdown"; ValueType: string; ValueName: ""; ValueData: "Markdown Document"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Inkdown.Markdown"; ValueType: string; ValueName: "FriendlyTypeName"; ValueData: "Markdown Document"

; Default icon for .md files (this is what shows in Explorer)
Root: HKCU; Subkey: "Software\Classes\Inkdown.Markdown\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\Inkdown.exe"",0"

; Shell open command
Root: HKCU; Subkey: "Software\Classes\Inkdown.Markdown\shell"; ValueType: string; ValueName: ""; ValueData: "open"
Root: HKCU; Subkey: "Software\Classes\Inkdown.Markdown\shell\open"; ValueType: string; ValueName: ""; ValueData: "Open with Inkdown"
Root: HKCU; Subkey: "Software\Classes\Inkdown.Markdown\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\Inkdown.exe"" ""%1"""

; Force Windows to refresh associations
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md"; ValueType: none; Flags: deletekey
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.markdown"; ValueType: none; Flags: deletekey
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.mdown"; ValueType: none; Flags: deletekey

[Run]
Filename: "{app}\Inkdown.exe"; Description: "Launch Inkdown"; Flags: nowait postinstall skipifsilent
; Refresh icon cache after install
Filename: "ie4uinit.exe"; Parameters: "-show"; Flags: runhidden