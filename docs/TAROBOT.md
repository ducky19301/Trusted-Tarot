# TaroBot / Astro guide to the tarot app API

Base URL: `http://127.0.0.1:8090`. All requests and responses are JSON. The server backs up and atomically
writes `entries.json` itself, so **don't hand-edit entries.json while the app is running.** Use these endpoints instead.
Photo paths in records are relative to `/workspace/tarot-app/data/`. For example,
`uploads/2026-09-27/ph-ab12.jpg` is the file `/workspace/tarot-app/data/uploads/2026-09-27/ph-ab12.jpg`, and the app
serves it at `http://127.0.0.1:8090/uploads/2026-09-27/ph-ab12.jpg`.

Cards can be given by `name` ("Nine of Cups", "The Star", case-insensitive) or by `id` ("cu09", "ar17").
`orientation` is `upright` or `reversed` (the gap endpoint `/api/gaps/resolve` also accepts `unknown`, for "I don't remember"). `source` is one of `physical deck`, `digital app`, `unknown` or `photo`
(it defaults to `physical deck` when resolving a photo).

## 1. List pending work

```bash
curl -s http://127.0.0.1:8090/api/outbox/pending | python3 -m json.tool
```
Each record has a `kind` and a `status`:

| kind | status | who acts | what to do |
|---|---|---|---|
| `self_photo` | `needs_identification` | TaroBot | Look at `photos[]` (absolute path = `/workspace/tarot-app/data/` + path), identify the cards and orientation, then **resolve** (§2). `cards[]` may contain Natalie's own optional tags. |
| `guest_reading` | `needs_reading` | TaroBot | Has `guest_id`, `guest_name`, `reading_id`, `question`, `photos[]`, `cards[]`. Write the reading, then **resolve** (§3). |
| `self_draw` | `pending_astro` | Astro | Write the tie-in (§4). |

Quick view with absolute photo paths:
```bash
curl -s http://127.0.0.1:8090/api/outbox/pending | python3 -c '
import json,sys
for o in json.load(sys.stdin):
    print(o["id"], o.get("kind"), o["status"], o["date"], o.get("guest_name",""),
          [c["name"]+"/"+c["orientation"] for c in o.get("cards",[])],
          ["/workspace/tarot-app/data/"+p for p in o.get("photos",[])])'
```
The full history (including done/resolved records) is at `GET /api/outbox`.

## 2. Resolve Natalie's own photo → journal entry

```bash
curl -s -X POST http://127.0.0.1:8090/api/outbox/ob-XXXXXXXXXX/resolve \
  -H 'Content-Type: application/json' \
  -d '{"cards":[{"name":"Nine of Cups","orientation":"reversed","source":"physical deck"},
               {"name":"The Star","orientation":"upright","source":"physical deck"}],
       "reading":"Optional short interpretation; appended to the day notes as “Reading — …”."}'
```
What this does:
- Appends the cards to that day's entry in `entries.json` (or creates the day). Each card gets `summary` = the meaning for its orientation, `sitWith` from the knowledge bank, and `astro: null`. The card image is copied into `tarot-journal/img/`.
- Adds the photo paths to the day's `photos` array. The record note and `reading` are appended to `notes`.
- Marks the record `resolved` (with `resolved_cards`) and creates a new `self_draw / pending_astro` record for Astro.
- Returns `{added, skipped, backup, outbox}`. Resolving the same record twice returns 409.

## 3. Resolve a guest reading (guests.json only, never entries.json)

Either use the outbox id:
```bash
curl -s -X POST http://127.0.0.1:8090/api/outbox/ob-XXXXXXXXXX/resolve \
  -H 'Content-Type: application/json' \
  -d '{"cards":[{"name":"Three of Wands","orientation":"upright","position":"Future"}],
       "reading":"The move reads as expansion, not escape…"}'
```
or the guest and reading ids:
```bash
curl -s -X POST http://127.0.0.1:8090/api/guests/g-XXXXXXXXXX/readings/r-XXXXXXXXXX/resolve \
  -H 'Content-Type: application/json' \
  -d '{"cards":[{"name":"Three of Wands","orientation":"upright","position":"Past"}], "reading":"…"}'
```
`cards` is optional. If you send it, it replaces the reading's card list (use it when you identified cards from a photo).
`reading` is the text Natalie sees on the guest's timeline. The reading gets status `read` and the outbox record becomes `resolved`.
To see a guest's history before writing (useful for building on past readings): `GET /api/guests/<id or slug>`.

## 4. Astro: write the tie-in and mark it done

```bash
curl -s -X POST http://127.0.0.1:8090/api/entries/2026-09-27/astro \
  -H 'Content-Type: application/json' \
  -d '{"cardAstro":{"Nine of Cups":"Venus trine her natal Moon…","The Star":"Aquarius echo…"},
       "weave":"Soft receptive day… Dos: … Don’ts: …"}'
```
- `cardAstro` maps card name → text and sets that card's `astro` field on that date. Every name must be on that day, otherwise you get a 400.
- `weave` (optional) is appended to the day's `notes` as a `Day weave — …` paragraph (the prefix is added if missing). The Journal, Astro tab, flip book and PDF all show it.
- Once every card that day has astro text, all `pending_astro` records for that date are marked `done` automatically (listed in `outbox_done`).

You can also write astro text for a day that has **no** `pending_astro` record (e.g. the Sep 15 Five of Swords, whose
outbox is empty): the same call works for any saved date and card. The app shows "Astro tie-in pending" only while a
`pending_astro` record lists the card; otherwise it shows a neutral "No astro note" until text arrives.
A card saved with `orientation: "unknown"` (gap answered "I don't remember") can be woven like any other card.

To close a record by hand:
```bash
curl -s -X POST http://127.0.0.1:8090/api/outbox/ob-XXXXXXXXXX/done
```

## 5. Other useful calls
```bash
curl -s http://127.0.0.1:8090/api/entries          # the journal (entries.json)
curl -s http://127.0.0.1:8090/api/cards            # 78 cards (knowledge bank merged if present)
curl -s http://127.0.0.1:8090/api/gaps             # "needs your input" items
# Add a personal draw directly (same merge rules; creates a pending_astro record):
curl -s -X POST http://127.0.0.1:8090/api/entries -H 'Content-Type: application/json' \
  -d '{"date":"2026-09-27","cards":[{"name":"The Star","orientation":"upright","source":"physical deck"}],"note":"optional"}'
```

After journal changes, regenerate the PDF if you want it updated: `cd /workspace/tarot-journal && .venv/bin/python build_pdf.py`.
Note: that `.venv` wasn't present on this box when the app was built. Recreate it with
`python3 -m venv .venv && .venv/bin/pip install reportlab pillow`.

## 6. Voice: Natalie's own draws are written in first person

Anything TaroBot writes for **Natalie's own draws** (the `reading` text on a resolve, day-note paragraphs such as
`Theme` and `Together`, and any rewritten card `summary` or `sitWith`) is written in the first person, in her diary
voice: "I'm carrying a heavy load", "Which weight was I never meant to carry alone?". Keep the meaning the same.
**Guest readings are not** written this way: they stay addressed to the guest ("you") or about them.
Never rewrite Natalie's own typed notes or Astro's text (`astro` fields, `Day weave`, `Dos`, `Don'ts`).
The Sep 14, 15 and 24 2026 entries were converted on Sep 28; the old wording is kept in `readingOriginal` (card) and
`notesOriginal` (day), and the full pre-change file is `/workspace/tarot-journal/entries.pre-firstperson.json`.
Note: the automatic `summary` that a resolve copies from the knowledge bank is in the second person. If you add a
reading for her own draw, write that reading in the first person.

## 7. Practice data (study only)

The Practice tab stores everything in `/workspace/tarot-app/data/practice.json` (backed up to
`practice.json.bak-<stamp>` before each write, last 30 kept). It is **never** written to entries.json, the outbox or
Astro, so practice pulls don't need a tie-in and don't appear in the journal.

```bash
curl -s http://127.0.0.1:8090/api/practice
# self-rating (Leitner): rating knew|sort|didnt; mode pick|flashcard|quiz|real|daily|reading
curl -s -X POST http://127.0.0.1:8090/api/practice/review -H 'Content-Type: application/json' \
  -d '{"card":"wa10","orientation":"upright","rating":"knew","mode":"flashcard"}'
# a Shuffle & pick pull (1 or 3 cards) with her first impression
curl -s -X POST http://127.0.0.1:8090/api/practice/pull -H 'Content-Type: application/json' \
  -d '{"mode":"real","reversals":true,"context":"pick","cards":[{"id":"ar18","orientation":"reversed","impression":"fog lifting"}]}'
# practice spread reading, lesson done, quiz score, daily lesson done
curl -s -X POST http://127.0.0.1:8090/api/practice/reading -H 'Content-Type: application/json' \
  -d '{"spreadId":"ppf","spreadName":"Past, present, future","source":"app","cards":[{"id":"wa10","orientation":"upright","position":"Past","note":"tired"}]}'
curl -s -X POST http://127.0.0.1:8090/api/practice/lesson -d '{"id":"courts","done":true}' -H 'Content-Type: application/json'
curl -s -X POST http://127.0.0.1:8090/api/practice/quiz -d '{"kind":"mixed","score":8,"total":10}' -H 'Content-Type: application/json'
curl -s -X POST http://127.0.0.1:8090/api/practice/day -d '{}' -H 'Content-Type: application/json'
```

## 8. Card knowledge: new fields and what the validator allows

`/api/cards` now also returns `waiteNote`, `imageryHistory`, `olderMeanings` and `readMore` (see README). Only Waite,
Mathers and the Golden Dawn's Book T are quoted; other authors in the Resources list get neutral descriptions.
The voice checks in `/workspace/card-knowledge-work/build_validate.py` skip text inside curly quotes “…” (Waite's and
Mathers' own words, and quoted titles such as Mathers' “The Universe” for card XXI), and `imageryHistory` and
`olderMeanings.note` are exempt from the repeated-opening and shared 6-word-phrase checks, because they name the same
sources on many cards. Every quoted older meaning is verified verbatim against the saved source text.
The build also fails if two sentences in the same field say the same thing in other words (`neardup.py`: difflib
ratio 0.6 or more, heavy content-word overlap, or the same three opening words). Fix a hit by writing a sentence that adds
something new, in `dedupe_overrides.py`, rather than lowering a field minimum.
