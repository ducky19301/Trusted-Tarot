const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("only the Cards tab is vertically scrollable on mobile", () => {
  const css = read("public/themes.css");
  const mobileFix = css.slice(css.lastIndexOf("Final mobile viewport correction"));
  assert.match(mobileFix, /\.panel:not\(\[hidden\]\)[^{]*\{[^}]*overflow-y:\s*hidden/s);
  assert.match(mobileFix, /#panel-cards[^}]*overflow-y:\s*auto/s);
  assert.doesNotMatch(mobileFix, /#panel-today[^}]*overflow-y:\s*auto/s);
  assert.equal(read("public/themes.css"), read("web/themes.css"));
});

test("trusted login reports empty and malformed credentials accessibly", () => {
  const html = read("public/login.html");
  assert.match(html, /<form[^>]*novalidate/i);
  assert.match(html, /id="err"[^>]*role="alert"/);
  assert.match(html, /aria-describedby="err"/);
  assert.match(html, /Enter your username/i);
  assert.match(html, /Enter your password/i);
  assert.match(html, /aria-invalid/);
});
