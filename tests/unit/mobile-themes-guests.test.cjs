const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("appearance changes synchronously update the active screen composition", () => {
  const appearance = read("public/appearance.js");
  assert.match(appearance, /screenLayout:\s*p\.designTheme/);
  assert.match(appearance, /TAROT_THEME_LAYOUTS/);
});

test("mobile app keeps the document fixed to the device viewport and scrolls only within the active panel", () => {
  const css = read("public/app.css");
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.app\s*\{[^}]*height:\s*100dvh/s);
  assert.match(css, /\.panel:not\(\[hidden\]\)[^{]*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.panel:not\(\[hidden\]\)[^{]*\{[^}]*overflow-y:\s*auto/s);
});

test("guest screen uses compact horizontal guest navigation and a bounded profile workspace on phones", () => {
  const css = read("public/themes.css");
  assert.match(css, /#panel-guests \.people[^}]*overflow-x:\s*auto/s);
  assert.match(css, /#panel-guests \.profile[^}]*min-height:\s*0/s);
  assert.match(css, /#panel-guests \.profile-head[^}]*padding/s);
  assert.match(css, /#panel-guests \.new-reading[^}]*overflow-wrap/s);
});

test("public and web presentation assets stay synchronized", () => {
  for (const name of ["app.css", "themes.css", "appearance.js", "theme-layouts.js", "index.html"]) {
    assert.equal(read("public/" + name), read("web/" + name), name + " mirror mismatch");
  }
});
