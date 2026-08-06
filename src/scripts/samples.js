// Sample content
export const SAMPLE = String.raw`# 🪶 Inkdown

### Your README, rendered in black, white & one shade of pink.

**Inkdown** drops straight into your browser: open any \`.md\`, get a beautiful reading view, tap the ✏️ pencil for a quick edit, then save or download. *This very document is live — try editing it.*

> 💡 **New** — press **F** for focus mode, **Ctrl+K** to search this page, select any sentence to **🖍 highlight** it, and click any image to zoom.

## ✨ What's inside

### Reading
- 🎨 **Minimal palette** — pure white, pure black, one pink accent
- 🌗 Light & dark modes, font & width controls (the **Aa** button)
- 🖍 Highlights that survive reloads

### Navigation
- 🧭 Filterable contents table with fold/unfold sections
- 🗺️ Minimap on the right edge — click anywhere to teleport
- 🍞 Breadcrumbs that follow you down the page

### Editing
- ✏️ Formatting toolbar: bold, tables, task lists, code fences
- 🔎 Find & replace, smart lists, symbol auto-pairing
- 🩺 LINT health check + 🕘 version history + ◎ word goals

## 🚀 Quick start

` + "```bash" + String.raw`
# 1. drop any .md file onto the window
# 2. press the pencil to edit
# 3. Ctrl+S to save, or export from the ⬇ menu
inkdown open README.md --theme auto
` + "```" + String.raw`

` + "```js" + String.raw`
import { render } from "inkdown";

render("# Hello, world", {
  theme: "auto",
  accent: "#ff2e88",
});
` + "```" + String.raw`

## 📊 Benchmarks

| Engine    |  Parse | Render | GFM | Math |
|-----------|-------:|-------:|:---:|:----:|
| Inkdown   | 1.2 ms | 3.4 ms | ✅  |  ✅  |
| Viewer B  | 4.8 ms | 9.1 ms | ✅  |  ❌  |
| Viewer C  | 7.6 ms | 18 ms  | ⚠️  |  ❌  |

## 🗺️ Roadmap

- [x] Drop-and-view with gorgeous typography
- [x] Quick edit + autosave + download
- [x] Focus mode, search, highlights, minimap
- [x] Toolbar, lint, versions, word goals
- [ ] Shareable links
- [ ] Plugin API — 🚧 in progress

## 🧭 How a file flows through

` + "```mermaid" + String.raw`
flowchart LR
  A((Drop .md)) --> B{Parse GFM}
  B -->|code| C[Highlight]
  B -->|math| D[KaTeX]
  B -->|graph| E[Mermaid]
  C & D & E --> F(((Gorgeous view)))
` + "```" + String.raw`

## 🧮 Math, properly typeset

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx \;=\; \sqrt{\pi}
$$

## ❓ FAQ

<details>
<summary>Where are my files stored?</summary>

Only in this browser's <code>localStorage</code>, including versions and highlights.

</details>

<details>
<summary>Which Markdown flavours work?</summary>

GitHub Flavored Markdown plus \`$math$\`, Mermaid fences and \`:emoji:\` shortcodes.

</details>

---

Made with ♥ and one single color — [Markdown Guide](https://www.markdownguide.org) · [CommonMark](https://commonmark.org)
`;
