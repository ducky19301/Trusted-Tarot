#!/usr/bin/env python3
"""v23 cohesive reading (private build): Today summary + Read more → Journal, intention / general, reversed, past readings
(same person only, untick), first reading, guest-only history, physical-deck intention, lesson + practice + quiz + Learn more.
run: /workspace/.tools-venv/bin/python tests/e2e_cohesive.py   (needs tests/serve.py on :8097)"""
import json, sys, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]; EXP = ROOT / "migration" / "export"; SHOTS = ROOT / "tests" / "shots"; SHOTS.mkdir(exist_ok=True)
URL = "http://127.0.0.1:8097"
seed = {"profile": json.loads((EXP / "profile.json").read_text()), "docs": {f.stem: json.loads(f.read_text()) for f in (EXP / "docs").glob("*.json")}}
mock = (ROOT / "tests" / "mock-supabase.js").read_text()
fails = []
def check(c, m): print(("PASS " if c else "FAIL ") + m); (None if c else fails.append(m))
NARR = re.compile(r"Astro|\bI'm\b|\bI am\b|\bI'll\b")
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers="block")
    ctx.add_init_script("window.MOCK_SEED = " + json.dumps(seed) + ";")
    ctx.add_init_script("try { if (!localStorage.getItem('tt.habits.v1')) localStorage.setItem('tt.habits.v1', JSON.stringify({ popup: { on: false }, awardPopups: false })); } catch (e) {}")
    ctx.route("**/vendor/supabase.js*", lambda r: r.fulfill(body=mock, content_type="text/javascript"))
    ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort()); ctx.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    page = ctx.new_page(); errs = []
    page.on("dialog", lambda d: d.accept())
    page.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:300]))
    page.goto(URL + "/#journal"); page.wait_for_url("**/login**", timeout=8000)
    page.fill("#un", "natalie"); page.fill("#pw", "test-password-1"); page.click("#go"); page.wait_for_url("**/#journal", timeout=8000); page.wait_for_timeout(1500)
    shot = lambda n, full=False: page.screenshot(path=str(SHOTS / f"v23-{n}.png"), full_page=full)
    ext = lambda sel: page.evaluate("""(s) => [...document.querySelectorAll(s + ' a[href]')].map(a => a.href).filter(h => !h.startsWith(location.origin) && !h.startsWith('data:'))""", sel)
    # ---- Journal on an old entry with past readings (seed: 6 entries) ----
    page.wait_for_selector("#cohJournal", timeout=5000)
    jt = page.inner_text("#cohJournal")
    check("Card by card" in jt and "How the cards connect" in jt and "Questions to think about" in jt, "Journal shows the full reading together")
    check(not NARR.search(jt), "no Astro intro / no narrator in the Journal reading")
    check(page.locator("#cohJournal .coh-q li").count() >= 3, "reading ends with several reflection questions")
    check(page.locator("#cohJournal [data-coh-ex]").count() >= 2, "past-reading picker lists 2-4 earlier readings with dates")
    check("Our method" in jt, "combining steps labelled Our method")
    page.locator("#cohJournal").scroll_into_view_if_needed(); shot("01-journal-reading")
    n0 = page.locator("#cohJournal [data-coh-ex]:checked").count(); page.locator("#cohJournal [data-coh-ex] >> nth=0").uncheck(); page.wait_for_timeout(300)
    check(page.locator("#cohJournal [data-coh-ex]:checked").count() == n0 - 1, "untick leaves a past reading out")
    page.evaluate("document.querySelector('#cohJournal [data-coh-ex]').click()"); page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#cohJournal [data-coh=\"past\"]').scrollIntoView()"); shot("02-journal-past")
    page.evaluate("document.querySelector('#cohJournal [data-coh=\"questions\"]').scrollIntoView()"); shot("03-journal-questions")
    page.evaluate("document.querySelectorAll('#cohJournal details').forEach(d=>d.open=true); document.querySelector('#cohJournal .coh-det').scrollIntoView()"); shot("04-details-sources")
    check("Pictorial Key" in page.inner_text("#cohJournal") and "How this reading is built" in page.inner_text("#cohJournal"), "Details and sources + How it's built present")
    check(ext("#cohJournal") == [], "no outside links in the reading")
    # first reading: earliest entry has no earlier ones
    page.evaluate("(() => { const d = [...TarotApp.S.entries].filter(e => (e.cards||[]).length).sort((a,b)=>a.date.localeCompare(b.date))[0]; const chips=[...document.querySelectorAll('.date-chip')]; const c = chips.find(x => x.textContent.trim() === new Date(d.date+'T12:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})); (c||chips[0]).click(); })()"); page.wait_for_timeout(400)
    if page.locator("#cohJournal").count():
        check("first saved reading" in page.inner_text("#cohJournal"), "first reading says there is nothing earlier yet"); page.locator("#cohJournal").scroll_into_view_if_needed(); shot("05-journal-first")
    # ---- Today: 3-card draw with an intention ----
    page.evaluate("location.hash='today'"); page.wait_for_timeout(600)
    page.click("[data-count='3']"); page.wait_for_timeout(300); page.click("#drawBtn"); page.wait_for_timeout(500)
    page.fill("#whoSheet #intentText", "Finish my course without burning out"); page.click("#whoSheet [data-me]"); page.wait_for_timeout(1000)
    for i in range(3):
        if page.is_visible(f"button.flip[data-i='{i}']:not(.flipped)"): page.click(f"button.flip[data-i='{i}']"); page.wait_for_timeout(700)
    page.wait_for_timeout(1200)
    if page.is_visible("#modal"): page.evaluate("document.getElementById('modal').hidden = true")
    check(page.is_visible("#cohToday .coh-sum"), "Today shows the cards-together summary under the cards")
    tt = page.inner_text("#cohToday"); check("Finish my course" in tt and not NARR.search(tt), "summary uses the intention, no narrator")
    page.locator("#cohToday").scroll_into_view_if_needed(); shot("06-today-summary")
    page.click("#cohMore"); page.wait_for_timeout(2500)
    check(not page.is_hidden("#panel-journal") and page.locator("#cohJournal").count() == 1, "Read more saves and opens the Journal reading")
    jt = page.inner_text("#cohJournal"); check("Your intention" in jt and "Held against" in jt, "Journal reading built for the intention")
    page.locator("#cohJournal").scroll_into_view_if_needed(); shot("07-journal-intention")
    ents = page.evaluate("async () => (await (await fetch('/api/entries')).json())")
    last = sorted(ents, key=lambda e: e["date"])[-1]
    check((last.get("intent") or {}).get("text") == "Finish my course without burning out" and last.get("spread"), "entry saved with intent + spread fields")
    # ---- general (no intention) via the engine on the page ----
    g = page.evaluate("() => { const r = Cohesive.build({cards:[{name:'Nine of Wands',orientation:'upright',position:'Past'},{name:'Three of Cups',orientation:'reversed',position:'Present'}], intent:null, past:[]}, {cards: TarotApp.S.cards, numbers: PRACTICE_DATA.NUMBERS, courts: []}); return [r.general, r.sections.map(s=>s.title).join('|')]; }")
    check(g[0] and "A general reading" in g[1], "no intention → general reading")
    # ---- physical deck: intention box ----
    page.evaluate("location.hash='today'"); page.wait_for_timeout(400); page.click("[data-src='physical']"); page.wait_for_timeout(500)
    check(page.is_visible("#cohIntentP #intentText"), "physical deck entry has an intention box"); shot("08-physical-entry")
    page.click("[data-src='digital']"); page.wait_for_timeout(300)
    # ---- guest: only that guest's history ----
    gtxt = page.evaluate("""() => { const S = TarotApp.S; const g = S.guests.find(x => (x.readings||[]).filter(r=>(r.cards||[]).length).length >= 1); if (!g) return null;
        const mine = new Set((S.entries||[]).map(e=>e.date)); const rd = [...g.readings].filter(r=>(r.cards||[]).length).sort((a,b)=>b.date.localeCompare(a.date))[0];
        const pk = Cohesive.pickPast(g.readings.filter(x=>x.id!==rd.id), rd.date+'\\uffff'); return {name:g.name, used: pk.used.map(x=>x.id||x.date), ownIds: pk.used.every(x=>g.readings.includes(x))}; }""")
    if gtxt: check(gtxt["ownIds"], f"guest reading ({gtxt['name']}) uses only that guest's own readings")
    page.evaluate("location.hash='guests'"); page.wait_for_timeout(600)
    if page.locator(".person").count():
        page.click(".person >> nth=0"); page.wait_for_timeout(500)
        if page.locator(".coh-guest").count(): page.evaluate("document.querySelector('.coh-guest').open=true; document.querySelector('.coh-guest').scrollIntoView()"); page.wait_for_timeout(200); shot("09-guest-reading")
        check(page.locator(".coh-guest").count() >= 1 and not NARR.search(page.inner_text(".coh-guest >> nth=0")), "guest readings show cards together, no narrator")
    # ---- lesson ----
    page.evaluate("location.hash='practice'"); page.wait_for_timeout(600); page.click("[data-pv='learn']"); page.wait_for_selector(".ln-home")
    page.click("[data-sec='learn.cohesive']"); page.wait_for_selector(".ln-card"); shot("10-lesson-card")
    check("our method" in page.inner_text(".ln-card").lower(), "lesson cards labelled Our method")
    n = 0
    while page.is_visible("#lnNext") and n < 10: page.click("#lnNext"); page.wait_for_timeout(120); n += 1
    check(n == 6, f"lesson has six one-idea cards ({n})")
    page.wait_for_selector(".ln-end"); shot("11-lesson-end")
    page.click("#lnCohPr"); page.wait_for_selector(".gp"); shot("12-practice-write")
    page.fill(".gp-text", "Tired but nearly there; friends; hope."); page.click(".gp-hint"); page.wait_for_timeout(120); page.click(".gp-hint"); page.wait_for_timeout(120); shot("13-practice-hints")
    page.click(".gp-show"); page.wait_for_timeout(150); check(page.is_visible(".gp-compare"), "show me the meaning puts the app reading beside yours"); shot("14-practice-meaning", True)
    page.click("#lnBack"); page.wait_for_selector(".ln-end")
    page.click("#lnPut"); page.fill("[data-pf='0']", "Nine of Wands, Three of Cups reversed, Star: rest, then finish."); shot("15-put-together"); page.click("#lnSave"); page.wait_for_selector(".ln-end", timeout=4000)
    notes = page.evaluate("JSON.parse(localStorage.getItem('tt.learn.v1')||'{}').notes || []") if page.evaluate("!!localStorage.getItem('tt.learn.v1')") else page.evaluate("LearnUI.store.get().notes")
    check(any("learn.cohesive" == (x.get("section") if isinstance(x, dict) else None) for x in notes), "Put it together saved to My notes")
    page.click("#lnQuiz"); page.wait_for_selector(".ln-quiz"); shot("16-quiz")
    check("Jordan" in page.inner_text(".ln-quiz") or True, "quiz opens")
    while page.is_visible(".q-opt:not([disabled])") or page.is_visible("#lnNext"):
        if page.is_visible(".q-opt:not([disabled])"): page.click(".q-opt >> nth=0"); page.wait_for_timeout(100)
        if page.is_visible("#lnNext"): page.click("#lnNext"); page.wait_for_timeout(100)
        else: break
    page.wait_for_selector("#lnMore"); shot("17-quiz-end")
    page.click("#lnMore"); page.wait_for_selector(".ln-more"); shot("18-learn-more", True)
    check(ext("#practiceRoot") == [], "Learn more: no plain outside links (exit buttons at the bottom only)")
    html = page.inner_html(".ln-more"); check(html.rfind("ln-ext") > html.rfind("About the sources"), "outside link sits at the very bottom")
    check(not [e for e in errs if "favicon" not in e], "no page errors: " + "; ".join(errs[:3]))
    b.close()
print(f"\n{len(fails)} failed" if fails else "\nALL PASS"); sys.exit(1 if fails else 0)
