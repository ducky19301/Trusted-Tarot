const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const app = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public/app.css"), "utf8");

test("Home deck controls expose shuffle, fan and cut", () => {
  for (const id of ["shuffleBtn", "fanBtn", "cutBtn", "drawBtn"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(app, /\$\("#fanBtn"\)\.addEventListener\("click"/);
  assert.match(app, /\$\("#cutBtn"\)\.addEventListener\("click"/);
});

test("Home fan selects unique cards in user-selected order and draws only the spread size", () => {
  assert.match(app, /S\.homeSelected\.indexOf\(id\)/);
  assert.match(app, /S\.homeSelected\.length<S\.count/);
  assert.match(app, /S\.homeSelected\.map\(id=>S\.deck\.find/);
  assert.match(app, /if\(picked\.length!==S\.count\)return/);
  assert.match(app, /const ids=new Set\(S\.homeSelected\.map\(String\)\)/);
});

test("Cut rotates the existing deck without adding or dropping cards", () => {
  assert.match(app, /S\.deck=\[\.\.\.S\.deck\.slice\(n\),\.\.\.S\.deck\.slice\(0,n\)\]/);
  assert.match(app, /id="homeCutRange"/);
  assert.match(app, /id="homeCutApply"/);
});

test("Shuffle uses the Home deck state and respects reduced-motion settings", () => {
  assert.match(app, /S\.deck = shuffle\(S\.cards\)/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /homeDeckModal\("shuffle"\)/);
});

test("Mobile layout fits the viewport while keeping content panels independently scrollable", () => {
  assert.match(css, /height:100dvh/);
  assert.match(css, /overflow-y:auto/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
