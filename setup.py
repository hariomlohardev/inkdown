import sys
from cx_Freeze import setup, Executable

# 1. Define what files need to be bundled inside the installer
build_exe_options = {
    "packages": ["webview"],
    "include_files": [
        "index.html",
        "src/"  # Copies your css/js folder
    ],
}

# 2. Hide the black console window on Windows (UPDATED FOR PYTHON 3.13)
base = None
if sys.platform == "win32":
    base = "gui"  # This fixed the error

# 3. Configure the executable properties
executables = [
    Executable(
        "main.py",          
        base=base,
        target_name="Inkdown.exe", 
    )
]

# 4. Turn on the MSI Installer creation options & add shortcuts
bdist_msi_options = {
    "add_to_path": False,
    "initial_target_dir": r"[ProgramFilesFolder]\Inkdown", 
}

# 5. Run the setup configuration
setup(
    name="Inkdown",
    version="1.0",
    description="Inkdown Markdown Editor",
    options={
        "build_exe": build_exe_options,
        "bdist_msi": bdist_msi_options
    },
    executables=executables
)
