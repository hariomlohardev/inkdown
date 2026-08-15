"""
Quick Capture Window - Runs as a separate process.
Launched by inkdown_daemon.py when the hotkey is triggered.
"""
import os
import sys
import json
import traceback
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import webview
except ImportError:
    print("ERROR: pywebview not installed")
    sys.exit(1)

# Configuration
DATA_DIR = Path(os.environ.get('APPDATA', os.path.expanduser('~'))) / 'Inkdown'
CAPTURES_FILE = DATA_DIR / 'quick-captures.json'
# capture.html lives at app/capture.html (repo root → app/)
_HERE = Path(__file__).resolve().parent
REPO_ROOT = _HERE.parent.parent
APP_DIR = REPO_ROOT / 'app'
CAPTURE_HTML = APP_DIR / 'capture.html'
# Fallback for frozen/legacy layout
if not CAPTURE_HTML.exists():
    CAPTURE_HTML = _HERE / 'app' / 'capture.html'


class CaptureAPI:
    """API exposed to the capture window's JavaScript."""

    def save_capture(self, text):
        """Save captured text to the captures file."""
        try:
            if not text or len(text.strip()) < 1:
                return {'success': False, 'error': 'Empty capture'}

            # Truncate if too long
            if len(text) > 5000:
                text = text[:5000]

            # Ensure data directory exists
            DATA_DIR.mkdir(parents=True, exist_ok=True)

            # Load existing captures
            captures = []
            if CAPTURES_FILE.exists():
                try:
                    with open(CAPTURES_FILE, 'r', encoding='utf-8') as f:
                        captures = json.load(f)
                except Exception:
                    captures = []

            # Add new capture
            captures.append({
                'text': text,
                'timestamp': datetime.now().isoformat()
            })

            # Save
            with open(CAPTURES_FILE, 'w', encoding='utf-8') as f:
                json.dump(captures, f, indent=2, ensure_ascii=False)

            print(f"Capture saved: {len(text)} chars")
            return {'success': True}

        except Exception as e:
            print(f"Capture save error: {e}")
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

    def close_window(self):
        """Close the capture window."""
        if window:
            window.destroy()
        return {'success': True}


# Global window reference
window = None


def main():
    global window

    print("Quick Capture starting...")
    print(f"Capture HTML: {CAPTURE_HTML}")

    # Check if capture.html exists
    if not CAPTURE_HTML.exists():
        print(f"ERROR: capture.html not found at {CAPTURE_HTML}")
        sys.exit(1)

    # Create API instance
    api = CaptureAPI()

    # Create window
    window = webview.create_window(
        'Quick Capture - Inkdown',
        str(CAPTURE_HTML),
        width=420,
        height=240,
        resizable=False,
        on_top=True,
        confirm_close=False,
        frameless=False,
        minimized=False,
        js_api=api
    )

    print("Starting webview...")

    # Start webview (must be on main thread)
    webview.start(debug=False)

    print("Capture window closed")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"FATAL: {e}")
        traceback.print_exc()
        sys.exit(1)