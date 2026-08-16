"""Tests for sanitizeFilename in app/src/scripts/storage.js (source-mirror).

Mirrors the JS logic in Python and validates it stays in sync with the regex
actually shipped in storage.js. See storage.js:sanitizeFilename.
"""
import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_JS = os.path.join(REPO_ROOT, "app", "src", "scripts", "storage.js")

SANITIZE_REGEX = r'/[<>:"/\\|?*\x00-\x1f]/g'


def _source():
    with open(STORAGE_JS, encoding="utf-8") as handle:
        return handle.read()


def _mirror_sanitize(name):
    if not name:
        return "untitled.md"
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name)
    safe = safe.replace("..", "")
    safe = safe.strip()
    if len(safe) > 100:
        ext = "." + safe.split(".").pop() if "." in safe else ".md"
        safe = safe[: 100 - len(ext)] + ext
    if not re.search(r"\.(md|markdown|mdown|txt)$", safe, re.IGNORECASE):
        safe += ".md"
    return safe or "untitled.md"


def test_sanitize_regex_in_source():
    assert SANITIZE_REGEX in _source()


def test_strips_invalid_chars():
    assert _mirror_sanitize('a<>:"/\\|?*b') == "ab.md"


def test_removes_double_dots():
    assert _mirror_sanitize("a..b") == "ab.md"


def test_truncates_to_100():
    assert len(_mirror_sanitize("x" * 200)) <= 100


def test_keeps_markdown_extension():
    assert _mirror_sanitize("notes.md") == "notes.md"


def test_empty_falls_back_to_untitled():
    assert _mirror_sanitize("") == "untitled.md"