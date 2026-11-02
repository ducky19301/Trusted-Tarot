#!/usr/bin/env python3
"""v20 Learn + Astro story check (private build). End-to-end check of the built site in Chrome with a fake Supabase (tests/mock-supabase.js) seeded from the
migration export. run: /workspace/.tools-venv/bin/python tests/e2e.py   (needs tests/serve.py on :8097)"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]; EXP = ROOT / "migration" / "export"; SHOTS = ROOT / "tests" / "shots"; SHOTS.mkdir(exist_ok=True)
URL = "http://127.0.0.1:8097"
seed = {"profile": json.loads((EXP / "profile.json").read_text()), "docs": {f.stem: json.loads(f.read_text()) for f in (EXP / "docs").glob("*.json")}}
mock = (ROOT / "tests" / "mock-supabase.js").read_text()
fails = []
def check(c, m): print(("PASS " if c else "FAIL ") + m); (None if c else fails.append(m))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers="block")
    ctx.add_init_script("window.MOCK_SEED = " + json.dumps(seed) + ";")
    ctx.route("**/vendor/supabase.js*", lambda r: r.fulfill(body=mock, content_type="text/javascript"))
    ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort()); ctx.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    page = ctx.new_page(); errs = []
    page.on("dialog", lambda d: d.accept())
    page.on("response", lambda r: errs.append("404 " + r.url) if r.status == 404 else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" and "favicon" not in m.text and "ERR_FAILED" not in m.text else None)
    page.goto(URL + "/#journal"); page.wait_for_url("**/login**", timeout=8000)
    check("/login" in page.url and "next=" in page.url, "signed-out visit goes to the login page (keeps where you were going)")
    page.fill("#un", "natalie"); page.fill("#pw", "wrong-pass"); page.click("#go"); page.wait_for_timeout(400)
    check("don’t match" in page.inner_text("#err"), "wrong password refused")
    page.fill("#pw", "test-password-1"); page.click("#go"); page.wait_for_url("**/#journal", timeout=8000); page.wait_for_timeout(1500)
    check(page.text_content(".header .eyebrow").startswith("Natalie"), "signed in as Natalie; header says Natalie’s Tarot")
    shot = lambda n, full=False: page.screenshot(path=str(SHOTS / f"v20-{n}.png"), full_page=full)
    ext = lambda sel: page.evaluate("""(s) => [...document.querySelectorAll(s + ' a[href]')].map(a => a.href).filter(h => !h.startsWith(location.origin))""", sel)
    # ---- Learn (Practice > Learn) ----
    page.evaluate("location.hash='practice'"); page.wait_for_timeout(800)
    page.click("[data-pv='learn']"); page.wait_for_selector(".ln-home"); shot("20-learn-home")
    check(page.locator(".ln-sec").count() >= 25, "Learn shows bite-sized sections")
    check(ext("#practiceRoot") == [], "Learn home has no outside links")
    page.click(".ln-sec >> nth=0"); page.wait_for_selector(".ln-card"); shot("21-learn-card")
    n = 0
    while page.is_visible("#lnNext") and n < 40:
        check(ext("#practiceRoot") == [], f"card {n+1} has no outside links") if n < 3 else None
        page.click("#lnNext"); page.wait_for_timeout(120); n += 1
    page.wait_for_selector(".ln-end"); shot("22-learn-end")
    check(page.locator("#lnPut").is_visible() and page.locator("#lnQuiz").is_visible(), "section ends with Put it together then the quiz")
    page.click("#lnPut"); page.fill("[data-pf='0']", "I looked at the picture first."); shot("23-put-together"); page.click("#lnSave"); page.wait_for_selector(".ln-end", timeout=4000)
    page.click("#lnQuiz"); page.wait_for_selector(".ln-quiz")
    if page.is_visible("#lnHint"): page.click("#lnHint"); page.wait_for_timeout(150)
    shot("24-quiz-hint"); page.click(".q-opt >> nth=0"); page.wait_for_timeout(200)
    check("Reasoning" in page.inner_text(".q-fb") and page.is_visible("#lnSee"), "quiz shows reasoning and links back to the card")
    shot("25-quiz-reason")
    while page.is_visible("#lnNext"): page.click("#lnNext"); page.wait_for_timeout(120); (page.click(".q-opt >> nth=0") if page.is_visible(".q-opt:not([disabled])") else None); page.wait_for_timeout(100)
    page.click("#lnMore"); page.wait_for_selector(".ln-more"); shot("26-learn-more", True)
    check(ext("#practiceRoot") == [], "Learn more has no plain outside links (exit buttons only)")
    if page.locator(".ln-ext").count():
        page.click(".ln-ext >> nth=0"); page.wait_for_timeout(200); check("Leave the app?" in page.inner_text("#lnSheet"), "outside link asks before leaving"); shot("27-leave-confirm"); page.click("#lnSheet .btn-ghost[data-x]")
    page.click("#lnBack"); page.wait_for_timeout(200); page.click("#lnBack"); page.wait_for_selector(".ln-home"); page.click("#lnNotes"); page.wait_for_timeout(200)
    check("I looked at the picture first." in page.inner_text("#practiceRoot"), "Put it together saved to My notes"); shot("28-my-notes")
    # ---- Flashcards: guided flow ----
    page.click("[data-pv='practice']"); page.wait_for_timeout(500); page.click("[data-mode='flash']"); page.wait_for_selector(".gp")
    page.fill(".gp-text", "Someone starting out, a bit careless."); page.click(".gp-chk >> nth=0"); page.click(".gp-hint"); page.wait_for_timeout(120)
    check(page.locator(".gp-hints .ln-hint").count() == 1, "flashcard: hints come one at a time"); shot("29-flash-guided")
    page.click(".gp-show"); page.wait_for_timeout(200); check("you wrote" in page.inner_text(".gp").lower() and page.locator("[data-rate]").count() >= 3, "flashcard: show meaning side by side, optional rating"); shot("30-flash-reveal", True)
    # ---- Astro tab ----
    page.evaluate("location.hash='astro'"); page.wait_for_selector(".astro-story", timeout=8000); page.wait_for_timeout(400)
    check(page.locator("#astroNav [data-av]").count() == 3, "Astro has Today | Learn to read charts | My chart")
    txt = page.inner_text(".astro-story")
    check(all(b not in txt.lower() for b in ["journey", "the universe", "cosmic", "manifest", "embrace", "tapestry"]), "story has no stock phrases")
    check(page.locator(".hs-tips li").count() == 6, "three dos and three don'ts"); shot("31-astro-today", True)
    page.click("[data-hp] >> nth=0"); page.wait_for_timeout(200); check("computed" in page.inner_text("#lnSheet").lower(), "story paragraph opens its computed fact"); shot("32-astro-why"); page.click("#lnSheet .modal-close")
    check(ext("#panel-astro") == [], "Astro Today has no outside links")
    page.click("[data-av='learn']"); page.wait_for_selector("#astroToday .ln-home"); shot("33-astro-learn")
    check(page.locator("#astroToday .ln-sec").count() == 9, "nine chart-reading sections")
    page.click("#astroToday .ln-sec >> nth=4"); page.wait_for_selector("#astroToday .ln-card"); shot("34-astro-houses-card")
    check("Lilly" in page.inner_text("#astroToday .ln-card"), "house cards quote Lilly")
    page.click("#astroToday #lnBack"); page.click("[data-av='chart']"); page.wait_for_selector("#astroToday .hs-table"); shot("35-my-chart", True)
    check("Pisces" in page.inner_text("#astroToday .hs-table"), "My chart lists the real natal positions (Sun in Pisces)")
    page.click("#astroToday .gp-hint"); page.wait_for_timeout(100); page.click("#astroToday .gp-show"); page.wait_for_timeout(100); shot("36-chart-guided", True)
    errs = [e for e in errs if "/uploads/" not in e and "Failed to load resource" not in e]
    check(errs == [], "no JS errors: " + "; ".join(errs[:3]))
    b.close()
print("all v20 learn checks passed" if not fails else f"{len(fails)} FAILED: " + "; ".join(fails)); sys.exit(1 if fails else 0)
