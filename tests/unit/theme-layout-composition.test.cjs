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
    assert.match(controller, new RegExp('"' + theme + '"'));
    assert.ok(css.includes('data-screen-layout="' + theme + '"'), "missing composition styles for " + theme);
  }
  assert.match(controller, /MutationObserver/);
  assert.match(controller, /data-design-theme/);
});

test("all nine feature screens receive a composition and retain their route IDs", () => {
  for (const screen of ["today", "journal", "guests", "cards", "practice", "astro", "compat", "friends", "meditate"]) {
    assert.match(controller, new RegExp(screen + ':\\s*\\{'));
    assert.ok(html.includes('id="panel-' + screen + '"'), "missing screen panel " + screen);
  }
  for (const part of ["daily-context", "reading-workspace", "journal-pages", "guest-workspace", "guest-list", "guest-profile", "card-collection", "learning-content", "astro-feature", "compatibility-content", "compatibility-hero", "compatibility-wheel", "compatibility-story", "community-content", "friend-identity", "friend-actions", "friend-list", "friend-feed", "meditation-stage"]) {
    assert.ok(controller.includes(part), "missing layout role " + part);
  }
});

test("theme compositions style all secondary screens in each distinct visual world", () => {
  for (const theme of ["celestial", "editorial", "cosmic"]) {
    assert.ok(css.includes('html[data-screen-layout="' + theme + '"] #panel-guests'), theme + " missing guest layout");
    assert.ok(css.includes('html[data-screen-layout="' + theme + '"] #panel-compat'), theme + " missing compatibility layout");
    assert.ok(css.includes('html[data-screen-layout="' + theme + '"] #panel-friends'), theme + " missing friends layout");
  }
});

test("shared bottom navigation remains outside the screen composition system", () => {
  const navStart = html.indexOf('<nav class="tabs"');
  const navEnd = html.indexOf("</nav>", navStart);
  const nav = html.slice(navStart, navEnd + 6);
  assert.ok(navStart >= 0 && navEnd > navStart, "shared bottom navigation not found");
  for (const tab of ["today", "journal", "cards", "practice"]) assert.ok(nav.includes('data-tab="' + tab + '"'));
  assert.match(html, /theme-layouts\.js/);
  assert.match(htmlMirror, /theme-layouts\.js/);
  assert.ok(controller.indexOf('document.getElementById("panel-"') >= 0);
});

test("theme composition supports dynamic content, mobile layouts and accessible controls", () => {
  assert.match(controller, /childList:\\s*true/);
  assert.match(controller, /subtree:\\s*true/);
  assert.match(css, /@media\\s*\\(max-width:\\s*640px\\)/);
  assert.match(css, /:focus-visible/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /id="moreMenu"/);
});

test("public and web theme assets stay byte-for-byte mirrored", () => {
  assert.equal(controller, mirror);
  assert.equal(html, htmlMirror);
  assert.equal(css, cssMirror);
});
