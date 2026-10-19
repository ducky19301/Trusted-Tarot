#!/usr/bin/env python3
"""Card-detail screenshots against the local server (run with /workspace/.tools-venv/bin/python).
Uses the ?card=ID&o=reversed&open=a,b demo hook; never saves anything."""
from pathlib import Path
from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parent.parent
OUT = APP / "screenshots"
URL = "http://127.0.0.1:8090"
PHONE = dict(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True)

def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

def full_modal(page, path):
    # let the modal grow to its full height so one image shows every open section
    page.add_style_tag(content=".modal{position:absolute;inset:0 0 auto 0;min-height:100%;place-items:start center}.modal-card{max-height:none;overflow:visible}")
    page.wait_for_timeout(200)
    h = page.evaluate("() => document.querySelector('.modal-card').getBoundingClientRect().bottom + 16")
    page.set_viewport_size({"width": page.viewport_size["width"], "height": int(h)})
    page.wait_for_timeout(300)
    page.screenshot(path=str(path))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    shots = [("ar16", "upright", "meaning,love,yesno,waite", "phone-card-detail-upright"),
             ("swqu", "reversed", "meaning,person,yesno,symbols,waite", "phone-card-detail-reversed")]
    for cid, o, op, name in shots:
        ctx = b.new_context(**PHONE); page = ctx.new_page()
        page.goto(f"{URL}/?shot=1&tab=cards&card={cid}&o={o}&open={op}", wait_until="networkidle")
        page.wait_for_timeout(900)
        print(name, "overflow", overflow(page), "open:", page.evaluate("() => [...document.querySelectorAll('#modalBody details[open]')].map(d => d.dataset.key)"))
        # viewport view: scroll the modal so Waite's words sit in view
        page.evaluate("() => { const w = document.querySelector('#modalBody details[data-key=waite]'); const c = document.querySelector('.modal-card'); c.scrollTop = w.offsetTop - 260; }")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / f"{name}-viewport.png"))
        page.evaluate("() => document.querySelector('.modal-card').scrollTop = 0")
        full_modal(page, OUT / f"{name}.png")
        ctx.close()
    # toggle check: open Tower upright, flip to reversed, confirm open sections survive and text changes
    ctx = b.new_context(**PHONE); page = ctx.new_page()
    page.goto(f"{URL}/?shot=1&tab=cards&card=ar16&open=meaning,love", wait_until="networkidle"); page.wait_for_timeout(700)
    before = page.inner_text("#modalBody details[data-key=love] .info-body")
    page.click('.orient-toggle [data-o="reversed"]'); page.wait_for_timeout(300)
    after = page.inner_text("#modalBody details[data-key=love] .info-body")
    print("toggle keeps open:", page.evaluate("() => [...document.querySelectorAll('#modalBody details[open]')].map(d => d.dataset.key)"),
          "| love text changed:", before != after, "| img reversed:", page.evaluate("() => document.querySelector('.detail img').classList.contains('reversed-img')"))
    small = page.evaluate("""() => [...document.querySelectorAll('#modalBody summary, #modalBody .seg-btn')].map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h < 44).length""")
    print("summaries/toggles under 44px tall:", small)
    # Today with a drawn card (demo draw, nothing saved) and Journal, at phone width
    page.goto(f"{URL}/?shot=1&demo=1", wait_until="networkidle"); page.wait_for_timeout(900)
    print("today sections:", page.evaluate("() => document.querySelectorAll('.reading details.info-sec').length"), "overflow", overflow(page))
    page.evaluate("() => document.querySelector('.reading').scrollIntoView()"); page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / "phone-today-card-info.png"))
    page.goto(f"{URL}/?shot=1&tab=journal", wait_until="networkidle"); page.wait_for_timeout(900)
    print("journal sections:", page.evaluate("() => document.querySelectorAll('.day-card details.info-sec').length"), "overflow", overflow(page))
    ctx.close()
    # laptop width
    ctx = b.new_context(viewport={"width": 1280, "height": 860}); page = ctx.new_page()
    page.goto(f"{URL}/?shot=1&tab=cards&card=ar16&open=meaning,symbols,waite", wait_until="networkidle"); page.wait_for_timeout(900)
    print("laptop overflow", overflow(page))
    page.screenshot(path=str(OUT / "card-detail-1280.png"))
    page.goto(f"{URL}/?shot=1&demo=3", wait_until="networkidle"); page.wait_for_timeout(900)
    page.evaluate("() => document.querySelector('.readings').scrollIntoView()"); page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / "today-3card-info-1280.png"))
    ctx.close(); b.close()
