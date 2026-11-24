const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("appearance changes synchronously update the active screen composition", () => {
  const appearance = read("public/appearance.js");
  assert.ok(appearance.includes("screenLayout: p.designTheme"));
  assert.ok(appearance.includes("TAROT_THEME_LAYOUTS.apply()"));
});

test("mobile app keeps the document fixed and allows scrolling only in the Cards panel", () => {
  const css = read("public/themes.css");
  assert.ok(css.includes("height:100dvh; min-height:0; max-height:100dvh"));
  assert.ok(css.includes(".panel:not([hidden]) {\n    flex:1 1 0; min-height:0; max-height:100%; overflow-x:hidden; overflow-y:hidden;"));
  assert.ok(css.includes("html, body { width:100%; height:100%; min-height:100%; overflow:hidden; }"));
  assert.ok(css.includes("#panel-cards { overflow-y: auto !important; }"));
});

test("guest screen uses compact horizontal guest navigation and a bounded profile workspace on phones", () => {
  const css = read("public/themes.css");
  assert.ok(css.includes("#panel-guests #peopleList {"));
  assert.ok(css.includes("overflow-x:auto; overflow-y:hidden;"));
  assert.ok(css.includes("#panel-guests .profile { width:100%; min-width:0; min-height:0; }"));
  assert.ok(css.includes("#panel-guests .new-reading"));
});

test("public and web presentation assets stay synchronized", () => {
  for (const name of ["themes.css", "appearance.js", "theme-layouts.js", "index.html"]) {
    assert.equal(read("public/" + name), read("web/" + name), name + " mirror mismatch");
  }
});
