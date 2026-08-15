import os, sys, socket, threading, functools, ctypes, logging, multiprocessing, traceback
import http.server, socketserver
import json as json_module
from datetime import datetime

PORT = 8741
MAX_OPEN_FILE_BYTES = 15 * 1024 * 1024
LAUNCH_DOCS = []
_MAIN_WINDOW = {'ref': None}

# ========== Capture Mode Detection ==========
CAPTURE_MODE = '--capture' in sys.argv

# ========== File Locking (with graceful fallback) ==========
try:
    # Package import (when running as `python -m inkdown` or via shim)
    from inkdown.file_lock import FileLock, safe_read_json, safe_write_json, atomic_write
    HAS_FILE_LOCK = True
except ImportError:
    try:
        from file_lock import FileLock, safe_read_json, safe_write_json, atomic_write
        HAS_FILE_LOCK = True
    except ImportError:
        HAS_FILE_LOCK = False

    class FileLock:
        def __init__(self, path, timeout=10):
            self.path = path
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    def safe_read_json(path, default=None):
        try:
            if not os.path.exists(path):
                return default
            with open(path, 'r', encoding='utf-8') as f:
                return json_module.load(f)
        except Exception:
            return default

    def safe_write_json(path, data):
        try:
            os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                json_module.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False

    def atomic_write(path, content, encoding='utf-8'):
        try:
            os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
            tmp = path + '.tmp'
            with open(tmp, 'w', encoding=encoding) as f:
                f.write(content)
                f.flush()
            if os.path.exists(path):
                os.remove(path)
            os.rename(tmp, path)
        except Exception as e:
            try: os.remove(tmp)
            except: pass
            raise


# ========== Core Setup ==========
def data_dir():
    if os.name == 'nt':
        base = os.environ.get('APPDATA', os.path.expanduser('~'))
    else:
        base = os.environ.get('XDG_CONFIG_HOME', os.path.expanduser('~/.config'))
    d = os.path.join(base, 'Inkdown')
    try: os.makedirs(d, exist_ok=True)
    except Exception: d = os.path.expanduser('~')
    return d


def setup_logging():
    try:
        logging.basicConfig(filename=os.path.join(data_dir(), 'launch.log'),
                            level=logging.INFO,
                            format='%(asctime)s %(levelname)s %(message)s', filemode='w')
    except Exception:
        logging.basicConfig(level=logging.INFO)


def log(msg):
    try: logging.info(msg)
    except Exception: pass
    try: print(msg, flush=True)
    except Exception: pass


def install_exception_hook():
    def hook(exc_type, exc_value, exc_tb):
        try:
            msg = ''.join(traceback.format_exception(exc_type, exc_value, exc_tb))
            log('UNCAUGHT:\n' + msg)
        except Exception: pass
        try: sys.__excepthook__(exc_type, exc_value, exc_tb)
        except Exception: pass
    sys.excepthook = hook


def set_app_user_model_id():
    if os.name == 'nt':
        try:
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("com.inkdown.desktop")
        except Exception as e:
            log('appUMID failed: ' + repr(e))


def parse_args():
    """Parse launch arguments (files passed via command line or double-click)."""
    for a in sys.argv[1:]:
        # Skip our own flags
        if a.startswith('--'):
            continue
        try:
            p = os.path.abspath(a)
            if not os.path.isfile(p): continue
            if not p.lower().endswith(('.md', '.markdown', '.mdown', '.txt')): continue
            if os.path.getsize(p) > MAX_OPEN_FILE_BYTES:
                log('skipping large launch file: ' + p)
                continue
            with open(p, 'r', encoding='utf-8', errors='ignore') as f:
                LAUNCH_DOCS.append({'name': os.path.basename(p), 'content': f.read()})
            log('queued launch file: ' + p)
        except Exception as e:
            log('parse_args error: ' + repr(e))


def import_quick_captures():
    """Import pending quick captures from the daemon."""
    try:
        captures_file = os.path.join(data_dir(), 'quick-captures.json')

        if not os.path.exists(captures_file):
            return

        with FileLock(captures_file, timeout=5):
            captures = safe_read_json(captures_file, default=[])

            if captures and isinstance(captures, list):
                log(f"Found {len(captures)} pending quick captures")
                try:
                    os.remove(captures_file)
                    log("Quick captures imported and pending file cleared")
                except Exception as e:
                    log(f"Failed to clear captures file: {e}")
            else:
                try:
                    os.remove(captures_file)
                except:
                    pass

    except Exception as e:
        log(f"Quick capture import error: {e}")


def check_daemon_status():
    """Check if the daemon is running by reading the heartbeat file."""
    try:
        heartbeat_file = os.path.join(data_dir(), 'daemon-heartbeat.txt')

        if not os.path.exists(heartbeat_file):
            return {'running': False, 'last_seen': None, 'age_seconds': None}

        with open(heartbeat_file, 'r', encoding='utf-8') as f:
            last_seen = f.read().strip()

        try:
            heartbeat_time = datetime.fromisoformat(last_seen)
            age = (datetime.now() - heartbeat_time).total_seconds()
            is_running = age < 120
        except Exception:
            is_running = False
            age = None

        return {
            'running': is_running,
            'last_seen': last_seen,
            'age_seconds': age
        }
    except Exception as e:
        log(f"Daemon status check error: {e}")
        return {'running': False, 'last_seen': None, 'age_seconds': None}


def base_dir():
    if getattr(sys, 'frozen', False):
        return getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    # __main__.py lives at src/inkdown/__main__.py → repo root is three levels up
    here = os.path.dirname(os.path.abspath(__file__))
    # Try package layout first (src/inkdown/__main__.py → repo root)
    repo_root = os.path.dirname(os.path.dirname(here))
    # Fallback: if app/ not found there, try legacy flat layout
    if os.path.isdir(os.path.join(repo_root, 'app')):
        return repo_root
    return here


def app_dir():
    return os.path.join(base_dir(), 'app')


# ========== Shared State ==========
DATA_FILE = os.path.join(data_dir(), 'inkdown-data.json')
HOTKEYS_FILE = os.path.join(data_dir(), 'hotkeys.json')
WEBVIEW_DATA_DIR = os.path.join(data_dir(), 'webview')
_io_lock = threading.Lock()

try:
    os.makedirs(WEBVIEW_DATA_DIR, exist_ok=True)
except Exception:
    WEBVIEW_DATA_DIR = data_dir()


# ========== Capture Mode ==========
def run_capture_mode():
    """Run in capture mode - show only the Quick Capture window."""
    log("=== Inkdown Capture Mode ===")

    try:
        import webview
    except ImportError:
        log("ERROR: pywebview not available")
        return

    capture_html = os.path.join(app_dir(), 'capture.html')

    if not os.path.exists(capture_html):
        log(f"ERROR: capture.html not found at {capture_html}")
        return

    class CaptureAPI:
        def save_capture(self, text):
            try:
                if not text or len(text.strip()) < 1:
                    return {'success': False, 'error': 'Empty capture'}

                if len(text) > 5000:
                    text = text[:5000]

                captures_file = os.path.join(data_dir(), 'quick-captures.json')
                captures = safe_read_json(captures_file, default=[])
                if not isinstance(captures, list):
                    captures = []

                captures.append({
                    'text': text,
                    'timestamp': datetime.now().isoformat()
                })

                safe_write_json(captures_file, captures)
                log(f"Capture saved: {len(text)} chars")
                return {'success': True}

            except Exception as e:
                log(f"Capture save error: {e}")
                return {'success': False, 'error': str(e)}

        def close_window(self):
            w = _MAIN_WINDOW.get('ref')
            if w:
                w.destroy()
            return {'success': True}

    api = CaptureAPI()

    window = webview.create_window(
        'Quick Capture - Inkdown',
        capture_html,
        width=420,
        height=240,
        resizable=False,
        on_top=True,
        confirm_close=False,
        frameless=False,
        minimized=False,
        js_api=api
    )
    _MAIN_WINDOW['ref'] = window

    log("Starting capture window...")
    webview.start(debug=False)
    log("Capture window closed")


# ========== API (exposed to JS) ==========
class Api:
    """Bridge between web UI and Python."""

    def toggle_fullscreen(self):
        try:
            w = _MAIN_WINDOW.get('ref')
            if w is not None:
                w.toggle_fullscreen()
                return True
        except Exception as e:
            log('fullscreen error: ' + repr(e))
        return False

    def get_launch_docs(self):
        global LAUNCH_DOCS
        docs = LAUNCH_DOCS[:]
        LAUNCH_DOCS = []
        return docs

    def save_snapshot(self, payload):
        try:
            with _io_lock:
                atomic_write(DATA_FILE, payload, encoding='utf-8')
            return True
        except Exception as e:
            log('save error: ' + repr(e))
            return False

    def load_snapshot(self):
        try:
            with _io_lock:
                if not os.path.exists(DATA_FILE):
                    return ''
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    return f.read()
        except Exception:
            return ''

    def fetch_url(self, url):
        import urllib.request
        try:
            if not url.startswith(('http://', 'https://')):
                return None
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Inkdown)'})
            with urllib.request.urlopen(req, timeout=20) as r:
                content = r.read()
                if len(content) > 10 * 1024 * 1024:
                    return None
                return content.decode('utf-8', errors='ignore')
        except Exception as e:
            log(f"fetch_url error: {e}")
            return None

    def get_daemon_status(self):
        return check_daemon_status()

    def get_hotkey_config(self):
        try:
            config = safe_read_json(HOTKEYS_FILE, default=None)
            if config is None:
                config = {
                    'open_app': 'ctrl+alt+space',
                    'quick_capture': 'ctrl+alt+c',
                    'custom': False,
                    'last_updated': datetime.now().isoformat()
                }
                safe_write_json(HOTKEYS_FILE, config)
            return config
        except Exception as e:
            log(f"get_hotkey_config error: {e}")
            return {'open_app': 'ctrl+alt+space', 'quick_capture': 'ctrl+alt+c'}

    def save_hotkey_config(self, config):
        try:
            if not isinstance(config, dict):
                return False
            for key in ['open_app', 'quick_capture']:
                if key in config:
                    val = config[key]
                    if not isinstance(val, str) or not val:
                        return False
            config['last_updated'] = datetime.now().isoformat()
            return safe_write_json(HOTKEYS_FILE, config)
        except Exception as e:
            log(f"save_hotkey_config error: {e}")
            return False

    def save_file(self, filename, content, encoding='utf-8'):
        """
        Save content to a file. Opens a save dialog in PyWebView.
        Returns the path where the file was saved, or None if cancelled.
        """
        try:
            import webview
            w = _MAIN_WINDOW.get('ref')
            if not w:
                return None

            # Open save dialog
            file_types = ('Markdown Files (*.md;*.markdown;*.txt)', 'HTML Files (*.html)', 'All files (*.*)')
            result = w.create_file_dialog(
                webview.SAVE_DIALOG,
                directory='',
                save_filename=filename,
                file_types=file_types
            )

            if result:
                # result might be a tuple or string depending on platform
                path = result[0] if isinstance(result, (list, tuple)) else result

                # Write the file
                with open(path, 'w', encoding=encoding) as f:
                    f.write(content)

                log(f'File saved: {path}')
                return path
            else:
                log('Save cancelled by user')
                return None

        except Exception as e:
            log(f'save_file error: {repr(e)}')
            return None

    def save_binary_file(self, filename, base64_content):
        """
        Save binary content (like images) to a file.
        """
        try:
            import base64
            w = _MAIN_WINDOW.get('ref')
            if not w:
                return None

            file_types = ('PNG Images (*.png)', 'JPEG Images (*.jpg;*.jpeg)', 'All files (*.*)')
            result = w.create_file_dialog(
                webview.SAVE_DIALOG,
                directory='',
                save_filename=filename,
                file_types=file_types
            )

            if result:
                path = result[0] if isinstance(result, (list, tuple)) else result

                # Decode base64 and write binary
                binary_data = base64.b64decode(base64_content)
                with open(path, 'wb') as f:
                    f.write(binary_data)

                log(f'Binary file saved: {path}')
                return path
            else:
                return None

        except Exception as e:
            log(f'save_binary_file error: {repr(e)}')
            return None


# ========== HTTP Server ==========
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
    }

    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        if not getattr(sys, 'frozen', False):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        else:
            self.send_header('Cache-Control', 'public, max-age=3600')
        super().end_headers()


def find_port(preferred):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(root):
    port = find_port(PORT)
    handler = functools.partial(QuietHandler, directory=root)
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    log(f"HTTP server started on port {port}")
    return port


# ========== Main Entry Point ==========
def main():
    multiprocessing.freeze_support()
    setup_logging()
    install_exception_hook()

    log('=== Inkdown start ===')
    log(f'frozen={getattr(sys, "frozen", False)} argv={sys.argv}')
    log(f'Python {sys.version}')
    log(f'Capture mode: {CAPTURE_MODE}')

    # If in capture mode, run capture window and exit
    if CAPTURE_MODE:
        run_capture_mode()
        return

    try:
        set_app_user_model_id()
        parse_args()
        import_quick_captures()

        import webview
        try:
            from inkdown import updater
        except ImportError:
            import updater

        root = app_dir()
        log(f'app dir: {root} (exists={os.path.isdir(root)})')

        if not os.path.isdir(root):
            try:
                ctypes.windll.user32.MessageBoxW(
                    0,
                    'Could not find the app folder at:\n\n%s\n\n'
                    'Re-clone or run: python scripts/fetch_vendor.py\n'
                    'Then rebuild: build.bat' % root,
                    'Inkdown', 0x10)
            except Exception:
                pass
            return

        port = start_server(root)
        url = f'http://127.0.0.1:{port}/index.html'
        log(f'URL: {url}')

        api = Api()

        window = webview.create_window(
            title='Inkdown — README Studio',
            url=url,
            width=1280, height=820,
            min_size=(820, 600),
            background_color='#0a0a0a',
            text_select=True,
            js_api=api,
        )
        _MAIN_WINDOW['ref'] = window

        window.events.shown += lambda: threading.Thread(
            target=updater.check_and_offer, args=(window,), daemon=True
        ).start()

        log(f'entering webview loop (storage={WEBVIEW_DATA_DIR})')

        try:
            try:
                webview.start(debug=False, storage_path=WEBVIEW_DATA_DIR, private_mode=False)
            except TypeError:
                try:
                    webview.start(debug=False, storage_path=WEBVIEW_DATA_DIR)
                except TypeError:
                    webview.start(debug=False)
            log('webview loop exited normally')

        except Exception as e:
            log('webview.start failed: ' + repr(e))
            try:
                ctypes.windll.user32.MessageBoxW(
                    0,
                    'The window failed to start.\n\nError: %s\n\n'
                    'Try installing the "Microsoft Edge WebView2 Runtime".' % e,
                    'Inkdown', 0x10)
            except Exception:
                pass
            raise

    except KeyboardInterrupt:
        log('Interrupted by user (Ctrl+C)')
    except Exception as e:
        log('FATAL: ' + repr(e))
        log(traceback.format_exc())
        try:
            ctypes.windll.user32.MessageBoxW(
                0, 'Inkdown failed to start:\n\n%s' % e, 'Inkdown', 0x10)
        except Exception:
            pass
        raise
    finally:
        log('=== Inkdown shutdown ===')


if __name__ == '__main__':
    main()