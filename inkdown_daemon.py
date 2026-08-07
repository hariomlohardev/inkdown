"""
Inkdown Daemon — Background process for:
- System tray icon
- Global hotkeys
- Quick Capture widget
"""
import os
import sys
import threading
import json
import time
from datetime import datetime

# Third-party
try:
    import webview
except ImportError:
    print("ERROR: pywebview not installed. Run: pip install pywebview")
    sys.exit(1)

try:
    import keyboard
except ImportError:
    print("ERROR: keyboard not installed. Run: pip install keyboard")
    sys.exit(1)

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError:
    print("ERROR: pystray or Pillow not installed. Run: pip install pystray pillow")
    sys.exit(1)


# ---------- Config ----------
APP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app')
DATA_DIR = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'Inkdown')
CAPTURES_FILE = os.path.join(DATA_DIR, 'quick-captures.json')
QUICK_NOTES_FILE = os.path.join(DATA_DIR, 'quick-notes.md')
HOTKEY_OPEN = 'ctrl+alt+space'
HOTKEY_CAPTURE = 'ctrl+alt+c'

capture_window = None
main_window = None


# ---------- Capture API ----------
class CaptureApi:
    def save_capture(self, text):
        """Save captured text to Quick Notes file."""
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
            entry = f"\n\n## {timestamp}\n\n{text}\n\n---\n"

            with open(QUICK_NOTES_FILE, 'a', encoding='utf-8') as f:
                f.write(entry)

            # Also save to JSON for the main app to import
            captures = []
            if os.path.exists(CAPTURES_FILE):
                try:
                    with open(CAPTURES_FILE, 'r', encoding='utf-8') as f:
                        captures = json.load(f)
                except:
                    captures = []

            captures.append({'text': text, 'at': timestamp})
            with open(CAPTURES_FILE, 'w', encoding='utf-8') as f:
                json.dump(captures, f, ensure_ascii=False)

            return True
        except Exception as e:
            print(f"Capture save error: {e}")
            return False

    def close_window(self):
        global capture_window
        if capture_window:
            capture_window.destroy()
            capture_window = None


# ---------- Quick Capture Window ----------
def open_capture():
    global capture_window
    if capture_window:
        try:
            capture_window.show()
            return
        except:
            capture_window = None

    capture_path = os.path.join(APP_DIR, 'capture.html')
    if not os.path.exists(capture_path):
        print(f"ERROR: {capture_path} not found")
        return

    capture_window = webview.create_window(
        'Quick Capture',
        capture_path,
        width=440,
        height=300,
        resizable=False,
        fullscreen=False,
        on_top=True,
        frameless=True,
        background_color='#1a1a2e',
        js_api=CaptureApi()
    )


# ---------- Main App ----------
def open_main_app():
    """Launch or focus the main Inkdown app."""
    main_py = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'main.py')
    if os.path.exists(main_py):
        os.system(f'start "" python "{main_py}"')


# ---------- Hotkeys ----------
def setup_hotkeys():
    keyboard.add_hotkey(HOTKEY_OPEN, open_main_app)
    keyboard.add_hotkey(HOTKEY_CAPTURE, open_capture)
    print(f"Hotkeys registered: {HOTKEY_OPEN} (open), {HOTKEY_CAPTURE} (capture)")


# ---------- System Tray ----------
def create_tray_icon():
    # Create a simple icon
    image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    # Pink rounded square
    draw.rounded_rectangle([8, 8, 56, 56], radius=12, fill=(255, 46, 136, 255))
    # White "I" letter
    draw.rectangle([28, 20, 36, 44], fill=(255, 255, 255, 255))

    def on_open(icon, item):
        open_main_app()

    def on_capture(icon, item):
        open_capture()

    def on_exit(icon, item):
        icon.stop()
        keyboard.unhook_all()
        os._exit(0)

    menu = pystray.Menu(
        pystray.MenuItem('Open Inkdown', on_open, default=True),
        pystray.MenuItem('Quick Capture', on_capture),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('Exit', on_exit),
    )

    icon = pystray.Icon('Inkdown', image, 'Inkdown', menu)
    return icon


# ---------- Main ----------
def main():
    print("=" * 50)
    print("  Inkdown Daemon Starting")
    print("=" * 50)
    print(f"  Data dir: {DATA_DIR}")
    print(f"  App dir:  {APP_DIR}")
    print(f"  Hotkeys:  {HOTKEY_OPEN}, {HOTKEY_CAPTURE}")
    print("=" * 50)

    os.makedirs(DATA_DIR, exist_ok=True)
    setup_hotkeys()

    icon = create_tray_icon()
    print("Tray icon created. Running in background...")
    icon.run()


if __name__ == '__main__':
    main()