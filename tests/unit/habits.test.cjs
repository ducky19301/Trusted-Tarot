// v21 habits: streaks with freezes and rest days, missed-day detection, awards list, share text has no link by default.
const test = require('node:test'), assert = require('node:assert'), path = require('path'), fs = require('fs');
const pub = path.join(__dirname, '../../public');
const mem = {};
global.localStorage = { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = String(v); } };
global.location = { hostname: '127.0.0.1', search: '', hash: '' };
global.document = { addEventListener() {}, querySelector: () => null };
global.window = { TarotApp: {} };
require(path.join(pub, 'habits.js'));
const X = window.Habits, T = X._t;
const base = (o) => Object.assign({ days: [], frozen: [], rest: [], resetOn: null }, o);
test('streak counts consecutive active days', () => {
  assert.equal(T.streakOf(base({ days: ['2026-10-31', '2026-11-01', '2026-11-02'] }), '2026-11-02'), 3);
  assert.equal(T.streakOf(base({ days: ['2026-10-31', '2026-11-01'] }), '2026-11-02'), 2, 'today not done yet keeps yesterday\'s streak');
  assert.equal(T.streakOf(base({ days: ['2026-10-30', '2026-11-01'] }), '2026-11-02'), 1, 'a gap breaks it');
});
test('a freeze or a rest day bridges a gap without adding a day', () => {
  assert.equal(T.streakOf(base({ days: ['2026-10-30', '2026-11-01'], frozen: ['2026-10-31'] }), '2026-11-02'), 2);
  assert.equal(T.streakOf(base({ days: ['2026-10-31', '2026-11-02'], rest: [0] }), '2026-11-02'), 2, 'Sunday Nov 1 is a rest day');
});
test('missed day offers a freeze only when there was a streak', () => {
  const m = T.missed(base({ days: ['2026-10-29', '2026-10-30', '2026-10-31'] }), '2026-11-02');
  assert.deepEqual(m, { date: '2026-11-01', before: 3 });
  assert.equal(T.missed(base({ days: [] }), '2026-11-02'), null);
  assert.equal(T.missed(base({ days: ['2026-10-31'], rest: [0] }), '2026-11-02'), null, 'rest days are never a miss');
});
test('two freezes per week, counted Monday to Sunday', () => {
  assert.equal(T.freezesLeft(base({ freezesPerWeek: 2, frozen: ['2026-11-02'] }), '2026-11-04'), 1);
  assert.equal(T.freezesLeft(base({ freezesPerWeek: 2, frozen: ['2026-11-01'] }), '2026-11-04'), 2, 'last week\'s freeze doesn\'t count');
});
test('awards include the shareable first-day New learner and the 3/7/30/100 day ladder', () => {
  const ids = X.AWARDS.map((a) => a.id);
  for (const k of ['new', 'd3', 'd7', 'd30', 'd100', 'q1', 'n1']) assert.ok(ids.includes(k), k);
  assert.deepEqual(X.AWARDS.filter((a) => a.share).map((a) => a.id), ['new']);
});
test('share text carries no link off the public host, or when the toggle is off', () => {
  assert.ok(!/https?:/.test(T.shareText({ shareLink: true })), 'non-public host never adds a link');
  global.location.hostname = 'tarot-public.ducky19301.workers.dev';
  assert.ok(!/https?:/.test(T.shareText({ shareLink: false })), 'default off');
  assert.ok(T.shareText({ shareLink: true }).includes('https://tarot-public.ducky19301.workers.dev/'));
  global.location.hostname = '127.0.0.1';
});
test('no guilt copy anywhere in habits', () => {
  const src = fs.readFileSync(path.join(pub, 'habits.js'), 'utf8').replace(/No "you're about to lose your streak" messages/, '');
  for (const p of [/about to lose/i, /don't break/i, /you failed/i, /hurry/i, /last chance/i, /streak is at risk/i]) assert.ok(!p.test(src), String(p));
});
test('glossary tab is wired in Practice', () => {
  const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8'), pr = fs.readFileSync(path.join(pub, 'practice.js'), 'utf8');
  assert.ok(html.includes('data-pv="glossary"')); assert.ok(pr.includes('glossary: renderGlossary'));
});
test('share text never uses a personal app title', () => {
  window.TAROT_CONFIG = { appName: 'Jordan’s Tarot' };
  assert.ok(!/Jordan/.test(T.shareText({ shareLink: false })));
  window.TAROT_CONFIG = { appName: 'Tarot Journey' };
  assert.ok(T.shareText({ shareLink: false }).includes('Tarot Journey'));
  delete window.TAROT_CONFIG;
});
