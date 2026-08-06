import os
import sys
import webview

def get_asset_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

if __name__ == '__main__':
    # Get the correct path for your main HTML file
    html_file = get_asset_path('index.html')
    
    # Open the window pointing to your HTML file
    webview.create_window('Inkdown', html_file, width=1024, height=768)
    webview.start()
