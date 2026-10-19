#!/usr/bin/env python3
"""Step 1 of the move: copy Natalie's current data into a Supabase-ready folder (read-only on the live app).
   python3 scripts/migrate_export.py [--out migration/export]
Writes: profile.json, docs/<kind>.json (entries, guests, practice, outbox, gaps), files/<path> (photos + journal PDF),
manifest.json. The folder holds personal data: it is git-ignored and must never be committed."""
import json, shutil, sys, os, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
LIVE = Path(os.environ.get("TAROT_LIVE", "/workspace/tarot-app"))
OUT = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT / "migration" / "export"
DATA = LIVE / "data"
ENTRIES = Path(os.environ.get("TAROT_ENTRIES", "/workspace/tarot-journal/entries.json"))
PDF = Path(os.environ.get("TAROT_PDF", "/workspace/tarot-journal/Natalie-Tarot-Journal.pdf"))

def rd(p, default):
    try: return json.loads(Path(p).read_text())
    except FileNotFoundError: return default

shutil.rmtree(OUT, ignore_errors=True); (OUT / "docs").mkdir(parents=True); (OUT / "files").mkdir()
users = rd(DATA / "users.json", {})
nat = users.get("natalie", {})
sys.path.insert(0, str(LIVE)); import server  # noqa: E402  (constants only)
full = dict(server.NATALIE_BIRTH or {})
profile = {"username": "natalie", "display": nat.get("display") or "Natalie", "is_owner": True,
           "birth": {k: full.get(k) for k in ("y", "m", "d", "hour", "minute", "tz", "lat", "lon", "place")} if full else nat.get("birth")}
(OUT / "profile.json").write_text(json.dumps(profile, indent=2))
docs = {"entries": rd(ENTRIES, []), "guests": rd(DATA / "guests.json", []), "practice": rd(DATA / "practice.json", None) or server.empty_practice(),
        "outbox": rd(DATA / "outbox.json", []), "gaps": rd(DATA / "gaps.json", [])}
files = []
def want(rel):
    src = DATA / rel
    if src.is_file() and rel not in files:
        dst = OUT / "files" / rel; dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dst); files.append(rel)
    elif not src.is_file(): print("missing file (skipped):", rel)
for d in docs["entries"]: [want(p) for p in d.get("photos") or []]
for g in docs["guests"]:
    for r in g.get("readings") or []: [want(p) for p in r.get("photos") or []]
for o in docs["outbox"]: [want(p) for p in o.get("photos") or []]
for f in (DATA / "uploads").rglob("*"):   # anything else uploaded (keeps orphans too)
    if f.is_file() and not f.name.startswith("."): want(str(f.relative_to(DATA)))
if PDF.is_file():
    shutil.copy2(PDF, OUT / "files" / "journal.pdf"); files.append("journal.pdf")
for k, v in docs.items(): (OUT / "docs" / f"{k}.json").write_text(json.dumps(v, ensure_ascii=False, indent=1))
others = [u for u in users if u != "natalie"]
man = {"profile": "natalie", "docs": {k: (len(v) if isinstance(v, list) else len(v.get("reviews", {}))) for k, v in docs.items()},
       "files": files, "sha256": {f: hashlib.sha256((OUT / "files" / f).read_bytes()).hexdigest() for f in files},
       "other_accounts_not_moved": others,
       "social": rd(DATA / "social.json", {}).get("friends", [])}
(OUT / "manifest.json").write_text(json.dumps(man, indent=2))
print(json.dumps({k: man[k] for k in ("docs", "other_accounts_not_moved")}), len(files), "files ->", OUT)
