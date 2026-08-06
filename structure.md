

---

## Table of Contents

- [1. Headings](#1-headings)
- [2. Text Formatting](#2-text-formatting)
- [3. Paragraphs & Line Breaks](#3-paragraphs--line-breaks)
- [4. Lists](#4-lists)
- [5. Links](#5-links)
- [6. Images](#6-images)
- [7. Blockquotes](#7-blockquotes)
- [8. Code](#8-code)
- [9. Tables](#9-tables)
- [10. Horizontal Rules](#10-horizontal-rules)
- [11. Escaping Characters](#11-escaping-characters)
- [12. HTML Inside Markdown](#12-html-inside-markdown)
- [13. Extended Syntax](#13-extended-syntax)
- [14. Best Practices](#14-best-practices)

---

## 1. Headings

Headings create structure and hierarchy. Use `#` symbols at the start of a line. More `#` symbols = smaller heading.

```markdown
# Heading level 1
## Heading level 2
### Heading level 3
#### Heading level 4
##### Heading level 5
###### Heading level 6
```

**Rendered:**

# Heading level 1
## Heading level 2
### Heading level 3
#### Heading level 4
##### Heading level 5
###### Heading level 6

> **Tip:** Most renderers automatically build a table of contents from headings. Use level 1 for the document title, level 2 for major sections, and level 3 for subsections.

---

## 2. Text Formatting

### Bold

Wrap text in **two asterisks** or **two underscores**.

```markdown
**This text is bold.**
__This text is also bold.__
```

**Rendered:** **This text is bold.**

### Italic

Wrap text in *one asterisk* or *one underscore*.

```markdown
*This text is italic.*
_This text is also italic._
```

**Rendered:** *This text is italic.*

### Bold and Italic

Combine them with ***three asterisks***.

```markdown
***This text is bold and italic.***
```

**Rendered:** ***This text is bold and italic.***

### Strikethrough

Wrap text in ~~two tildes~~.

```markdown
~~This text is crossed out.~~
```

**Rendered:** ~~This text is crossed out.~~

### Inline Code

Wrap text in **backticks** to display it as code.

```markdown
Use the `printf()` function to print output.
```

**Rendered:** Use the `printf()` function to print output.

### Combined Formatting

You can combine these freely.

```markdown
This is **bold with *italic* inside** it.
```

**Rendered:** This is **bold with *italic* inside** it.

---

## 3. Paragraphs & Line Breaks

### Paragraphs

Separate paragraphs with a **blank line**.

```markdown
This is the first paragraph.

This is the second paragraph.
```

### Line Breaks

To create a line break *without* starting a new paragraph, end a line with **two or more spaces**, or use a backslash.

```markdown
First line.  
Second line on its own.
```

---

## 4. Lists

### Unordered Lists

Use `-`, `*`, or `+` at the start of each line.

```markdown
- First item
- Second item
- Third item
```

**Rendered:**
- First item
- Second item
- Third item

### Ordered Lists

Use numbers followed by a period. The actual numbers don't matter — only the order.

```markdown
1. First step
2. Second step
3. Third step
```

**Rendered:**
1. First step
2. Second step
3. Third step

### Nested Lists

Indent with **two spaces** (or one tab).

```markdown
1. First item
   - Nested item A
   - Nested item B
2. Second item
```

**Rendered:**
1. First item
   - Nested item A
   - Nested item B
2. Second item

### Task Lists

Use `- [ ]` for incomplete and `- [x]` for complete.

```markdown
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task
```

**Rendered:**
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task

---

## 5. Links

### Inline Links

Wrap the link text in `[brackets]` and the URL in `(parentheses)`.

```markdown
[Visit Example](https://example.com)
```

**Rendered:** [Visit Example](https://example.com)

### Links with Titles

Add a title in quotes for a hover tooltip.

```markdown
[Visit Example](https://example.com "Example website")
```

### Automatic Links

Wrap a raw URL in angle brackets.

```markdown
<https://example.com>
```

**Rendered:** <https://example.com>

### Reference Links

Define the link once, reference it multiple times.

```markdown
[Example][ex]

[ex]: https://example.com
```

---

## 6. Images

Images use the same syntax as links, with an exclamation mark `!` at the start.

```markdown
![Alt text](https://via.placeholder.com/150)
```

**Rendered:**

![Placeholder](https://via.placeholder.com/150)

### Image with Title

```markdown
![Alt text](https://via.placeholder.com/150 "A placeholder image")
```

### Linked Images

Wrap the image in a link to make it clickable.

```markdown
[![Alt text](https://via.placeholder.com/150)](https://example.com)
```

---

## 7. Blockquotes

Use `>` at the start of a line to create a blockquote.

```markdown
> This is a blockquote.
```

**Rendered:**

> This is a blockquote.

### Multi-Paragraph Blockquotes

Use `>` on every line, including blank ones.

```markdown
> First paragraph.
>
> Second paragraph.
```

### Nested Blockquotes

Use additional `>` symbols.

```markdown
> Outer quote.
>> Inner quote.
```

### Blockquotes with Other Elements

Blockquotes can contain other Markdown.

```markdown
> **Important:** This quote contains **bold text** and a [link](https://example.com).
```

---

## 8. Code

### Inline Code

Wrap in single backticks.

```markdown
Use `code` for inline code.
```

### Fenced Code Blocks

Use three backticks to start and end a block. Optionally add a language name for syntax highlighting.

````markdown
```python
def hello():
    print("Hello, world!")
```
````

**Rendered:**

```python
def hello():
    print("Hello, world!")
```

### Common Language Tags

| Language | Tag |
|---|---|
| JavaScript | `js` or `javascript` |
| Python | `python` |
| HTML | `html` |
| CSS | `css` |
| JSON | `json` |
| Bash | `bash` or `sh` |
| SQL | `sql` |
| Markdown | `markdown` |

---

## 9. Tables

Use pipes `|` to separate columns and hyphens `---` to create the header row.

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1    | Data     | Data     |
| Row 2    | Data     | Data     |
```

**Rendered:**

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1    | Data     | Data     |
| Row 2    | Data     | Data     |

### Alignment

Use colons to control alignment.

```markdown
| Left | Center | Right |
|:-----|:------:|------:|
| Left | Center | Right |
```

**Rendered:**

| Left | Center | Right |
|:-----|:------:|------:|
| Left | Center | Right |

### Formatting Inside Tables

You can use bold, italic, code, and links inside table cells.

```markdown
| Feature | Status |
|---------|--------|
| **Bold** | `done` |
| *Italic* | [link](https://example.com) |
```

---

## 10. Horizontal Rules

Use three or more hyphens, asterisks, or underscores on their own line.

```markdown
---
***
___
```

All three produce a horizontal line:

---

---

## 11. Escaping Characters

Use a backslash `\` to escape characters that would otherwise be interpreted as Markdown.

```markdown
\*This is not italic\*
\# This is not a heading
```

**Rendered:**

\*This is not italic\*

Characters you can escape: `\`, `` ` ``, `*`, `_`, `[]`, `()`, `#`, `+`, `-`, `.`, `!`.

---

## 12. HTML Inside Markdown

Most renderers allow raw HTML to be mixed with Markdown.

```markdown
This is <u>underlined</u> text.
```

**Rendered:** This is <u>underlined</u> text.

```markdown
<details>
<summary>Click to expand</summary>

Hidden content goes here.

</details>
```

---

## 13. Extended Syntax

These features are supported by many, but not all, Markdown renderers.

### Footnotes

```markdown
Here is a statement.[^1]

[^1]: This is the footnote.
```

**Rendered:** Here is a statement.[^1]

[^1]: This is the footnote.

### Emoji Shortcodes

Many renderers support emoji via shortcodes.

```markdown
:rocket: :sparkles: :heart: :fire: :tada:
```

**Rendered:** :rocket: :sparkles: :heart: :fire: :tada:

### Highlight

Some renderers support `==highlighted text==`.

```markdown
==This text is highlighted.==
```

### Definition Lists

```markdown
Term 1
: Definition 1

Term 2
: Definition 2
```

---

## 14. Best Practices

### Structure

- Use **one H1** per document — the title.
- Use **H2 for major sections**, H3 for subsections.
- Don't skip levels (don't jump from H1 to H4).
- Keep headings short and descriptive.

### Readability

- Keep paragraphs to **2–4 sentences**.
- Use **blank lines** between paragraphs.
- Use **lists** instead of long comma-separated lists.
- Use **bold** for key terms, not all caps.

### Code

- Always specify the **language** in fenced code blocks.
- Use **inline code** for function names, variables, and commands.
- Keep code examples **short and focused**.

### Tables

- Use tables for **structured data**, not layout.
- Keep cells **short** — long text in tables is hard to read.
- Use alignment to improve readability.

### Links & Images

- Always provide **meaningful link text** — not "click here".
- Always provide **alt text** for images.
- Use **relative paths** for local images.

### General

- **One idea per paragraph.**
- Use **consistent formatting** throughout.
- **Test your document** in the renderer you're targeting.
- Keep it **simple** — Markdown's strength is readability.

---

## Quick Reference Card

| Element | Syntax | Example |
|---|---|---|
| H1 | `#` | `# Title` |
| H2 | `##` | `## Section` |
| Bold | `**text**` | `**bold**` |
| Italic | `*text*` | `*italic*` |
| Strikethrough | `~~text~~` | `~~gone~~` |
| Inline code | `` `text` `` | `` `code` `` |
| Link | `[text](url)` | `[site](url)` |
| Image | `![alt](url)` | `![pic](url)` |
| Blockquote | `>` | `> quote` |
| Bullet | `-` | `- item` |
| Ordered | `1.` | `1. item` |
| Task | `- [ ]` | `- [ ] todo` |
| Code block | ` ``` ` | ` ```js ` |
| Table | `\|` | `\| a \| b \|` |
| Horizontal rule | `---` | `---` |
| Footnote | `[^1]` | `text[^1]` |

---

*This reference covers the core Markdown specification plus the most widely supported extensions. Syntax support may vary between renderers — always test in your target environment.*
```

---
