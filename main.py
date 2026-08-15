#!/usr/bin/env python3
"""Shim for backward compatibility — delegates to src/inkdown."""

import sys
import os

# Ensure src/ is on path so `import inkdown` works when running `python main.py`
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from inkdown.__main__ import main

if __name__ == "__main__":
    main()
