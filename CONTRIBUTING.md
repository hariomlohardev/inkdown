# Contributing to Inkdown

Thanks for wanting to contribute! Inkdown is a Python + PyWebView desktop Markdown studio — vanilla JS frontend, local-first.

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/hariomlohardev/inkdown.git
cd inkdown
pip install -r requirements.txt        # or: pip install -e ".[dev]"

# 2. Run
python main.py                          # desktop app
python main.py --capture                # quick-capture window only
python -m inkdown                       # same as above (package entry)
python -m inkdown.watchdog              # daemon watchdog
python -m inkdown.daemon                # tray daemon directly

# Frontend only (no Python)
npx serve app                           # open http://localhost:3000/app/index.html

# Vendor (offline libs)
python scripts/fetch_vendor.py          # re-download app/vendor/
python scripts/make_icon.py             # regenerate icon.ico + icon.png
```

## Project layout

```
inkdown/
├── src/inkdown/        # Python package (main, daemon, file_lock, watchdog, updater, capture_*)
├── app/                # Frontend (index.html, capture.html, src/scripts/, src/styles/, vendor/)
├── scripts/            # Dev helpers (fetch_vendor.py, make_icon.py, windows/*.bat)
├── docs/               # Guides (markdown-guide.md)
├── .github/workflows/  # CI / Pages deploy
├── tests/              # Smoke tests
├── main.py             # Shim → src/inkdown/__main__.py (keeps `python main.py` working)
├── build.bat           # PyInstaller build (→ dist/Inkdown/)
├── installer.iss       # Inno Setup (→ Output/Inkdown-Setup.exe)
├── Inkdown.spec        # PyInstaller spec
└── pyproject.toml      # Package metadata (pip install -e .)
```

## Where to change what

- **Editor / preview / markdown pipeline:** `app/src/scripts/markdown.js` (marked → DOMPurify → hljs/KaTeX/mermaid), `editor.js`, `viewer.js`
- **Library / folders / search:** `app/src/scripts/storage.js` + `idb-storage.js`, `home.js`/`library.js`
- **Persistence:** `storage.js` (localStorage) + `idb-storage.js` (IndexedDB) + `persist.js` (disk mirror via `Api.save_snapshot`)
- **Python bridge:** `src/inkdown/__main__.py:Api` ↔ `window.pywebview.api`
- **Daemon / tray:** `src/inkdown/daemon.py`, `watchdog.py`

## Conventions

- Frontend: ES6 modules, no bundler. Imports must include `.js` extension. Styles via `app/src/styles/main.css` import chain.
- Python: `src` layout, `pyproject.toml` is source of truth. Keep `main.py` shim for backward compat.
- Do not commit: `__pycache__/`, `*.egg-info/`, `dist/`, `build/`, `Output/`, `icon.ico` (generated), `.remember/`.
- Vendor: `app/vendor/` is committed (3.9MB) for offline clones. Run `scripts/fetch_vendor.py` to refresh.

## Submitting changes

1. Create a branch: `git checkout -b feat/your-feature`
2. Keep changes focused; include a short description of *why*, not just *what*.
3. Test manually: `python main.py` + try a `.md` file open, todo, and slides.
4. Push and open a PR against `main`. CI will run the deploy check.

## Reporting bugs

Use the issue templates in `.github/ISSUE_TEMPLATE/`. Include OS, Python version, and steps to reproduce.
