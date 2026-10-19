#!/usr/bin/env python3
"""Cold-load byte counter (Playwright, phone 390x844, no cache, service worker blocked).
Usage: /workspace/.tools-venv/bin/python tools/measure_load.py [base_url] [label]
Counts bytes on the wire (encodedDataLength from Chrome DevTools) for same-origin requests:
  1. open /?tab=today (Today tab, cold)
  2. then open the Cards tab and scroll the whole grid so every lazy image loads."""
import json, sys, time
from collections import defaultdict
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

base = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090").rstrip("/")
label = sys.argv[2] if len(sys.argv) > 2 else ""
origin = urlparse(base).netloc

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, service_workers="block")
        page = ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        cdp.send("Network.enable")
        cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
        reqs = {}
        totals = {"phase": "today"}
        rows = []
        cdp.on("Network.responseReceived", lambda e: reqs.setdefault(e["requestId"], {}).update(
            url=e["response"]["url"], type=e["type"], enc=e["response"]["headers"].get("Content-Encoding") or e["response"]["headers"].get("content-encoding") or ""))
        def done(e):
            r = reqs.get(e["requestId"])
            if r and urlparse(r["url"]).netloc == origin:
                rows.append({**r, "bytes": e["encodedDataLength"], "phase": totals["phase"]})
        cdp.on("Network.loadingFinished", done)
        page.goto(base + "/?tab=today", wait_until="networkidle")
        time.sleep(1)
        totals["phase"] = "cards"
        page.click('.tab[data-tab="cards"]')
        for _ in range(40):
            page.mouse.wheel(0, 900); time.sleep(0.12)
        page.wait_for_load_state("networkidle"); time.sleep(1.5)
        b.close()
    out = {"base": base, "label": label}
    for ph in ("today", "cards"):
        sel = [r for r in rows if r["phase"] == ph]
        by = defaultdict(int)
        for r in sel:
            path = urlparse(r["url"]).path
            k = "api" if path.startswith("/api/") else ("img" if r["type"] == "Image" else r["type"].lower())
            by[k] += r["bytes"]
        out[ph] = {"requests": len(sel), "bytes": sum(r["bytes"] for r in sel), "by_kind": dict(by)}
    out["total_bytes"] = out["today"]["bytes"] + out["cards"]["bytes"]
    out["detail"] = sorted([(urlparse(r["url"]).path, r["bytes"], r["enc"]) for r in rows if r["type"] != "Image"], key=lambda x: -x[1])
    print(json.dumps(out, indent=1))

run()
