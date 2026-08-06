# make_icon.py — generates a proper multi-size Windows icon from the app logo.
from PIL import Image, ImageDraw
import os

SCALE = 0.82
CORNER = 0.225
BG    = (10, 10, 10, 255)
MARK  = (255, 255, 255, 255)
ARROW = (255, 46, 136, 255)

def rounded_rect(draw, box, radius, fill):
    try:
        draw.rounded_rectangle(box, radius=radius, fill=fill)
    except AttributeError:
        draw.rectangle(box, fill=fill)

def rounded_line(draw, pts, width, fill):
    draw.line(pts, fill=fill, width=int(width), joint="curve")
    r = width / 2.0
    for (x, y) in (pts[0], pts[-1]):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)

def make_logo(size=1024):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_rect(d, (0, 0, size, size), int(size * CORNER), BG)
    scale = (size * SCALE) / 24.0
    off = (size - 24 * scale) / 2.0
    def P(x, y): return (off + x * scale, off + y * scale)
    rounded_line(d, [P(4,5), P(4,16), P(8.5,12.2), P(13,16), P(13,5)], 2.4*scale, MARK)
    w = 2.2*scale
    rounded_line(d, [P(17,10), P(17,19)], w, ARROW)
    rounded_line(d, [P(14,16), P(17,19)], w, ARROW)
    rounded_line(d, [P(17,19), P(20,16)], w, ARROW)
    return img

def main():
    big = make_logo(1024)
    big.resize((512, 512), Image.LANCZOS).save("icon.png")
    # All the sizes Windows asks for (256 gets PNG-compressed automatically)
    sizes = [(16,16),(20,20),(24,24),(32,32),(40,40),(48,48),(64,64),(128,128),(256,256)]
    big.save("icon.ico", sizes=sizes)
    # sanity check
    if os.path.exists("icon.ico") and os.path.getsize("icon.ico") > 1000:
        print("✓ icon.ico created (%d bytes)" % os.path.getsize("icon.ico"))
    else:
        raise SystemExit("✗ icon.ico was NOT created correctly")

if __name__ == "__main__":
    main()