#!/usr/bin/env python3
"""Build public/ (the Cloudflare static site) from the live app sources. Read-only on the sources.
Usage: python3 scripts/build_static.py [--src /workspace/tarot-app]"""
import json, shutil, sys, os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[sys.argv.index("--src") + 1]) if "--src" in sys.argv else Path("/workspace/tarot-app")
OUT = ROOT / "public"
DECK = Path("/workspace/tarot-deck/img"); SOUND = Path("/workspace/frequency-soundboard")
MAX = 25 * 1024 * 1024 - 1   # Cloudflare Pages per-file limit
sys.path.insert(0, str(SRC))
os.environ.setdefault("TAROT_DATA_DIR", str(SRC / "data"))
import server  # noqa: E402  (only uses load_cards; does not start anything)

def copytree(a, b, skip_big=True):
    b.mkdir(parents=True, exist_ok=True)
    for f in sorted(a.iterdir()):
        if f.is_file() and not f.name.startswith(".") and (not skip_big or f.stat().st_size <= MAX):
            shutil.copy2(f, b / f.name)
        elif f.is_file():
            print("skipped (over 25 MB):", f.name)

# app shell: our overlay files (web/) win over the live static/ files
for d in ("deck-img", "deck-thumb", "meditate", "icons", "data"):
    shutil.rmtree(OUT / d, ignore_errors=True)
OUT.mkdir(exist_ok=True)
copytree(SRC / "static" / "icons", OUT / "icons")
for f in ("app.css", "practice-data.js", "practice.js", "manifest.webmanifest"):
    shutil.copy2(SRC / "static" / f, OUT / f)
for f in (ROOT / "web").rglob("*"):
    if f.is_file():
        (OUT / f.relative_to(ROOT / "web")).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, OUT / f.relative_to(ROOT / "web"))
(OUT / "data").mkdir(exist_ok=True)
(OUT / "data" / "cards.json").write_text(json.dumps(server.load_cards(), ensure_ascii=False, separators=(",", ":")))
copytree(DECK, OUT / "deck-img")
copytree(SRC / "thumbs", OUT / "deck-thumb")
copytree(SOUND, OUT / "meditate")
print("built", OUT)
