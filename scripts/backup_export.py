#!/usr/bin/env python3
"""Daily backup: everything in Supabase -> one dated folder (+ .tar.gz). Read-only on Supabase.
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 scripts/backup_export.py [--out backups] [--keep 30]
Saves profiles, docs, friends, requests, shares as JSON plus every file in the private `uploads` bucket.
The output contains personal data: keep it private (box disk or a private GitHub Actions artifact), never commit it.
Each run also counts as activity, which keeps the free Supabase project from pausing after 7 idle days."""
import json, os, sys, tarfile, time, shutil, urllib.request, urllib.parse
from pathlib import Path
URL = os.environ.get("SUPABASE_URL", "").rstrip("/"); KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
OUT = Path(arg("--out", "backups")); KEEP = int(arg("--keep", "30"))
if not (URL and KEY): sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY")
H = {"apikey": KEY, **({"Authorization": f"Bearer {KEY}"} if KEY.startswith("eyJ") else {})}
def get(path, raw=False, body=None):
    req = urllib.request.Request(URL + path, headers={**H, **({"Content-Type": "application/json"} if body else {})}, data=json.dumps(body).encode() if body else None, method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=120) as r: t = r.read(); return t if raw else json.loads(t)
stamp = time.strftime("%Y-%m-%d"); d = OUT / f"trusted-tarot-{stamp}"; shutil.rmtree(d, ignore_errors=True); (d / "files").mkdir(parents=True)
for t in ("profiles", "docs", "friendships", "friend_requests", "shares"):
    (d / f"{t}.json").write_text(json.dumps(get(f"/rest/v1/{t}?select=*"), ensure_ascii=False, indent=1))
def walk(prefix=""):
    items = get("/storage/v1/object/list/uploads", body={"prefix": prefix, "limit": 1000, "offset": 0})
    for it in items:
        name = f"{prefix}{it['name']}"
        if it.get("id") is None: yield from walk(name + "/")
        else: yield name
n = 0
for name in walk():
    dst = d / "files" / name; dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(get("/storage/v1/object/uploads/" + urllib.parse.quote(name), raw=True)); n += 1
with tarfile.open(str(d) + ".tar.gz", "w:gz") as tf: tf.add(d, arcname=d.name)
shutil.rmtree(d)
olds = sorted(OUT.glob("trusted-tarot-*.tar.gz"))
for o in olds[:-KEEP]: o.unlink()
print(f"backup {d}.tar.gz ({n} files)")
