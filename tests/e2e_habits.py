#!/usr/bin/env python3
"""v21 habits + glossary check (private build). End-to-end check of the built site in Chrome with a fake Supabase (tests/mock-supabase.js) seeded from the
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
    shot = lambda n, full=False: page.screenshot(path=str(SHOTS / f"v21-{n}.png"), full_page=full)
    ext = lambda sel: page.evaluate("""(s) => [...document.querySelectorAll(s + ' a[href]')].map(a => a.href).filter(h => !h.startsWith(location.origin) && !h.startsWith('data:'))""", sel)
    page.wait_for_timeout(800)
    # ---- once-a-day pop-up ----
    check(page.is_visible("#hbSheet .hb-pop"), "daily lesson pops up on the first open of the day"); shot("40-popup")
    page.click("#hbLater"); page.evaluate("location.hash='today'"); page.wait_for_timeout(400)
    check(page.is_visible("#hbBanner") and "today's lesson" in page.inner_text("#hbBanner").lower(), "Later today tucks it into a banner on Today"); shot("41-banner")
    page.reload(); page.wait_for_timeout(1500); page.evaluate("location.hash='today'"); page.wait_for_timeout(300)
    check(not page.is_visible("#hbSheet .hb-pop"), "pop-up shows only once a day")
    check(page.is_visible("#hbBanner"), "banner is still there after Later today")
    # ---- Glossary tab in Practice ----
    page.evaluate("location.hash='practice'"); page.wait_for_timeout(800)
    check(page.is_visible("[data-pv='glossary']"), "Practice has a visible Glossary sub-tab")
    page.click("[data-pv='glossary']"); page.wait_for_selector(".ln-gloss"); shot("42-glossary")
    allN = page.locator(".gl-card").count(); page.fill("#glSearch", "revers"); page.wait_for_timeout(200)
    check(0 < page.locator(".gl-card").count() < allN, "glossary search filters cards"); shot("43-glossary-search")
    check(ext("#practiceRoot") == [], "glossary has no outside links")
    page.fill("#glSearch", ""); page.click("#glPractice"); page.wait_for_selector(".gp")
    check(page.locator(".gp-text").count() == 1 and page.is_visible(".gp-hint") and page.is_visible(".gp-show"), "glossary practice: write first, hints, show me the meaning")
    page.fill(".gp-text", "Something about the cards"); page.click(".gp-hint"); page.wait_for_timeout(100); shot("44-glossary-hint")
    page.click(".gp-show"); page.wait_for_timeout(100); check(page.is_visible("[data-rate='knew']"), "optional rating after the meaning"); shot("45-glossary-meaning")
    for i in range(10):
        if page.is_visible("#glDone"): break
        if page.is_visible(".gp-show"): page.click(".gp-show"); page.wait_for_timeout(80)
        if page.is_visible("#hbSheet .hb-award"): page.click("#hbSheet [data-hx] >> nth=1")
        page.click("[data-rate='knew']"); page.wait_for_timeout(120)
    page.wait_for_timeout(300)
    # ---- first-day award ----
    check(page.is_visible("#hbSheet .hb-award") and "new learner" in page.inner_text("#hbSheet").lower(), "first-day New learner award appears"); shot("46-award-new")
    page.click("#hbShare"); page.wait_for_selector(".hb-share-img"); shot("47-share-card")
    t = page.inner_text("#hbSheet").lower()
    check("never on the card" in t and page.locator("#hbLink").count() == 0, "share card lists what's never shared; private app has no link toggle")
    check(page.evaluate("window.Habits._t.shareText(window.Habits.H.get())").find("http") == -1, "share text has no link")
    page.evaluate("""() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = { n: d.files.length, type: d.files[0].type, name: d.files[0].name, text: d.text || '', url: d.url || '' }; }; }""")
    page.click("#hbDo"); page.wait_for_timeout(600)
    sh = page.evaluate("window.__shared")
    check(sh and sh["n"] == 1 and sh["type"] == "image/png" and not sh["url"] and "http" not in sh["text"], f"share sheet gets one PNG, no link ({sh})")
    page.click("#hbSheet .modal-close")
    # ---- quiz + learn more ----
    page.click("[data-pv='glossary']"); page.wait_for_selector(".ln-gloss"); page.click("#glQuiz"); page.wait_for_selector(".ln-quiz")
    check(page.is_visible("#lnHint"), "glossary quiz offers a hint before answering"); page.click("#lnHint"); page.wait_for_timeout(100); shot("48-glossary-quiz")
    page.click("[data-pv='glossary']"); page.wait_for_selector(".ln-gloss"); page.click("#glMore"); page.wait_for_selector(".ln-more"); shot("49-glossary-learnmore", True)
    check(page.locator(".ln-more .ln-ext").count() <= 1 and ext(".ln-more") == [], "Learn more stays in the app (outside link only behind the confirm button)")
    # ---- Learn glossary links to the tab ----
    page.click("[data-pv='learn']"); page.wait_for_selector(".ln-home"); page.click("[data-sec='learn.glossary']"); page.wait_for_selector(".ln-card")
    for _ in range(200):
        if not page.is_visible("#lnNext"): break
        page.click("#lnNext"); page.wait_for_timeout(30)
    check(page.is_visible("#lnGlossTab"), "Learn › Glossary links to Practice › Glossary"); page.click("#lnGlossTab"); page.wait_for_selector(".ln-gloss")
    # ---- Progress: streak, settings, awards ----
    page.click("[data-pv='practice']"); page.wait_for_timeout(300); page.click("[data-mode='progress']"); page.wait_for_timeout(800); page.wait_for_selector("#hbPanel")
    check("1" in page.inner_text("#hbPanel .hb-flame"), "streak shows 1 day"); page.locator("#hbPanel").scroll_into_view_if_needed(); shot("50-streak")
    page.click("#hbSet"); page.wait_for_selector(".hb-settings"); t = page.inner_text("#hbSheet").lower()
    check("home screen" in t or "app is open" in t, "reminder settings are honest about how notifications arrive")
    check("about to lose" in t and "what we won't do" in t, "settings list what we won't do"); shot("51-settings")
    page.click("[data-rest='0']"); page.click("#hbSheet .modal-close")
    # missed day → freeze
    page.evaluate("""() => { const k='tt.habits.v1', h=JSON.parse(localStorage.getItem(k)); const d=(n)=>{const x=new Date(); x.setDate(x.getDate()-n); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
      h.days=[d(4),d(3),d(2)]; h.rest=[]; h.frozen=[]; localStorage.setItem(k, JSON.stringify(h)); }""")
    page.click("[data-mode='progress']"); page.click("[data-mode='progress']"); page.wait_for_selector("#hbPanel")
    page.locator("#hbPanel").scroll_into_view_if_needed(); t = page.inner_text("#hbPanel")
    check("Welcome back" in t and "That's fine" in t, "missed day: welcome back, no guilt"); shot("52-missed")
    page.click("#hbFreeze"); page.wait_for_timeout(200)
    check("3" in page.inner_text("#hbPanel .hb-flame") and "Welcome back" not in page.inner_text("#hbPanel"), "freeze keeps the 3-day streak")
    page.click("#hbAwards"); page.wait_for_selector(".hb-awards"); shot("53-awards")
    check(page.locator(".hb-a").count() == 14 and page.locator(".hb-a:not(.off)").count() >= 2, "awards list with New learner earned")
    page.click("#hbSheet .modal-close")
    # ---- reminder fallback banner ----
    page.evaluate("""() => { const k='tt.habits.v1', h=JSON.parse(localStorage.getItem(k)); h.days=[]; h.reminder.on=true; h.reminder.time='00:00'; h.reminder.notified=null; h.reminder.banner=null; h.popup.later=null; localStorage.setItem(k, JSON.stringify(h)); }""")
    page.evaluate("location.hash='today'"); page.reload(); page.wait_for_timeout(1800)
    check(page.is_visible("#hbBanner") and "lesson time" in page.inner_text("#hbBanner").lower(), "in-app fallback banner when reminder time has passed"); shot("54-reminder-banner")
    check("natalie" not in page.evaluate("window.Habits._t.shareText(window.Habits.H.get())").lower(), "share text has no name")
    check(not [e for e in errs if "favicon" not in e], f"no console errors ({errs[:3]})")
    b.close()
print("\nall habits checks passed" if not fails else f"\n{len(fails)} FAILED: {fails}"); sys.exit(1 if fails else 0)
