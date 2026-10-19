"""v16 accounts + friends for the tarot gate (stdlib only).

* Natalie is user "natalie": her password stays in data/public-auth.json (unchanged) and her data stays exactly
  where it was, served by the existing server.py on :8090 (the local routines keep using it).
* Every other user gets data/users/<username>/ and their own server.py process on 127.0.0.1:<port>,
  so no request can ever read another user's files.
* Friends and shared items live in data/social.json. A share is a snapshot the owner chose to publish;
  unsharing deletes it. Nothing is shared by default.
"""
import hashlib, hmac, json, os, re, secrets, shutil, socket, subprocess, sys, threading, time
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
DATA = APP_DIR / "data"
USERS_FILE = DATA / "users.json"
SOCIAL_FILE = DATA / "social.json"
USERS_ROOT = DATA / "users"
OWNER = "natalie"
NAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")
RESERVED = {"natalie", "admin", "root", "login", "signup", "logout", "api", "social", "invite", "tarot"}
LOCK = threading.RLock()
_procs = {}

def _read(path, default):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return default

def _write(path, data):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)

def users():
    with LOCK:
        u = _read(USERS_FILE, {})
        if OWNER not in u:
            u[OWNER] = {"display": "Natalie", "legacy_password": True, "port": 8090, "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "birth": {"y": 1997, "m": 3, "d": 7}}
            _write(USERS_FILE, u)
        return u

def get(name):
    return users().get((name or "").lower())

def _hash(pw, salt=None, it=240000):
    salt = salt or secrets.token_hex(16)
    return {"salt": salt, "iterations": it, "hash": hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), it).hex()}

def check(name, pw, legacy_check):
    name = (name or "").strip().lower() or OWNER
    u = get(name)
    if not u or not pw:
        return None
    if u.get("legacy_password"):
        return name if legacy_check(pw) else None
    p = u["password"]
    return name if hmac.compare_digest(_hash(pw, p["salt"], int(p["iterations"]))["hash"], p["hash"]) else None

def create(name, display, pw, birth_date=None):
    name = (name or "").strip().lower()
    if not NAME_RE.match(name):
        raise ValueError("Username: 3–20 letters, numbers or _.")
    if name in RESERVED:
        raise ValueError("That username isn’t available.")
    if len(pw or "") < 8:
        raise ValueError("Password needs at least 8 characters.")
    b = None
    if birth_date:
        m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", birth_date)
        if not m:
            raise ValueError("Birthday must be a date.")
        b = {"y": int(m[1]), "m": int(m[2]), "d": int(m[3])}
    with LOCK:
        u = users()
        if name in u:
            raise ValueError("That username is taken.")
        port = max([8100] + [x.get("port", 0) for x in u.values() if x.get("port", 0) > 8100]) + 1
        u[name] = {"display": (display or name).strip()[:40] or name, "password": _hash(pw), "port": port, "birth": b,
                   "created": time.strftime("%Y-%m-%dT%H:%M:%S")}
        d = USERS_ROOT / name
        (d / "journal-img").mkdir(parents=True, exist_ok=True)
        (d / "entries.json").write_text("[]")
        _write(USERS_FILE, u)
    return name

def delete(name):
    name = name.lower()
    if name == OWNER:
        raise ValueError("refusing to delete the owner")
    with LOCK:
        stop(name)
        u = users(); u.pop(name, None); _write(USERS_FILE, u)
        shutil.rmtree(USERS_ROOT / name, ignore_errors=True)
        s = social()
        s["friends"] = [f for f in s["friends"] if name not in f]
        s["requests"] = [r for r in s["requests"] if name not in (r["from"], r["to"])]
        s["invites"] = {k: v for k, v in s["invites"].items() if v != name}
        s["shares"] = [x for x in s["shares"] if x["owner"] != name]
        _write(SOCIAL_FILE, s)

# ---------- per-user app processes ----------
def _open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False

def ensure(name):
    """-> port of a running app for this user (starts it if needed)."""
    u = get(name)
    if not u:
        raise LookupError("no such user")
    port = u["port"]
    if name == OWNER or _open(port):
        return port
    with LOCK:
        if _open(port):
            return port
        d = USERS_ROOT / name
        b = u.get("birth")
        env = dict(os.environ, PORT=str(port), TAROT_HOST="127.0.0.1", TAROT_DATA_DIR=str(d), TAROT_ENTRIES=str(d / "entries.json"),
                   TAROT_JOURNAL_IMG=str(d / "journal-img"), TAROT_PDF=str(d / "journal.pdf"), TAROT_OWNER_KEY="me",
                   TAROT_OWNER_NAME=u.get("display") or name,
                   TAROT_OWNER_BIRTH=json.dumps({**b, "hour": None, "minute": None, "tz": "UTC", "lat": 0.0, "lon": 0.0}) if b else "none")
        log = open(f"/tmp/tarot-user-{name}.log", "a")
        _procs[name] = subprocess.Popen([sys.executable, str(APP_DIR / "server.py")], cwd=str(APP_DIR), env=env,
                                        stdout=log, stderr=log, stdin=subprocess.DEVNULL, start_new_session=True)
        for _ in range(60):
            if _open(port):
                return port
            time.sleep(0.15)
    raise RuntimeError("couldn’t start the app for " + name)

def stop(name):
    p = _procs.pop(name, None)
    if p and p.poll() is None:
        p.terminate()
        try: p.wait(5)
        except Exception: p.kill()
    else:   # started by an earlier gate process
        u = get(name)
        if u and name != OWNER:
            subprocess.run(["bash", "-c", f"for p in $(pgrep -f 'server.py'); do tr '\\0' '\\n' < /proc/$p/environ 2>/dev/null | grep -qx 'PORT={u['port']}' && kill $p; done"], check=False)

# ---------- social ----------
def social():
    s = _read(SOCIAL_FILE, None) or {}
    for k, v in (("friends", []), ("requests", []), ("invites", {}), ("shares", [])):
        s.setdefault(k, v)
    return s

def friends_of(name, s=None):
    s = s or social()
    return sorted({a if b == name else b for a, b in s["friends"] if name in (a, b)})

def public(name):
    u = get(name) or {}
    return {"username": name, "display": u.get("display") or name}

def me(name):
    with LOCK:
        s = social()
        inv = next((k for k, v in s["invites"].items() if v == name), None)
        if not inv:
            inv = secrets.token_urlsafe(12); s["invites"][inv] = name; _write(SOCIAL_FILE, s)
        return {"user": public(name), "friends": [public(f) for f in friends_of(name, s)],
                "incoming": [public(r["from"]) for r in s["requests"] if r["to"] == name],
                "outgoing": [public(r["to"]) for r in s["requests"] if r["from"] == name], "invite": inv,
                "mine": [{"kind": x["kind"], "ref": x["ref"]} for x in s["shares"] if x["owner"] == name]}

def _befriend(s, a, b):
    s["requests"] = [r for r in s["requests"] if {r["from"], r["to"]} != {a, b}]
    if not any({x, y} == {a, b} for x, y in s["friends"]):
        s["friends"].append([a, b])

def request(name, other):
    other = (other or "").strip().lower().lstrip("@")
    if other == name or not get(other):
        raise LookupError("No one with that username.")
    with LOCK:
        s = social()
        if other in friends_of(name, s):
            return "already friends"
        if any(r["from"] == other and r["to"] == name for r in s["requests"]):
            _befriend(s, name, other); _write(SOCIAL_FILE, s); return "friends"
        if not any(r["from"] == name and r["to"] == other for r in s["requests"]):
            s["requests"].append({"from": name, "to": other, "at": time.strftime("%Y-%m-%dT%H:%M:%S")})
        _write(SOCIAL_FILE, s)
        return "requested"

def respond(name, other, accept):
    with LOCK:
        s = social()
        if not any(r["from"] == other and r["to"] == name for r in s["requests"]):
            raise LookupError("No request from that person.")
        if accept:
            _befriend(s, name, other)
        else:
            s["requests"] = [r for r in s["requests"] if not (r["from"] == other and r["to"] == name)]
        _write(SOCIAL_FILE, s)

def unfriend(name, other):
    with LOCK:
        s = social(); s["friends"] = [f for f in s["friends"] if set(f) != {name, other}]
        s["shares"] = s["shares"]; _write(SOCIAL_FILE, s)

def invite_accept(name, token):
    with LOCK:
        s = social(); owner = s["invites"].get(token)
        if not owner or owner == name:
            raise LookupError("That invite link isn’t valid.")
        _befriend(s, name, owner); _write(SOCIAL_FILE, s)
        return public(owner)

KINDS = {"reading", "guest_reading", "practice"}
def share(name, kind, ref, title, payload):
    if kind not in KINDS or not ref:
        raise ValueError("bad share")
    blob = json.dumps(payload or {}, ensure_ascii=False)
    if len(blob) > 60000:
        raise ValueError("That item is too large to share.")
    with LOCK:
        s = social()
        s["shares"] = [x for x in s["shares"] if not (x["owner"] == name and x["kind"] == kind and x["ref"] == str(ref))]
        s["shares"].append({"id": secrets.token_hex(6), "owner": name, "kind": kind, "ref": str(ref), "title": str(title or "")[:120],
                            "payload": payload or {}, "at": time.strftime("%Y-%m-%dT%H:%M:%S")})
        _write(SOCIAL_FILE, s)

def unshare(name, kind, ref):
    with LOCK:
        s = social(); s["shares"] = [x for x in s["shares"] if not (x["owner"] == name and x["kind"] == kind and x["ref"] == str(ref))]
        _write(SOCIAL_FILE, s)

def feed(name):
    s = social(); fr = set(friends_of(name, s))
    items = [dict(x, owner=public(x["owner"])) for x in s["shares"] if x["owner"] in fr]
    return sorted(items, key=lambda x: x["at"], reverse=True)[:100]

if __name__ == "__main__":   # admin CLI: python3 accounts.py list | delete <username>
    if sys.argv[1:2] == ["list"]:
        for k, v in users().items(): print(k, v.get("display"), v.get("port"))
    elif sys.argv[1:2] == ["delete"]:
        delete(sys.argv[2]); print("deleted", sys.argv[2])
