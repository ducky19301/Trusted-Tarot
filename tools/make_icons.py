#!/usr/bin/env python3
"""Generate the dark-and-gold app icons (needs Pillow; run with /workspace/.tools-venv/bin/python)."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

OUT = Path(__file__).resolve().parent.parent / "static" / "icons"
S = 2048  # supersampled canvas


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def background():
    img = Image.new("RGB", (S, S), (7, 6, 15))
    # soft indigo glow from the top, like the app background
    glow = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(glow)
    d.ellipse((-S * 0.3, -S * 0.55, S * 1.3, S * 0.75), fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.18))
    img = Image.composite(Image.new("RGB", (S, S), (38, 33, 82)), img, glow)
    return img


def gold_fill():
    """Vertical gold gradient: champagne -> gold -> antique."""
    g = Image.new("RGB", (1, S))
    stops = [(0.0, (240, 222, 150)), (0.45, (212, 175, 55)), (1.0, (150, 112, 32))]
    for y in range(S):
        t = y / (S - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                g.putpixel((0, y), lerp(c0, c1, (t - t0) / (t1 - t0)))
                break
    return g.resize((S, S))


def star_mask(cx, cy, r, inner=0.28, points=4, rot=0.0):
    m = Image.new("L", (S, S), 0)
    pts = []
    for i in range(points * 2):
        a = rot + math.pi * i / points - math.pi / 2
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def emblem(scale):
    """Crescent + two small four-point stars, as an L mask, centred, sized by scale (0..1 of canvas)."""
    m = Image.new("L", (S, S), 0)
    R = S * 0.30 * scale
    cx, cy = S * 0.5 - R * 0.12, S * 0.5
    d = ImageDraw.Draw(m)
    d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=255)
    cut = Image.new("L", (S, S), 0)
    ox, oy, r2 = cx + R * 0.42, cy - R * 0.22, R * 0.86
    ImageDraw.Draw(cut).ellipse((ox - r2, oy - r2, ox + r2, oy + r2), fill=255)
    m = ImageChops.subtract(m, cut)
    m = ImageChops.lighter(m, star_mask(cx + R * 0.78, cy - R * 0.02, R * 0.30))
    m = ImageChops.lighter(m, star_mask(cx + R * 0.60, cy + R * 0.40, R * 0.13))
    m = ImageChops.lighter(m, star_mask(cx + R * 1.02, cy - R * 0.62, R * 0.10))
    return m


def ring(scale):
    m = Image.new("L", (S, S), 0)
    r = S * 0.43 * scale
    w = max(2, int(S * 0.006))
    ImageDraw.Draw(m).ellipse((S / 2 - r, S / 2 - r, S / 2 + r, S / 2 + r), outline=150, width=w)
    return m


def render(scale, with_ring=True):
    img = background()
    gold = gold_fill()
    em = emblem(scale)
    halo = em.filter(ImageFilter.GaussianBlur(S * 0.03)).point(lambda v: int(v * 0.45))
    img = Image.composite(Image.new("RGB", (S, S), (212, 175, 55)), img, halo)
    if with_ring:
        img = Image.composite(gold, img, ring(scale))
    img = Image.composite(gold, img, em)
    return img


def save(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print("wrote", OUT / name)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    full = render(1.0)
    save(full, 512, "icon-512.png")
    save(full, 192, "icon-192.png")
    save(full, 180, "apple-touch-icon.png")
    save(full, 32, "favicon-32.png")
    # maskable: keep everything inside the central 80% safe zone
    save(render(0.72), 512, "icon-maskable-512.png")


if __name__ == "__main__":
    main()
