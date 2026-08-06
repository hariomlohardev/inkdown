# make_icon.py — auto-generates the Inkdown app icon from the same logo used in the UI.
# Requires: pip install pillow
from PIL import Image, ImageDraw

SCALE = 0.82          # how much of the icon the logo occupies (tweak to taste)
CORNER = 0.225        # rounded-square corner radius as a fraction of size

# Brand colors (match the web logo)
BG    = (10, 10, 10, 255)        # near-black square  (var(--ink))
MARK  = (255, 255, 255, 255)     # white "M"          (var(--bg))
ARROW = (255, 46, 136, 255)      # pink arrow         (#ff2e88)


def rounded_rect(draw, box, radius, fill):
    try:
        draw.rounded_rectangle(box, radius=radius, fill=fill)
    except AttributeError:               # very old Pillow fallback
        draw.rectangle(box, fill=fill)


def rounded_line(draw, pts, width, fill):
    """Thick polyline with rounded joints + rounded end caps."""
    draw.line(pts, fill=fill, width=int(width), joint="curve")
    r = width / 2.0
    for (x, y) in (pts[0], pts[-1]):     # caps at both ends
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def make_logo(size=1024):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 1) rounded-square background
    rounded_rect(d, (0, 0, size, size), int(size * CORNER), BG)

    # 2) map the 24x24 SVG viewBox onto the canvas, centered
    scale = (size * SCALE) / 24.0
    off = (size - 24 * scale) / 2.0
    def P(x, y):
        return (off + x * scale, off + y * scale)

    # 3) white "M"   →  M4 5 v11 l4.5 -3.8 L13 16 V5
    m_pts = [P(4, 5), P(4, 16), P(8.5, 12.2), P(13, 16), P(13, 5)]
    rounded_line(d, m_pts, 2.4 * scale, MARK)

    # 4) pink down arrow  →  shaft M17 10 v9, head to (14,16) and (20,16)
    w = 2.2 * scale
    rounded_line(d, [P(17, 10), P(17, 19)], w, ARROW)      # shaft
    rounded_line(d, [P(14, 16), P(17, 19)], w, ARROW)      # head left
    rounded_line(d, [P(17, 19), P(20, 16)], w, ARROW)      # head right

    return img


def main():
    big = make_logo(1024)

    # PNG for manifest / general use
    big.resize((512, 512), Image.LANCZOS).save("icon.png")

    # Windows .ico with every size the OS asks for
    ico_sizes = [(16, 16), (20, 20), (24, 24), (32, 32), (40, 40),
                 (48, 48), (64, 64), (128, 128), (256, 256)]
    big.save("icon.ico", sizes=ico_sizes)

    print("✓ Created icon.ico and icon.png")


if __name__ == "__main__":
    main()