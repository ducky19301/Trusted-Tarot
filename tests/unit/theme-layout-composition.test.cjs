const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const controller = read("public/theme-layouts.js");
const mirror = read("web/theme-layouts.js");
const html = read("public/index.html");
const htmlMirror = read("web/index.html");
const css = read("public/themes.css");
const cssMirror = read("web/themes.css");

test("theme composition controller supports all three selectable themes", () => {
  for (const theme of ["celestial", "editorial", "cosmic"]) {
    assert.match(controller, new RegExp('"'+theme+'"'));
    assert.ok(css.includes('data-screen-layout="'+theme+'"'), "missing composition styles for "+theme);
  }
  assert.match(controller, /MutationObserver/);
  assert.match(controller, /data-design-theme/);
});

test("all major feature screens receive a composition without changing their route IDs", () => {
  for (const screen of ["today","journal","guests","cards","practice","astro","compat","friends","meditate"]) {
    assert.match(controller, new RegExp(screen+':\\s*\\{'));
    assert.ok(html.includes('id="panel-'+screen+'"'), "missing screen panel "+screen);
  }
  for (const part of ["daily-context","reading-workspace","journal-pages","guest-workspace","card-collection","learning-content","astro-feature","compatibility-content","community-content","meditation-stage"]) {
    assert.ok(controller.includes(part), "missing layout role "+part);
  }
});

test("shared bottom navigation stays outside theme-specific screen composition", () => {
  const navStart = html.indexOf('<nav class="tabs"');
  const navEnd = html.indexOf("</nav>", navStart);
  const nav = html.slice(navStart, navEnd + 6);
  assert.ok(navStart >= 0 && navEnd > navStart, "shared bottom navigation not found");
  assert.match(nav, /data-tab="today"/);
  assert.match(nav, /data-tab="journal"/);
  assert.match(nav, /data-tab="cards"/);
  assert.match(nav, /data-tab="practice"/);
  assert.match(html, /theme-layouts\\.js/);
  assert.match(htmlMirror, /theme-layouts\\.js/);
  assert.ok(controller.indexOf('document.getElementById("panel-"') >= 0);
});

test("public and web theme assets stay byte-for-byte mirrored", () => {
  assert.equal(controller, mirror);
  assert.equal(html, htmlMirror);
  assert.equal(css, cssMirror);
});
