/* Trusted Tarot v17: horoscope engine, a JavaScript port of tools/astro_engine.py (Swiss Ephemeris)
   using astronomy-engine (MIT). Real positions only; text comes from the same fixed tables. Runs in the browser. */
(() => {
  "use strict";
  const A = window.Astronomy;
  const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  const ELEM = ['Fire','Earth','Air','Water','Fire','Earth','Air','Water','Fire','Earth','Air','Water'];
  const BODIES = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
  const PLANET = {Sun:'identity and vitality',Moon:'feelings and needs',Mercury:'thinking, messages and talks',
    Venus:'love, values and money',Mars:'drive, action and anger',Jupiter:'growth, luck and opportunity',
    Saturn:'structure, limits and commitment',Uranus:'sudden change and freedom',Neptune:'dreams, intuition and blur',
    Pluto:'deep change and power',ASC:'outward image',MC:'career and public direction'};
  const ASPECT = {0:['conjunct','merges with','so this theme is loud today'],60:['sextile','opens an easy door for',''],
    90:['square','rubs against','friction that asks for action'],120:['trine','flows easily with','support you can lean on'],
    180:['opposite','pulls against','asking for balance']};
  const ordn = (n) => n + ((n % 100 >= 10 && n % 100 <= 20) ? 'th' : ({1:'st',2:'nd',3:'rd'}[n % 10] || 'th'));
  const HOUSE = {1:'self and body',2:'money and self-worth',3:'messages, siblings and short trips',4:'home and family',5:'creativity, fun and romance',
    6:'work routines and health',7:'partners and one-to-one relationships',8:'shared money, intimacy and change',
    9:'learning, travel and beliefs',10:'career and reputation',11:'friends, networks and hopes',12:'rest, retreat and the unseen'};
  const MOON_SIGN = {Aries:'quick, brave moods',Taurus:'a wish for comfort and steadiness',Gemini:'a curious, chatty mood',
    Cancer:'tender feelings and a pull toward home',Leo:'a wish to be seen and to play',Virgo:'a tidy, practical mood',
    Libra:'a wish for harmony and company',Scorpio:'intense, private feelings',Sagittarius:'restless, hopeful moods',
    Capricorn:'a serious, get-it-done mood',Aquarius:'a detached, independent mood',Pisces:'a dreamy, sensitive mood'};
  const DO = {'Jupiter|soft':'Say yes to an opportunity or ask for something you want.','Venus|soft':'Reach out warmly; enjoy something beautiful.',
    'Mars|soft':'Put energy into one concrete task.','Mercury|soft':'Send the message or have the talk.',
    'Saturn|soft':'Do steady, disciplined work; it will hold.','Sun|soft':'Let yourself be visible.',
    'Uranus|soft':'Try one new approach.','Neptune|soft':'Make time for intuition, art or rest.','Pluto|soft':'Take back one bit of power quietly.'};
  const DONT = {'Jupiter|hard':'Don’t over-promise or overspend.','Venus|hard':'Don’t buy or commit just to soothe a feeling.',
    'Mars|hard':'Don’t pick fights or rush.','Mercury|hard':'Don’t send things in a hurry; re-read first.',
    'Saturn|hard':'Don’t read delays as failure.','Sun|hard':'Don’t push your will on others.',
    'Uranus|hard':'Don’t blow up a plan on a sudden urge.','Neptune|hard':'Don’t sign or decide when things feel foggy.',
    'Pluto|hard':'Don’t force control over people.'};
  const PHASES = [[0,'New Moon','plant an intention'],[45,'Waxing Crescent','take a first step'],[90,'First Quarter','push through a block'],
    [135,'Waxing Gibbous','refine and adjust'],[180,'Full Moon','see results and release'],[225,'Waning Gibbous','share and give thanks'],
    [270,'Last Quarter','let go of what isn’t working'],[315,'Waning Crescent','rest and reflect']];
  const NICE = {ASC:'Ascendant', MC:'Midheaven'};
  const R = Math.PI / 180, mod = (x, n = 360) => ((x % n) + n) % n;
  const fmt = (l) => { const s = Math.floor(l / 30), d = l % 30; return `${Math.floor(d)}°${String(Math.floor((d - Math.floor(d)) * 60)).padStart(2, '0')}′ ${SIGNS[s]}`; };
  const diff = (a, b) => mod(a - b + 180) - 180;
  const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100, r1 = (x) => Math.round(x * 10) / 10;

  // local wall time in an IANA zone -> UTC Date
  function zonedToUtc(y, m, d, hh, mm, tz) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const want = Date.UTC(y, m - 1, d, hh, mm);
    let t = want;
    for (let i = 0; i < 3; i++) {
      const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
      const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
      t += want - shown;
    }
    return new Date(t);
  }
  // apparent geocentric ecliptic longitude of date (true equinox), like Swiss Ephemeris defaults
  function lon(body, time) {
    if (body === 'Moon') return mod(A.EclipticGeoMoon(time).lon);
    const v = A.GeoVector(A.Body[body], time, true);
    return mod(A.SphereFromVector(A.RotateVector(A.Rotation_EQJ_ECT(time), v)).lon);
  }
  function calc(body, time) {   // -> [lon, speed deg/day]
    const l = lon(body, time), a = lon(body, time.AddDays(-0.05)), b = lon(body, time.AddDays(0.05));
    return [l, diff(b, a) / 0.1];
  }
  function obliquity(time) {
    const v = A.RotateVector(A.Rotation_EQD_ECT(time), new A.Vector(0, 0, 1, time));
    return Math.acos(Math.max(-1, Math.min(1, v.z))) / R;
  }
  // Placidus houses (semi-arc iteration); returns [cusps(12), asc, mc]
  function houses(time, lat, lng) {
    const eps = obliquity(time) * R, phi = lat * R;
    const ramc = mod(A.SiderealTime(time) * 15 + lng);
    const ra = ramc * R;
    const mc = mod(Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(eps)) / R);
    const asc = mod(Math.atan2(Math.cos(ra), -(Math.sin(ra) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) / R);
    const lamFromRa = (a) => mod(Math.atan2(Math.sin(a * R), Math.cos(a * R) * Math.cos(eps)) / R);
    function cusp(f, above) {
      let lam = above ? mod(mc + 90 * f) : mod(mc + 180 - 90 * f);
      for (let i = 0; i < 50; i++) {
        const dec = Math.asin(Math.sin(eps) * Math.sin(lam * R));
        const x = -Math.tan(phi) * Math.tan(dec);
        const sda = Math.acos(Math.max(-1, Math.min(1, x))) / R;
        const raC = above ? ramc + f * sda : ramc + 180 - f * (180 - sda);
        const nl = lamFromRa(mod(raC));
        if (Math.abs(diff(nl, lam)) < 1e-7) { lam = nl; break; }
        lam = nl;
      }
      return lam;
    }
    const c11 = cusp(1 / 3, true), c12 = cusp(2 / 3, true), c2 = cusp(2 / 3, false), c3 = cusp(1 / 3, false);
    const c = [asc, c2, c3, mod(mc + 180), mod(c11 + 180), mod(c12 + 180), mod(asc + 180), mod(c2 + 180), mod(c3 + 180), mc, c11, c12];
    return [c, asc, mc];
  }
  function house(l, c) {
    for (let i = 0; i < 12; i++) { const a = c[i], b = c[(i + 1) % 12]; if (mod(l - a) < mod(b - a)) return i + 1; }
    return 12;
  }

  function run(b, date, tzNow = 'America/Los_Angeles') {
    const hasTime = b.hour !== null && b.hour !== undefined && b.hour !== '';
    const hh = hasTime ? +b.hour : 12, mm = hasTime ? +(b.minute || 0) : 0;
    const tBirth = A.MakeTime(zonedToUtc(+b.y, +b.m, +b.d, hh, mm, b.tz || 'UTC'));
    const natal = {};
    for (const n of BODIES) natal[n] = lon(n, tBirth);
    let cusps = null;
    if (hasTime) { const [c, asc, mc] = houses(tBirth, +b.lat, +b.lon); cusps = c; natal.ASC = asc; natal.MC = mc; }
    const [y, m, d] = date.split('-').map(Number);
    const tNow = A.MakeTime(zonedToUtc(y, m, d, 8, 0, tzNow));
    const tr = {}; for (const n of BODIES) tr[n] = calc(n, tNow);
    const aspects = [];
    for (const tn of BODIES) {
      if (tn === 'Moon') continue;
      const x = tr[tn], orb = ['Sun','Mercury','Venus','Mars'].includes(tn) ? 2.0 : 1.5;
      for (const [nn, nl] of Object.entries(natal)) {
        if (nn === 'Moon' && !hasTime) continue;
        for (const a of [0, 60, 90, 120, 180]) {
          const o = Math.abs(Math.abs(diff(x[0], nl)) - a);
          if (o <= orb) {
            const x2 = lon(tn, tNow.AddDays(0.1));
            aspects.push({ transit: tn, aspect: ASPECT[a][0], angle: a, natal: nn, orb: r2(o), applying: Math.abs(Math.abs(diff(x2, nl)) - a) < o, retro: x[1] < 0 });
          }
        }
      }
    }
    aspects.sort((p, q) => p.orb - q.orb);
    const sun = tr.Sun[0], moon = tr.Moon[0], el = mod(moon - sun);
    const ph = el < 337.5 ? PHASES.filter((p) => el >= p[0] - 22.5).pop() : PHASES[0];
    const msign = SIGNS[Math.floor(moon / 30)];
    const lines = [], dos = [], donts = [];
    lines.push(`The Moon is in ${msign} (${ELEM[Math.floor(moon / 30)]}), bringing ${MOON_SIGN[msign]}. It is a ${ph[1]} (${Math.round(el)}° from the Sun): a time to ${ph[2]}.`);
    if (cusps) lines.push(`Today's Moon moves through your ${ordn(house(moon, cusps))} house, the area of ${HOUSE[house(moon, cusps)]}.`);
    for (const r of aspects.slice(0, 7)) {
      const verb = ASPECT[r.angle][1], tail = ASPECT[r.angle][2];
      const h = cusps ? ` Transiting ${r.transit} is in your ${ordn(house(tr[r.transit][0], cusps))} house (${HOUSE[house(tr[r.transit][0], cusps)]}).` : '';
      lines.push(`${r.transit}${r.retro ? ' (retrograde)' : ''} at ${fmt(tr[r.transit][0])} is ${r.aspect} your natal ${NICE[r.natal] || r.natal} (${fmt(natal[r.natal])}, orb ${r.orb}°, ${r.applying ? 'applying' : 'separating'}): ${r.transit}'s ${PLANET[r.transit]} ${verb} your ${PLANET[r.natal]}${tail ? ', ' + tail : ''}.${h}`);
      const kind = [60, 120].includes(r.angle) ? 'soft' : [90, 180].includes(r.angle) ? 'hard' : (['Jupiter','Venus','Sun'].includes(r.transit) ? 'soft' : 'hard');
      (kind === 'soft' ? dos : donts).push((kind === 'soft' ? DO : DONT)[r.transit + '|' + kind]);
    }
    if (!aspects.length) lines.push('No tight transits to your chart today; a quiet day to keep things simple.');
    const dedupe = (xs) => xs.filter((x, i) => x && !xs.slice(0, i).includes(x)).slice(0, 5);
    const natalOut = {}, trOut = {};
    for (const [n, l] of Object.entries(natal)) natalOut[n] = { lon: r3(l), pos: fmt(l), sign: SIGNS[Math.floor(l / 30)], ...(cusps && !['ASC','MC'].includes(n) ? { house: house(l, cusps) } : {}) };
    for (const [n, x] of Object.entries(tr)) trOut[n] = { pos: fmt(x[0]), retro: x[1] < 0, ...(cusps ? { house: house(x[0], cusps) } : {}) };
    return {
      date, has_time: hasTime, natal: natalOut,
      big_three: { Sun: SIGNS[Math.floor(natal.Sun / 30)], Moon: SIGNS[Math.floor(natal.Moon / 30)] + (hasTime ? '' : ' (approx., no birth time)'), Ascendant: hasTime ? SIGNS[Math.floor(natal.ASC / 30)] : null },
      transits: trOut, aspects, moon: { sign: msign, phase: ph[1], elongation: r1(el) },
      text: lines, dos: dedupe(dos), donts: dedupe(donts),
      note: hasTime ? null : 'Birth time unknown: houses and the Ascendant are skipped, and the natal Moon is approximate (noon chart).',
    };
  }
  const api = { run, zonedToUtc, houses, lon };
  if (typeof window !== 'undefined') window.TarotAstro = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
