#!/usr/bin/env python3
"""Local stand-in for Cloudflare static hosting: serves public/ and applies the same rules as public/_redirects
(/login, /signup, /journal-img/*, /meditate/). usage: python3 tests/serve.py [port]"""
import sys, http.server, functools, os
from pathlib import Path
PUB = Path(__file__).resolve().parents[1] / "public"
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split("?")[0].split("#")[0]
        if p in ("/login", "/signup"): p += ".html"
        if p.startswith("/journal-img/"): p = "/deck-img/" + p.rsplit("/", 1)[-1]
        if p == "/meditate/": p = "/meditate/natalie-tones.html"
        return super().translate_path(p)
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8097
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(H, directory=str(PUB))).serve_forever()
