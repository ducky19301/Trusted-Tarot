#!/usr/bin/env python3
"""Step 2 of the move: load migration/export into Supabase (run once, after supabase/schema.sql).
   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=... NATALIE_PASSWORD=... python3 scripts/migrate_import.py [--dry-run]
The service key and password are read from the environment only and never written anywhere.
Creates (or finds) Natalie's login natalie@<email domain>, marks her as owner with her full birth chart,
uploads every doc and file. Safe to re-run: docs are upserted, files overwritten."""
import json, os, sys, urllib.request, urllib.error, mimetypes
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
EXP = Path(sys.argv[sys.argv.index("--from") + 1]) if "--from" in sys.argv else ROOT / "migration" / "export"
DRY = "--dry-run" in sys.argv
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
PW = os.environ.get("NATALIE_PASSWORD", "")
DOMAIN = os.environ.get("TAROT_EMAIL_DOMAIN", "users.trustedtarot.app")
if not DRY and not (URL and KEY and len(PW) >= 8):
    sys.exit("Set SUPABASE_URL, SUPABASE_SERVICE_KEY and NATALIE_PASSWORD (8+ chars) first.")

def call(method, path, body=None, headers=None, raw=None):
    h = {"apikey": KEY, **({"Authorization": f"Bearer {KEY}"} if KEY.startswith("eyJ") else {}), **(headers or {})}
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    if body is not None and raw is None: h["Content-Type"] = "application/json"
    if DRY:
        print("DRY", method, path, (len(data) if data else 0), "bytes"); return {} if "users" not in path else {"id": "00000000-0000-0000-0000-000000000000", "users": []}
    req = urllib.request.Request(URL + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read(); return json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode(errors='replace')[:300]}")

prof = json.loads((EXP / "profile.json").read_text())
email = f"{prof['username']}@{DOMAIN}"
b = prof.get("birth") or {}
meta = {"username": prof["username"], "display": prof["display"], "birth": f"{b['y']:04d}-{b['m']:02d}-{b['d']:02d}" if b.get("y") else None}
try:
    uid = call("POST", "/auth/v1/admin/users", {"email": email, "password": PW, "email_confirm": True, "user_metadata": meta})["id"]
    print("created login", email)
except RuntimeError as e:
    if "already" not in str(e).lower() and "exists" not in str(e).lower(): raise
    users = call("GET", "/auth/v1/admin/users?per_page=1000").get("users", [])
    uid = next(u["id"] for u in users if u.get("email") == email)
    call("PUT", f"/auth/v1/admin/users/{uid}", {"password": PW})
    print("found existing login", email, "(password reset to NATALIE_PASSWORD)")
call("PATCH", f"/rest/v1/profiles?id=eq.{uid}", {"is_owner": bool(prof.get("is_owner")), "birth": b or None, "display": prof["display"]},
     {"Prefer": "return=minimal"})
for f in sorted((EXP / "docs").glob("*.json")):
    call("POST", "/rest/v1/docs?on_conflict=user_id,kind", {"user_id": uid, "kind": f.stem, "data": json.loads(f.read_text())},
         {"Prefer": "resolution=merge-duplicates,return=minimal"})
    print("doc", f.stem)
man = json.loads((EXP / "manifest.json").read_text())
for rel in man["files"]:
    p = EXP / "files" / rel
    ctype = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    call("POST", f"/storage/v1/object/uploads/{uid}/{rel}", raw=p.read_bytes(), headers={"Content-Type": ctype, "x-upsert": "true"})
    print("file", rel)
if man.get("other_accounts_not_moved"):
    print("NOTE: these old accounts were not moved (they can sign up again):", man["other_accounts_not_moved"])
print("done. Natalie signs in with username 'natalie' and NATALIE_PASSWORD.")
