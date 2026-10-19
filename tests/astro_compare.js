// node tests/astro_compare.js : compares web/astro.js with tools/astro_engine.py (Swiss Ephemeris)
global.window = { Astronomy: require('/tmp/npmv/node_modules/astronomy-engine') };
const { execFileSync } = require('child_process');
require('../web/astro.js'); const T = window.TarotAstro;
const cases = [
  [{ y: 1997, m: 3, d: 7, hour: 22, minute: 36, tz: 'America/Denver', lat: 37.2753, lon: -107.8801 }, '2026-10-19'],
  [{ y: 1997, m: 3, d: 7, hour: 22, minute: 36, tz: 'America/Denver', lat: 37.2753, lon: -107.8801 }, '2027-03-01'],
  [{ y: 1996, m: 1, d: 25, hour: null, minute: null, tz: 'UTC', lat: 0, lon: 0 }, '2026-10-19'],
  [{ y: 1985, m: 7, d: 2, hour: 6, minute: 5, tz: 'Europe/London', lat: 51.5074, lon: -0.1278 }, '2026-12-25'],
  [{ y: 2000, m: 1, d: 1, hour: null, minute: null, tz: 'UTC', lat: 0, lon: 0 }, '2026-10-14'],
];
let worst = 0, bad = 0;
for (const [b, date] of cases) {
  const py = JSON.parse(execFileSync('/workspace/.tools-venv/bin/python', ['/workspace/tarot-app/tools/astro_engine.py'], { input: JSON.stringify({ birth: b, date, tz_now: 'America/Los_Angeles' }) }));
  const js = T.run(b, date);
  for (const k of Object.keys(py.natal)) {
    const d = Math.abs(((py.natal[k].lon - js.natal[k].lon + 540) % 360) - 180); worst = Math.max(worst, d);
    if (py.natal[k].sign !== js.natal[k].sign || py.natal[k].house !== js.natal[k].house) { bad++; console.log('natal diff', date, k, py.natal[k], js.natal[k]); }
  }
  for (const k of Object.keys(py.transits)) if (JSON.stringify(py.transits[k]) !== JSON.stringify(js.transits[k])) console.log('transit text diff', date, k, py.transits[k].pos, js.transits[k].pos, py.transits[k].house, js.transits[k].house);
  const pa = py.aspects.map((a) => a.transit + a.aspect + a.natal).join(','), ja = js.aspects.map((a) => a.transit + a.aspect + a.natal).join(',');
  if (pa !== ja) { console.log('aspects diff', date, '\n py', pa, '\n js', ja); }
  if (JSON.stringify(py.moon) !== JSON.stringify(js.moon)) console.log('moon', py.moon, js.moon);
  if (py.text.length !== js.text.length) { bad++; console.log('text len', py.text.length, js.text.length); }
}
console.log('worst natal longitude difference (deg):', worst.toFixed(4), 'hard mismatches:', bad);
process.exit(bad ? 1 : 0);
