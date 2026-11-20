const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const backend = fs.readFileSync(path.join(root, "public/backend.js"), "utf8");
const app = fs.readFileSync(path.join(root, "public/app.js"), "utf8");

test("owner can delete a saved personal journal reading or one exact card", () => {
  assert.match(backend, /\/api\/entries\/\(\d\{4\}-\d\{2\}-\d\{2\}\)\/delete/);
  assert.match(backend, /\/api\/entries\/\(\d\{4\}-\d\{2\}-\d\{2\}\)\/cards\/delete/);
  assert.match(app, /data-delete-personal-reading/);
  assert.match(app, /data-delete-personal-card/);
  assert.match(app, /confirm\(/);
});

test("owner can delete a guest-profile reading or one exact guest card", () => {
  assert.match(backend, /\/api\/guests\/\(\[\\w-\]\+\)\/readings\/\(\[\\w-\]\+\)\/delete/);
  assert.match(backend, /\/api\/guests\/\(\[\\w-\]\+\)\/readings\/\(\[\\w-\]\+\)\/cards\/delete/);
  assert.match(app, /data-delete-guest-reading/);
  assert.match(app, /data-delete-guest-card/);
});

test("deleting a reading cleans related private photo references and pending queue records", () => {
  assert.match(backend, /storage\.from\("uploads"\)\.remove/);
  assert.match(backend, /kind === "guest_reading"/);
  assert.match(backend, /kind === "self_draw"/);
});
