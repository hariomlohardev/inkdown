# app.py
import os
import sys
import webview

def get_html_path():
    """Locates the HTML file path even after bundling into an .exe"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, 'index.html')
    return os.path.abspath('index.html')

if __name__ == '__main__':
    # Get the correct path of the HTML file
    html_file = get_html_path()
    
    # Create a clean window without a browser interface
    webview.create_window('My App Window', html_file, width=800, height=600)
    
    # Start the application window
    webview.start()
