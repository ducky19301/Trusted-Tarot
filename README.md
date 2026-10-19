# Natalie's Tarot app

A private tarot practice app: daily draws and spreads with live readings, journal, guest readings,
practice/study mode, astrology and numerology tie-ins, meditation tab, multi-user login and friends.

- `server.py`: app + JSON API (Python standard library, default port 8090).
- `public_proxy.py`: login/password gate in front of the app (port 8091); `accounts.py` handles users and friends.
- `static/`: the phone web app (PWA).
- `content/`: tarot card text (no personal data). `thumbs/`: card thumbnails.
- `tools/astro_engine.py`: Swiss Ephemeris horoscopes (`pip install -r requirements.txt`).
- `docs/`: architecture notes and the bot API.

**Not in this repo, on purpose:** `data/` (accounts, password hash, cookie secret, journal, guests and their
birth data, readings, photos, friends). Back that up separately; never commit it.

Personal settings come from environment variables, for example `TAROT_OWNER_BIRTH` (JSON birth data),
`TAROT_DATA_DIR`, `TAROT_ENTRIES`, `TAROT_DECK_IMG`, `PORT`, `PROXY_PORT`.

Run locally: `python3 server.py` then `python3 public_proxy.py` (after `python3 public_auth_setup.py`).
