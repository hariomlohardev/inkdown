
<div align="center">

# 🖋️ Inkdown

### The Notion-inspired Markdown studio for writers who care about craft

**A beautiful, fast, and feature-rich Markdown editor with todos, slides, and global hotkeys**

[![Version](https://img.shields.io/badge/version-1.0.0-ff2e88?style=for-the-badge)](https://github.com/hariomlohardev/inkdown)
[![Platform](https://img.shields.io/badge/platform-Windows%2010/11-0078d4?style=for-the-badge)](https://github.com/hariomlohardev/inkdown/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![Download](https://img.shields.io/badge/download-Installer-ff2e88?style=for-the-badge)](./Output/Inkdown-Setup.exe)

---

[📥 Download Installer](./Output/Inkdown-Setup.exe) • [✨ Features](#-features) • [⌨️ Shortcuts](#-keyboard-shortcuts) • [📖 Documentation](#-usage)

</div>

---

## 🌟 Overview

**Inkdown** is a modern Markdown editor that combines the elegance of Notion with the power of a professional writing tool. Whether you're writing documentation, taking notes, or creating presentations, Inkdown provides a seamless, distraction-free experience with features that actually matter.

Built with **PyWebView** and vanilla JavaScript, Inkdown runs as a native Windows desktop app while maintaining the speed and flexibility of web technologies.

---

## ✨ Features

### 📝 Core Editor

- **Live Preview** — See your Markdown rendered in real-time as you type
- **Split View** — Edit and preview side-by-side
- **Focus Mode** — Distraction-free writing environment
- **Syntax Highlighting** — 180+ languages supported
- **Math Support** — KaTeX-powered LaTeX rendering
- **Mermaid Diagrams** — Create flowcharts, sequences, and more
- **Code Blocks** — With line numbers and copy button

### 📚 Library Management

- **Multi-file Library** — Organize unlimited documents
- **Folders** — Create nested folder structures
- **Search** — Instant full-text search across all files
- **Tags** — Organize with custom tags
- **Archive** — Hide completed projects without deleting
- **Import/Export** — Drag-and-drop, paste, or import from URL

### 🎨 Notion-Inspired Design

- **Minimalist UI** — Clean, spacious, beautiful
- **Dark/Light Themes** — Automatic system theme detection
- **Custom Accent Colors** — Personalize your workspace
- **Smooth Animations** — 60fps GPU-accelerated transitions
- **Typography** — Serif, sans-serif, mono, and Atkinson Hyperlegible fonts

### ✅ Todo System

- **Day-based Todos** — Organize tasks by date
- **Floating Widget** — Always-on-top quick capture
- **Global Hotkeys** — `Ctrl+Alt+C` to capture from anywhere
- **Priority Levels** — Low, medium, high, urgent
- **File Linking** — Connect todos to documents
- **Streak Tracking** — Build productive habits
- **Auto-backup** — Never lose your tasks

### 📽️ Slides & Presentations

- **Instant Slides** — Convert any document to a presentation
- **Smart Splitting** — Automatically splits by headings
- **Full-screen Mode** — Present with confidence
- **Smooth Transitions** — Professional animations
- **Progress Indicator** — Know where you are
- **Speaker Notes** — Private notes visible only to you

### 🖍️ Highlights & Annotations

- **5 Color Options** — Yellow, pink, green, blue, purple
- **Click to Remove** — Easy management
- **Persistent** — Survives re-renders and reloads
- **Context-Aware** — Accurate even with duplicate text
- **Keyboard Shortcut** — Press `H` to highlight selection

### ⌨️ Power User Features

- **Command Palette** (`Ctrl+P`) — VS Code-style command search
- **Quick Capture** (`Ctrl+Alt+C`) — Global hotkey for instant notes
- **100+ Keyboard Shortcuts** — Work at the speed of thought
- **Version History** — Never lose your work
- **Auto-save** — Configurable intervals
- **Storage Monitoring** — Know when you're running low

### 🤖 Writing Assistant

- **Readability Score** — Flesch-Kincaid analysis
- **Broken Link Checker** — Find dead links instantly
- **Tone Analysis** — Check for inclusivity and clarity
- **Summarizer** — Generate TL;DR automatically
- **Multi-language Translation** — 12 languages supported

### 📊 Advanced Features

- **Tables with Charts** — Visualize data directly in tables
- **Footnotes** — Academic-style citations
- **Callouts** — Note, tip, warning, danger blocks
- **Emoji Shortcodes** — `:rocket:` → 🚀
- **Image Viewer** — Click to zoom, scroll to pan
- **Export Options** — PDF, HTML, PNG, Markdown, ZIP backup

---

## 🚀 Installation

### Windows (Recommended)

1. **Download the installer:**
   ```
   ./Output/Inkdown-Setup.exe
   ```

2. **Run the installer** and follow the setup wizard

3. **Launch Inkdown** from Start Menu or Desktop shortcut

4. **Optional:** Run the daemon for global hotkeys:
   ```batch
   .\Output\run-daemon.bat
   ```

### From Source

```bash
# Clone the repository
git clone https://github.com/hariomlohardev/inkdown.git
cd inkdown

# Install dependencies
pip install -r requirements.txt

# Run in development mode
python main.py

# Build executable
build.bat
```

---

## 📖 Usage

### Getting Started

1. **Create a new file** — Click `+ New File` or press `Ctrl+N`
2. **Start writing** — Type Markdown, see live preview
3. **Save** — Press `Ctrl+S` or click the save button
4. **Organize** — Create folders, add tags, archive old files

### Writing Markdown

```markdown
# Heading 1
## Heading 2

**Bold text** and *italic text*

- Bullet list
- Another item

1. Numbered list
2. Second item

[Link](https://example.com)

![Image](image.png)

> Blockquote

`inline code`

```python
def hello():
    print("Hello, World!")
```

$$
E = mc^2
$$
```

### Using Todos

1. **Open Todos page** — Click the ✅ icon in sidebar
2. **Add a task** — Type and press Enter
3. **Set priority** — Click the priority dot
4. **Link a file** — Click the link icon
5. **Quick capture** — Press `Ctrl+Alt+C` from anywhere

### Creating Slides

1. **Write your document** with `##` headings for each slide
2. **Right-click** anywhere in the document
3. **Select "Present as Slides"**
4. **Navigate** with arrow keys or click
5. **Full-screen** with `F` key

### Command Palette

Press `Ctrl+P` to open the command palette and search for:
- Files by name
- Actions (new file, export, etc.)
- Settings (change theme, font, etc.)
- Navigation (go to todos, settings, etc.)

---

## ⌨️ Keyboard Shortcuts

<details>
<summary><b>Click to expand full shortcut list</b></summary>

### General

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save document |
| `Ctrl+E` | Toggle edit mode |
| `Ctrl+P` | Command palette |
| `Ctrl+K` | Search document |
| `Ctrl+O` | Open file |
| `Ctrl+N` | New file |
| `F11` | Fullscreen |
| `F` | Focus mode |
| `Esc` | Close dialogs |

### Editing

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+\`` | Inline code |
| `H` | Highlight selection |

### Todos

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+C` | Quick capture (global) |
| `Ctrl+Alt+Space` | Open Inkdown (global) |

### Navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl+\` | Toggle table of contents |
| `Ctrl+[` | Jump back |
| `Home` | Scroll to top |

### Slides

| Shortcut | Action |
|----------|--------|
| `←` / `→` | Previous/Next slide |
| `Home` / `End` | First/Last slide |
| `F` | Toggle fullscreen |
| `Esc` | Exit slides |

</details>

---

## 🎨 Customization

### Themes

Inkdown supports three theme modes:
- **System** — Follows your OS theme
- **Light** — Clean white interface
- **Dark** — Easy on the eyes

Change in **Settings → Appearance → Theme**

### Fonts

Choose from four reading fonts:
- **Serif** — Classic, elegant (default)
- **Sans-serif** — Modern, clean
- **Monospace** — Code-friendly
- **Atkinson Hyperlegible** — Accessibility-focused

### Accent Colors

Personalize with 5 accent colors:
- 🌸 Pink (default)
- 💙 Blue
- 💚 Green
- 💜 Purple
- 🧡 Orange

---

## 🏗️ Architecture

### Tech Stack

- **Backend:** Python 3.11+, PyWebView
- **Frontend:** Vanilla JavaScript (ES6 modules)
- **Styling:** Custom CSS with CSS variables
- **Markdown:** marked.js + DOMPurify
- **Math:** KaTeX
- **Diagrams:** Mermaid.js
- **Charts:** Custom canvas-based renderer

### File Structure

```
inkdown/
├── app/
│   ├── src/
│   │   ├── scripts/     # JavaScript modules
│   │   ├── styles/      # CSS files
│   │   └── index.html   # Main HTML
│   └── vendor/          # Third-party libraries
├── main.py              # PyWebView entry point
├── inkdown_daemon.py    # Global hotkey daemon
├── build.bat            # Build script
└── requirements.txt     # Python dependencies
```

---

## 🔒 Privacy & Security

- **100% Local** — All data stored on your device
- **No Telemetry** — Zero tracking or analytics
- **No Account Required** — Just download and use
- **Open Source** — Inspect the code yourself
- **Offline-First** — Works without internet

---

## 🤝 Contributing

Contributions are welcome! Here's how to help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Setup

```bash
# Install dev dependencies
pip install -r requirements-dev.txt

# Run tests
pytest

# Lint code
flake8 src/
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[Notion](https://notion.so)** — Design inspiration
- **[Obsidian](https://obsidian.md)** — Feature inspiration
- **[PyWebView](https://pywebview.flowrl.com/)** — Desktop framework
- **[marked.js](https://marked.js.org/)** — Markdown parser
- **[KaTeX](https://katex.org/)** — Math rendering
- **[Mermaid](https://mermaid.js.org/)** — Diagram generation

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/hariomlohardev/inkdown/issues)
- **Discussions:** [GitHub Discussions](https://github.com/hariomlohardev/inkdown/discussions)
- **Email:** support@inkdown.app

---

## 🗺️ Roadmap

### Coming Soon

- [ ] Mobile app (iOS/Android)
- [ ] Cloud sync (optional)
- [ ] Collaborative editing
- [ ] Plugin system
- [ ] API for integrations
- [ ] Vim mode
- [ ] Multi-cursor editing
- [ ] AI writing assistant

---

<div align="center">

**Made with ❤️ by [Your Name]**

[⭐ Star this repo](https://github.com/hariomlohardev/inkdown) if you find it useful!

[📥 Download Now](./Output/Inkdown-Setup.exe)

</div>

---

<details>
<summary><b>Screenshots</b> (Click to expand)</summary>

### Library View
*Organize all your documents in one place*

![Library](docs/screenshots/library.png)

### Editor
*Beautiful, distraction-free writing*

![Editor](docs/screenshots/editor.png)

### Todos
*Stay productive with built-in task management*

![Todos](docs/screenshots/todos.png)

### Slides
*Turn any document into a presentation*

![Slides](docs/screenshots/slides.png)

### Command Palette
*Access any feature instantly*

![Command Palette](docs/screenshots/command-palette.png)

</details>

---

<div align="center">

### 🖋️ Inkdown — Write beautifully, think clearly, present confidently

[Download for Windows](./Output/Inkdown-Setup.exe) • [View on GitHub](https://github.com/hariomlohardev/inkdown)

</div>
```

---