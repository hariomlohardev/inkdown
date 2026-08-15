# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pip install -r requirements.txt          # or: pip install -e ".[dev]"
pip install -e .                         # installs src/inkdown as package (uses pyproject.toml)

python main.py                           # run desktop app (shim → src/inkdown/__main__.py)
python -m inkdown                        # same (package entry, preferred for dev)
python main.py --capture                 # quick-capture window only
python main.py path/to/file.md           # open with file pre-loaded (OS file association)

python scripts/fetch_vendor.py           # download CDN libs to app/vendor/ for offline builds
python scripts/make_icon.py              # regenerate icon.ico + icon.png from app/icon.svg

build.bat                                # full build: pip install → scripts/make_icon.py → scripts/fetch_vendor.py → PyInstaller
pyinstaller Inkdown.spec                 # build directly (output: dist/Inkdown/Inkdown.exe, pathex=src)
# then compile installer.iss with Inno Setup → Output/Inkdown-Setup.exe (Output/ is gitignored)

python -m pytest                         # smoke tests (tests/test_smoke.py, pythonpath=src via pyproject.toml)
python -m pytest tests/test_smoke.py -v  # single file
```

Frontend-only dev (no Python): vanilla JS, no bundler — serve `app/` over HTTP.

```bash
npx serve app                            # open http://localhost:3000/app/index.html
```

No lint is configured. `package.json` has been removed (was stubs). Do not assume `npm test` exists.

## Architecture

**Inkdown** is a Notion-inspired Markdown studio. Native Windows desktop app via **PyWebView** + vanilla JS. 100% local, offline-first.

```
inkdown/
├── src/inkdown/        # Python package (see below)
├── app/                # Frontend (index.html, capture.html, src/scripts/, src/styles/, vendor/)
├── scripts/            # fetch_vendor.py, make_icon.py, windows/*.bat
├── docs/               # markdown-guide.md (was structure.md)
├── tests/              # test_smoke.py
├── .github/            # workflows/deploy.yml, ISSUE_TEMPLATE/, pull_request_template.md
├── main.py             # Shim → src/inkdown/__main__.py (keeps `python main.py` working)
├── Inkdown.spec        # PyInstaller spec (pathex=src, datas app+version.txt)
├── installer.iss       # Inno Setup (Output/Inkdown-Setup.exe, .md associations)
├── pyproject.toml      # Package metadata (setuptools src layout, pytest pythonpath)
└── version.txt / version.json / version_info.txt  # release version (bump together)
```

### Python package (`src/inkdown/`)

- **`__main__.py`** (was `main.py`) — entry point. Starts `ThreadingTCPServer` on `127.0.0.1:8741` (falls back if busy) serving `app/` via `QuietHandler`; WebView loads `http://127.0.0.1:<port>/index.html`. Exposes `Api` as `window.pywebview.api`: `toggle_fullscreen`, `get_launch_docs`, `save_snapshot`/`load_snapshot`, `fetch_url`, `get_daemon_status`, `get_hotkey_config`/`save_hotkey_config`, `save_file`/`save_binary_file`. `waitForApi()` in `app/src/scripts/main.js` polls until bridge is ready. Handles `--capture` via `CaptureAPI`, `parse_args()` for file association, `import_quick_captures()` from `quick-captures.json`. `base_dir()` resolves repo root from `src/inkdown/__main__.py` (three levels up) and supports frozen (`_MEIPASS`) and legacy flat layout.
- **`daemon.py`** (was `inkdown_daemon.py`) — tray icon (`pystray`) + heartbeat every 30s to `daemon-heartbeat.txt`; launches `main.py` shim or `python -m inkdown` fallback.
- **`watchdog.py`** — monitors daemon, restarts on crash (up to 3 in 60s), path now resolves to `src/inkdown/daemon.py`.
- **`updater.py`** — checks `VERSION_URL` (empty by default) against `version.txt`/`version.json` from repo root.
- **`file_lock.py`** — cross-platform `FileLock` + `atomic_write`/`safe_read_json`/`safe_write_json`; `__main__.py` tries `from inkdown.file_lock` then fallback.
- **`capture_window.py` / `capture_validator.py`** — standalone capture window helpers; `capture_window.py` now resolves `app/capture.html` via repo root.

Data dir: `%APPDATA%/Inkdown` (Windows) or `~/.config/Inkdown` → `inkdown-data.json`, `hotkeys.json`, `quick-captures.json`, `daemon-heartbeat.txt`, `webview/`, `launch.log`.

### Frontend (`app/`)

- Single HTML entry: `app/index.html` (~1180 lines) — all views are sections toggled via `data-view`/`body` classes: `#home` (library), `#todosPage`, `#settingsPage`, `#slidesPage`, `#app` (reader/editor). No SPA router, no framework.
- Boot: `app/src/scripts/main.js` — `await restored` (persist), then `initTheme/initState/migrateLegacy/migrateToIDB` + `initUI/initTOC/initNavigation/initEditor/...` (~25 inits). Global error handlers prevent white-screen.
- State: `app/src/scripts/state.js` — single mutable `state` object (`fileId`, `md`, `name`, `editing`, `tabs`, `activeTabId`, etc.).
- Module map (`app/src/scripts/`): `storage.js` (library CRUD, limits), `idb-storage.js` (IndexedDB for large files), `persist.js` (disk mirror), `home.js`/`library.js`, `editor.js`/`viewer.js`/`markdown.js` (marked → DOMPurify → hljs/KaTeX/mermaid), `toc.js`, `slides.js`, `todos.js`, `highlight.js`, `palette.js` (Ctrl+P), `search.js`, `tabs.js`, `navigation.js`, `chat.js`+`chat-settings.js`+`assist.js`+`quality.js`, `settings.js`/`storage-monitor.js`/`backup-manager.js`, `theme.js`, `click-to-source.js`, `pwa.js`, `samples.js`.
- Styles: `app/src/styles/main.css` import chain `tokens.css` → `base.css` → `layout.css` → `components.css` → per-feature files. `data-theme="light|dark"` on `<html>`.
- Vendor: `app/vendor/` is committed (3.9MB) for offline clones. Regenerate via `scripts/fetch_vendor.py`.
- Sample doc: `app/src/samples/guide.md`.

### Persistence (three layers)

1. **localStorage** — `inkdown:library`, `inkdown:folders`, `inkdown:versions`, `inkdown:todos`, `inkdown:settings`, `inkdown:theme`, `inkdown:read`, `inkdown:todoPos`, `inkdown:doc` (legacy).
2. **IndexedDB** (`idb-storage.js`) — large contents (>500KB `IDB_THRESHOLD`) + version overflow. `storage.js:saveLibrary` strips `md` for large files (`_useIDB=true`). Use `getFileContent()`/`getFileWithContent()` (async); `getLibrary()`/`getFile()` are sync metadata-only.
3. **Disk mirror** (`persist.js` ↔ `Api.save_snapshot/load_snapshot` → `inkdown-data.json`). `restored` promise gates boot; `flush()` every 2s + `beforeunload`/`pagehide`/`visibilitychange`. Only fills missing keys.

Limits: `MAX_FILE_SIZE=100MB`, `WARN_FILE_SIZE=10MB`, `MAX_FILES=500` (`storage.js`).

### Build & Distribution

- `Inkdown.spec` — PyInstaller `--onedir --windowed`, `pathex=['src']`, `Analysis(['main.py'])` (shim), `collect_all('webview')`, `datas=[('app','app'),('version.txt','.'),('version.json','.')]`, `icon=['icon.ico']`. `icon.ico` is generated (gitignored), not committed.
- `build.bat` — handles both old and new `scripts/` locations, `--paths src`.
- `installer.iss` — Inno Setup, `dist\Inkdown\*` → `{app}`, `.md`/`.markdown`/`.mdown` → `Inkdown.Markdown`, refresh icon cache via `ie4uinit`.
- `pyproject.toml` — `src` layout, `pip install -e .`, `project.scripts.inkdown`, `tool.pytest.ini_options.pythonpath=["src"]`.
- `version.txt` + `version.json` + `version_info.txt` must be bumped together. `updater.py:VERSION_URL` must point to hosted `version.json`.

## Conventions

- ES6 modules only, no bundler. Imports need `.js` extension. CSS via `main.css` import order.
- Python: `src` layout, `pyproject.toml` is source of truth. Keep `main.py` shim for backward compat (`sys.path.insert(0, "src")`).
- Do not commit: `__pycache__/`, `*.egg-info/`, `dist/`, `build/`, `Output/`, `icon.ico`, `.remember/`, `.pytest_cache/`.
- Vendor: `app/vendor/` is committed — don't hand-edit, run `scripts/fetch_vendor.py`.
- Docs: `docs/markdown-guide.md` is the Markdown syntax reference (was `structure.md`). `roadmap.html` was removed (was unrelated AGI plan).
- Tests: `tests/test_smoke.py` — import + file existence checks. Add new tests under `tests/`.
- File validation: `storage.js:validateFileSize`/`canAddFile` before imports.
