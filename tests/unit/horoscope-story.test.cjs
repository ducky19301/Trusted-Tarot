// v20 horoscope story: every paragraph tied to a computed fact, plain wording, tips change daily.
const test = require('node:test'), assert = require('node:assert'), path = require('path');
const pub = path.join(__dirname, '../../public');
global.window = { Astronomy: require('astronomy-engine') }; require(path.join(pub, 'astro.js'));
const A = window.TarotAstro, H = (require(path.join(pub, 'horoscope-story.js')), window.HoroscopeStory);
const JORDAN = { y: 1992, m: 7, d: 14, hour: 15, minute: 20, tz: 'America/Los_Angeles', lat: 45.5152, lon: -122.6784 };
const day = (i) => { const d = new Date(Date.UTC(2026, 10, 1 + i)); return d.toISOString().slice(0, 10); };
test('Jordan sample is a real engine run (Sun 22°41′ Cancer, 9th house)', () => {
  const h = A.run(JORDAN, '2026-11-02'); assert.equal(h.natal.Sun.pos, '22°41′ Cancer'); assert.equal(h.natal.Sun.house, 9);
});
test('every middle paragraph points at a computed fact', () => {
  const h = A.run(JORDAN, '2026-11-02'), s = H.compose(h, { name: 'Jordan', user: 't1' });
  for (const p of s.paragraphs.slice(1, -1)) assert.ok(p.facts && p.facts.length, p.text);
});
test('no banned or stock phrases across 60 days', () => {
  let hist = [];
  for (let i = 0; i < 60; i++) { const s = H.compose(A.run(JORDAN, day(i)), { name: 'Jordan', user: 't2', history: hist });
    hist.push({ date: day(i), ...s.tipKeys });
    const txt = s.paragraphs.map((p) => p.text).concat(s.dos.map((t) => t.text), s.donts.map((t) => t.text)).join(' ');
    assert.deepEqual(H.bannedIn(txt), [], day(i)); assert.ok(!/undefined|\{\w+\}/.test(txt), txt); }
});
test("consecutive days' do and don't lists always differ, and no tip repeats within 14 days", () => {
  let hist = [];
  for (let i = 0; i < 60; i++) {
    const s = H.compose(A.run(JORDAN, day(i)), { user: 't3', history: hist });
    const prev = hist[hist.length - 1];
    if (prev) { assert.notDeepEqual(s.dos.map((t) => t.text), prev.dosText, day(i)); assert.notDeepEqual(s.donts.map((t) => t.text), prev.dontsText, day(i)); }
    const recent = new Set(hist.slice(-13).flatMap((x) => [...x.dos, ...x.donts]));
    for (const k of [...s.tipKeys.dos, ...s.tipKeys.donts]) assert.ok(!recent.has(k), `${k} repeated within 14 days on ${day(i)}`);
    hist.push({ date: day(i), ...s.tipKeys, dosText: s.dos.map((t) => t.text), dontsText: s.donts.map((t) => t.text) });
  }
});
