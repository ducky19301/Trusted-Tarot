const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const astro = fs.readFileSync(path.join(root, 'public/astro-ui.js'), 'utf8');

test('home screen exposes the dated past-reading import workflow', () => {
  for (const id of ['importReadingToggle','importReadingPanel','importReadingDate','importReadingFile','importReadingText','importReadingCards','importReadingSave']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /\.json,\.txt,\.md,\.csv,\.pdf,image\//);
});

test('past readings can be extracted or routed into the existing journal storage', () => {
  assert.match(app, /loadPdfText/);
  assert.match(app, /pdfjsLib\.getDocument/);
  assert.match(app, /api\("\/api\/entries"/);
  assert.match(app, /api\("\/api\/photos"/);
  assert.match(app, /parseCardLines/);
  assert.match(app, /await loadAll\(\)/);
});

test('Astro and journal screens connect to date-specific numerology and chart themes', () => {
  assert.match(app, /personMe\(day\.date\)/);
  assert.match(app, /numerology\(ME\.birth,null,day\.date\)/);
  assert.match(app, /Chart \+ numerology links/);
  assert.match(astro, /personalCycleHTML/);
  assert.match(astro, /chartGuideHTML/);
  assert.match(astro, /COMPAT_GUIDE/);
});

test('full Astro course loads before Astro navigation uses its learning UI', () => {
  const curriculum = html.indexOf('astro-curriculum.js');
  const learningUI = html.indexOf('astro-learning-ui.js');
  const astroUI = html.indexOf('astro-ui.js');
  assert.ok(curriculum >= 0 && learningUI > curriculum && astroUI > learningUI);
});
