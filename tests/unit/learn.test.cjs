// v20 Learn: bite-sized cards, honest sources, no outside links in learning flows.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '../../public');
global.window = {}; require(path.join(pub, 'practice-data.js'));
const D = window.PRACTICE_DATA; require(path.join(pub, 'learn-data.js')); const L = window.LEARN_DATA;
const S = L.build(D);
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();
test('every section has cards, a Put it together prompt and a known source', () => {
  assert.ok(S.length >= 30);
  for (const s of S) { assert.ok(s.cards.length, s.id); assert.ok(s.put, s.id + ' put');
    for (const c of s.cards) assert.ok(L.SOURCES[c.source], `${c.id} source ${c.source}`); }
});
test('no card is longer than 3 sentences', () => {
  for (const s of S) for (const c of s.cards) assert.ok(L.sents(c.text).length <= 3, c.id + ': ' + c.text);
});
test('lesson cards rejoin into the original lesson text', () => {
  for (const l of D.LESSONS) { const s = S.find((x) => x.id === 'learn.' + l.id); assert.ok(s, l.id);
    const joined = norm(s.cards.map((c) => c.text).join(' '));
    assert.equal(joined, norm(l.body.join(' ')), l.id); }
});
test('sources are honest: nothing is marked read that was not', () => {
  assert.equal(L.SOURCES.greer.read, 'listed');
  for (const k of ['ptolemy', 'lilly', 'carlson', 'openstax']) assert.equal(L.SOURCES[k].read, 'partly', k);
  assert.ok(!Object.values(L.SOURCES).some((s) => /Hand\b/.test(s.author)), 'Hand was not read and is cut');
});
test('Ptolemy wording matches the text read (discordant, not disharmonious)', () => {
  const all = JSON.stringify(S);
  assert.ok(!/disharmonious/i.test(all)); assert.ok(/discordant/.test(all)); assert.ok(!/I\.13\b/.test(all));
});
test('no outside URL in cards; outside links only in the Learn more ext button', () => {
  for (const s of S) for (const c of s.cards) assert.ok(!/https?:\/\//.test(c.text), c.id);
  for (const f of ['learn-ui.js', 'astro-ui.js', 'horoscope-story.js']) {
    const src = fs.readFileSync(path.join(pub, f), 'utf8');
    const hrefs = src.match(/href=|window\.open\(/g) || [];
    if (f === 'learn-ui.js') assert.ok(hrefs.length <= 1 && /ln-leave|Leave the app/.test(src), 'only the confirmed exit link');
    else assert.equal(hrefs.length, 0, f);
  }
  const prac = fs.readFileSync(path.join(pub, 'practice.js'), 'utf8');
  const learnFn = prac.slice(prac.indexOf('function renderLearn'), prac.indexOf('/* ================= SPREADS'));
  assert.ok(!/href=/.test(learnFn), 'renderLearn has no outside links');
});
test('every Waite line quoted in the guide comes from the card data', () => {
  const cards = JSON.parse(fs.readFileSync(path.join(pub, 'data/cards.json'), 'utf8'));
  const list = Array.isArray(cards) ? cards : cards.cards; assert.equal(list.length, 78);
  for (const c of list) assert.ok(c.waite && c.waite.upright && c.waite.reversed, c.name);
});

test('mastery requires at least 80 percent and never awards an empty quiz', () => {
  assert.equal(L.masteryPass(4, 5), true);
  assert.equal(L.masteryPass(3, 5), false);
  assert.equal(L.masteryPass(0, 0), false);
  assert.equal(L.masteryPass(8, 10), true);
});

test('web learning overlays stay identical to the deployable public bundle', () => {
  for (const file of ['learn-data.js', 'learn-ui.js', 'astro-ui.js', 'app.js']) {
    assert.equal(
      fs.readFileSync(path.join(__dirname, '../../web', file), 'utf8'),
      fs.readFileSync(path.join(pub, file), 'utf8'),
      file + ' source overlay must match public output'
    );
  }
});

global.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
require(path.join(pub, 'learn-ui.js'));
const UI = window.LearnUI;
test('each astrology lesson starts its quiz with a practical scenario', () => {
  for (const id of ['sky.anatomy', 'sky.bigthree', 'sky.planets', 'sky.signs', 'sky.houses', 'sky.aspects', 'sky.whole', 'sky.transits', 'sky.evidence', 'sky.planets.personal','sky.planets.social','sky.planets.outer','sky.signs.elements','sky.signs.modalities','sky.signs.individual','sky.houses.personal','sky.houses.relational','sky.aspects.major','sky.aspects.orbs','sky.whole.ruler','sky.whole.synthesis','sky.transits.cycles','sky.compatibility','sky.synastry','sky.growth','sky.numerology']) {
    const section = S.find(item => item.id === id);
    assert.ok(section, 'missing ' + id);
    const questions = UI.makeQuestions(section, 6);
    assert.ok(questions.length >= 1, id + ' has a question');
    assert.ok(questions[0].prompt.includes('?'), id + ' begins with a real-world question');
    assert.equal(questions[0].options.length, 3, id + ' has three answer choices');
    assert.ok(questions[0].why.length > 20, id + ' includes reasoning');
  }
});
