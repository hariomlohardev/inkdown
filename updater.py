import json, os, sys, urllib.request, tempfile, subprocess

# Point this at where you host version.json (GitHub Releases works great)
VERSION_URL = ""   # e.g. "https://github.com/you/inkdown/releases/latest/download/version.json"
LOCAL_VERSION_FILE = "version.txt"

def base_dir():
    if getattr(sys, 'frozen', False):
        return getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))

def local_version():
    try:
        with open(os.path.join(base_dir(), LOCAL_VERSION_FILE), encoding='utf-8') as f:
            return f.read().strip()
    except Exception:
        return "0.0.0"

def parse(v):
    out = []
    for part in str(v).split('.'):
        digits = ''.join(ch for ch in part if ch.isdigit())
        out.append(int(digits) if digits else 0)
    return tuple(out)

def check_and_offer(window):
    """Download the new installer and run it if a newer version exists."""
    if not VERSION_URL:
        return
    try:
        with urllib.request.urlopen(VERSION_URL, timeout=8) as r:
            data = json.load(r)
        remote = data.get("version", "0.0.0")
        installer_url = data.get("installer_url", "")
        if installer_url and parse(remote) > parse(local_version()):
            ok = window.evaluate_js(
                f"confirm('Inkdown {remote} is available (you have {local_version()}). Download the update now?')"
            )
            if ok:
                dest = os.path.join(tempfile.gettempdir(), f"Inkdown-Setup-{remote}.exe")
                urllib.request.urlretrieve(installer_url, dest)
                subprocess.Popen([dest])   # installer handles the update
                window.destroy()
    except Exception:
        pass   # updater must never break the app