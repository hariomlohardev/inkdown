import os, sys, socket, threading, functools, ctypes, logging, multiprocessing, time, traceback
import http.server, socketserver

PORT = 8741
MAX_OPEN_FILE_BYTES = 15 * 1024 * 1024
LAUNCH_DOCS = []
_MAIN_WINDOW = {'ref': None}

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
    """Catch ANY uncaught error, log it to crash.log, and show a dialog instead of dying silently."""
    def hook(exc_type, exc_value, exc_tb):
        try:
            msg = ''.join(traceback.format_exception(exc_type, exc_value, exc_tb))
            log('UNCAUGHT EXCEPTION:\n' + msg)
            with open(os.path.join(data_dir(), 'crash.log'), 'a', encoding='utf-8') as f:
                f.write('\n=== %s ===\n%s' % (time.strftime('%Y-%m-%d %H:%M:%S'), msg))
        except Exception:
            pass
        try:
            ctypes.windll.user32.MessageBoxW(
                0, 'Inkdown hit an unexpected error:\n\n%s\n\nDetails saved to %%APPDATA%%\\Inkdown\\crash.log' % exc_value,
                'Inkdown', 0x10)
        except Exception:
            pass
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
    for a in sys.argv[1:]:
        try:
            p = os.path.abspath(a)
            if not os.path.isfile(p): continue
            if not p.lower().endswith(('.md', '.markdown', '.mdown', '.txt')): continue
            if os.path.getsize(p) > MAX_OPEN_FILE_BYTES:
                log('skipping large launch file: ' + p); continue
            with open(p, 'r', encoding='utf-8', errors='ignore') as f:
                LAUNCH_DOCS.append({'name': os.path.basename(p), 'content': f.read()})
            log('queued launch file: ' + p)
        except Exception as e:
            log('parse_args error for %r: %r' % (a, e))

def base_dir():
    if getattr(sys, 'frozen', False):
        return getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))

def app_dir():
    return os.path.join(base_dir(), 'app')

DATA_FILE = os.path.join(data_dir(), 'inkdown-data.json')
WEBVIEW_DATA_DIR = os.path.join(data_dir(), 'webview')
try: os.makedirs(WEBVIEW_DATA_DIR, exist_ok=True)
except Exception: WEBVIEW_DATA_DIR = data_dir()
_io_lock = threading.Lock()

class Api:
    """js_api must only contain simple methods — never store the Window on it."""
    def toggle_fullscreen(self):
        try:
            w = _MAIN_WINDOW.get('ref')
            if w is not None:
                w.toggle_fullscreen(); return True
        except Exception as e:
            log('fullscreen error: ' + repr(e))
        return False
    def get_launch_docs(self):
        global LAUNCH_DOCS
        docs = LAUNCH_DOCS[:]; LAUNCH_DOCS = []
        return docs
    def save_snapshot(self, payload):
        try:
            with _io_lock:
                with open(DATA_FILE, 'w', encoding='utf-8') as f: f.write(payload)
            return True
        except Exception as e:
            log('save_snapshot error: ' + repr(e)); return False
    def load_snapshot(self):
        try:
            with _io_lock:
                with open(DATA_FILE, 'r', encoding='utf-8') as f: return f.read()
        except Exception:
            return ''

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)
    def log_message(self, *args): pass

def find_port(preferred):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try: s.bind(("127.0.0.1", preferred)); return preferred
        except OSError: pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0)); return s.getsockname()[1]

def start_server(root):
    port = find_port(PORT)
    handler = functools.partial(QuietHandler, directory=root)
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return port

def main():
    multiprocessing.freeze_support()
    setup_logging()
    install_exception_hook()
    log('=== Inkdown start ===')
    log('frozen=%r argv=%r' % (getattr(sys, 'frozen', False), sys.argv))
    try:
        set_app_user_model_id()
        parse_args()
        log('launch docs queued: %d' % len(LAUNCH_DOCS))

        import webview
        import updater

        root = app_dir()
        log('app dir: %s (exists=%s)' % (root, os.path.isdir(root)))
        port = start_server(root)
        log('local server on port %d' % port)
        url = 'http://127.0.0.1:%d/index.html' % port

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

        log('entering webview loop (storage=%s)' % WEBVIEW_DATA_DIR)
        try:
            try:
                webview.start(debug=False, storage_path=WEBVIEW_DATA_DIR, private_mode=False)
            except TypeError:
                try:
                    webview.start(debug=False, storage_path=WEBVIEW_DATA_DIR)
                except TypeError:
                    webview.start(debug=False)
            log('webview loop exited')
        except Exception as e:
            log('webview.start failed: ' + repr(e))
            try:
                ctypes.windll.user32.MessageBoxW(
                    0, 'The window failed to start.\n\nThis usually means the WebView2 runtime is '
                       'missing, or the app hit an error.\n\nError: %s\n\nTry installing the '
                       '"Microsoft Edge WebView2 Runtime" and reopen Inkdown.' % e,
                    'Inkdown', 0x10)
            except Exception:
                pass
            raise
    except Exception as e:
        log('FATAL: %r' % e)
        log(traceback.format_exc())
        try:
            ctypes.windll.user32.MessageBoxW(0, 'Inkdown failed to start:\n\n%s' % e, 'Inkdown', 0x10)
        except Exception:
            pass
        raise

if __name__ == '__main__':
    main()