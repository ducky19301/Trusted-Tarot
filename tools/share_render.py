#!/usr/bin/env python3
"""v16: render one guest reading to PNG (stdout) or PDF (stdout). stdin: JSON job from server.py."""
import io, json, sys, textwrap
from PIL import Image, ImageDraw, ImageFont
J = json.load(sys.stdin)
F = "/usr/share/fonts/truetype/dejavu/"
serif = lambda n: ImageFont.truetype(F + "DejaVuSerif-Bold.ttf", n)
sans = lambda n: ImageFont.truetype(F + "DejaVuSans.ttf", n)
sansb = lambda n: ImageFont.truetype(F + "DejaVuSans-Bold.ttf", n)
W, PAD, BG, GOLD, TEXT, MUTED = 1080, 64, (7, 6, 15), (212, 175, 55), (243, 239, 230), (168, 160, 184)
blocks = []   # (kind, payload)
def para(t, font=None, color=TEXT):
    if t: blocks.append(("text", (str(t), font or sans(28), color)))
blocks.append(("text", (f"Reading for {J['guest']}", serif(56), GOLD)))
sub = " · ".join(x for x in [J.get("date"), J.get("spread")] if x)
para(sub, sans(28), MUTED)
if J.get("question"): para(f"“{J['question']}”", sans(30), TEXT)
if J.get("birth"): para(f"Born {J['birth']}" + (f" · Sun in {J['sun']}" if J.get("sun") else ""), sans(26), MUTED)
blocks.append(("cards", J["cards"]))
for c in J["cards"]:
    para(f"{(c.get('position') + ': ') if c.get('position') and c['position'].lower() not in ('upright','reversed') else ''}{c['name']} ({c.get('orientation') or 'upright'})", sansb(30), GOLD)
    gc = next((x for x in ((J.get("generated") or {}).get("cards") or []) if x.get("name") == c["name"]), None)
    if gc and gc.get("core"): para(gc["core"])
gen = J.get("generated") or {}
if gen.get("summary"): para("Together", sansb(30), GOLD); para(gen["summary"])
if gen.get("forGuest"): para(gen["forGuest"].get("title"), sansb(30), GOLD); [para("• " + n) for n in gen["forGuest"].get("notes", [])]
if J.get("reading"): para("Reading", sansb(30), GOLD); para(J["reading"])
if J.get("note"): para("Note: " + J["note"], sans(26), MUTED)
para(J.get("brand") or "Tarot", sans(22), MUTED)
# layout
def layout():
    items, y = [], PAD
    d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    for k, p in blocks:
        if k == "text":
            t, f, col = p
            cw = max(10, int((W - 2 * PAD) / (f.size * 0.55)))
            for line in sum([textwrap.wrap(x, cw) or [""] for x in t.split("\n")], []):
                items.append(("t", y, line, f, col)); y += int(f.size * 1.4)
            y += 14
        else:
            n = len(p); cw = min(220, (W - 2 * PAD - (n - 1) * 16) // max(n, 1)); ch = int(cw * 1.72)
            items.append(("c", y, p, cw, ch)); y += ch + 28
    return items, y + PAD
items, H = layout()
img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
d.rectangle([20, 20, W - 20, H - 20], outline=(90, 75, 30), width=2)
for it in items:
    if it[0] == "t": d.text((PAD, it[1]), it[2], font=it[3], fill=it[4])
    else:
        _, y, cards, cw, ch = it; x = PAD
        for c in cards:
            try:
                ci = Image.open(c["img"]).convert("RGB").resize((cw, ch))
                if str(c.get("orientation")).lower() == "reversed": ci = ci.rotate(180)
                img.paste(ci, (x, y))
            except Exception:
                d.rectangle([x, y, x + cw, y + ch], outline=GOLD)
            x += cw + 16
out = io.BytesIO()
if J["fmt"] == "png":
    img.save(out, "PNG", optimize=True)
else:
    PH = int(W * 1.414); pages = [img.crop((0, t, W, min(H, t + PH))) for t in range(0, H, PH)]
    pages = [p if p.height == PH else (lambda q: (q.paste(p, (0, 0)), q)[1])(Image.new("RGB", (W, PH), BG)) for p in pages]
    pages[0].save(out, "PDF", resolution=110, save_all=True, append_images=pages[1:])
sys.stdout.buffer.write(out.getvalue())
