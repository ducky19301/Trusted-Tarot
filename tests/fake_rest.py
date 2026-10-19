#!/usr/bin/env python3
"""Tiny stand-in for Supabase's REST API (profiles + docs only), used to test tools/sb_bot.py offline."""
import json, sys, http.server, urllib.parse
from pathlib import Path
EXP = Path(__file__).resolve().parents[1] / "migration" / "export"
UID = "11111111-1111-1111-1111-111111111111"
DOCS = {f.stem: {"kind": f.stem, "data": json.loads(f.read_text()), "updated_at": "2026-10-19T00:00:00.000Z"} for f in (EXP / "docs").glob("*.json")}
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/rest/v1/profiles": return self.send([{"id": UID}])
        if u.path == "/rest/v1/docs": return self.send(list(DOCS.values()))
        if u.path == "/dump": return self.send(DOCS)
        self.send({}, 404)
    def do_PATCH(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query); k = q["kind"][0].split(".", 1)[1]; ver = q["updated_at"][0].split(".", 1)[1]
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if DOCS[k]["updated_at"] != ver: return self.send([])
        DOCS[k].update(body); self.send([DOCS[k]])
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
