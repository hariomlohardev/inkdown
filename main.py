import os, sys, socket, threading, functools, ctypes
import http.server, socketserver

PORT = 8741   # fixed port => stable origin

def set_app_user_model_id():
    if os.name == 'nt':
        try:
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("com.inkdown.desktop")
        except Exception:
            pass

def base_dir():
    if getattr(sys, 'frozen', False):
        return getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))

def app_dir():
    return os.path.join(base_dir(), 'app')

def data_dir():
    if os.name == 'nt':
        base = os.environ.get('APPDATA', os.path.expanduser('~'))
    else:
        base = os.environ.get('XDG_CONFIG_HOME', os.path.expanduser('~/.config'))
    d = os.path.join(base, 'Inkdown')
    os.makedirs(d, exist_ok=True)
    return d

LAUNCH_FILES = []

def parse_args():
    for a in sys.argv[1:]:
        p = os.path.abspath(a)
        if os.path.isfile(p):
            LAUNCH_FILES.append(p)

# inside class Api:
    def get_launch_files(self):
        global LAUNCH_FILES
        files = LAUNCH_FILES[:]
        LAUNCH_FILES = []
        return files

    def read_external_file(self, path):
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except Exception:
            return None

    def fetch_url(self, url):
        import urllib.request
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read().decode('utf-8', errors='ignore')
        except Exception:
            return None
        
DATA_FILE = os.path.join(data_dir(), 'inkdown-data.json')

class Api:
    """Exposed to the page as window.pywebview.api"""
    window = None

    # F11 → native fullscreen
    def toggle_fullscreen(self):
        if self.window:
            self.window.toggle_fullscreen()
            return True
        return False

    def save_snapshot(self, payload):
        try:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                f.write(payload)
            return True
        except Exception:
            return False

    def load_snapshot(self):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            return ''

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)
    def log_message(self, *args):
        pass

def find_port(preferred):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", preferred)); return preferred
        except OSError:
            pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0)); return s.getsockname()[1]

def start_server(root):
    port = find_port(PORT)
    handler = functools.partial(QuietHandler, directory=root)
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return port

def main():
    set_app_user_model_id()
    parse_args()          # ← capture double-clicked / passed .md files
    import webview
    import updater

    port = start_server(app_dir())
    url = f"http://127.0.0.1:{port}/index.html"

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
    api.window = window   # lets the JS bridge drive native fullscreen

    window.events.shown += lambda: threading.Thread(
        target=updater.check_and_offer, args=(window,), daemon=True
    ).start()

    webview.start(debug=False)

if __name__ == '__main__':
    main()