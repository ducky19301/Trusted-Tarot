const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("mobile screen layout reserves safe areas and fits the viewport without page scrolling", () => {
  const css = read("public/themes.css");
  assert.match(css, /\.app\s*\{[^}]*height:\s*100dvh/s);
  assert.match(css, /#panel-cards[^}]*overflow-y:\s*auto/s);
  assert.match(css, /#panel-today[^}]*overflow-y:\s*hidden/s);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("mobile reading controls and card artwork scale to short phone screens", () => {
  const css = read("public/themes.css");
  assert.match(css, /#panel-today \.controls[^}]*gap:/s);
  assert.match(css, /#panel-today \.stage[^}]*max-height:\s*\d+vh/s);
  assert.match(css, /#panel-today \.stage \\.flip[^}]*max-height:\s*\d+vh/s);
  assert.match(css, /@media\s*\(max-height:\s*740px\)/);
});

test("all design themes retain the same compact mobile navigation and touch sizing", () => {
  const css = read("public/themes.css");
  assert.match(css, /html\[data-screen-layout\] \.tabs/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /backdrop-filter:\s*blur/);
});

test("public and web theme styles stay synchronized", () => {
  assert.equal(read("public/themes.css"), read("web/themes.css"));
});
