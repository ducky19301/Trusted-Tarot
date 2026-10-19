# Trusted Tarot (v17): free hosting edition

Same app and screens as v16, with no server to babysit.

* **public/** is the whole website (Cloudflare Pages or Workers static assets, free). It is built by `scripts/build_static.py` from the live app.
  * `backend.js` answers the old `/api/*`, `/social/*` and `/auth/status` calls in the browser, using the same rules as server.py and accounts.py, on top of Supabase.
  * `astro.js` is a JavaScript port of tools/astro_engine.py using astronomy-engine. It matches Swiss Ephemeris to within 0.003° (`node tests/astro_compare.js`).
  * Share-as-image/PDF now uses the browser's canvas plus jsPDF instead of Pillow.
  * `login.html` / `signup.html` use Supabase Auth. A username becomes `<username>@users.trustedtarot.app`, and no email is ever sent.
  * `config.js` holds the Supabase project URL and publishable key. Both are public by design.
* **supabase/schema.sql** sets up the tables (profiles, docs, friendships, friend_requests, shares) with row-level security, the friend functions and a private `uploads` bucket. Free plan only.
* **scripts/**
  * `migrate_export.py`: live data to `migration/export/` (git-ignored).
  * `migrate_import.py`: export to Supabase (needs the env vars `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and `NATALIE_PASSWORD`).
  * `backup_export.py`: nightly backup (box cron or `.github/workflows/daily-backup.yml`).
* **tools/sb_bot.py**: box bots call the exact same API as before, for example `python3 tools/sb_bot.py GET /api/outbox/pending`.
* **tests/**
  * `schema_test.mjs`: real Postgres (PGlite) plus RLS checks.
  * `e2e.py`: Chrome run of the built site against `mock-supabase.js`.
  * `serve.py`: local static server.
  * `fake_rest.py`: offline REST stand-in for sb_bot.

Deploy order: run the schema, turn off email confirmation, fill in `public/config.js` (and `web/config.js`), run `migrate_import.py`, push, and let Cloudflare deploy from `public/`.
