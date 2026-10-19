#!/usr/bin/env python3
"""Natalie's Tarot — unified local app (stdlib only).

Serves the single-page app on PORT (default 8090) plus a small JSON API.
All paths are overridable by env vars so the API can be tested against copies.
See README.md (data flow) and TAROBOT.md (agent API).
"""
import base64
import gzip
import hashlib
import json
import os
import re
import shutil
import tempfile
import threading
import uuid
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
DATA_DIR = Path(os.environ.get("TAROT_DATA_DIR", APP_DIR / "data"))
CARDS_FILE = Path(os.environ.get("TAROT_CARDS", APP_DIR / "content" / "cards.json"))
KNOWLEDGE_FILE = Path(os.environ.get("TAROT_KNOWLEDGE", APP_DIR / "content" / "card-knowledge.json"))
ENTRIES_FILE = Path(os.environ.get("TAROT_ENTRIES", "/workspace/tarot-journal/entries.json"))
JOURNAL_IMG_DIR = Path(os.environ.get("TAROT_JOURNAL_IMG", "/workspace/tarot-journal/img"))
DECK_IMG_DIR = Path(os.environ.get("TAROT_DECK_IMG", "/workspace/tarot-deck/img"))
THUMB_DIR = Path(os.environ.get("TAROT_THUMBS", APP_DIR / "thumbs"))   # ~240px JPEGs made by tools/make_thumbs.py
PDF_FILE = Path(os.environ.get("TAROT_PDF", "/workspace/tarot-journal/Natalie-Tarot-Journal.pdf"))
MEDITATE_DIR = Path(os.environ.get("TAROT_MEDITATE_DIR", "/workspace/frequency-soundboard"))
PORT = int(os.environ.get("PORT", "8090"))

# ---------- v13: horoscopes (Swiss Ephemeris via the tools venv; real positions only) ----------
import subprocess
ASTRO_PY = os.environ.get("TAROT_ASTRO_PY", "/workspace/.tools-venv/bin/python")
ASTRO_ENGINE = APP_DIR / "tools" / "astro_engine.py"
ASTRO_CACHE = DATA_DIR / "astro-cache"
# Owner birth data (date, time, place) is personal: set it with the TAROT_OWNER_BIRTH env var (JSON), not in code.
NATALIE_BIRTH = None
# v16: each signed-up user gets their own server process; their birth date (if any) comes from the gate
_ob = os.environ.get("TAROT_OWNER_BIRTH")
if _ob is not None:
    NATALIE_BIRTH = json.loads(_ob) if _ob not in ("", "none") else None
OWNER_KEY = os.environ.get("TAROT_OWNER_KEY", "natalie")
HOST = os.environ.get("TAROT_HOST", "0.0.0.0")
# small offline place lookup: name -> (lat, lon, IANA time zone)
PLACES = {
    "durango, colorado": (37.2753, -107.8801, "America/Denver"), "denver, colorado": (39.7392, -104.9903, "America/Denver"),
    "los angeles, california": (34.0522, -118.2437, "America/Los_Angeles"), "san francisco, california": (37.7749, -122.4194, "America/Los_Angeles"),
    "san diego, california": (32.7157, -117.1611, "America/Los_Angeles"), "sacramento, california": (38.5816, -121.4944, "America/Los_Angeles"),
    "san jose, california": (37.3382, -121.8863, "America/Los_Angeles"), "oakland, california": (37.8044, -122.2712, "America/Los_Angeles"),
    "seattle, washington": (47.6062, -122.3321, "America/Los_Angeles"), "yakima, washington": (46.6021, -120.5059, "America/Los_Angeles"),
    "spokane, washington": (47.6588, -117.4260, "America/Los_Angeles"), "portland, oregon": (45.5152, -122.6784, "America/Los_Angeles"),
    "las vegas, nevada": (36.1699, -115.1398, "America/Los_Angeles"), "phoenix, arizona": (33.4484, -112.0740, "America/Phoenix"),
    "tucson, arizona": (32.2226, -110.9747, "America/Phoenix"), "albuquerque, new mexico": (35.0844, -106.6504, "America/Denver"),
    "salt lake city, utah": (40.7608, -111.8910, "America/Denver"), "boise, idaho": (43.6150, -116.2023, "America/Boise"),
    "dallas, texas": (32.7767, -96.7970, "America/Chicago"), "houston, texas": (29.7604, -95.3698, "America/Chicago"),
    "austin, texas": (30.2672, -97.7431, "America/Chicago"), "san antonio, texas": (29.4241, -98.4936, "America/Chicago"),
    "el paso, texas": (31.7619, -106.4850, "America/Denver"), "chicago, illinois": (41.8781, -87.6298, "America/Chicago"),
    "minneapolis, minnesota": (44.9778, -93.2650, "America/Chicago"), "kansas city, missouri": (39.0997, -94.5786, "America/Chicago"),
    "st. louis, missouri": (38.6270, -90.1994, "America/Chicago"), "new orleans, louisiana": (29.9511, -90.0715, "America/Chicago"),
    "nashville, tennessee": (36.1627, -86.7816, "America/Chicago"), "memphis, tennessee": (35.1495, -90.0490, "America/Chicago"),
    "atlanta, georgia": (33.7490, -84.3880, "America/New_York"), "miami, florida": (25.7617, -80.1918, "America/New_York"),
    "orlando, florida": (28.5383, -81.3792, "America/New_York"), "tampa, florida": (27.9506, -82.4572, "America/New_York"),
    "new york, new york": (40.7128, -74.0060, "America/New_York"), "brooklyn, new york": (40.6782, -73.9442, "America/New_York"),
    "boston, massachusetts": (42.3601, -71.0589, "America/New_York"), "philadelphia, pennsylvania": (39.9526, -75.1652, "America/New_York"),
    "pittsburgh, pennsylvania": (40.4406, -79.9959, "America/New_York"), "washington, dc": (38.9072, -77.0369, "America/New_York"),
    "baltimore, maryland": (39.2904, -76.6122, "America/New_York"), "detroit, michigan": (42.3314, -83.0458, "America/Detroit"),
    "cleveland, ohio": (41.4993, -81.6944, "America/New_York"), "columbus, ohio": (39.9612, -82.9988, "America/New_York"),
    "charlotte, north carolina": (35.2271, -80.8431, "America/New_York"), "honolulu, hawaii": (21.3069, -157.8583, "Pacific/Honolulu"),
    "anchorage, alaska": (61.2181, -149.9003, "America/Anchorage"), "toronto, ontario": (43.6532, -79.3832, "America/Toronto"),
    "vancouver, british columbia": (49.2827, -123.1207, "America/Vancouver"), "mexico city, mexico": (19.4326, -99.1332, "America/Mexico_City"),
    "london, uk": (51.5074, -0.1278, "Europe/London"), "paris, france": (48.8566, 2.3522, "Europe/Paris"),
    "berlin, germany": (52.5200, 13.4050, "Europe/Berlin"), "kingston, jamaica": (17.9714, -76.7936, "America/Jamaica"),
    "manila, philippines": (14.5995, 120.9842, "Asia/Manila"), "sydney, australia": (-33.8688, 151.2093, "Australia/Sydney"),
}
def resolve_place(place):
    p = re.sub(r"\s+", " ", str(place or "").strip().lower()).replace(", usa", "").replace(", us", "")
    if not p:
        return None
    if p in PLACES:
        return PLACES[p]
    hits = [v for k, v in PLACES.items() if k.split(",")[0] == p.split(",")[0].strip()]
    return hits[0] if len(hits) == 1 else None

def run_astro(birth, date, cache_key=None):
    if cache_key:
        f = ASTRO_CACHE / f"{cache_key}-{date}.json"
        if f.exists():
            return json.loads(f.read_text())
    q = json.dumps({"birth": birth, "date": date, "tz_now": "America/Los_Angeles"})
    pr = subprocess.run([ASTRO_PY, str(ASTRO_ENGINE)], input=q, capture_output=True, text=True, timeout=30)
    if pr.returncode != 0:
        raise RuntimeError("horoscope engine failed: " + (pr.stderr.strip().splitlines() or ["?"])[-1])
    out = json.loads(pr.stdout)
    if cache_key:
        ASTRO_CACHE.mkdir(parents=True, exist_ok=True)
        write_json_atomic(ASTRO_CACHE / f"{cache_key}-{date}.json", out)
    return out

def guest_birth(g):
    """-> (birth dict for the engine, None) or (None, message saying what's missing)."""
    b = g.get("birth") or {}
    if not b.get("date"):
        return None, "Add a birth date first (Edit birth details)."
    y, m, d = map(int, b["date"].split("-"))
    lat, lon, tz = b.get("lat"), b.get("lon"), b.get("tz")
    if lat in (None, "") or lon in (None, "") or not tz:
        hit = resolve_place(b.get("place"))
        if not hit:
            return None, ("I can't place “%s” offline. Add latitude, longitude and the time zone (e.g. America/Denver) in Edit birth details." % (b.get("place") or "no place"))
        lat, lon, tz = (lat if lat not in (None, "") else hit[0]), (lon if lon not in (None, "") else hit[1]), (tz or hit[2])
    hour = minute = None
    if b.get("time"):
        hour, minute = map(int, b["time"].split(":")[:2])
    return {"y": y, "m": m, "d": d, "hour": hour, "minute": minute, "tz": tz, "lat": float(lat), "lon": float(lon)}, None


GUESTS_FILE = DATA_DIR / "guests.json"
OUTBOX_FILE = DATA_DIR / "outbox.json"
GAPS_FILE = DATA_DIR / "gaps.json"
PRACTICE_FILE = Path(os.environ.get("TAROT_PRACTICE", DATA_DIR / "practice.json"))
PRACTICE_BACKUPS = 30             # keep this many timestamped practice.json backups
UPLOADS_DIR = DATA_DIR / "uploads"

MIME = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
    ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic", ".heif": "image/heif",
    ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon",
}
RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")
LOCK = threading.Lock()
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
IMG_RE = re.compile(r"^[a-z]{2}[0-9a-z]{2}\.jpg$")
VALID_SOURCES = {"physical deck", "digital app", "unknown", "photo"}
# "unknown" orientation is only accepted from the gap "I don't remember" answer (allow_unknown=True).
COMPRESSIBLE = ("text/", "application/json", "application/javascript", "application/manifest+json", "image/svg+xml")
STATIC_TEXT = {".html", ".css", ".js", ".json", ".webmanifest", ".svg", ".txt"}
GZIP_MIN = 1024                   # don't bother compressing tiny bodies
IMG_MAX_AGE = 7 * 86400           # public-domain card art never changes
_gz_cache = {}                    # (path, mtime_ns, size) -> gzipped bytes for static files
_cards_cache = {"key": None, "body": None, "etag": None}
MAX_BODY = 80 * 1024 * 1024       # JSON body incl. base64 photos
MAX_PHOTO = 25 * 1024 * 1024      # per decoded photo
MAX_PHOTOS = 8


# ---------- helpers ----------
def now_iso():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def today_local():
    return datetime.now().astimezone().strftime("%Y-%m-%d")


def new_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def write_json_atomic(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    fd, tmp = tempfile.mkstemp(prefix="." + path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        if path.exists():
            shutil.copymode(path, tmp)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def backup_entries():
    if not ENTRIES_FILE.exists():
        return None
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = ENTRIES_FILE.with_name(f"{ENTRIES_FILE.name}.bak-{stamp}")
    n = 1
    while dest.exists():
        dest = ENTRIES_FILE.with_name(f"{ENTRIES_FILE.name}.bak-{stamp}-{n}")
        n += 1
    shutil.copy2(ENTRIES_FILE, dest)
    return str(dest)


def write_entries(entries):
    backup = backup_entries()
    write_json_atomic(ENTRIES_FILE, entries)
    return backup


KNOWLEDGE_FIELDS = ("upright", "reversed", "sitWith", "keywords", "inASpread", "imagery", "number",
                    "element", "waite", "symbols", "history", "numerologyAstrology", "topics",
                    "waiteNote", "imageryHistory", "olderMeanings", "readMore")


def load_cards():
    """Base deck (cards.json, extracted from tarot-deck/app.js) overlaid with
    card-knowledge.json when it exists. Knowledge may be a list or {id: obj}."""
    cards = read_json(CARDS_FILE, [])
    try:
        kn = read_json(KNOWLEDGE_FILE, None)
    except (json.JSONDecodeError, OSError):
        kn = None  # being written / malformed -> fall back
    if kn:
        items = kn.values() if isinstance(kn, dict) else kn
        by_id = {k.get("id"): k for k in items if isinstance(k, dict)}
        by_name = {str(k.get("name", "")).lower(): k for k in items if isinstance(k, dict)}
        merged = []
        for c in cards:
            k = by_id.get(c["id"]) or by_name.get(c["name"].lower())
            c = dict(c)
            if k:
                for f in KNOWLEDGE_FIELDS:
                    if k.get(f) not in (None, "", [], {}):
                        c[f] = k[f]
                c["knowledge"] = True
            merged.append(c)
        return merged
    return cards


def cards_payload():
    """/api/cards body + ETag, rebuilt only when cards.json or card-knowledge.json change."""
    key = tuple((str(f), f.stat().st_mtime_ns, f.stat().st_size) if f.exists() else (str(f), 0, 0)
                for f in (CARDS_FILE, KNOWLEDGE_FILE))
    if _cards_cache["key"] != key:
        body = json.dumps(load_cards(), ensure_ascii=False).encode("utf-8")
        _cards_cache.update(key=key, body=body, etag='"c-' + hashlib.sha1(body).hexdigest()[:16] + '"')
    return _cards_cache["body"], _cards_cache["etag"]


def clean_text(s, limit=2000):
    """User free text: trimmed, no markup (the PDF builder parses <, >, &)."""
    if not s:
        return ""
    s = str(s).strip()[:limit]
    return s.replace("&", "and").replace("<", "").replace(">", "")


def clean_generated(g):
    """Live 'reading as it goes' built in the app from the card data: {summary, cards:[{label,name,orientation,core,others:[{label,text}]}]}."""
    if not isinstance(g, dict):
        return None
    t = lambda v, n=4000: clean_text(v, n) or None
    cards = []
    for c in (g.get("cards") or [])[:15]:
        if not isinstance(c, dict):
            continue
        others = [{"label": t(o.get("label"), 60), "text": t(o.get("text"))}
                  for o in (c.get("others") or [])[:12] if isinstance(o, dict) and o.get("text")]
        cards.append({"label": t(c.get("label"), 80), "name": t(c.get("name"), 80),
                      "orientation": t(c.get("orientation"), 20), "core": t(c.get("core")), "others": others})
    if not cards:
        return None
    out = {"summary": t(g.get("summary"), 6000), "cards": cards, "generated_at": now_iso()}
    fg = g.get("forGuest")
    if isinstance(fg, dict) and fg.get("notes"):
        out["forGuest"] = {"title": t(fg.get("title"), 120), "notes": [t(x, 400) for x in fg["notes"][:20] if x]}
    return out


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")
    return s[:40] or "guest"


def resolve_card(by_id, by_name, raw, default_source="digital app", allow_unknown=False):
    c = None
    if raw.get("id"):
        c = by_id.get(str(raw["id"]))
    if not c and raw.get("name"):
        c = by_name.get(str(raw["name"]).strip().lower())
    if not c:
        raise ValueError(f"Unknown card: {raw.get('id') or raw.get('name')!r}")
    orient = str(raw.get("orientation", "")).lower()
    if orient not in ("upright", "reversed") and not (allow_unknown and orient == "unknown"):
        raise ValueError(f"Orientation must be upright or reversed for {c['name']}")
    source = str(raw.get("source") or default_source).lower()
    if source not in VALID_SOURCES:
        raise ValueError(f"Unknown source {source!r}")
    pos = clean_text(raw.get("position"), 40)
    return c, orient, source, pos


def parse_cards(payload, required=True, default_source="digital app", allow_unknown=False):
    raw_cards = payload.get("cards") or []
    if not isinstance(raw_cards, list) or len(raw_cards) > 12 or (required and not raw_cards):
        raise ValueError("Provide 1–12 cards" if required else "cards must be a list (max 12)")
    all_cards = load_cards()
    by_id = {c["id"]: c for c in all_cards}
    by_name = {c["name"].lower(): c for c in all_cards}
    return [resolve_card(by_id, by_name, rc, default_source, allow_unknown) for rc in raw_cards]


def card_brief(rows, with_img=False):
    out = []
    for c, o, s, p in rows:
        d = {"name": c["name"], "orientation": o, "source": s}
        if p:
            d["position"] = p
        if with_img:
            d["img"] = c["img"]
        out.append(d)
    return out


def ensure_journal_image(card):
    fname = Path(card["img"]).name
    if not IMG_RE.match(fname):
        raise ValueError("Bad image name")
    dest = JOURNAL_IMG_DIR / fname
    if not dest.exists():
        src = DECK_IMG_DIR / fname
        if src.exists():
            JOURNAL_IMG_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
    return f"img/{fname}"


def sniff_ext(data):
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if data[4:8] == b"ftyp" and data[8:12] in (b"heic", b"heix", b"mif1", b"msf1", b"heim", b"hevc"):
        return ".heic"
    return None


def save_photos(photos, subdir):
    """photos: [{data: base64 or dataURL, name?}] -> list of paths relative to DATA_DIR."""
    if not photos:
        return []
    if not isinstance(photos, list) or len(photos) > MAX_PHOTOS:
        raise ValueError(f"Up to {MAX_PHOTOS} photos")
    decoded = []
    for p in photos:
        raw = p.get("data") if isinstance(p, dict) else p
        if not isinstance(raw, str):
            raise ValueError("photo data must be base64")
        if raw.startswith("data:"):
            raw = raw.split(",", 1)[-1]
        data = base64.b64decode(raw, validate=False)
        if len(data) > MAX_PHOTO:
            raise ValueError("Photo too large (25 MB max)")
        ext = sniff_ext(data)
        if not ext:
            raise ValueError("Unsupported image type (jpg, png, webp, gif, heic)")
        decoded.append((data, ext))
    dest_dir = UPLOADS_DIR / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for data, ext in decoded:
        name = new_id("ph") + ext
        tmp = dest_dir / ("." + name + ".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, dest_dir / name)
        paths.append(f"uploads/{subdir}/{name}")
    return paths


def add_outbox(record):
    outbox = read_json(OUTBOX_FILE, [])
    record = {"id": new_id("ob"), **record, "created_at": now_iso()}
    outbox.append(record)
    write_json_atomic(OUTBOX_FILE, outbox)
    return record


def astro_record(date, rows):
    return add_outbox({
        "kind": "self_draw", "date": date,
        "cards": [{"name": c["name"], "orientation": o, "source": s} for c, o, s, _ in rows],
        "status": "pending_astro",
    })


def summary_for(c, orient):
    if orient == "reversed":
        return c["reversed"]
    if orient == "unknown":   # gap answered "I don't remember": keep both readings, flag it
        return f"Orientation not recorded. Upright: {c['upright']} Reversed: {c['reversed']}"
    return c["upright"]


def save_personal(date, card_rows, note="", spread_labels=None, photos=None, reading=""):
    """Merge cards into the day entry in entries.json (append, never overwrite).
    Caller must hold LOCK."""
    entries = read_json(ENTRIES_FILE, [])
    if not isinstance(entries, list):
        raise ValueError("entries.json is not a list")
    day = next((e for e in entries if e.get("date") == date), None)
    is_new = day is None
    if is_new:
        day = {"date": date, "cards": [], "notes": None}

    added, skipped = [], []
    for c, orient, source, _pos in card_rows:
        dup = any(
            x.get("name") == c["name"] and x.get("orientation") == orient and x.get("source") == source
            for x in day.get("cards", [])
        )
        if dup:
            skipped.append(c["name"])
            continue
        img = ensure_journal_image(c)
        day.setdefault("cards", []).append({
            **({"position": _pos} if _pos else {}),
            "name": c["name"],
            "orientation": orient,
            "img": img,
            "source": source,
            "summary": summary_for(c, orient),
            "sitWith": c["sitWith"],
            "astro": None,
        })
        added.append(c["name"])

    new_photos = [p for p in (photos or []) if p not in day.get("photos", [])]
    if not added and not new_photos:
        return {"added": [], "skipped": skipped, "backup": None, "outbox": None}

    extra = []
    if spread_labels and len(card_rows) == 3 and len(spread_labels) == 3 and added:
        names = " · ".join(
            f"{c['name']}{' (reversed)' if o == 'reversed' else ''}" for c, o, _, _ in card_rows
        )
        extra.append(f"3-card spread ({' · '.join(spread_labels)}): {names}")
    elif spread_labels and len(spread_labels) == len(card_rows) and len(card_rows) > 1 and added:
        names = " · ".join(
            f"{lab}: {c['name']}{' (reversed)' if o == 'reversed' else ''}" for (c, o, _, _), lab in zip(card_rows, spread_labels)
        )
        extra.append(f"{len(card_rows)}-card spread: {names}")
    if note:
        extra.append(f"Note — {note}")
    if reading:
        extra.append(f"Reading — {reading}")
    if extra:
        day["notes"] = "\n\n".join([p for p in [day.get("notes")] + extra if p])
    if new_photos:
        day["photos"] = day.get("photos", []) + new_photos

    if is_new:
        entries.append(day)
        entries.sort(key=lambda e: e.get("date", ""))
    backup = write_entries(entries)
    added_rows = [r for r in card_rows if r[0]["name"] in added]
    rec = astro_record(date, added_rows) if added_rows else None
    return {"added": added, "skipped": skipped, "backup": backup, "outbox": rec}


def find_guest(guests, gid):
    g = next((x for x in guests if x.get("id") == gid or x.get("slug") == gid), None)
    if not g:
        raise LookupError("no such guest")
    return g


def resolve_guest_reading(gid, rid, body):
    """Caller holds LOCK. Fills cards/reading on a guest reading; never touches entries.json."""
    guests = read_json(GUESTS_FILE, [])
    g = find_guest(guests, gid)
    r = next((x for x in g.get("readings", []) if x.get("id") == rid), None)
    if not r:
        raise LookupError("no such reading")
    if body.get("cards"):
        r["cards"] = card_brief(parse_cards(body, default_source="photo"), with_img=True)
    if body.get("reading") is not None:
        r["reading"] = str(body.get("reading")).strip()[:8000] or None
    r["status"] = "read" if r.get("reading") else r.get("status", "needs_reading")
    r["resolved_at"] = now_iso()
    write_json_atomic(GUESTS_FILE, guests)
    outbox = read_json(OUTBOX_FILE, [])
    for o in outbox:
        if o.get("kind") == "guest_reading" and o.get("reading_id") == rid and o.get("status") == "needs_reading":
            o["status"] = "resolved"
            o["resolved_at"] = now_iso()
    write_json_atomic(OUTBOX_FILE, outbox)
    return g, r


# ---------- practice (study data; never entries.json, never the outbox, never Astro) ----------
LEITNER_DAYS = {1: 0, 2: 1, 3: 3, 4: 7, 5: 16}   # box -> days until the card is due again
RATINGS = {"knew", "sort", "didnt"}
PRACTICE_KINDS = {"pick", "flashcard", "quiz", "real", "daily", "reading"}


def empty_practice():
    return {"version": 1, "reviews": {}, "reviewLog": [], "pulls": [], "readings": [],
            "lessons": {}, "quizzes": [], "days": []}


def read_practice():
    p = read_json(PRACTICE_FILE, None)
    if not isinstance(p, dict):
        p = empty_practice()
    for k, v in empty_practice().items():
        p.setdefault(k, v)
    return p


def write_practice(p):
    """Timestamped backup of the previous file (last PRACTICE_BACKUPS kept), then an atomic replace."""
    if PRACTICE_FILE.exists():
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        shutil.copy2(PRACTICE_FILE, PRACTICE_FILE.with_name(f"{PRACTICE_FILE.name}.bak-{stamp}"))
        olds = sorted(PRACTICE_FILE.parent.glob(PRACTICE_FILE.name + ".bak-*"))
        for old in olds[:-PRACTICE_BACKUPS]:
            try:
                old.unlink()
            except OSError:
                pass
    t = today_local()
    if t not in p["days"]:
        p["days"].append(t)
        p["days"].sort()
    write_json_atomic(PRACTICE_FILE, p)


def add_days(iso, n):
    from datetime import date, timedelta
    return (date.fromisoformat(iso) + timedelta(days=n)).isoformat()


def practice_card(raw_id):
    by_id = {c["id"]: c for c in load_cards()}
    c = by_id.get(str(raw_id or ""))
    if not c:
        raise ValueError(f"Unknown card id {raw_id!r}")
    return c


def apply_review(p, card_id, orientation, rating, mode):
    """Leitner step: knew -> up one box, sort of -> same box (seen again tomorrow), didn't -> back to box 1 (today)."""
    if rating not in RATINGS:
        raise ValueError("rating must be knew, sort or didnt")
    if orientation not in ("upright", "reversed"):
        orientation = "upright"
    if mode not in PRACTICE_KINDS:
        mode = "flashcard"
    r = p["reviews"].get(card_id) or {"box": 1, "seen": 0, "knew": 0, "sort": 0, "didnt": 0}
    box = int(r.get("box") or 1)
    box = min(box + 1, 5) if rating == "knew" else (1 if rating == "didnt" else box)
    days = LEITNER_DAYS[box] if rating == "knew" else (1 if rating == "sort" else 0)
    r.update({"box": box, "due": add_days(today_local(), days), "last": now_iso(),
              "seen": int(r.get("seen", 0)) + 1, rating: int(r.get(rating, 0)) + 1})
    p["reviews"][card_id] = r
    p["reviewLog"].append({"at": now_iso(), "card": card_id, "orientation": orientation, "rating": rating, "mode": mode})
    p["reviewLog"] = p["reviewLog"][-3000:]
    return r


def clean_pull_cards(raw, with_note_key="impression"):
    if not isinstance(raw, list) or not 1 <= len(raw) <= 12:
        raise ValueError("Provide 1-12 cards")
    out = []
    for rc in raw:
        if not isinstance(rc, dict):
            raise ValueError("cards must be objects")
        c = practice_card(rc.get("id"))
        o = str(rc.get("orientation", "")).lower()
        if o not in ("upright", "reversed"):
            raise ValueError("orientation must be upright or reversed")
        d = {"id": c["id"], "name": c["name"], "orientation": o}
        pos = clean_text(rc.get("position"), 60)
        if pos:
            d["position"] = pos
        note = clean_text(rc.get(with_note_key), 4000)
        if note:
            d[with_note_key] = note
        if rc.get("rating") in RATINGS:
            d["rating"] = rc["rating"]
        out.append(d)
    return out


# ---------- HTTP ----------
class Handler(SimpleHTTPRequestHandler):
    server_version = "TarotApp/1.1"

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(STATIC_DIR), **kw)

    def log_message(self, fmt, *args):
        print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {self.address_string()} {fmt % args}", flush=True)

    def send_response(self, *a, **kw):
        self._cc_sent = False
        super().send_response(*a, **kw)

    def send_header(self, k, v):
        if k.lower() == "cache-control":
            self._cc_sent = True
        super().send_header(k, v)

    def end_headers(self):
        if self.path.startswith("/api/") and not getattr(self, "_cc_sent", False):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def wants_gzip(self):
        for part in (self.headers.get("Accept-Encoding") or "").lower().split(","):
            name, _, params = part.strip().partition(";")
            q = params.replace(" ", "")
            if name.strip() in ("gzip", "*") and not (q.startswith("q=0") and q.strip("q=0.") == ""):
                return True
        return False

    def send_body(self, body, ctype, status=200, etag=None, cache=None, gz=None, head=False):
        """Send bytes with optional gzip (when the client accepts it), ETag/304 and Cache-Control.
        gz: pre-compressed bytes (static cache) or None to compress here when worthwhile."""
        gz_etag = etag[:-1] + '-gz"' if etag else None
        if etag and status == 200:
            inm = [t.strip().removeprefix("W/") for t in (self.headers.get("If-None-Match") or "").split(",")]
            if etag in inm or gz_etag in inm or "*" in inm:
                self.send_response(304)
                self.send_header("ETag", gz_etag if ctype.startswith(COMPRESSIBLE) and self.wants_gzip() else etag)
                if cache:
                    self.send_header("Cache-Control", cache)
                self.send_header("Vary", "Accept-Encoding")
                self.end_headers()
                return
        compressible = ctype.startswith(COMPRESSIBLE)
        enc = None
        if compressible and len(body) >= GZIP_MIN and self.wants_gzip():
            body = gz if gz is not None else gzip.compress(body, compresslevel=6)
            enc = "gzip"
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if compressible:
            self.send_header("Vary", "Accept-Encoding")
        if enc:
            self.send_header("Content-Encoding", enc)
        if etag:  # distinct tag per encoding so caches never mix gzip and identity bodies
            self.send_header("ETag", gz_etag if enc else etag)
        if cache:
            self.send_header("Cache-Control", cache)
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_body(body, "application/json; charset=utf-8", status)

    def send_static_text(self, path, head=False):
        """index.html / app.js / app.css / sw.js ...: gzip (cached per file version), ETag,
        long cache for ?v= versioned assets, revalidate-always for the rest (index, sw.js)."""
        st = path.stat()
        key = (str(path), st.st_mtime_ns, st.st_size)
        raw = path.read_bytes()
        gz = _gz_cache.get(key)
        if gz is None and len(raw) >= GZIP_MIN:
            gz = gzip.compress(raw, compresslevel=9)
            for k in [k for k in _gz_cache if k[0] == key[0]]:
                _gz_cache.pop(k, None)
            _gz_cache[key] = gz
        etag = '"s-%x-%x"' % (st.st_mtime_ns, st.st_size)
        q = urlparse(self.path).query
        versioned = "v=" in q and path.suffix in (".js", ".css")
        cache = "public, max-age=31536000, immutable" if versioned else (
            "public, max-age=86400" if path.suffix == ".webmanifest" else "no-cache")
        ctype = "application/manifest+json" if path.suffix == ".webmanifest" else MIME.get(path.suffix, "text/plain; charset=utf-8")
        self.send_body(raw, ctype, etag=etag, cache=cache, gz=gz, head=head)

    def route_static(self, path, head=False):
        if self.headers.get("Range"):
            return False
        rel = "index.html" if path in ("/", "/index.html") else path.lstrip("/")
        if not rel or rel.startswith(".") or "/." in rel or "\\" in rel:
            return False
        target = (STATIC_DIR / rel).resolve()
        if STATIC_DIR.resolve() not in target.parents or not target.is_file() or target.suffix not in STATIC_TEXT:
            return False
        self.send_static_text(target, head)
        return True

    def send_file(self, path, ctype=None, download_name=None, head=False):
        """Stream a file (read-only) with HTTP Range support for audio seeking."""
        path = Path(path)
        if not path.is_file():
            return self.send_error(HTTPStatus.NOT_FOUND)
        ctype = ctype or MIME.get(path.suffix.lower(), "application/octet-stream")
        size = path.stat().st_size
        start, end, status = 0, size - 1, 200
        rng = self.headers.get("Range")
        if rng and size:
            m = RANGE_RE.match(rng.strip())
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = min(int(m.group(2)), size - 1) if m.group(2) else size - 1
                else:  # suffix range: last N bytes
                    start = max(size - int(m.group(2)), 0)
                if start > end or start >= size:
                    self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                status = 206
        length = end - start + 1 if size else 0
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Last-Modified", self.date_time_string(path.stat().st_mtime))
        cache = "public, max-age=3600" if ctype.startswith(("image/", "audio/")) else "no-cache"
        if str(path).startswith((str(DECK_IMG_DIR), str(THUMB_DIR))):
            cache = f"public, max-age={IMG_MAX_AGE}"
        self.send_header("Cache-Control", cache)
        if download_name:
            self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.end_headers()
        if head or not length:
            return
        try:
            with open(path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(256 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # client seeked/stopped; normal for media

    def send_under(self, base_dir, rel, head=False, default=None):
        """Serve a file under base_dir, refusing traversal and dotfiles."""
        rel = rel or default or ""
        base = Path(base_dir).resolve()
        target = (base / rel).resolve()
        if base not in target.parents or rel.startswith(".") or "/." in rel:
            return self.send_error(HTTPStatus.NOT_FOUND)
        return self.send_file(target, head=head)

    def route_files(self, path, head=False):
        if path == "/meditate":
            self.send_response(301)
            self.send_header("Location", "/meditate/")
            self.end_headers()
            return True
        if path.startswith("/meditate/"):
            self.send_under(MEDITATE_DIR, path[len("/meditate/"):], head, "natalie-tones.html")
            return True
        if path.startswith("/uploads/"):
            self.send_under(UPLOADS_DIR, path[len("/uploads/"):], head)
            return True
        if path.startswith("/deck-thumb/"):
            # small (~240px) JPEGs for grids/pickers; falls back to the full image if missing
            name = path.rsplit("/", 1)[-1]
            if not IMG_RE.match(name):
                self.send_error(HTTPStatus.NOT_FOUND)
                return True
            t = THUMB_DIR / name
            self.send_file(t if t.exists() else DECK_IMG_DIR / name, "image/jpeg", head=head)
            return True
        if path.startswith("/deck-img/") or path.startswith("/journal-img/"):
            name = path.rsplit("/", 1)[-1]
            if not IMG_RE.match(name):
                self.send_error(HTTPStatus.NOT_FOUND)
                return True
            p = JOURNAL_IMG_DIR / name if path.startswith("/journal-img/") else DECK_IMG_DIR / name
            self.send_file(p if p.exists() else DECK_IMG_DIR / name, "image/jpeg", head=head)
            return True
        if path in ("/journal.pdf", "/Natalie-Tarot-Journal.pdf"):
            self.send_file(PDF_FILE, "application/pdf", PDF_FILE.name, head=head)
            return True
        return False

    def read_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("Body too large")
        raw = self.rfile.read(n) if n else b"{}"
        data = json.loads(raw or b"{}")
        if not isinstance(data, dict):
            raise ValueError("JSON object expected")
        return data

    def do_HEAD(self):
        path = unquote(urlparse(self.path).path)
        if not self.route_files(path, head=True) and not self.route_static(path, head=True):
            return super().do_HEAD()

    # --- GET ---
    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        try:
            if path == "/api/cards":
                # short max-age + ETag: phones revalidate cheaply (304) instead of re-downloading ~680 KB
                body, etag = cards_payload()
                return self.send_body(body, "application/json; charset=utf-8", etag=etag,
                                      cache="private, max-age=300, must-revalidate")
            if path == "/api/entries":
                return self.send_json(read_json(ENTRIES_FILE, []))
            if path == "/api/guests":
                return self.send_json(read_json(GUESTS_FILE, []))
            m = re.match(r"^/api/guests/([\w-]+)$", path)
            if m:
                return self.send_json(find_guest(read_json(GUESTS_FILE, []), m.group(1)))
            if path == "/api/outbox":
                return self.send_json(read_json(OUTBOX_FILE, []))
            if path == "/api/outbox/pending":
                ob = read_json(OUTBOX_FILE, [])
                return self.send_json([o for o in ob if o.get("status") in ("pending_astro", "needs_identification", "needs_reading")])
            if path == "/api/gaps":
                return self.send_json(read_json(GAPS_FILE, []))
            if path == "/api/astro/today":   # Natalie's daily horoscope, computed on first request each PT day
                if not NATALIE_BIRTH:
                    return self.send_json({"error": "Add your birthday to your account to get a daily horoscope.", "needs": "birth"}, 400)
                return self.send_json(run_astro(NATALIE_BIRTH, today_local(), cache_key=OWNER_KEY))
            if path == "/api/moon":   # v16: today's Moon phase (same for everyone), for the new/full moon spread suggestion
                mo = run_astro({"y": 2000, "m": 1, "d": 1, "hour": None, "minute": None, "tz": "UTC", "lat": 0.0, "lon": 0.0}, today_local(), cache_key="moon")["moon"]
                el = float(mo["elongation"])
                kind = "new" if el < 12 or el > 348 else "full" if abs(el - 180) < 12 else None
                return self.send_json({"date": today_local(), "phase": mo["phase"], "sign": mo["sign"], "elongation": el, "special": kind})
            m = re.match(r"^/api/guests/([\w-]+)/horoscope$", path)
            if m:   # on demand only, never cached or scheduled
                g = find_guest(read_json(GUESTS_FILE, []), m.group(1))
                birth, why = guest_birth(g)
                if not birth:
                    return self.send_json({"error": why, "needs": "birth"}, 400)
                return self.send_json({"guest": g["name"], **run_astro(birth, today_local())})
            if path == "/api/today":
                return self.send_json({"date": today_local()})
            if path == "/api/practice":
                return self.send_json(read_practice())
            if self.route_files(path):
                return
            if path.startswith("/api/"):
                return self.send_json({"error": "not found"}, 404)
            if self.route_static(path):
                return
            return super().do_GET()
        except LookupError as e:
            return self.send_json({"error": str(e)}, 404)
        except Exception as e:  # noqa: BLE001
            return self.send_json({"error": str(e)}, 500)

    # --- POST ---
    def do_POST(self):
        path = unquote(urlparse(self.path).path)
        try:
            body = self.read_body()
            date = body.get("date") or today_local()
            if not DATE_RE.match(str(date)):
                raise ValueError("date must be YYYY-MM-DD")

            # ---- Practice (study only: practice.json; never entries.json, outbox or Astro) ----
            if path == "/api/practice/review":
                c = practice_card(body.get("card") or body.get("id"))
                rating = str(body.get("rating", "")).lower()
                with LOCK:
                    p = read_practice()
                    r = apply_review(p, c["id"], str(body.get("orientation", "upright")).lower(), rating, str(body.get("mode", "flashcard")))
                    pid, idx = body.get("pullId"), body.get("index")
                    if pid is not None:
                        pull = next((x for x in p["pulls"] if x.get("id") == pid), None)
                        if pull and isinstance(idx, int) and 0 <= idx < len(pull["cards"]) and pull["cards"][idx]["id"] == c["id"]:
                            pull["cards"][idx]["rating"] = rating
                    write_practice(p)
                return self.send_json({"ok": True, "card": c["id"], "review": r})

            if path == "/api/practice/pull":
                cards = clean_pull_cards(body.get("cards"))
                mode = "real" if body.get("mode") == "real" else "virtual"
                with LOCK:
                    p = read_practice()
                    pull = {"id": new_id("pp"), "date": date, "mode": mode,
                            "spread": "ppf" if len(cards) == 3 else "one",
                            "reversals": bool(body.get("reversals", True)),
                            "context": clean_text(body.get("context"), 20) or "pick",
                            "cards": cards, "created_at": now_iso()}
                    p["pulls"].append(pull)
                    write_practice(p)
                return self.send_json({"ok": True, "pull": pull})

            if path == "/api/practice/reading":
                cards = clean_pull_cards(body.get("cards"), "note")
                spread = clean_text(body.get("spreadId"), 40)
                if not spread:
                    raise ValueError("spreadId required")
                with LOCK:
                    p = read_practice()
                    rd = {"id": new_id("pr"), "date": date, "spreadId": spread,
                          "spreadName": clean_text(body.get("spreadName"), 80) or spread,
                          "question": clean_text(body.get("question"), 300) or None,
                          "source": "real" if body.get("source") == "real" else "app",
                          "cards": cards, "overall": clean_text(body.get("overall"), 4000) or None,
                          "created_at": now_iso()}
                    p["readings"].append(rd)
                    write_practice(p)
                return self.send_json({"ok": True, "reading": rd})

            if path == "/api/practice/lesson":
                lid = clean_text(body.get("id"), 40)
                if not re.match(r"^[a-z0-9-]{1,40}$", lid or ""):
                    raise ValueError("lesson id required")
                with LOCK:
                    p = read_practice()
                    if body.get("done", True):
                        p["lessons"][lid] = now_iso()
                    else:
                        p["lessons"].pop(lid, None)
                    write_practice(p)
                return self.send_json({"ok": True, "lessons": p["lessons"]})

            if path == "/api/practice/quiz":
                kind = clean_text(body.get("kind"), 30) or "mixed"
                try:
                    score, total = int(body.get("score")), int(body.get("total"))
                except (TypeError, ValueError):
                    raise ValueError("score and total must be numbers")
                if not 0 <= score <= total <= 50:
                    raise ValueError("score/total out of range")
                with LOCK:
                    p = read_practice()
                    q = {"at": now_iso(), "date": date, "kind": kind, "score": score, "total": total}
                    p["quizzes"].append(q)
                    p["quizzes"] = p["quizzes"][-500:]
                    write_practice(p)
                return self.send_json({"ok": True, "quiz": q})

            if path == "/api/practice/day":   # daily lesson finished (also marks the streak day)
                with LOCK:
                    p = read_practice()
                    p.setdefault("dailyDone", [])
                    if date not in p["dailyDone"]:
                        p["dailyDone"].append(date)
                    write_practice(p)
                return self.send_json({"ok": True, "dailyDone": p["dailyDone"]})

            # Personal save (digital draw or manual physical pick) -> entries.json
            if path == "/api/entries":
                rows = parse_cards(body)
                labels = body.get("spreadLabels")
                labels = [clean_text(x, 40) for x in labels][:12] if isinstance(labels, list) else None
                with LOCK:
                    res = save_personal(date, rows, clean_text(body.get("note")), labels)
                return self.send_json({"ok": True, "date": date, **res})

            # Astro writes its tie-in text into entries.json.
            # Any assistant (Astro or another helper) can add astro text for a day at any time, even when
            # no pending_astro outbox record exists (e.g. the Sep 15 Five of Swords):
            #   curl -s -X POST http://127.0.0.1:8090/api/entries/2026-09-15/astro \
            #     -H 'Content-Type: application/json' -d '{"cardAstro":{"Five of Swords":"..."}}'
            # The app shows "Astro tie-in pending" only while a pending_astro record lists that card;
            # a card with no astro text and nothing pending just shows a neutral "No astro note".
            m = re.match(r"^/api/entries/(\d{4}-\d{2}-\d{2})/astro$", path)
            if m:
                d = m.group(1)
                card_astro = body.get("cardAstro") or {}
                weave = str(body.get("weave") or "").strip()
                if not isinstance(card_astro, dict) or (not card_astro and not weave):
                    raise ValueError("Provide cardAstro {cardName: text} and/or weave")
                with LOCK:
                    entries = read_json(ENTRIES_FILE, [])
                    day = next((e for e in entries if e.get("date") == d), None)
                    if not day:
                        return self.send_json({"error": f"no entry for {d}"}, 404)
                    names = {c["name"].lower(): c["name"] for c in day.get("cards", [])}
                    unknown = [n for n in card_astro if n.lower() not in names]
                    if unknown:
                        raise ValueError(f"Cards not on {d}: {unknown}")
                    for c in day.get("cards", []):
                        for n, text in card_astro.items():
                            if n.lower() == c["name"].lower() and str(text).strip():
                                c["astro"] = str(text).strip()
                    if weave:
                        if not re.match(r"^Day weave\s*[—:-]", weave):
                            weave = "Day weave — " + weave
                        day["notes"] = "\n\n".join(p for p in [day.get("notes"), weave] if p)
                    backup = write_entries(entries)
                    closed = []
                    if all(c.get("astro") for c in day.get("cards", [])):
                        outbox = read_json(OUTBOX_FILE, [])
                        for o in outbox:
                            if o.get("date") == d and o.get("status") == "pending_astro":
                                o["status"] = "done"
                                o["done_at"] = now_iso()
                                closed.append(o["id"])
                        write_json_atomic(OUTBOX_FILE, outbox)
                return self.send_json({"ok": True, "date": d, "backup": backup, "outbox_done": closed, "entry": day})

            # Photo of her own physical draw -> outbox (TaroBot identifies later)
            if path == "/api/photos":
                if not body.get("photos"):
                    raise ValueError("Attach at least one photo")
                tags = parse_cards(body, required=False, default_source="physical deck")
                with LOCK:
                    paths = save_photos(body.get("photos"), date)
                    rec = add_outbox({
                        "kind": "self_photo", "date": date, "photos": paths,
                        "cards": card_brief(tags), "note": clean_text(body.get("note")) or None,
                        "status": "needs_identification",
                    })
                return self.send_json({"ok": True, "outbox": rec})

            m = re.match(r"^/api/outbox/([\w-]+)/(done|resolve)$", path)
            if m:
                oid, action = m.groups()
                with LOCK:
                    outbox = read_json(OUTBOX_FILE, [])
                    rec = next((r for r in outbox if r.get("id") == oid), None)
                    if not rec:
                        return self.send_json({"error": "no such outbox id"}, 404)
                    if action == "done":
                        rec["status"] = "done"
                        rec["done_at"] = now_iso()
                        write_json_atomic(OUTBOX_FILE, outbox)
                        return self.send_json({"ok": True, "record": rec})
                    kind = rec.get("kind")
                    if kind == "guest_reading":
                        g, r = resolve_guest_reading(rec["guest_id"], rec["reading_id"], body)
                        return self.send_json({"ok": True, "guest_id": g["id"], "reading": r})
                    if kind != "self_photo":
                        raise ValueError("Only self_photo / guest_reading records can be resolved; use /done for astro")
                    if rec.get("status") == "resolved":
                        return self.send_json({"error": "already resolved"}, 409)
                    rows = parse_cards(body, default_source="physical deck")
                    res = save_personal(rec["date"], rows, rec.get("note") or "", None,
                                        rec.get("photos"), clean_text(body.get("reading"), 8000))
                    outbox = read_json(OUTBOX_FILE, [])  # re-read: save_personal appended
                    rec = next(r for r in outbox if r.get("id") == oid)
                    rec["status"] = "resolved"
                    rec["resolved_at"] = now_iso()
                    rec["resolved_cards"] = card_brief(rows)
                    write_json_atomic(OUTBOX_FILE, outbox)
                return self.send_json({"ok": True, "record": rec, **res})

            # Guests: profiles + readings (never entries.json, never Astro)
            if path == "/api/guests":
                name = clean_text(body.get("name"), 80)
                if not name:
                    raise ValueError("Name required")
                with LOCK:
                    guests = read_json(GUESTS_FILE, [])
                    existing = next((g for g in guests if g["name"].lower() == name.lower()), None)
                    if existing:
                        return self.send_json({"ok": True, "guest": existing, "existing": True})
                    slug, n = slugify(name), 2
                    while any(g.get("slug") == slug for g in guests):
                        slug, n = f"{slugify(name)}-{n}", n + 1
                    g = {"id": new_id("g"), "slug": slug, "name": name,
                         "note": clean_text(body.get("note"), 600) or None,
                         "created_at": now_iso(), "readings": []}
                    guests.append(g)
                    write_json_atomic(GUESTS_FILE, guests)
                return self.send_json({"ok": True, "guest": g})

            m = re.match(r"^/api/guests/([\w-]+)/readings$", path)
            if m:
                rows = parse_cards(body, required=False, default_source="physical deck")
                with LOCK:
                    guests = read_json(GUESTS_FILE, [])
                    g = find_guest(guests, m.group(1))
                    photos = save_photos(body.get("photos"), f"guests/{g['slug']}")
                    if not rows and not photos:
                        raise ValueError("Add a photo or tag at least one card")
                    r = {"id": new_id("r"), "date": date,
                         "question": clean_text(body.get("question"), 300) or None,
                         "spread": clean_text(body.get("spread"), 40) or None,
                         "photos": photos, "cards": card_brief(rows, with_img=True),
                         "note": clean_text(body.get("note")) or None,
                         "reading": None, "status": "needs_reading", "created_at": now_iso()}
                    gen = clean_generated(body.get("generated_reading"))
                    if gen:
                        r["generated_reading"] = gen
                    g.setdefault("readings", []).append(r)
                    write_json_atomic(GUESTS_FILE, guests)
                    rec = add_outbox({"kind": "guest_reading", "guest_id": g["id"], "guest_name": g["name"],
                                      "reading_id": r["id"], "date": date, "photos": photos,
                                      "cards": card_brief(rows), "question": r["question"],
                                      "status": "needs_reading"})
                return self.send_json({"ok": True, "guest_id": g["id"], "reading": r, "outbox": rec})

            m = re.match(r"^/api/guests/([\w-]+)/profile$", path)
            if m:   # optional birth details (+ full birth name for numerology); guests.json only
                b = {"date": clean_text(body.get("birth_date"), 10) or None, "time": clean_text(body.get("birth_time"), 5) or None,
                     "place": clean_text(body.get("birth_place"), 120) or None, "lat": body.get("lat") or None,
                     "lon": body.get("lon") or None, "tz": clean_text(body.get("tz"), 60) or None}
                if b["date"] and not re.match(r"^\d{4}-\d{2}-\d{2}$", b["date"]):
                    raise ValueError("Birth date must be YYYY-MM-DD")
                if b["time"] and not re.match(r"^\d{1,2}:\d{2}$", b["time"]):
                    raise ValueError("Birth time must be HH:MM")
                for k in ("lat", "lon"):
                    if b[k] is not None:
                        b[k] = float(b[k])
                if b["tz"]:
                    from zoneinfo import ZoneInfo
                    ZoneInfo(b["tz"])   # raises on a bad zone name
                with LOCK:
                    guests = read_json(GUESTS_FILE, [])
                    g = find_guest(guests, m.group(1))
                    g["birth"] = b
                    g["birth_name"] = clean_text(body.get("birth_name"), 120) or None
                    g.pop("sun_sign", None)
                    birth, _ = guest_birth(g)
                    if birth:
                        try:
                            g["sun_sign"] = run_astro(birth, today_local())["natal"]["Sun"]["sign"]
                        except Exception:  # noqa: BLE001
                            pass
                    elif b["date"]:   # no place/time: the Sun sign is still exact when it is the same all day (checked at both ends of the UTC day)
                        try:
                            y, mo, d = map(int, b["date"].split("-"))
                            signs = {run_astro({"y": y, "m": mo, "d": d, "hour": h, "minute": mi, "tz": "UTC", "lat": 0.0, "lon": 0.0}, today_local())["natal"]["Sun"]["sign"]
                                     for h, mi in ((0, 0), (23, 59))}
                            if len(signs) == 1:
                                g["sun_sign"] = signs.pop()
                        except Exception:  # noqa: BLE001
                            pass
                    write_json_atomic(GUESTS_FILE, guests)
                return self.send_json({"ok": True, "guest": g})

            m = re.match(r"^/api/guests/([\w-]+)/insights$", path)
            if m:   # save a generated horoscope / numerology reading to the guest's history
                kind = str(body.get("kind", ""))
                if kind not in ("horoscope", "numerology"):
                    raise ValueError("kind must be horoscope or numerology")
                text = clean_text(body.get("text"), 12000)
                if not text:
                    raise ValueError("Nothing to save")
                with LOCK:
                    guests = read_json(GUESTS_FILE, [])
                    g = find_guest(guests, m.group(1))
                    rec = {"id": new_id("i"), "kind": kind, "date": today_local(), "title": clean_text(body.get("title"), 120) or kind.title(),
                           "text": text, "created_at": now_iso()}
                    g.setdefault("insights", []).append(rec)
                    write_json_atomic(GUESTS_FILE, guests)
                return self.send_json({"ok": True, "guest_id": g["id"], "insight": rec})

            m = re.match(r"^/api/guests/([\w-]+)/readings/([\w-]+)/generated$", path)
            if m:   # attach/refresh the app-built reading text (used for backfill); touches only guests.json
                gen = clean_generated(body.get("generated_reading"))
                if not gen:
                    raise ValueError("generated_reading with at least one card required")
                with LOCK:
                    guests = read_json(GUESTS_FILE, [])
                    g = find_guest(guests, m.group(1))
                    r = next((x for x in g.get("readings", []) if x.get("id") == m.group(2)), None)
                    if not r:
                        raise LookupError("no such reading")
                    r["generated_reading"] = gen
                    write_json_atomic(GUESTS_FILE, guests)
                return self.send_json({"ok": True, "guest_id": g["id"], "reading": r})

            m = re.match(r"^/api/guests/([\w-]+)/readings/([\w-]+)/share\.(png|pdf)$", path)
            if m:   # v16: render a guest reading as an image or PDF (Pillow in the tools venv); nothing is stored
                g = find_guest(read_json(GUESTS_FILE, []), m.group(1))
                r = next((x for x in g.get("readings", []) if x.get("id") == m.group(2)), None)
                if not r:
                    raise LookupError("no such reading")
                inc = body.get("include") or {}
                job = {"fmt": m.group(3), "guest": g["name"], "date": r.get("date"), "question": r.get("question"), "spread": r.get("spread"),
                       "cards": [{"name": c.get("name"), "orientation": c.get("orientation"), "position": c.get("position"),
                                  "img": str(DECK_IMG_DIR / Path(str(c.get("img") or "")).name)} for c in r.get("cards") or []],
                       "reading": r.get("reading") if inc.get("reading", True) else None,
                       "generated": r.get("generated_reading") if inc.get("reading", True) else None,
                       "note": r.get("note") if inc.get("notes") else None,
                       "brand": os.environ.get("TAROT_OWNER_NAME", "Natalie") + "’s Tarot", "birth": (g.get("birth") or {}).get("date") if inc.get("birth") else None, "sun": g.get("sun_sign") if inc.get("birth") else None}
                pr = subprocess.run([ASTRO_PY, str(APP_DIR / "tools" / "share_render.py")], input=json.dumps(job).encode(), capture_output=True, timeout=60)
                if pr.returncode != 0:
                    raise RuntimeError("render failed: " + pr.stderr.decode(errors="replace").strip().splitlines()[-1:][0] if pr.stderr else "render failed")
                ctype = "image/png" if m.group(3) == "png" else "application/pdf"
                fn = f"{slugify(g['name'])}-{r.get('date')}.{m.group(3)}"
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(pr.stdout)))
                self.send_header("Content-Disposition", f'attachment; filename="{fn}"')
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(pr.stdout)
                return

            m = re.match(r"^/api/guests/([\w-]+)/readings/([\w-]+)/resolve$", path)
            if m:
                with LOCK:
                    g, r = resolve_guest_reading(m.group(1), m.group(2), body)
                return self.send_json({"ok": True, "guest_id": g["id"], "reading": r})

            if path == "/api/gaps/resolve":
                gid = body.get("id")
                orient = str(body.get("orientation", "")).lower()
                if orient not in ("upright", "reversed", "unknown"):
                    raise ValueError("orientation must be upright, reversed or unknown (I don't remember)")
                with LOCK:
                    gaps = read_json(GAPS_FILE, [])
                    gap = next((g for g in gaps if g.get("id") == gid), None)
                    if not gap:
                        return self.send_json({"error": "no such gap"}, 404)
                    if gap.get("status") != "open":
                        return self.send_json({"error": "gap already resolved"}, 409)
                    rows = parse_cards({"cards": [{
                        "id": gap.get("card_id"), "name": gap.get("name"),
                        "orientation": orient, "source": gap.get("source") or "unknown",
                    }]}, allow_unknown=True)
                    res = save_personal(gap["date"], rows)
                    gap["status"] = "resolved"
                    gap["orientation"] = orient
                    gap["resolved_at"] = now_iso()
                    write_json_atomic(GAPS_FILE, gaps)
                return self.send_json({"ok": True, "gap": gap, **res})

            return self.send_json({"error": "not found"}, 404)
        except LookupError as e:
            return self.send_json({"error": str(e)}, 404)
        except (ValueError, json.JSONDecodeError, base64.binascii.Error) as e:
            return self.send_json({"error": str(e)}, 400)
        except Exception as e:  # noqa: BLE001
            return self.send_json({"error": str(e)}, 500)


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    for f in (GUESTS_FILE, OUTBOX_FILE, GAPS_FILE):
        if not f.exists():
            write_json_atomic(f, [])
    print(f"Tarot app on http://0.0.0.0:{PORT}  entries={ENTRIES_FILE}  data={DATA_DIR}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
