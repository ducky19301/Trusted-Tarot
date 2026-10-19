#!/usr/bin/env python3
"""Phone-size screenshots through the public URL (run with /workspace/.tools-venv/bin/python).
usage: phone_shots.py <password> [url]"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parent.parent
OUT = APP / "screenshots"
pw = sys.argv[1]
url = (sys.argv[2] if len(sys.argv) > 2 else (APP / "data" / "public-url.txt").read_text().strip()).rstrip("/")

def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True,
                        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    try:
        cdp.send("Emulation.setEmulatedMedia", {"features": [{"name": "display-mode", "value": "standalone"}]})
        print("display-mode standalone emulated:", page.evaluate("() => 1") and True)
    except Exception as e:
        print("display-mode emulation not available:", e)
    page.goto(url + "/", wait_until="load")
    page.wait_for_timeout(1500)
    print("landed on", page.url)
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / "phone-login.png"))
    print("login overflow", overflow(page))
    page.fill("#pw", pw)
    page.click("button[type=submit]")
    page.wait_for_url(lambda u: "/login" not in u, timeout=30000)
    page.wait_for_timeout(1500)
    print("after login", page.url)
    page.goto(url + "/?shot=1#today", wait_until="load")
    page.wait_for_timeout(1200)
    print("standalone media matches:", page.evaluate("() => matchMedia('(display-mode: standalone)').matches"))
    page.screenshot(path=str(OUT / "phone-today.png"))
    res = {}
    for tab in ["today", "journal", "guests", "cards", "astro", "meditate"]:
        page.click(f'.tab[data-tab="{tab}"]')
        page.wait_for_timeout(900)
        res[tab] = overflow(page)
        if tab == "journal":
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / "phone-journal.png"))
    print("overflow per tab [scrollWidth, innerWidth]:", res)
    print("logout visible:", page.is_visible("#logoutForm"))
    small = page.evaluate("""() => [...document.querySelectorAll('button, a.btn, .chip, .seg-btn, input, select, textarea')]
      .filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return [e.className || e.tagName, Math.round(r.width), Math.round(r.height)]; })
      .filter(([, w, h]) => h < 44).slice(0, 15)""")
    print("visible controls under 44px tall (on meditate tab):", small)
    sw = page.evaluate("async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active || r.installing || r.waiting || {}).scriptURL || 'registered' : null }")
    print("service worker:", sw)
    keys = page.evaluate("async () => { const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k); out[k] = (await c.keys()).map(r => new URL(r.url).pathname + new URL(r.url).search); } return out; }")
    print("caches:", keys)
    b.close()
