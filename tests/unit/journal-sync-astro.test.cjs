const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const html = read("public/index.html");
const app = read("public/app.js");
const backend = read("public/backend.js");
const journal = read("public/journal-ui.js");
const css = read("public/themes.css");


function routePatternFor(suffix) {
  const line = backend.split("\n").find(line => line.includes("path.match") && line.includes(suffix));
  assert.ok(line, "missing route for " + suffix);
  const literal = line.match(/path\\.match\\((\\/.*\\/)\\)/);
  assert.ok(literal, "could not extract route regex for " + suffix);
  const raw = literal[1], end = raw.lastIndexOf("/");
  return new RegExp(raw.slice(1, end), raw.slice(end + 1));
}

test("journal and Astro endpoints match real ISO calendar dates", () => {
  const date = "2026-11-23";
  const journalRoute = routePatternFor("/journal");
  const astroRoute = routePatternFor("/astro/auto");
  assert.equal(journalRoute.exec("/api/entries/" + date + "/journal")?.[1], date);
  assert.equal(astroRoute.exec("/api/entries/" + date + "/astro/auto")?.[1], date);
  assert.equal(journalRoute.test("/api/entries/not-a-date/journal"), false);
  assert.equal(astroRoute.test("/api/entries/not-a-date/astro/auto"), false);
});

test("journal editor loads before app and mounts into the saved journal page", () => {
  assert.ok(html.indexOf("journal-ui.js") < html.indexOf("app.js"));
  assert.match(app, /JournalSyncUI\.mount\(day, api, loadAll\)/);
  assert.match(journal, /data-journal-text/);
  assert.match(journal, /\/journal\"/);
});

test("journal text is stored in the signed-in user's entries document", () => {
  assert.match(backend, /entry\.journal = journal/);
  assert.match(backend, /journal_updated_at = nowIso\(\)/);
  assert.match(backend, /12000/);
});

test("personal Astro tie-ins use the saved birth profile and date-specific chart data", () => {
  assert.match(backend, /ownBirth\(p\)/);
  assert.match(backend, /window\.TarotAstro\.run\(birth, d\)/);
  assert.match(backend, /saved\.cards/);
  assert.match(backend, /saved\.astro_generated_at/);
  assert.match(journal, /astro\/auto/);
});

test("mobile journal sections collapse long card and reflection content", () => {
  assert.match(journal, /Tap to review meanings/);
  assert.match(journal, /Reading context & reflection/);
  assert.match(css, /\.js-section/);
});

test("public and web journal assets stay byte-for-byte synchronized", () => {
  for (const pair of [["public/backend.js","web/backend.js"],["public/app.js","web/app.js"],["public/index.html","web/index.html"],["public/themes.css","web/themes.css"],["public/journal-ui.js","web/journal-ui.js"]]) {
    assert.equal(read(pair[0]), read(pair[1]), pair[0] + " differs from " + pair[1]);
  }
});
