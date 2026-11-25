const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("all mobile tabs fit the viewport; only Cards is a primary scroll area", () => {
  const css = read("public/themes.css");
  assert.match(css, /\.app\s*\{[^}]*height:\s*100dvh/s);
  const fit = css.slice(css.lastIndexOf("All-tab viewport fit"));
  assert.match(fit, /\.app > \.panel:not\(\[hidden\]\)\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(fit, /\.app > #panel-cards:not\(\[hidden\]\)\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(fit, /env\(safe-area-inset-bottom\)/);
});

test("card library groups the complete deck into collapsible arcana and suits", () => {
  const js = read("public/app.js");
  assert.match(js, /<details class="suit-group"/);
  assert.match(js, /<summary>\$\{esc\(group\)\}/);
  assert.match(js, /groupOrder/);
});

test("mobile tabs retain touch-sized controls and safe-area spacing", () => {
  const css = read("public/themes.css");
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});


test("mobile viewport contract has a stable fallback and keeps the bottom navigation inside the safe area", () => {
  const css = read("public/themes.css");
  const fit = css.slice(css.lastIndexOf("All-tab viewport fit"));
  assert.match(fit, /height:\s*100vh[\s\S]*height:\s*100dvh/);
  assert.match(fit, /position:\s*fixed[\s\S]*bottom:\s*0/);
  assert.match(fit, /env\(safe-area-inset-left\)/);
  assert.match(fit, /env\(safe-area-inset-right\)/);
  assert.match(fit, /touch-action:\s*pan-y/);
});


test("the service worker caches the active mobile layout stylesheet", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /const VERSION = "tarot-shell-v27"/);
  assert.match(sw, /\/themes\.css\?v=8/);
  assert.ok(sw.includes('"/themes.css?v=8"'));
  assert.ok(sw.includes("themes" + String.fromCharCode(92) + ".css"));
});


test("Fool's Journey navigation resets the app's internal learning scroller", () => {
  const learn = read("public/learn-ui.js");
  assert.match(learn, /id="lnJourney"/);
  assert.match(learn, /journeyButton\\.addEventListener\\("click"/);
  assert.match(learn, /function resetLearningScroll/);
  assert.match(learn, /resetLearningScroll\\(el\\)/);
  assert.doesNotMatch(learn, /window\\.scrollTo\\(\\{ top: 0 \\}\\)/);
});

test("Practice lesson content has its own touch-scrollable mobile viewport", () => {
  const css = read("public/app.css");
  assert.match(css, /#panel-practice:not\\(\\[hidden\\]\\)[\\s\\S]*#practiceRoot[\\s\\S]*overflow-y:\\s*auto/);
  assert.match(css, /-webkit-overflow-scrolling:\\s*touch/);
});
