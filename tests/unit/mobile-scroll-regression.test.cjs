const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("mobile shell keeps the viewport fixed while long content gets its own touch scroller", () => {
  const css = read("public/themes.css");
  const mobile = css.slice(css.lastIndexOf("Mobile content scrollers"));
  assert.match(mobile, /html,\s*body[\s\S]*overflow:\s*hidden/);
  assert.match(mobile, /\.app > \.panel:not\(\[hidden\]\)[\s\S]*overflow:\s*hidden/);
  for (const selector of [
    "#panel-today #todayDraw",
    "#panel-journal .book",
    "#panel-guests .profile",
    "#panel-practice #practiceRoot",
    "#panel-astro #astroList",
    "#panel-compat #compatBody",
    "#panel-friends #friendsBody",
    "#panel-meditate .med-frame"
  ]) {
    assert.ok(mobile.includes(selector), selector + " needs a dedicated mobile content area");
  }
  assert.match(mobile, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(mobile, /touch-action:\s*pan-y/);
});

test("card library remains the only primary screen scroller and keeps suit groups collapsible", () => {
  const css = read("public/themes.css");
  const js = read("public/app.js");
  const mobile = css.slice(css.lastIndexOf("Mobile content scrollers"));
  assert.match(mobile, /#panel-cards[^}]*overflow-y:\s*auto/s);
  assert.match(js, /<details class="suit-group"/);
  assert.match(js, /groupOrder/);
});
