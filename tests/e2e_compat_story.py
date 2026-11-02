#!/usr/bin/env python3
"""v22: entering two people in Compatibility shows the full v8 story told by Astro (not just an overview), with tips,
warnings, (i) sheets and Details and sources. Cloud build + fake Supabase. run: /workspace/.tools-venv/bin/python tests/e2e_compat_story.py
(needs tests/serve.py on :8097, or TT_URL)"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]; EXP = ROOT / "migration" / "export"; SHOTS = ROOT / "tests" / "shots"; SHOTS.mkdir(exist_ok=True)
URL = os.environ.get("TT_URL", "http://127.0.0.1:8097")
seed = {"profile": json.loads((EXP / "profile.json").read_text()), "docs": {f.stem: json.loads(f.read_text()) for f in (EXP / "docs").glob("*.json")}}
mock = (ROOT / "tests" / "mock-supabase.js").read_text()
fails = []
def check(c, m): print(("PASS " if c else "FAIL ") + m); (None if c else fails.append(m))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers="block")
    ctx.add_init_script("window.MOCK_SEED = " + json.dumps(seed) + ";")
    ctx.add_init_script("try { if (!localStorage.getItem('tt.habits.v1')) localStorage.setItem('tt.habits.v1', JSON.stringify({ popup: { on: false }, awardPopups: false })); } catch (e) {}")
    ctx.route("**/vendor/supabase.js*", lambda r: r.fulfill(body=mock, content_type="text/javascript"))
    for pat in ("https://fonts.googleapis.com/**", "https://fonts.gstatic.com/**", "https://geocoding-api.open-meteo.com/**"): ctx.route(pat, lambda r: r.abort())
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL + "/#today"); page.wait_for_url("**/login**", timeout=8000)
    page.fill("#un", "natalie"); page.fill("#pw", "test-password-1"); page.click("#go"); page.wait_for_timeout(1500)
    page.evaluate("location.hash='compat'"); page.wait_for_selector("#cxNew", timeout=8000); page.click("#cxNew"); page.wait_for_selector("#cxForm")
    for k, n, d in (("a", "Sam", "1990-06-15"), ("b", "Alex", "1992-02-03")):
        if page.query_selector(f"#{k}-name"): page.fill(f"#{k}-name", n); page.fill(f"#{k}-date", d); page.check(f"#{k}-unk")
    page.click("#cxGo"); page.wait_for_selector(".cx-story", timeout=15000); page.wait_for_timeout(500)
    story = page.inner_text(".cx-story")
    check("I’m Astro" in story and "Alex" in story, "two people → the story, told by Astro in the first person")
    check(page.locator(".cx-para").count() >= 6 and all(len(page.inner_text(f".cx-para:nth-of-type({i+1}) p")) > 150 for i in range(6)), "full narrative paragraphs, not an overview")
    check("patterns, not fate" in story and not any(w in story.lower() for w in ["soulmate", "destined", "perfect match", " score", "%"]), "no verdict")
    check(page.locator(".cx-tips li").count() >= 3 and page.locator(".cx-warn li").count() >= 1, "tips and warnings")
    page.screenshot(path=str(SHOTS / "v22-compat-story.png")); page.screenshot(path=str(SHOTS / "v22-compat-story-full.png"), full_page=True)
    page.click(".cx-para[data-id='moon'] .cx-i"); page.wait_for_selector(".cx-sheet"); check("Moon" in page.inner_text(".cx-sheet"), "(i) sheet"); page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "v22-compat-info.png")); page.keyboard.press("Escape"); page.wait_for_timeout(300)
    page.click("#cxDetails"); page.wait_for_selector(".cx-srcs"); t = page.inner_text(".cx-sheet")
    check("Research behind the tips" in t and "Abstract read" in t, "Details and sources, research labelled honestly"); page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "v22-compat-details.png"))
    check(not errs, "no script errors: " + "; ".join(errs[:3]))
    b.close()
print(f"{len(fails)} FAILED" if fails else "all compat story checks passed"); raise SystemExit(1 if fails else 0)
