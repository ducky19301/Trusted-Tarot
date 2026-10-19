# Natalie’s Tarot — one app for the whole practice

One local web app with seven tabs: **Today · Journal · Guests · Cards · Practice · Astro · Meditate**.
On a phone the bottom bar shows **Today · Journal · Cards · Practice · More**, and More opens Guests, Astro and Meditate.
Python stdlib only (no venv needed). Port **8090**.

## Start / stop

```bash
cd /workspace/tarot-app
nohup setsid python3 server.py > /tmp/tarot-app.log 2>&1 < /dev/null &
# open http://localhost:8090
# stop:
kill $(ss -ltnp | grep ':8090 ' | grep -oP 'pid=\K[0-9]+')
```

The old deck server on :8080 is separate. Leave it alone.

## Tabs

| Tab | What it does |
|---|---|
| Today | If entries.json already has a card for today (local date), Today opens on **today's saved card** (image, orientation, one-line meaning; tap the card for the full page) with **Share** and **Pull another / spread**. Otherwise it opens on the drawing table: one card or a 3-card spread (Left·Center·Right or Past·Present·Future), three ways in: **Draw here** (shuffle, draw, tap to flip, about 40% reversed), **I drew from my physical deck** (tap grid of card thumbnails by Major/suit, upright/reversed toggle, search box kept), and **Upload a photo of my cards** (TaroBot identifies them). After a draw, Draw/Shuffle are replaced by **Redraw** until the card is saved, so a stray tap can't re-roll it (switching spread or source asks first). Right under the card: name, orientation, a one-line meaning, then **Save as my card** / **Reading for someone else** (note and guest name fold under *Add a note*); the long sections (Love/Work/Money, Waite, history…) sit under **Read more**. After saving: **Share** (phone share sheet via `navigator.share`, otherwise copies e.g. `Today's card: Four of Pentacles, reversed (physical deck)`). A small line at the top shows the streak and this month's recap. |
| Journal | A flip book of `entries.json`, newest first, with reversed cards rotated. At the very top: the **streak and monthly recap** (e.g. `This month: 3 days · Swords ×3 · mostly reversed`, plus last month when this month is empty), computed in the browser from `/api/entries`. Then "Needs your input" (gaps.json: Upright / Reversed / **I don't remember**) and "Waiting for TaroBot". Each card shows its Astro text; "Astro tie-in pending" appears **only** while a `pending_astro` outbox record lists that card, otherwise a neutral "No astro note". Cards saved with orientation `unknown` show "Orientation not recorded". There is also a PDF download (`/journal.pdf`). |
| Guests | Each person has a profile and a timeline of readings (question, spread, photos, tagged cards with positions, TaroBot's reading text). It also counts recurring cards and suits. Guest data **never** goes into entries.json or to Astro. |
| Cards | A grid of all 78 cards (small thumbnails from `/deck-thumb/`) with search and Major/suit filters. Tap a card for the full-size image and upright/reversed meaning, sit-with, keywords, "in a spread" and imagery. |
| Practice | Study mode with four sections. **Practice**: *Shuffle & pick* at the top (shuffle animation, all 78 fanned face down, tap to pick 1 or 3 cards, 3D flip with random orientation or your own deck via the fast picker, a first-impression box, then "Flip the meaning" turns an info card with keywords, core meaning, Waite plus plain note, love/work/money and advice, and a Knew it / Sort of / Didn't self-rating), then Daily lesson, Flashcards (Leitner boxes), Quiz (10 questions, 4 choices, with the reason after each answer), Real deck practice and Progress. **Numerology**: numbers 1 to 10 across the four suits, courts as stages, Major reductions, birth card calculator, number quiz. **Learn**: 12 lessons with a done checkbox, plus a glossary. **Spreads**: 14 spreads with layout diagrams, practice readings (your notes beside the book text plus a templated study aid), history and a spread quiz. Everything is saved in `data/practice.json`, never in the journal. `?pdemo=1` turns off saving (used for screenshots). |
| Astro | Read-only. Card-level `astro` text plus the day's "Day weave / Dos / Don’ts" from `notes`. A day is "Woven", "Astro pending" (only while the outbox has a `pending_astro` record for it) or "No astro note". It also shows the queue of saves waiting for Astro. |
| Meditate | Embeds Meditation Bot's `/workspace/frequency-soundboard/` in an iframe (natalie-tones.html by default, with a toggle for the full soundboard). The folder is served **read-only** at `/meditate/`, and audio supports HTTP Range so seeking works. |

## Data files and their roles

| File | Role | Written by the app? |
|---|---|---|
| `/workspace/tarot-journal/entries.json` | **Source of truth** for Natalie's own journal. The flip book, `build_pdf.py` and the 8pm routine all read it too. | Yes, but only for personal saves, gap fixes, photo resolves and Astro text. It is always backed up to `entries.json.bak-YYYYmmdd-HHMMSS` first and written atomically (temp file + `os.replace`). Cards are **appended** to an existing day, never overwritten, and exact duplicates are skipped. |
| `data/outbox.json` | The work queue for bots. `kind: self_draw`, `status: pending_astro` means Astro should write the tie-in. `kind: self_photo`, `status: needs_identification` means TaroBot should read the photo. `kind: guest_reading`, `status: needs_reading` means TaroBot should write a guest reading. | Yes |
| `data/guests.json` | Guest profiles with their readings: `[{id, slug, name, note, created_at, readings:[{id, date, question, spread, photos, cards, note, reading, status}]}]` | Yes (never entries.json) |
| `data/gaps.json` | Known gaps shown in "Needs your input". Currently the Sep 23 Nine of Cups (orientation unknown, source `unknown`), still open for Natalie to answer. | Marks the gap `resolved` and writes the entry. "I don't remember" saves the card with `orientation: "unknown"`. |
| `data/uploads/` | Photos. Natalie's own go in `uploads/YYYY-MM-DD/<id>.<ext>`, guests' in `uploads/guests/<slug>/<id>.<ext>`. Served at `/uploads/...`. | Yes |
| `data/practice.json` | Practice tab study data: `{version, reviews{cardId:{box,due,last,seen,knew,sort,didnt}}, reviewLog[], pulls[], readings[], lessons{id:iso}, quizzes[], days[], dailyDone[]}`. Leitner: Knew it moves a card up a box (max 5, due again in 0/1/3/7/16 days by box), Sort of keeps the box and makes it due tomorrow, Didn't sends it to box 1 due today. Practice pulls keep her first impression per card. | Yes. Each write first copies the old file to `practice.json.bak-YYYYmmdd-HHMMSS-ffffff` (the last 30 are kept), then writes atomically. **Never** touches entries.json, the outbox or Astro. |
| `data/cards.json` | 78 RWS cards extracted from `tarot-deck/app.js` (the `CARDS` array). | No |
| `data/card-knowledge.json` | The richer knowledge bank (78 cards). `/api/cards` overlays its `upright/reversed/sitWith/keywords/inASpread/imagery/number/element` plus the expanded fields `waite` (Waite's own 1911 meanings, verbatim, with his picture description and source line), `symbols`, `history`, `numerologyAstrology`, and `topics.{upright,reversed}.{love,work,money,advice,asAPerson,yesNo}` onto cards.json. Added in the second expansion: `waiteNote.{upright,reversed}` (a plain-words note under Waite's quote), `imageryHistory` (how the design changed from Marseille-pattern decks to Smith's drawing), `olderMeanings` (`mathers` 1888 title/upright/reversed/remarks with source URL, `goldenDawn` Book T title as printed in The Equinox 1912, `waiteAdditional` from Pictorial Key Part III for the 56 minors, and a `note`), and `readMore` (the card's sacred-texts Pictorial Key page, Wikisource and Mathers links). All quoted older text is checked verbatim against saved copies of the sources by the validator. When the two expansions are merged, a sentence that repeats one already in the field is dropped (keeping the longer one) unless that would take the field under its minimum; those kept fields, plus paraphrased repeats found across every prose field, were then rewritten by hand in `/workspace/card-knowledge-work/dedupe_overrides.py` (279 sentence replacements in 248 fields; the build stops if an old sentence is no longer found). The validator runs `neardup.py` on every prose field and fails on any two sentences in one field that match (difflib ratio 0.6 or more, heavy content-word overlap, or the same three opening words). Pre-dedupe copy: `data/card-knowledge.pre-dedupe.json`; before the hand rewrite: `data/card-knowledge.pre-neardup.json`. Built from the batch files in `/workspace/card-knowledge-work/` with `python3 build_validate.py` (rebuilds and runs the voice checks; `--draft` writes to /tmp only). Pre-expansion copy: `data/card-knowledge.pre-expand.json`. Otherwise it falls back to cards.json. | No |

### entries.json schema (unchanged, plus optional keys)
```json
{"date": "YYYY-MM-DD",
 "cards": [{"name","orientation":"upright|reversed|unknown","img":"img/xx.jpg","source":"physical deck|digital app|unknown",
            "summary","sitWith","astro": null}],
 "notes": "string or null",
 "photos": ["uploads/YYYY-MM-DD/ph-xxxx.jpg"]}
```
`orientation: "unknown"` only comes from a gap answered "I don't remember"; its `summary` is `Orientation not recorded. Upright: … Reversed: …`. The app, the flip book (`tarot-journal/app.js`) and `build_pdf.py` label it "Orientation not recorded" and don't rotate the image (tested on copies Oct 6 2026). The Astro tab and outbox treat it like any other card.
Optional history keys: a card may carry `readingOriginal: {summary, sitWith}` and a day may carry `notesOriginal`, holding the wording from before the Sep 28 2026 first-person rewrite of Natalie's own readings (Sep 14, 15 and 24). The app, flip book and PDF ignore them. Pre-rewrite copy: `/workspace/tarot-journal/entries.pre-firstperson.json`.
`photos` is optional, and the paths are relative to `/workspace/tarot-app/data/`. The existing flip book and `build_pdf.py` ignore it (tested). Any card image used is copied from `tarot-deck/img/` into `tarot-journal/img/` if it's missing, so the PDF can find it. The app appends notes as `3-card spread (...)`, `Note — ...`, `Reading — ...` and `Day weave — ...` paragraphs. It strips `<`, `>` and `&` from free text because the PDF builder parses markup.

### Data flow
```
Today (digital / physical)  --POST /api/entries-->        entries.json (+backup) + outbox{self_draw, pending_astro}
Today (photo)               --POST /api/photos-->         uploads/ + outbox{self_photo, needs_identification}
TaroBot                     --POST /api/outbox/<id>/resolve--> entries.json (cards + photos) + outbox{self_draw, pending_astro}
Astro                       --POST /api/entries/<date>/astro-->  entries.json astro text; closes pending_astro when all cards are woven
Guests / "for someone else" --POST /api/guests/<gid>/readings--> guests.json + outbox{guest_reading, needs_reading}
TaroBot                     --POST /api/guests/<gid>/readings/<rid>/resolve--> guests.json reading text
```

## API
`GET /api/cards | /api/entries | /api/guests | /api/guests/<id|slug> | /api/outbox | /api/outbox/pending | /api/gaps | /api/today`
`POST /api/entries`, `/api/photos`, `/api/entries/<date>/astro`, `/api/outbox/<id>/done`, `/api/outbox/<id>/resolve`,
`/api/guests`, `/api/guests/<gid>/readings`, `/api/guests/<gid>/readings/<rid>/resolve`, `/api/gaps/resolve`.
Practice (study only, `data/practice.json`): `GET /api/practice`; `POST /api/practice/review`, `/api/practice/pull`, `/api/practice/reading`, `/api/practice/lesson`, `/api/practice/quiz`, `/api/practice/day`.
`/api/gaps/resolve` accepts `orientation: upright | reversed | unknown`.
Details and curl examples are in **TAROBOT.md**.

### Writing astro text later (any assistant)
Astro text can be added for any saved day at any time with `POST /api/entries/<date>/astro`, even when no `pending_astro`
outbox record exists (for example the Sep 15 Five of Swords, whose record is gone). Example:
```bash
curl -s -X POST http://127.0.0.1:8090/api/entries/2026-09-15/astro -H 'Content-Type: application/json' \
  -d '{"cardAstro":{"Five of Swords":"<tie-in text>"},"weave":"<optional Day weave paragraph>"}'
```
The server backs up entries.json and writes it atomically. Until then the app shows a neutral "No astro note"; it only says
"pending" while a `pending_astro` record lists the card. See TAROBOT.md §4.

## Speed: compression, caching, thumbnails (v9, Oct 6 2026)
- `server.py` gzips JSON / JS / CSS / HTML (bodies ≥ 1 KB) when the request has `Accept-Encoding: gzip`, with `Vary: Accept-Encoding`.
  Static text files are compressed once per file version and kept in memory. Range requests are never compressed (served as before).
- `/api/cards`: `Cache-Control: private, max-age=300, must-revalidate` + an `ETag`, so a repeat visit gets `304 Not Modified`.
  The body is rebuilt only when cards.json / card-knowledge.json change. All other `/api/*` stay `no-store`.
- `?v=` assets (`app.js?v=9` …): `public, max-age=31536000, immutable`. `/`, `sw.js`: `no-cache` + ETag (revalidated every time).
  Card images (`/deck-img/`, `/deck-thumb/`): 7 days.
- Thumbnails: `tools/make_thumbs.py` (Pillow, `/workspace/.tools-venv/bin/python tools/make_thumbs.py`) writes 240 px-wide JPEGs to
  `thumbs/` (78 files, 11.2 MB → 2.0 MB). Served at `/deck-thumb/<id>.jpg` (falls back to the full image if a thumb is missing).
  Used by the Cards grid, the physical-deck picker, the Journal/Astro/Guests/gap images. Full size stays for the drawn card,
  today's saved card and the card detail page. Override the folder with `TAROT_THUMBS`.
- `public_proxy.py` needed no change: it forwards the client's `Accept-Encoding`, `If-None-Match` and `Range` upstream unchanged,
  and passes `Content-Encoding`, `ETag`, `Content-Length` and the body bytes back untouched (304 has no body).
- Measured cold load, phone 390×844, no cache, service worker off (`tools/measure_load.py`):
  Today **1.93 MB → 0.28 MB** (/api/cards 678 KB → 200 KB gzip, JS+CSS 221 KB → 68 KB, ~1 MB of hidden-tab images no longer loaded);
  opening Cards and scrolling all 78 **11.1 MB → 2.0 MB**. Total 13.0 MB → 2.3 MB.

## Testing against copies
Every path can be overridden, so you can run a second instance against temp copies:
```bash
T=$(mktemp -d); mkdir -p $T/data $T/img
cp /workspace/tarot-journal/entries.json $T/; cp data/{guests,outbox,gaps}.json $T/data/; cp /workspace/tarot-journal/img/* $T/img/
cp data/practice.json $T/data/
TAROT_ENTRIES=$T/entries.json TAROT_DATA_DIR=$T/data TAROT_JOURNAL_IMG=$T/img PORT=8097 python3 server.py
```
Use a free port such as 8097. **Not 8091**: that is the password gate. Other variables: `TAROT_KNOWLEDGE`, `TAROT_CARDS`, `TAROT_DECK_IMG`, `TAROT_PDF`, `TAROT_MEDITATE_DIR`, `TAROT_THUMBS`, `TAROT_PRACTICE`.
`tools/v9_shots.py http://127.0.0.1:8097` runs the v9 behaviour checks and phone screenshots against such a copy (it refuses :8090), saving to `screenshots/v9/`.

Screenshot/demo URL hooks (these never save): `?demo=1|3[&labels=ppf]`, `?src=physical&pick=cu09:reversed`, `?src=photo`, `?card=ar17`, `?guest=<slug>`, `?shot=1` (turns off animations), `?today=draw` (skip today's saved card), `?more=1` (open the phone More menu).
Deep links: `/#today`, `/#journal` … or `/?tab=today` (use `?tab=` for a link that has to survive the login page, since the browser never sends `#…` to the server).

## Phone access

The app can be opened from Natalie's phone through a **permanent** public HTTPS link, behind one password:

**<your-ngrok-domain>** (also in `data/public-url.txt`)

Port 8090 is **unchanged and still unauthenticated** for the local routines; only the public path is gated.
Only 127.0.0.1:8091 (the password gate) is exposed; no ngrok traffic policy/auth/IP rules are used, the gate does all of it.

```
phone ──HTTPS──> ngrok (free dev domain) ──> 127.0.0.1:8091 public_proxy.py (password gate) ──> 127.0.0.1:8090 server.py
```

**ngrok setup (already done):**
- Authtoken saved in ngrok's own config (`~/.config/ngrok/ngrok.yml`, chmod 600), not in this repo. `bin/ngrok config check` must pass.
- `data/public-tunnel.env` (chmod 600) contains only `NGROK_DOMAIN=<your-ngrok-domain>`.
- The keepalive uses ngrok when `NGROK_DOMAIN` is set **and** either `NGROK_AUTHTOKEN` is non-empty or `ngrok config check` passes;
  it runs `bin/ngrok http 127.0.0.1:8091 --url https://$NGROK_DOMAIN` (never with an empty `NGROK_AUTHTOKEN`).
- The free plan allows **one** ngrok agent session: don't start a second `ngrok` while the keepalive's one is running.
- Free-plan warning: a normal browser gets ngrok's "You are about to visit … (ERR_NGROK_6024)" page first; tap **Visit Site** once
  and that browser remembers it (a home-screen/standalone copy may ask once more). Tools can skip it with the header `ngrok-skip-browser-warning: 1`.

**Start everything (one command; also restarts whatever is down):**
```bash
cd /workspace/tarot-app
nohup setsid ./public_keepalive.sh >> /tmp/tarot-public/keepalive.log 2>&1 < /dev/null &
cat data/public-url.txt        # public URL
```
Run the same command after the box reboots (nothing auto-starts on boot). A second copy exits immediately (flock).

**After a reboot / "is it up?" — one command:** `/workspace/tarot-app/ensure_running.sh`. It creates `/tmp/tarot-public`, starts
the keepalive only if it isn't already running (never a duplicate, never a second ngrok), then checks :8090, the gate on :8091 and
the public `/login`, prints `OK` or what is down, and exits 0/1. Run it first thing in any session that needs the app.
Auto-start on boot is **not** possible on this box (checked Oct 6 2026): there is no cron/crontab and no systemd — PID 1 is
`tini`/pod-daemon — so after a box restart someone has to run `ensure_running.sh` (or the start command above).
(Oct 6 2026 fix: the keepalive's app/proxy start subshells no longer inherit the flock fd, so a stale helper can't keep the lock
and block a restart of the loop.)

**Stop the public link** (kill the keepalive loop, then the ngrok process; the app and gate keep running locally):
```bash
kill $(cat /tmp/tarot-public/keepalive.pid)     # the loop first, so it doesn't restart the tunnel
kill $(cat /tmp/tarot-public/tunnel.pid)        # the ngrok process (or: pkill -f 'bin/ngrok http')
# optional, also stop the password gate:  pkill -f public_proxy.py
```
Note: the loop's `sleep 60` child keeps the lock for up to a minute after the loop is killed; if a restart says
"keepalive already running" and no `public_keepalive.sh` is running, wait a minute and start again.

**Fall back to the Cloudflare quick tunnel:** `rm data/public-tunnel.env`. Within a minute the running keepalive notices the mode
change, stops ngrok, starts cloudflared and writes the new random `https://<random>.trycloudflare.com` URL to `data/public-url.txt`.
That URL changes every time cloudflared restarts. To go back to ngrok, recreate the file with the `NGROK_DOMAIN=` line (chmod 600).

| Piece | What it does |
|---|---|
| `public_proxy.py` | Stdlib threaded proxy on **127.0.0.1:8091** that forwards everything (methods, bodies up to 100 MB, Range/206, content types) to :8090. Without a valid session cookie: pages redirect to `/login`, `/api/*` returns 401. Login sets a signed (HMAC-SHA256) `tarot_session` cookie: HttpOnly, Secure, SameSite=Lax, 90 days, silently renewed weekly while in use. Constant-time checks; failed logins are rate limited (5 per client per 15 min, 30 total per hour, plus a 1 s delay). Cross-origin POSTs are refused. `/manifest.webmanifest`, `/icons/*`, `/sw.js` are served without login so the phone can install the app. `POST /logout` clears the cookie; `/auth/status` tells the app to show the small **Log out** button in the footer. Log: `/tmp/tarot-proxy.log`. |
| `public_auth_setup.py` | Creates `data/public-auth.json` (chmod 600): PBKDF2-SHA256 hash of the password + random cookie secret. The password itself is never stored. `python3 public_auth_setup.py --reset` prints a new password and logs out every device (the proxy picks up the change without a restart). |
| `public_keepalive.sh` | Every 60 s: starts `server.py` if nothing listens on :8090 (never kills it), restarts the proxy if it's down/hung, starts the tunnel if it's down, restarts it if the public URL fails 5 checks in a row (the check sends `ngrok-skip-browser-warning: 1` so ngrok's warning page never counts as a failure), and keeps `data/public-url.txt` up to date. `--once` does a single pass. Logs: `/tmp/tarot-public/keepalive.log`, `/tmp/tarot-public/tunnel.log`. |
| `bin/ngrok` | ngrok agent v3 (active tunnel). The authtoken lives only in ngrok's own config, `~/.config/ngrok/ngrok.yml` (chmod 600); check it with `bin/ngrok config check`. |
| `bin/ngrok_token_form.py` | Small local form for (re-)saving the ngrok authtoken into ngrok's config. |
| `bin/cloudflared` | Cloudflare tunnel client (quick tunnel, no account), used only as the fallback. |

Other stable option (not wired in): a *Cloudflare named tunnel* needs a Cloudflare account and a domain on Cloudflare.

**Installable app (PWA).** `static/manifest.webmanifest` ("Tarot", standalone, dark/gold), icons in `static/icons/`
(made by `tools/make_icons.py` with Pillow), iOS meta tags and safe-area padding in `index.html`/`app.css`, and a bottom tab bar at phone width (5 items: Today, Journal, Cards, Practice, More; the More menu holds Guests, Astro, Meditate; the header is smaller on phones). Tabs use `role=tab` + `aria-controls` / `aria-selected` and panels `role=tabpanel` + `aria-labelledby`; arrow keys move between tabs.
On iPhone: open the URL in Safari → Share → *Add to Home Screen*. On Android/Chrome: menu → *Install app*.
`static/sw.js` caches **only** the static shell (`/`, `app.css`, `app.js`, icons, manifest, public-domain card images in `/deck-img/`);
plus `/deck-thumb/` thumbnails; it never caches `/api`, uploads, journal files, meditate audio or the login page. **When you change
index.html/app.css/app.js/practice*.js, bump `?v=` in index.html AND the `SHELL` list + `VERSION` in sw.js together** (now `v9` /
`tarot-shell-v9`) so phones pick up the update. Keep the ngrok fix: the `window.fetch` shim at the top of app.js adds
`ngrok-skip-browser-warning: 1` to every same-origin fetch, sw.js sends `NG` headers on its own fetches, and `api()` refuses a
non-JSON response (otherwise ngrok's free-plan warning page replaces API data on the phone).

Screenshots (through the public URL, 390×844): `screenshots/phone-login.png`, `phone-today.png`, `phone-journal.png`
(retake with `/workspace/.tools-venv/bin/python tools/phone_shots.py '<password>'`).

## Changelog
**v9 (Oct 6 2026)**: Today opens on today's saved card (Share, Pull another / spread); Redraw lock after a draw; Save and a one-line
meaning right under the card, long sections under Read more; Share button (`navigator.share`, clipboard fallback); deep links
`/#today` and `?tab=today`; streak + monthly recap (Journal top, small line on Today); gzip + ETag/Cache-Control + thumbnails
(`tools/make_thumbs.py`, `/deck-thumb/`); physical-deck tap grid with upright/reversed toggle (search kept); phone bottom bar
Today/Journal/Cards/Practice/More and a smaller header; tab ARIA; gap "I don't remember" → `orientation: "unknown"` (app, flip book
and PDF show "Orientation not recorded"); "No astro note" instead of a permanent "pending". Backups of every touched file:
`backups/20261006-180704-v9/`. Screenshots: `screenshots/v9/`.
