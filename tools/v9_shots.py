#!/usr/bin/env python3
"""v9 phone screenshots + behaviour checks against a TEMP COPY instance (never the real journal).
Usage: /workspace/.tools-venv/bin/python tools/v9_shots.py http://127.0.0.1:8097"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
assert not BASE.endswith(":8090"), "run against a temp copy, not the live app"
OUT = Path(__file__).resolve().parent.parent / "screenshots" / "v9"
OUT.mkdir(parents=True, exist_ok=True)
errors, results = [], {}

def check(name, cond):
    results[name] = bool(cond)
    print(("PASS " if cond else "FAIL ") + name, flush=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        service_workers="block", permissions=["clipboard-read", "clipboard-write"])
    def page_at(path):
        pg = ctx.new_page()
        pg.on("console", lambda m: m.type == "error" and errors.append(f"{path}: {m.text}"))
        pg.on("pageerror", lambda e: errors.append(f"{path}: pageerror {e}"))
        pg.on("dialog", lambda d: d.dismiss())
        pg.goto(BASE + path, wait_until="networkidle"); time.sleep(0.6)
        return pg
    shot = lambda pg, name, full=False: pg.screenshot(path=str(OUT / name), full_page=full)

    # 1. fresh Today (no card saved today yet in the copy)
    pg = page_at("/?shot=1")
    check("fresh: draw table shown", pg.is_visible("#drawBtn") and not pg.is_visible("#todaySaved"))
    check("phone bar has 5 items", len([e for e in pg.query_selector_all(".tabs .tab") if e.is_visible()]) == 5)
    check("aria: tab controls panel", pg.get_attribute("#tab-today", "aria-controls") == "panel-today" and pg.get_attribute("#tab-today", "aria-selected") == "true")
    shot(pg, "01-today-fresh.png")
    # draw lock
    pg.click("#drawBtn"); time.sleep(0.3)
    check("after draw: Draw/Shuffle hidden, Redraw shown", not pg.is_visible("#drawBtn") and not pg.is_visible("#shuffleBtn") and pg.is_visible("#redrawBtn"))
    first = pg.evaluate("window.TarotApp.S.drawn[0].card.id")
    pg.evaluate("document.getElementById('drawBtn').click()")
    check("hidden Draw cannot re-roll", pg.evaluate("window.TarotApp.S.drawn[0].card.id") == first)
    pg.click('[data-count="3"]'); time.sleep(0.2)   # confirm() dismissed -> keeps the draw
    check("switching spread asks first (dismiss keeps card)", pg.evaluate("window.TarotApp.S.drawn.length") == 1)
    pg.click(".flip[data-i='0']"); time.sleep(1.0)
    check("save box right under the card", pg.is_visible("#saveMineBtn") and pg.is_visible(".quick-row .one-line"))
    pg.close()

    # 2. Save placement (demo hook, never saves)
    pg = page_at("/?demo=1&shot=1")
    pg.evaluate("window.scrollTo(0, document.querySelector('#stage').getBoundingClientRect().top + scrollY - 120)"); time.sleep(0.2)
    shot(pg, "02-save-placement.png")
    box = pg.eval_on_selector("#saveMineBtn", "e => e.getBoundingClientRect().top + scrollY")
    rm = pg.eval_on_selector("#readMore", "e => e.getBoundingClientRect().top + scrollY")
    check("Save sits above Read more", box < rm and not pg.eval_on_selector("#readMore", "e => e.open"))
    shot(pg, "02b-save-placement-full.png", full=True)
    pg.close()
    pg = page_at("/?demo=3&labels=ppf&shot=1")
    shot(pg, "02c-three-card-save.png", full=True)
    pg.close()

    # 3. Physical picker grid
    pg = page_at("/?src=physical&shot=1")
    check("physical grid has 22 majors", len(pg.query_selector_all(".pp-card")) == 22)
    pg.click('[data-g="Pentacles"]'); time.sleep(0.2)
    shot(pg, "03-physical-grid.png")
    pg.click('.pp-card[data-id="pe04"]'); time.sleep(0.2)
    pg.click('#physicalControls [data-o="reversed"]'); time.sleep(0.3)
    check("tap grid picks card + reversed", pg.evaluate("window.TarotApp.S.drawn[0].card.name + '/' + window.TarotApp.S.drawn[0].orientation") == "Four of Pentacles/reversed")
    check("search still available", pg.query_selector(".pp-search") is not None or pg.is_visible(".pp-change"))
    pg.evaluate("window.scrollTo(0, 0)")
    shot(pg, "03b-physical-picked.png")
    shot(pg, "03c-physical-picked-full.png", full=True)
    pg.close()

    # 4. Journal with recap + gap option, More menu
    pg = page_at("/?shot=1#journal")
    check("recap shown", "This month" in pg.inner_text("#recapBox") or "streak" in pg.inner_text("#recapBox").lower())
    check("gap has I don't remember", pg.is_visible('#gapBox [data-o="unknown"]'))
    shot(pg, "04-journal-recap-gap.png")
    pg.click("#moreBtn"); time.sleep(0.3)
    check("More menu opens with 3 items", len([e for e in pg.query_selector_all("#moreMenu button") if e.is_visible()]) == 3)
    shot(pg, "05-more-menu.png")
    pg.click('[data-goto="astro"]'); time.sleep(0.4)
    check("More -> Astro works", pg.is_visible("#panel-astro") and pg.get_attribute("#moreBtn", "aria-selected") == "true")
    astro = pg.inner_text("#astroList")
    check("Sep 15 shows no 'pending' (outbox empty)", "pending" not in astro.lower() and "No astro note" in astro)
    shot(pg, "06-astro-no-note.png")
    pg.close()

    # 5. Save today's card for real -- in the TEMP COPY -- then Share
    pg = page_at("/?shot=1")
    pg.click("#drawBtn"); pg.click(".flip[data-i='0']"); time.sleep(1.0)
    pg.click("#saveMineBtn"); time.sleep(1.2)
    check("after save: Share shown, Save locked", pg.is_visible("#shareBtn") and pg.is_disabled("#saveMineBtn"))
    check("after save: Pull another offered", "Pull another" in pg.inner_text("#redrawBtn"))
    pg.evaluate("navigator.share = undefined")
    pg.click("#shareBtn"); time.sleep(0.4)
    clip = pg.evaluate("navigator.clipboard.readText()")
    print("clipboard:", clip)
    check("share copies 'Today's card: …'", clip.startswith("Today's card: ") and "(digital app)" in clip)
    shot(pg, "07-after-save-share.png")
    pg.close()

    # 6. Today opens on today's saved card
    pg = page_at("/?shot=1")
    check("saved-today view on open", pg.is_visible("#todaySaved") and not pg.is_visible("#drawBtn"))
    shot(pg, "08-today-already-saved.png")
    pg.click("#tsAnother"); time.sleep(0.3)
    check("Pull another / spread opens draw table", pg.is_visible("#drawBtn") and pg.is_visible("#backToSaved"))
    pg.close()
    pg = page_at("/?tab=today&shot=1")
    check("deep link ?tab=today", pg.is_visible("#panel-today"))
    pg.close()
    pg = page_at("/?shot=1#journal")
    check("deep link #journal then hash #today", pg.is_visible("#panel-journal"))
    pg.evaluate("location.hash = '#today'"); time.sleep(0.3)
    check("hash route #today", pg.is_visible("#panel-today"))
    pg.close()

    # 7. Gap: "I don't remember" (temp copy)
    pg = page_at("/?shot=1#journal")
    pg.click('#gapBox [data-o="unknown"]'); time.sleep(1.2)
    txt = pg.inner_text("#jPage")
    check("unknown shows 'Orientation not recorded'", "Orientation not recorded" in txt or "ORIENTATION NOT RECORDED" in txt)
    shot(pg, "09-gap-unknown-saved.png")
    pg.close()

    # 8. desktop keeps all 7 tabs
    dctx = b.new_context(viewport={"width": 1280, "height": 900}, service_workers="block")
    dp = dctx.new_page(); dp.on("console", lambda m: m.type == "error" and errors.append(f"desktop: {m.text}"))
    dp.goto(BASE + "/?shot=1", wait_until="networkidle"); time.sleep(0.5)
    check("desktop shows 7 tabs, no More", len([e for e in dp.query_selector_all(".tabs .tab") if e.is_visible()]) == 7)
    dp.screenshot(path=str(OUT / "10-desktop-today-saved.png"))
    b.close()

real = [e for e in errors if "/auth/status" not in e and "404" not in e]
print("console errors (excluding expected /auth/status 404):", json.dumps(real, indent=1))
print("all console messages:", json.dumps(errors, indent=1))
print("SUMMARY", sum(results.values()), "/", len(results))
