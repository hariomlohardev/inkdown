"""
Inkdown Daemon - No Global Hotkeys
Just tray icon + manual Quick Capture from tray menu
"""
import os
import sys
import subprocess
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError:
    print("ERROR: 'pystray' or 'Pillow' not installed. Run: pip install pystray pillow")
    sys.exit(1)

# Configuration
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = Path(os.environ.get('APPDATA', os.path.expanduser('~'))) / 'Inkdown'
HEARTBEAT_FILE = DATA_DIR / 'daemon-heartbeat.txt'
CRASH_LOG = DATA_DIR / 'daemon-crash.log'

running = True


def log(msg, level='INFO'):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_line = f"[{timestamp}] {level}: {msg}"
    print(log_line)
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(CRASH_LOG, 'a', encoding='utf-8') as f:
            f.write(log_line + '\n')
    except:
        pass


def write_heartbeat():
    while running:
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            HEARTBEAT_FILE.write_text(datetime.now().isoformat())
        except:
            pass
        time.sleep(30)


def open_main_app():
    """Launch the main Inkdown app."""
    try:
        main_py = SCRIPT_DIR / 'main.py'
        if main_py.exists():
            log("Launching main app...")
            subprocess.Popen(
                [sys.executable, str(main_py)],
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )
        else:
            log(f"main.py not found: {main_py}", 'ERROR')
    except Exception as e:
        log(f"Error launching main app: {e}", 'ERROR')


def open_capture():
    """Launch Quick Capture window."""
    try:
        main_py = SCRIPT_DIR / 'main.py'
        if main_py.exists():
            log("Launching Quick Capture...")
            subprocess.Popen(
                [sys.executable, str(main_py), '--capture'],
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )
        else:
            log(f"main.py not found: {main_py}", 'ERROR')
    except Exception as e:
        log(f"Error launching capture: {e}", 'ERROR')


def create_tray_icon():
    """Create system tray icon."""
    image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([8, 8, 56, 56], radius=12, fill=(255, 46, 136, 255))
    draw.rectangle([28, 20, 36, 44], fill=(255, 255, 255, 255))

    menu = pystray.Menu(
        pystray.MenuItem('Open Inkdown', lambda icon, item: open_main_app(), default=True),
        pystray.MenuItem('Quick Capture', lambda icon, item: open_capture()),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('Exit', lambda icon, item: exit_daemon(icon)),
    )

    return pystray.Icon('Inkdown', image, 'Inkdown Daemon', menu)


def exit_daemon(icon):
    global running
    running = False
    icon.stop()
    log("Daemon exiting...")


def main():
    global running

    log("=" * 50)
    log("Inkdown Daemon Starting (No Hotkeys)")
    log(f"Script dir: {SCRIPT_DIR}")
    log(f"Data dir: {DATA_DIR}")
    log("=" * 50)

    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Write initial heartbeat
    try:
        HEARTBEAT_FILE.write_text(datetime.now().isoformat())
    except:
        pass

    # NO HOTKEYS - removed keyboard import and setup_hotkeys()

    # Start heartbeat thread
    hb_thread = threading.Thread(target=write_heartbeat, daemon=True)
    hb_thread.start()

    # Create and run tray icon
    log("Creating tray icon...")
    icon = create_tray_icon()

    log("Daemon running. Tray icon active. (No global hotkeys)")

    try:
        icon.run()
    except KeyboardInterrupt:
        log("Interrupted by user")
    except Exception as e:
        log(f"Daemon crashed: {e}", 'ERROR')
        log(traceback.format_exc(), 'ERROR')
    finally:
        running = False
        log("Daemon stopped")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        log(f"FATAL: {e}", 'FATAL')
        log(traceback.format_exc(), 'FATAL')
        sys.exit(1)