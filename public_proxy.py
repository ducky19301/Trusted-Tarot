#!/usr/bin/env python3
"""Password gate for phone access (stdlib only).

Listens on 127.0.0.1:8091 and forwards every request to the tarot app on
127.0.0.1:8090 once the browser holds a valid signed session cookie.
Port 8090 itself stays open and unauthenticated for the local routines.

* GET/POST /login   one-password login page (styled like the app)
* POST /logout      clears the cookie
* GET /auth/status  200 when logged in (the app uses it to show "Log out")
* /manifest.webmanifest, /icons/*, /sw.js, /robots.txt, /favicon.ico are
  served without auth so iOS/Android can read them before login.

Auth data (PBKDF2 hash + cookie secret) lives in data/public-auth.json,
created by public_auth_setup.py. The file is re-read when it changes, so a
password reset takes effect without restarting the proxy.
"""
import hashlib
import hmac
import html
import http.client
import json
import os
import secrets
import sys
import threading
import accounts
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

APP_DIR = Path(__file__).resolve().parent
AUTH_FILE = Path(os.environ.get("TAROT_PUBLIC_AUTH", APP_DIR / "data" / "public-auth.json"))
LISTEN_HOST = os.environ.get("PROXY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("PROXY_PORT", "8091"))
UP_HOST = os.environ.get("UPSTREAM_HOST", "127.0.0.1")
UP_PORT = int(os.environ.get("UPSTREAM_PORT", "8090"))

COOKIE = "tarot_session"
SESSION_DAYS = 90
MAX_AGE = SESSION_DAYS * 86400
RENEW_AFTER = 7 * 86400          # re-issue the cookie weekly so an active phone never expires
MAX_BODY = 100 * 1024 * 1024     # app allows 80 MB JSON (base64 photos)
CHUNK = 64 * 1024

PUBLIC_EXACT = {"/manifest.webmanifest", "/sw.js", "/robots.txt", "/favicon.ico"}
PUBLIC_PREFIX = ("/icons/",)

# rate limiting of failed logins
IP_MAX_FAILS, IP_WINDOW = 5, 15 * 60          # 5 wrong tries per client per 15 min
GLOBAL_MAX_FAILS, GLOBAL_WINDOW = 30, 60 * 60  # 30 wrong tries in total per hour
_fail_lock = threading.Lock()
_fails = {}        # client -> [timestamps]
_global_fails = []

HOP = {"connection", "keep-alive", "proxy-connection", "proxy-authenticate", "proxy-authorization",
       "te", "trailer", "trailers", "transfer-encoding", "upgrade", "expect"}


def log(msg):
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


# ---------- auth file ----------
class Auth:
    def __init__(self, path):
        self.path = path
        self.mtime = None
        self.data = None
        self.lock = threading.Lock()

    def get(self):
        with self.lock:
            try:
                m = self.path.stat().st_mtime_ns
            except FileNotFoundError:
                raise SystemExit(f"{self.path} missing: run public_auth_setup.py first")
            if m != self.mtime:
                with open(self.path, encoding="utf-8") as f:
                    self.data = json.load(f)
                self.mtime = m
            return self.data


AUTH = Auth(AUTH_FILE)


def _normalize_pw(pw):
    # Phones often turn "-" into an en/em dash, add a trailing space, or capitalize.
    for ch in "\u2010\u2011\u2012\u2013\u2014\u2015\u2212\ufe63\uff0d":
        pw = pw.replace(ch, "-")
    return pw.strip().lower()


def check_password(pw):
    return _check_exact(pw) or _check_exact(_normalize_pw(pw))


def _check_exact(pw):
    p = AUTH.get()["password"]
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), bytes.fromhex(p["salt"]), int(p["iterations"]))
    return hmac.compare_digest(dk.hex(), p["hash"])


def _sig(payload):
    secret = bytes.fromhex(AUTH.get()["cookie_secret"])
    return hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()


def make_token(user="natalie"):
    payload = f"v2.{AUTH.get().get('session_epoch', 1)}.{int(time.time())}.{secrets.token_hex(8)}.{user}"
    return f"{payload}.{_sig(payload)}"


def token_user(tok):
    """v16: (age, username) of a valid token, else (None, None). Old v1 cookies are Natalie's."""
    age = token_age(tok)
    if age is None:
        return None, None
    parts = tok.split(".")
    user = parts[4] if parts[0] == "v2" else "natalie"
    return (age, user) if accounts.get(user) else (None, None)


def token_age(tok):
    """Return age in seconds of a valid token, else None."""
    try:
        parts = tok.split(".")
        if parts[0] == "v2" and len(parts) == 6:
            v, epoch, issued, nonce, _u, sig = parts
            payload = f"{v}.{epoch}.{issued}.{nonce}.{_u}"
        else:
            v, epoch, issued, nonce, sig = parts
            payload = f"{v}.{epoch}.{issued}.{nonce}"
        if v not in ("v1", "v2") or not hmac.compare_digest(_sig(payload), sig):
            return None
        if int(epoch) != int(AUTH.get().get("session_epoch", 1)):
            return None
        age = time.time() - int(issued)
        if age > MAX_AGE or age < -300:
            return None
        return age
    except (ValueError, AttributeError):
        return None


def session_cookie(tok, max_age=MAX_AGE):
    return f"{COOKIE}={tok}; Max-Age={max_age}; Path=/; HttpOnly; Secure; SameSite=Lax"


# ---------- rate limiting ----------
def _prune(now):
    for k in list(_fails):
        _fails[k] = [t for t in _fails[k] if now - t < IP_WINDOW]
        if not _fails[k]:
            del _fails[k]
    _global_fails[:] = [t for t in _global_fails if now - t < GLOBAL_WINDOW]


def login_blocked(client):
    now = time.time()
    with _fail_lock:
        _prune(now)
        if len(_fails.get(client, [])) >= IP_MAX_FAILS:
            return int(IP_WINDOW - (now - _fails[client][0])) + 1
        if len(_global_fails) >= GLOBAL_MAX_FAILS:
            return int(GLOBAL_WINDOW - (now - _global_fails[0])) + 1
    return 0


def record_fail(client):
    now = time.time()
    with _fail_lock:
        _fails.setdefault(client, []).append(now)
        _global_fails.append(now)


def clear_fails(client):
    with _fail_lock:
        _fails.pop(client, None)


# ---------- login page ----------
HEAD_META = """<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#07060f" />
<meta name="robots" content="noindex, nofollow" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Tarot" />
<meta name="application-name" content="Tarot" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />"""

LOGIN_PAGE = """<!DOCTYPE html>
<html lang="en"><head>
{meta}
<title>Tarot · Sign in</title>
<style>
:root {{ --bg:#07060f; --gold:#d4af37; --gold-soft:#e8d48b; --gold-dim:rgba(212,175,55,.32);
  --text:#f3efe6; --muted:#a8a0b8; --serif:"Cormorant Garamond",Georgia,"Times New Roman",serif;
  --sans:"Outfit",system-ui,-apple-system,"Segoe UI",sans-serif; }}
*,*::before,*::after {{ box-sizing:border-box; }}
html,body {{ margin:0; }}
body {{ min-height:100dvh; display:grid; place-items:center; color:var(--text); font-family:var(--sans);
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
  padding:calc(1.5rem + env(safe-area-inset-top)) calc(1.25rem + env(safe-area-inset-right))
          calc(1.5rem + env(safe-area-inset-bottom)) calc(1.25rem + env(safe-area-inset-left));
  background:radial-gradient(ellipse 80% 50% at 50% -10%, rgba(61,53,120,.5), transparent 60%),
    radial-gradient(ellipse 60% 40% at 100% 100%, rgba(42,36,88,.35), transparent 55%), var(--bg);
  background-attachment:fixed; }}
.card {{ width:100%; max-width:360px; text-align:center; padding:2.2rem 1.6rem 1.8rem; border-radius:18px;
  background:rgba(20,18,42,.72); border:1px solid var(--gold-dim); box-shadow:0 18px 50px rgba(0,0,0,.55); }}
.mark {{ width:72px; height:72px; border-radius:18px; display:block; margin:0 auto 1rem;
  box-shadow:0 0 0 1px var(--gold-dim), 0 0 40px rgba(212,175,55,.15); }}
.eyebrow {{ margin:0; letter-spacing:.3em; text-transform:uppercase; font-size:.68rem; color:var(--gold-soft); font-weight:500; }}
h1 {{ margin:.25rem 0 .2rem; font-family:var(--serif); font-weight:600; font-size:2.2rem; letter-spacing:.04em;
  text-shadow:0 0 40px rgba(212,175,55,.18); }}
p.sub {{ margin:0 0 1.5rem; color:var(--muted); font-weight:300; font-size:.95rem; }}
label {{ display:block; text-align:left; font-size:.8rem; color:var(--muted); margin-bottom:.35rem; letter-spacing:.04em; }}
input[type=password], input[type=text], input[type=date] {{ margin-bottom:.8rem;  width:100%; min-height:48px; font:400 16px var(--sans); color:var(--text); background:rgba(7,6,15,.65);
  border:1px solid rgba(212,175,55,.3); border-radius:12px; padding:.7rem .9rem; outline:none; }}
input:focus {{ border-color:var(--gold); box-shadow:0 0 0 3px rgba(212,175,55,.18); }}
button {{ margin-top:1rem; width:100%; min-height:48px; font:600 1rem var(--sans); letter-spacing:.04em; color:#1a1405;
  border:0; border-radius:999px; cursor:pointer; background:linear-gradient(180deg,#e8d48b,#d4af37);
  box-shadow:0 6px 24px rgba(212,175,55,.25); }}
button:active {{ transform:translateY(1px); }}
.err {{ margin:1rem 0 0; min-height:1.3em; color:#e6a0b8; font-size:.9rem; }}
.foot {{ margin:1.4rem 0 0; color:var(--muted); font-size:.75rem; opacity:.7; }}
</style>
</head><body>
<main class="card">
  <img class="mark" src="/icons/icon-192.png" alt="" width="72" height="72" />
  <p class="eyebrow">Tarot</p>
  <h1>{title}</h1>
  <p class="sub">{sub}</p>
  <form method="post" action="{action}" autocomplete="on">{extra}
    <label for="un">Username</label>
    <input id="un" type="text" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Natalie: you can leave this blank" />
    <input type="hidden" name="next" value="{next}" />
    <label for="pw">Password</label>
    <input id="pw" type="password" name="password" autocomplete="current-password" autocapitalize="none"
      autocorrect="off" spellcheck="false" required autofocus />
    {after}<button type="submit">{button}</button>
    <p class="err" role="alert">{error}</p>
  </form>
  <p class="foot"><a href="/signup{nextq}" style="color:var(--gold-soft)">New here? Create your own account</a></p>
  <p class="foot">Private · stays signed in on this device for {days} days</p>
</main>
</body></html>"""


def safe_next(n):
    n = (n or "/").strip()
    if not n.startswith("/") or n.startswith("//") or "\\" in n or n.startswith("/login") or n.startswith("/logout"):
        return "/"
    return n


# ---------- handler ----------
class Proxy(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "TarotGate/1.0"
    sys_version = ""
    timeout = 300
    _body_done = False

    def log_message(self, fmt, *args):
        log(f"{self.client_key()} {fmt % args}")

    def client_key(self):
        return (self.headers.get("CF-Connecting-IP") or
                (self.headers.get("X-Forwarded-For") or "").split(",")[0].strip() or
                self.client_address[0]) if hasattr(self, "headers") and self.headers else self.client_address[0]

    # ----- helpers -----
    def security_headers(self):
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Strict-Transport-Security", "max-age=31536000")

    def discard_body(self):
        """Drop a request body we are not forwarding (or close the connection)."""
        if self._body_done:
            return
        self._body_done = True
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            self.close_connection = True
            return
        n = int(self.headers.get("Content-Length") or 0)
        if n > 64 * 1024:
            self.close_connection = True
            return
        if n:
            self.rfile.read(n)

    def simple(self, status, body=b"", ctype="text/html; charset=utf-8", headers=()):
        self.discard_body()
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in headers:
            self.send_header(k, v)
        if self.close_connection:
            self.send_header("Connection", "close")
        self.security_headers()
        self.end_headers()
        if self.command != "HEAD" and body:
            self.wfile.write(body)

    def redirect(self, location, headers=()):
        self.simple(303, b"", headers=[("Location", location), *headers])

    def cookie_token(self):
        raw = self.headers.get("Cookie") or ""
        for part in raw.split(";"):
            k, _, v = part.strip().partition("=")
            if k == COOKIE:
                return v
        return None

    def login_page(self, status=200, error="", nxt="/"):
        page = LOGIN_PAGE.format(meta=HEAD_META, next=html.escape(nxt, quote=True),
                                 error=html.escape(error), days=SESSION_DAYS, action="/login", extra="", after="", button="Open",
                                 title="Welcome back", sub="Sign in to open your deck.",
                                 nextq=html.escape("" if nxt == "/" else "?next=" + quote(nxt, safe=""), quote=True))
        self.simple(status, page)

    def signup_page(self, status=200, error="", nxt="/", form=None):
        f = form or {}
        v = lambda k: html.escape(f.get(k, [""])[0], quote=True)
        extra = (f'<label for="dn">Your name</label><input id="dn" type="text" name="display" maxlength="40" value="{v("display")}" required />')
        after = ('<label for="pw2">Password again</label><input id="pw2" type="password" name="password2" autocomplete="new-password" required />'
                 f'<label for="bd">Birthday <em>(optional, for your horoscope and numerology)</em></label><input id="bd" type="date" name="birth" value="{v("birth")}" />')
        page = LOGIN_PAGE.format(meta=HEAD_META, next=html.escape(nxt, quote=True), error=html.escape(error), days=SESSION_DAYS,
                                 action="/signup", extra=extra, after=after, button="Create account", title="Create your account",
                                 sub="Your own private deck. Nothing you save is shared unless you choose to.", nextq="")
        page = page.replace('placeholder="Natalie: you can leave this blank"', f'value="{v("username")}" required placeholder="letters, numbers, _"')
        page = page.replace('autocomplete="current-password"', 'autocomplete="new-password" minlength="8"')
        page = page.replace('<a href="/signup">New here? Create your own account</a>', '<a href="/login">Already have an account? Sign in</a>')
        page = page.replace('href="/signup" style', 'href="/login" style').replace("New here? Create your own account", "Already have an account? Sign in")
        self.simple(status, page)

    def read_form(self, limit=4096):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > limit:
            return None
        raw = self.rfile.read(n)
        self._body_done = True
        return parse_qs(raw.decode("utf-8", "replace"))

    def read_json_body(self, limit=200000):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise ValueError("too large")
        raw = self.rfile.read(n) if n else b"{}"
        self._body_done = True
        return json.loads(raw or b"{}")

    def jsend(self, data, status=200):
        self.simple(status, json.dumps(data, ensure_ascii=False), "application/json; charset=utf-8")

    def do_signup(self):
        client = self.client_key()
        wait = login_blocked(client)
        if wait:
            return self.signup_page(429, "Too many attempts. Try again later.")
        form = self.read_form()
        if form is None:
            return self.signup_page(400, "Please try again.")
        g = lambda k: form.get(k, [""])[0]
        nxt = safe_next(g("next"))
        if g("password") != g("password2"):
            return self.signup_page(400, "The two passwords don’t match.", nxt, form)
        try:
            name = accounts.create(g("username"), g("display"), g("password"), g("birth") or None)
        except ValueError as e:
            record_fail(client)   # also limits mass sign-ups from one client
            return self.signup_page(400, str(e), nxt, form)
        log(f"{client} signup {name}")
        self.send_response(303)
        self.send_header("Location", nxt)
        self.send_header("Set-Cookie", session_cookie(make_token(name)))
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.security_headers()
        self.end_headers()

    def social_api(self, user, path, method):
        try:
            if method == "GET" and path == "/social/me":
                return self.jsend(accounts.me(user))
            if method == "GET" and path == "/social/feed":
                return self.jsend(accounts.feed(user))
            if method != "POST":
                return self.jsend({"error": "not found"}, 404)
            b = self.read_json_body()
            if path == "/social/request":
                return self.jsend({"ok": True, "status": accounts.request(user, b.get("username"))})
            if path in ("/social/accept", "/social/decline"):
                accounts.respond(user, str(b.get("username", "")).lower(), path.endswith("accept"))
                return self.jsend({"ok": True})
            if path == "/social/unfriend":
                accounts.unfriend(user, str(b.get("username", "")).lower()); return self.jsend({"ok": True})
            if path == "/social/invite":
                return self.jsend({"ok": True, "friend": accounts.invite_accept(user, str(b.get("token", "")))})
            if path == "/social/share":
                accounts.share(user, b.get("kind"), b.get("ref"), b.get("title"), b.get("payload")); return self.jsend({"ok": True})
            if path == "/social/unshare":
                accounts.unshare(user, b.get("kind"), b.get("ref")); return self.jsend({"ok": True})
            return self.jsend({"error": "not found"}, 404)
        except (LookupError, ValueError) as e:
            return self.jsend({"error": str(e).strip("'\"")}, 400)

    def origin_ok(self):
        origin = self.headers.get("Origin")
        if not origin or origin == "null":
            return origin is None
        host = urlparse(origin).netloc.lower()
        allowed = {h.lower() for h in (self.headers.get("Host"), self.headers.get("X-Forwarded-Host")) if h}
        return host in allowed

    # ----- dispatch -----
    def handle_any(self):
        self._body_done = False
        url = urlparse(self.path)
        path = url.path
        method = self.command

        if path == "/login":
            if method in ("GET", "HEAD"):
                age = token_age(self.cookie_token() or "")
                nxt = safe_next(parse_qs(url.query).get("next", ["/"])[0])
                if age is not None:
                    return self.redirect(nxt)
                return self.login_page(nxt=nxt)
            if method == "POST":
                return self.do_login()
            return self.simple(405, "Method not allowed", "text/plain; charset=utf-8")

        if path == "/signup":
            if method in ("GET", "HEAD"):
                return self.signup_page(nxt=safe_next(parse_qs(url.query).get("next", ["/"])[0]))
            if method == "POST":
                if not self.origin_ok():
                    return self.simple(403, "Bad origin", "text/plain; charset=utf-8")
                return self.do_signup()
            return self.simple(405, "Method not allowed", "text/plain; charset=utf-8")

        if path == "/logout":
            if method != "POST":
                return self.simple(405, "Use POST", "text/plain; charset=utf-8")
            if not self.origin_ok():
                return self.simple(403, "Bad origin", "text/plain; charset=utf-8")
            return self.redirect("/login", headers=[("Set-Cookie", session_cookie("", 0))])

        if path in PUBLIC_EXACT or path.startswith(PUBLIC_PREFIX):
            if method not in ("GET", "HEAD"):
                return self.simple(405, "Method not allowed", "text/plain; charset=utf-8")
            if path == "/robots.txt":
                return self.simple(200, "User-agent: *\nDisallow: /\n", "text/plain; charset=utf-8")
            return self.forward()

        age, user = token_user(self.cookie_token() or "")
        if age is None:
            if path.startswith("/api/") or path.startswith("/social/") or path == "/auth/status":
                return self.simple(401, json.dumps({"error": "login required"}), "application/json; charset=utf-8")
            if method in ("GET", "HEAD"):
                nxt = path + (("?" + url.query) if url.query else "")
                return self.redirect("/login" + ("" if nxt == "/" else "?next=" + quote(nxt, safe="")))
            return self.simple(401, "Login required", "text/plain; charset=utf-8")

        renew = [("Set-Cookie", session_cookie(make_token(user)))] if age > RENEW_AFTER else []
        u = accounts.get(user)
        if path == "/auth/status":
            b = u.get("birth")
            return self.simple(200, json.dumps({"proxied": True, "logged_in": True, "user": user, "display": u.get("display"),
                                                "owner": user == accounts.OWNER,
                                                "birth": f"{b['y']:04d}-{b['m']:02d}-{b['d']:02d}" if b else None}),
                               "application/json; charset=utf-8", renew)
        if method not in ("GET", "HEAD", "OPTIONS") and not self.origin_ok():
            return self.simple(403, json.dumps({"error": "cross-origin request refused"}),
                               "application/json; charset=utf-8")
        if path.startswith("/invite/") and method in ("GET", "HEAD"):
            return self.redirect("/#friends?invite=" + quote(path[len("/invite/"):], safe=""))
        if path.startswith("/social/"):
            return self.social_api(user, path, method)
        try:
            port = accounts.ensure(user)
        except Exception as e:  # noqa: BLE001
            log(f"start app for {user} failed: {e!r}")
            return self.simple(502, "<h1>Your deck is starting</h1><p>Try again in a moment.</p>")
        return self.forward(renew, port)

    def do_login(self):
        client = self.client_key()
        wait = login_blocked(client)
        if wait:
            log(f"{client} login blocked ({wait}s left)")
            mins = max(1, (wait + 59) // 60)
            return self.login_page(429, f"Too many attempts. Try again in about {mins} min.")
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > 4096:
            return self.login_page(400, "Please try again.")
        raw = self.rfile.read(n)
        self._body_done = True
        form = parse_qs(raw.decode("utf-8", "replace"))
        pw = form.get("password", [""])[0]
        nxt = safe_next(form.get("next", ["/"])[0])
        uname = (form.get("username", [""])[0] or "").strip().lower()
        if uname in ("", "natalie"):
            uname = accounts.OWNER
        user = accounts.check(uname, pw, check_password) if pw else None
        if user:
            clear_fails(client)
            log(f"{client} login ok")
            self.send_response(303)
            self.send_header("Location", nxt)
            self.send_header("Set-Cookie", session_cookie(make_token(user)))
            self.send_header("Content-Length", "0")
            self.send_header("Cache-Control", "no-store")
            self.security_headers()
            self.end_headers()
            return
        record_fail(client)
        log(f"{client} login FAILED")
        time.sleep(1.0)
        return self.login_page(401, "That username and password didn’t match.", nxt)

    # ----- forwarding -----
    def read_request_body(self):
        """Returns (length, iterator-or-bytes)."""
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            buf = bytearray()
            while True:
                line = self.rfile.readline(1024)
                size = int(line.split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    while self.rfile.readline(1024) not in (b"\r\n", b"\n", b""):
                        pass
                    break
                buf += self.rfile.read(size)
                self.rfile.readline(8)
                if len(buf) > MAX_BODY:
                    raise ValueError("too large")
            return len(buf), bytes(buf)
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("too large")
        return n, None

    def forward(self, extra_headers=(), port=None):
        self._body_done = True
        try:
            length, body = self.read_request_body()
        except ValueError:
            self.close_connection = True
            return self.simple(413, json.dumps({"error": "Upload too large"}), "application/json; charset=utf-8")
        try:
            up = http.client.HTTPConnection(UP_HOST, port or UP_PORT, timeout=300)
            up.putrequest(self.command, self.path, skip_host=True, skip_accept_encoding=True)
            for k, v in self.headers.items():
                lk = k.lower()
                if lk in HOP or lk in ("host", "content-length"):
                    continue
                if lk == "cookie":
                    v = "; ".join(p.strip() for p in v.split(";") if p.strip() and not p.strip().startswith(COOKIE + "="))
                    if not v:
                        continue
                up.putheader(k, v)
            up.putheader("Host", f"{UP_HOST}:{port or UP_PORT}")
            up.putheader("X-Forwarded-Proto", "https")
            up.putheader("X-Forwarded-For", self.client_key())
            if length or self.command in ("POST", "PUT", "PATCH"):
                up.putheader("Content-Length", str(length))
            up.endheaders()
            if body is not None:
                up.send(body)
            else:
                left = length
                while left > 0:
                    chunk = self.rfile.read(min(CHUNK, left))
                    if not chunk:
                        break
                    up.send(chunk)
                    left -= len(chunk)
            resp = up.getresponse()
        except (ConnectionError, OSError, http.client.HTTPException) as e:
            log(f"upstream error: {e!r}")
            self.close_connection = True
            return self.simple(502, "<h1>Tarot app is not running</h1><p>It should restart within a minute.</p>")

        try:
            self.send_response(resp.status, resp.reason)
            has_len = False
            for k, v in resp.getheaders():
                lk = k.lower()
                if lk in HOP or lk in ("server", "date"):
                    continue
                if lk == "content-length":
                    has_len = True
                self.send_header(k, v)
            for k, v in extra_headers:
                self.send_header(k, v)
            no_body = self.command == "HEAD" or resp.status in (204, 304) or 100 <= resp.status < 200
            if not has_len and not no_body:
                self.close_connection = True
                self.send_header("Connection", "close")
            self.security_headers()
            self.end_headers()
            if not no_body:
                while True:
                    chunk = resp.read(CHUNK)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        finally:
            up.close()

    do_GET = do_POST = do_HEAD = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = handle_any


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 64


def main():
    AUTH.get()  # fail fast if not set up
    log(f"Tarot gate on http://{LISTEN_HOST}:{LISTEN_PORT} -> http://{UP_HOST}:{UP_PORT}  auth={AUTH_FILE}")
    Server((LISTEN_HOST, LISTEN_PORT), Proxy).serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
