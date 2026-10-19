#!/usr/bin/env python3
"""Make ~240px-wide JPEG thumbnails of the 78 deck images for the Cards grid and pickers.
Run: /workspace/.tools-venv/bin/python tools/make_thumbs.py   (needs Pillow; re-run if deck art changes)
Output: /workspace/tarot-app/thumbs/<id>.jpg, served by server.py at /deck-thumb/<id>.jpg."""
import os, sys
from pathlib import Path
from PIL import Image

SRC = Path(os.environ.get("TAROT_DECK_IMG", "/workspace/tarot-deck/img"))
DST = Path(__file__).resolve().parent.parent / "thumbs"
WIDTH = 240

DST.mkdir(exist_ok=True)
total_in = total_out = n = 0
for src in sorted(SRC.glob("*.jpg")):
    dst = DST / src.name
    with Image.open(src) as im:
        im = im.convert("RGB")
        h = round(im.height * WIDTH / im.width)
        im.resize((WIDTH, h), Image.LANCZOS).save(dst, "JPEG", quality=70, optimize=True, progressive=True)
    total_in += src.stat().st_size; total_out += dst.stat().st_size; n += 1
print(f"{n} thumbnails -> {DST}  ({total_in/1e6:.1f} MB -> {total_out/1e6:.2f} MB)")
sys.exit(0 if n else 1)
