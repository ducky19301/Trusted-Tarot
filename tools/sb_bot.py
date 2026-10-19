#!/usr/bin/env python3
"""Box bots (TaroBot / Astro) talking to Natalie's data in Supabase with the SAME API as before (see TAROBOT.md).
It downloads her docs, runs the original server.py on a private temp port against those copies, makes the one call,
then uploads whatever changed (refusing if the app changed the same doc meanwhile).

  export SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=...      # from the box's private env file only
  python3 tools/sb_bot.py GET  /api/outbox/pending
  python3 tools/sb_bot.py POST /api/entries/2026-10-19/astro '{"cardAstro": {"The Star": "..."}}'
  python3 tools/sb_bot.py POST /api/outbox/ob-123/done '{}'
"""
import json, os, socket, subprocess, sys, tempfile, time, urllib.request, urllib.error
from pathlib import Path
URL = os.environ.get("SUPABASE_URL", "").rstrip("/"); KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SERVER = Path(os.environ.get("TAROT_SERVER", "/workspace/tarot-app/server.py"))
CARDS_DIR = Path(os.environ.get("TAROT_CARDS_DIR", SERVER.parent / "data"))
KINDS = {"entries": "entries.json", "guests": "guests.json", "practice": "practice.json", "outbox": "outbox.json", "gaps": "gaps.json"}

def rest(method, path, body=None, headers=None):
    h = {"apikey": KEY, **({"Authorization": f"Bearer {KEY}"} if KEY.startswith("eyJ") else {}), "Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read(); return json.loads(t) if t else None

def main():
    if not (URL and KEY): sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY")
    method, path = sys.argv[1].upper(), sys.argv[2]; body = sys.argv[3] if len(sys.argv) > 3 else None
    owner = rest("GET", "/rest/v1/profiles?is_owner=eq.true&select=id")
    if len(owner) != 1: sys.exit("expected exactly one owner profile")
    uid = owner[0]["id"]
    docs = {d["kind"]: d for d in rest("GET", f"/rest/v1/docs?user_id=eq.{uid}&select=kind,data,updated_at")}
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp); before = {}
        for k, f in KINDS.items():
            data = docs[k]["data"] if k in docs else ([] if k != "practice" else None)
            if data is not None: (tmp / f).write_text(json.dumps(data, ensure_ascii=False)); before[k] = (tmp / f).read_text()
        s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
        env = dict(os.environ, PORT=str(port), TAROT_HOST="127.0.0.1", TAROT_DATA_DIR=str(tmp), TAROT_ENTRIES=str(tmp / "entries.json"),
                   TAROT_JOURNAL_IMG=str(tmp / "img"), TAROT_PRACTICE=str(tmp / "practice.json"),
                   TAROT_CARDS=str(CARDS_DIR / "cards.json"), TAROT_KNOWLEDGE=str(CARDS_DIR / "card-knowledge.json"))
        proc = subprocess.Popen([sys.executable, str(SERVER)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try: socket.create_connection(("127.0.0.1", port), 0.2).close(); break
                except OSError: time.sleep(0.05)
            req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=body.encode() if body else (b"{}" if method == "POST" else None),
                                         method=method, headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=60) as r: status, out = r.status, r.read().decode()
            except urllib.error.HTTPError as e: status, out = e.code, e.read().decode()
        finally:
            proc.terminate(); proc.wait(5)
        print(out)
        if status >= 400: sys.exit(1)
        for k, f in KINDS.items():
            p = tmp / f
            if not p.exists() or p.read_text() == before.get(k): continue
            new = json.loads(p.read_text())
            if k in docs:
                res = rest("PATCH", f"/rest/v1/docs?user_id=eq.{uid}&kind=eq.{k}&updated_at=eq.{urllib.parse.quote(docs[k]['updated_at'])}",
                           {"data": new, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())}, {"Prefer": "return=representation"})
                if not res: sys.exit(f"{k} changed in the app meanwhile; nothing saved for it. Run the command again.")
            else:
                rest("POST", "/rest/v1/docs", {"user_id": uid, "kind": k, "data": new}, {"Prefer": "return=minimal"})
            print(f"saved {k}", file=sys.stderr)

import urllib.parse  # noqa: E402
if __name__ == "__main__":
    main()
