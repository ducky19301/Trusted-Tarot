const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const appearance = fs.readFileSync(path.join(root, "public/appearance.js"), "utf8");
const settings = fs.readFileSync(path.join(root, "public/settings.js"), "utf8");
const index = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const themes = fs.readFileSync(path.join(root, "public/themes.css"), "utf8");

test("three complete design themes are valid, persisted appearance preferences", () => {
  for (const theme of ["celestial", "editorial", "cosmic"]) {
    assert.match(appearance, new RegExp(theme));
    assert.match(themes, new RegExp('data-design-theme="' + theme + '"'));
  }
  assert.match(appearance, /designTheme/);
  assert.match(appearance, /designTheme: p\.designTheme/);
  assert.match(appearance, /localStorage\.setItem\(KEY, JSON\.stringify\(cur\)\)/);
});

test("Settings exposes three visual theme previews and allows switching", () => {
  for (const theme of ["celestial", "editorial", "cosmic"]) {
    assert.match(settings, new RegExp('\\["' + theme + '"'));
    assert.match(settings, /data-design-theme="\$\{v\}"/);
  }
  assert.match(settings, /designTheme/);
  assert.match(settings, /Design style/);
});

test("theme stylesheet changes artwork, typography, surfaces and navigation, not only palette", () => {
  for (const selector of ['[data-design-theme="celestial"]', '[data-design-theme="editorial"]', '[data-design-theme="cosmic"]']) {
    assert.ok(themes.includes(selector), "missing " + selector);
  }
  assert.match(themes, /background-image/);
  assert.match(themes, /font-family/);
  assert.match(themes, /\.tabs/);
  assert.match(themes, /\.card/);
  assert.match(index, /themes\.css/);
});
