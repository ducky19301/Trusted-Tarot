// v23 cohesive reading: built only from app data, same person only, no narrator, ends with questions.
const test = require('node:test'), assert = require('node:assert'), path = require('path');
const pub = path.join(__dirname, '../../public');
global.window = {}; require(path.join(pub, 'practice-data.js')); require(path.join(pub, 'cohesive.js'));
const C = window.Cohesive, D = window.PRACTICE_DATA, cards = require(path.join(pub, 'data/cards.json'));
const kb = { cards, numbers: D.NUMBERS, courts: D.COURT_STAGES.filter((x) => x.rank) };
const spread = [{ name: 'Nine of Wands', orientation: 'upright', position: 'Situation', pm: 'what is really going on' }, { name: 'Three of Cups', orientation: 'reversed', position: 'Action' }, { name: 'The Star', orientation: 'upright', position: 'Outcome' }];
const me = [{ date: '2026-10-20', cards: [{ name: 'The Fool', orientation: 'upright' }] }, { date: '2026-10-28', cards: [{ name: 'Eight of Swords', orientation: 'reversed' }], notes: 'Intention: Study plan' },
  { date: '2026-10-29', cards: [] }, { date: '2026-10-30', cards: [{ name: 'Nine of Wands', orientation: 'reversed' }] }, { date: '2026-11-01', cards: [{ name: 'Ace of Wands', orientation: 'upright' }] }, { date: '2026-11-02', cards: [{ name: 'Ten of Cups', orientation: 'upright' }] }, { date: '2026-11-05', cards: [{ name: 'Death', orientation: 'upright' }] }];
const all = (r) => r.sections.flatMap((s) => [s.title, s.label, ...s.paras, ...(s.questions || [])]).join('\n');
test('past readings: last 4 with cards, before the date, newest first, untick works', () => {
  const p = C.pickPast(me, '2026-11-03');
  assert.deepEqual(p.offered.map((e) => e.date), ['2026-11-02', '2026-11-01', '2026-10-30', '2026-10-28']);
  assert.deepEqual(C.pickPast(me, '2026-11-03', { exclude: ['2026-11-01'] }).used.map((e) => e.date), ['2026-11-02', '2026-10-30', '2026-10-28']);
});
test('same person only: a guest reading never sees the owner readings', () => {
  const g = [{ id: 'g1', date: '2026-10-12', cards: [{ name: 'Death', orientation: 'upright' }] }];
  const r = C.build({ cards: spread, past: C.pickPast(g, '2026-11-03').used, person: { kind: 'guest', name: 'Jordan' } }, kb);
  assert.deepEqual(r.pastUsed, ['2026-10-12']); assert.ok(!/Eight of Swords|Ace of Wands/.test(all(r).split('Your past readings')[1]));
});
test('with intention: every card is held against it; repeats from past are tied in', () => {
  const r = C.build({ cards: spread, intent: { type: 'intention', text: 'Finish my course' }, past: C.pickPast(me, '2026-11-03').used, person: { kind: 'me' } }, kb);
  assert.equal(r.general, false); assert.equal((all(r).match(/Held against “Finish my course”/g) || []).length, 3);
  assert.ok(/Nine of Wands also came up on 2026-10-30/.test(all(r))); assert.ok(r.sections.find((s) => s.id === 'past').paras.length >= 2);
});
test('no intention: general reading', () => {
  const r = C.build({ cards: spread, intent: null, past: [] }, kb);
  assert.equal(r.general, true); assert.ok(/general reading/.test(all(r))); assert.ok(/first saved reading/.test(all(r)));
});
test('reversed card: reversal ways + Waite reversed line from cards.json', () => {
  const r = C.build({ cards: spread }, kb), t = all(r), c3 = cards.find((c) => c.name === 'Three of Cups');
  assert.ok(t.includes(c3.waite.reversed)); assert.ok(/blocked .* delayed .* overdone/.test(t));
});
test('no narrator, no Astro intro, no verdict words', () => {
  const t = all(C.build({ cards: spread, intent: { type: 'question', text: 'Will I pass?' } }, kb)) + C.build({ cards: spread }, kb).summary;
  assert.ok(!/Astro|I'm |I am |\bI'll\b/.test(t)); assert.ok(!/\b(destined|fated|will definitely|guaranteed)\b/i.test(t));
});
test('ends with several reflection questions tied to the cards', () => {
  const r = C.build({ cards: spread, intent: { type: 'intention', text: 'Finish my course' }, past: C.pickPast(me, '2026-11-03').used }, kb);
  const last = r.sections[r.sections.length - 1]; assert.equal(last.id, 'questions'); assert.ok(last.questions.length >= 5);
  for (const n of ['Nine of Wands', 'Three of Cups', 'The Star']) assert.ok(last.questions.some((q) => q.includes(n)), n);
  assert.ok(last.questions.every((q) => /\?/.test(q)));
});
test('only app data: every card sentence quoted comes from cards.json', () => {
  const r = C.build({ cards: spread }, kb), p = r.sections.find((s) => s.id === 'cards').paras[0], nw = cards.find((c) => c.name === 'Nine of Wands');
  assert.ok(p.includes(nw.upright.split('. ')[0])); assert.ok(r.sections.filter((s) => /connect|together/.test(s.id)).every((s) => /Our method/.test(s.label)));
});
test('old entries: intention read from the notes line; new field wins', () => {
  assert.deepEqual(C.intentOf({ notes: 'Intention: Rest more' }), { type: 'intention', text: 'Rest more' });
  assert.deepEqual(C.intentOf({ intent: { type: 'question', text: 'Q?' }, notes: 'Intention: x' }), { type: 'question', text: 'Q?' });
  assert.equal(C.intentOf({ notes: 'just a note' }), null);
});
