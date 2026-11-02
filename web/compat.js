/* Tarot Journey — compatibility engine (shared module; no UI). Works in the browser (window.TarotCompat) and in Node.
   Needs astronomy-engine (window.Astronomy) and astro.js (window.TarotAstro) loaded first.
   Every number below is computed from the birth data: planet positions come from astronomy-engine (apparent geocentric
   ecliptic longitudes, true equinox of date — the same convention as Swiss Ephemeris defaults); numerology uses the
   Pythagorean letter table; tarot birth cards use Mary K. Greer's add-the-birth-date method; the Chinese zodiac year starts
   at the actual Lunar New Year (second new moon after the December solstice, China Standard Time). Each system is
   reported as its own section and never blended into a single score. For reflection and entertainment only. */
(function (root) {
  "use strict";
  const A = () => root.Astronomy, T = () => root.TarotAstro;
  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const ELEMENT = ["Fire","Earth","Air","Water"], MODALITY = ["Cardinal","Fixed","Mutable"];
  const mod = (x) => ((x % 360) + 360) % 360, diff = (a, b) => ((a - b + 540) % 360) - 180;
  const sep = (a, b) => Math.abs(diff(a, b));
  const signOf = (l) => SIGNS[Math.floor(mod(l) / 30)], elemOf = (l) => ELEMENT[Math.floor(mod(l) / 30) % 4], modOf = (l) => MODALITY[Math.floor(mod(l) / 30) % 3];
  const fmt = (l) => { const x = mod(l), d = Math.floor(x % 30), m = Math.floor(((x % 30) - d) * 60); return `${d}°${String(m).padStart(2, "0")}′ ${signOf(x)}`; };
  const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
  const DISCLAIMER = "For reflection and entertainment only. Compatibility systems describe themes to talk about; they don’t predict whether a relationship will succeed. A large study of about 66,000 Swedish marriages found no link between sun-sign “compatibility” and marriage or divorce (Helgertz & Scott, 2020).";

  // ---------------- resources (each URL checked to load before it was added; see README) ----------------
  const R = {
    synastryWiki: { title: "Astrological compatibility (synastry) — Wikipedia", url: "https://en.wikipedia.org/wiki/Synastry", what: "Overview of synastry in Western, Vedic and Chinese traditions, with a reading list." },
    synastryCafe: { title: "Synastry — Cafe Astrology", url: "https://www.cafeastrology.com/synastry.html", what: "Astrologer-written guide to aspects between two charts in relationships." },
    aspectsWiki: { title: "Astrological aspect — Wikipedia", url: "https://en.wikipedia.org/wiki/Astrological_aspect", what: "Definitions of conjunction, sextile, square, trine and opposition, and orbs." },
    aspectsCafe: { title: "The meaning of the aspects — Cafe Astrology", url: "https://cafeastrology.com/articles/aspectsinastrology.html", what: "Traditional interpretations of each aspect type." },
    compositeCafe: { title: "Composite chart — Cafe Astrology", url: "https://cafeastrology.com/compositechart.html", what: "How a midpoint composite chart is built and read." },
    housesWiki: { title: "House (astrology) — Wikipedia", url: "https://en.wikipedia.org/wiki/House_(astrology)", what: "What the twelve houses represent and how house systems differ." },
    triplicityWiki: { title: "Triplicity (elements) — Wikipedia", url: "https://en.wikipedia.org/wiki/Triplicity", what: "The fire/earth/air/water groupings of the signs." },
    signWiki: { title: "Astrological sign — Wikipedia", url: "https://en.wikipedia.org/wiki/Astrological_sign", what: "Signs, elements and modalities (cardinal, fixed, mutable)." },
    nodeWiki: { title: "Lunar node — Wikipedia", url: "https://en.wikipedia.org/wiki/Lunar_node", what: "The astronomy behind the North Node (where the Moon’s orbit crosses the ecliptic)." },
    astroEngine: { title: "Astronomy Engine (source code) — GitHub", url: "https://github.com/cosinekitty/astronomy", what: "The open-source library this app uses for planet positions." },
    swisseph: { title: "Swiss Ephemeris — Astrodienst", url: "https://www.astro.com/swisseph/swephinfo_e.htm", what: "The reference ephemeris used by most astrology software; our tests compare against its values." },
    numerologyWiki: { title: "Numerology — Wikipedia", url: "https://en.wikipedia.org/wiki/Numerology", what: "History of numerology, including the Pythagorean letter system, and its scientific status." },
    numerologyCafe: { title: "Numerology — Cafe Astrology", url: "https://www.cafeastrology.com/numerology.html", what: "Life Path, Expression and Soul Urge numbers and their traditional meanings." },
    greerTag: { title: "Birth Cards — Mary K. Greer’s Tarot Blog", url: "https://marykgreer.com/tag/birth-cards/", what: "Posts by the author of the birth-card method used here." },
    greerEmperor: { title: "Emperor/Death/Fool Birth Cards — Mary K. Greer", url: "https://marykgreer.com/2021/01/05/emperor-death-fool-birth-cards-and-daechwita/", what: "Greer explains adding the birth date and the card “constellations”." },
    greerBook: { title: "Who Are You in the Tarot? — Mary K. Greer", url: "https://marykgreer.com/2011/08/17/who-are-you-in-the-tarot/", what: "Greer’s book on birth, year and soul cards and relationship dynamics." },
    majorWiki: { title: "Major Arcana — Wikipedia", url: "https://en.wikipedia.org/wiki/Major_Arcana", what: "The 22 trump cards and their traditional order." },
    chineseWiki: { title: "Chinese zodiac — Wikipedia (Compatibility section)", url: "https://en.wikipedia.org/wiki/Chinese_zodiac", what: "The twelve animals, the trines (San He), six harmonies (Liu He), clashes (Liu Chong) and harms (Liu Hai)." },
    wuxingWiki: { title: "Wuxing (Five Phases) — Wikipedia", url: "https://en.wikipedia.org/wiki/Wuxing_(Chinese_philosophy)", what: "The generating and overcoming cycles of Wood, Fire, Earth, Metal and Water." },
    sexagenaryWiki: { title: "Sexagenary cycle — Wikipedia", url: "https://en.wikipedia.org/wiki/Sexagenary_cycle", what: "How heavenly stems (elements) and earthly branches (animals) combine by year." },
    cnyWiki: { title: "Chinese New Year — Wikipedia", url: "https://en.wikipedia.org/wiki/Chinese_New_Year", what: "Why the new year falls between 21 January and 20 February." },
    hko: { title: "Gregorian–Lunar Calendar Conversion Table — Hong Kong Observatory", url: "https://www.hko.gov.hk/en/gts/time/conversion.htm", what: "Official lunar calendar tables used to check our Lunar New Year dates." },
    helgertz: { title: "Helgertz & Scott (2020), The validity of astrological predictions on marriage and divorce — Genus", url: "https://genus.springeropen.com/articles/10.1186/s41118-020-00103-5", what: "Open-access study of ~66,000 Swedish marriages: no consistent link between sun-sign compatibility and marriage or divorce." },
    carlson: { title: "Carlson (1985), A double-blind test of astrology — Nature", url: "https://www.nature.com/articles/318419a0", what: "Classic double-blind test of whether natal charts describe personality." },
    sciWiki: { title: "Astrology and science — Wikipedia", url: "https://en.wikipedia.org/wiki/Astrology_and_science", what: "Summary of scientific tests of astrology." },
  };
  const RESEARCH = [R.helgertz, R.carlson, R.sciWiki];

  // ---------------- charts ----------------
  function meanNode(date) {   // Meeus, Astronomical Algorithms ch. 47 (mean ascending node)
    const t = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
    return mod(125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + t * t * t / 467441 - t * t * t * t / 60616000);
  }
  const BODIES = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
  function chart(p) {
    if (!p || !p.y || !p.m || !p.d) throw new Error("A birth date is needed.");
    const tz = p.tz || "UTC", hasTime = p.hour !== null && p.hour !== undefined && p.hour !== "";
    const hasPlace = p.lat !== null && p.lat !== undefined && p.lat !== "" && p.lon !== null && p.lon !== undefined && p.lon !== "";
    const at = (hh, mm) => T().zonedToUtc(+p.y, +p.m, +p.d, hh, mm, tz);
    const date = hasTime ? at(+p.hour, +(p.minute || 0)) : at(12, 0);
    const time = A().MakeTime(date), pos = {};
    for (const b of BODIES) pos[b] = T().lon(b, time);
    pos.Node = meanNode(date);
    const out = { name: p.name || "", hasTime, hasPlace, exact: hasTime && hasPlace, pos, date: date.toISOString(), moonRange: null };
    if (!hasTime) {   // the Moon moves ~12–15°/day: report the range across the birth date
      const lo = T().lon("Moon", A().MakeTime(at(0, 0))), hi = T().lon("Moon", A().MakeTime(at(23, 59)));
      out.moonRange = { from: lo, to: hi, signs: [...new Set([signOf(lo), signOf(hi)])] };
    }
    if (out.exact) { const [cusps, asc, mc] = T().houses(time, +p.lat, +p.lon); out.cusps = cusps; pos.ASC = asc; pos.MC = mc; }
    return out;
  }
  function houseOf(l, c) { for (let i = 0; i < 12; i++) { const a = c[i], b = c[(i + 1) % 12]; if (mod(l - a) < mod(b - a)) return i + 1; } return 12; }

  // ---------------- synastry ----------------
  // Orbs (stated, conventional moderate orbs): 8° for conjunction/opposition/trine/square when the Sun or Moon is involved,
  // 6° otherwise; sextile 5° with a light, 4° otherwise. Ascendant contacts use 5° (4° sextile).
  const ASPECTS = [
    { name: "conjunction", angle: 0, tone: "blend" }, { name: "sextile", angle: 60, tone: "easy" }, { name: "square", angle: 90, tone: "hard" },
    { name: "trine", angle: 120, tone: "easy" }, { name: "opposition", angle: 180, tone: "hard" }];
  function maxOrb(asp, p, q) {
    const light = [p, q].some((x) => x === "Sun" || x === "Moon"), angle = [p, q].some((x) => x === "ASC");
    if (angle) return asp.angle === 60 ? 4 : 5;
    if (asp.angle === 60) return light ? 5 : 4;
    return light ? 8 : 6;
  }
  function aspectBetween(l1, l2, p, q) {
    const s = sep(l1, l2);
    for (const a of ASPECTS) { const orb = Math.abs(s - a.angle), mx = maxOrb(a, p, q); if (orb <= mx) return { ...a, orb: r2(orb), max: mx, tight: r2(1 - orb / mx) }; }
    return null;
  }
  const PLANET = {
    Sun: "core identity and vitality", Moon: "emotional needs and sense of safety", Mercury: "thinking and communication style",
    Venus: "affection, taste and what feels loving", Mars: "drive, desire and how anger moves", Saturn: "commitment, limits and responsibility",
    Node: "direction of growth (North Node)", ASC: "outward style and first impressions (Ascendant)", Jupiter: "generosity and optimism",
  };
  const TONE = {
    conjunction: "merge and amplify each other — this contact is strong and colours everything, for better or worse",
    sextile: "cooperate easily when both make a little effort", trine: "flow naturally and feel familiar",
    square: "rub against each other, creating friction that can push growth", opposition: "pull in opposite directions, like a see-saw that needs balancing",
  };
  const SPECIAL = {
    "Sun-Moon": "One of the classic signatures astrologers look for: one person’s core self meets the other’s emotional needs.",
    "Venus-Mars": "The traditional ‘attraction’ pairing: affection meets desire.",
    "Moon-Moon": "How your emotional rhythms and comfort needs line up day to day.",
    "Sun-Sun": "How your basic identities and life energy sit together.",
    "Mercury-Mercury": "How easily you understand each other’s way of thinking and talking.",
  };
  const LBL = (p) => (p === "Node" ? "North Node" : p === "ASC" ? "Ascendant" : p);
  const PERSONAL = ["Sun","Moon","Mercury","Venus","Mars"];
  function synastry(ca, cb, na, nb) {
    const rows = [], seen = new Set();
    const listA = [...PERSONAL, "Saturn", "Node", ...(ca.exact ? ["ASC"] : [])], listB = [...PERSONAL, "Saturn", "Node", ...(cb.exact ? ["ASC"] : [])];
    for (const p of listA) for (const q of listB) {
      const outerA = ["Saturn","Node","ASC"].includes(p), outerB = ["Saturn","Node","ASC"].includes(q);
      if (outerA && outerB) continue;                       // only contacts that touch a personal planet
      const a = aspectBetween(ca.pos[p], cb.pos[q], p, q); if (!a) continue;
      const key = [p, q].join("|"); if (seen.has(key)) continue; seen.add(key);
      const approx = (p === "Moon" && !ca.hasTime) || (q === "Moon" && !cb.hasTime);
      const pair = [p, q].sort().join("-"), sp = SPECIAL[`${p}-${q}`] || SPECIAL[`${q}-${p}`] || "";
      rows.push({ a: p, b: q, aspect: a.name, tone: a.tone, orb: a.orb, maxOrb: a.max, tightness: a.tight, approximate: approx, pair,
        aPos: fmt(ca.pos[p]), bPos: fmt(cb.pos[q]),
        text: `${na}’s ${LBL(p)} (${fmt(ca.pos[p])}) ${a.name} ${nb}’s ${LBL(q)} (${fmt(cb.pos[q])}), orb ${a.orb}°. ${na}’s ${PLANET[p]} and ${nb}’s ${PLANET[q]} ${TONE[a.name]}.${sp ? " " + sp : ""}${approx ? " (Approximate: a birth time is missing, so the Moon could be several degrees off.)" : ""}` });
    }
    rows.sort((x, y) => y.tightness - x.tightness);
    // Defined tallies (no percentages): each aspect contributes its tightness = 1 − orb/maxOrb (0–1).
    const sum = (f) => r1(rows.filter(f).reduce((s, r) => s + r.tightness, 0));
    const tally = { flowing: sum((r) => r.tone === "easy"), challenging: sum((r) => r.tone === "hard"), blending: sum((r) => r.tone === "blend"),
      definition: "Each contact adds its tightness (1 − orb ÷ allowed orb, from 0 to 1). Flowing = trines + sextiles, Challenging = squares + oppositions, Blending = conjunctions. These are descriptive totals, not a success score." };
    return { rows, tally };
  }

  // ---------------- element & modality balance ----------------
  // Weights (stated): Sun, Moon and Ascendant count 2; Mercury, Venus, Mars, Jupiter, Saturn count 1; Uranus, Neptune, Pluto
  // are left out because they stay in a sign for years and describe a generation more than a person.
  const W = { Sun: 2, Moon: 2, ASC: 2, Mercury: 1, Venus: 1, Mars: 1, Jupiter: 1, Saturn: 1 };
  function balance(c) {
    const e = { Fire: 0, Earth: 0, Air: 0, Water: 0 }, m = { Cardinal: 0, Fixed: 0, Mutable: 0 };
    for (const [b, w] of Object.entries(W)) { if (c.pos[b] === undefined) continue; e[elemOf(c.pos[b])] += w; m[modOf(c.pos[b])] += w; }
    return { elements: e, modalities: m };
  }
  const ELEM_TEXT = { Fire: "enthusiasm, spontaneity, courage", Earth: "practicality, patience, follow-through", Air: "ideas, conversation, perspective", Water: "feeling, intuition, closeness" };
  const MOD_TEXT = { Cardinal: "starting things", Fixed: "sustaining things", Mutable: "adapting" };

  // ---------------- sign-to-sign relationship (whole-sign aspect) ----------------
  const SIGN_REL = ["the same sign (shared instincts; can also mean shared blind spots)", "neighbouring signs (different approaches, little natural common ground)",
    "a sextile apart (compatible elements: fire–air or earth–water; easy friendliness)", "a square apart (same modality, clashing elements: lively tension)",
    "a trine apart (the same element: natural ease)", "a quincunx apart (little in common; needs conscious adjustment)", "opposite signs (same modality, complementary elements: attraction and balancing)"];
  const signRel = (l1, l2) => { let d = Math.abs(Math.floor(mod(l1) / 30) - Math.floor(mod(l2) / 30)); if (d > 6) d = 12 - d; return { steps: d, text: SIGN_REL[d] }; };

  // ---------------- numerology (Pythagorean) ----------------
  const MASTER = new Set([11, 22, 33]);
  const digits = (n) => String(Math.abs(n)).split("").reduce((s, d) => s + +d, 0);
  function reduce(n, keepMaster = true) { while (n > 9 && !(keepMaster && MASTER.has(n))) n = digits(n); return n; }
  const letterValue = (ch) => { const c = ch.toUpperCase().charCodeAt(0) - 64; return c >= 1 && c <= 26 ? ((c - 1) % 9) + 1 : 0; };
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z]/g, "");
  function lifePath(y, m, d) { return reduce(reduce(m) + reduce(d) + reduce(y)); }   // reduce month, day, year separately, then the sum
  function expression(name) { const s = norm(name); if (!s) return null; return reduce([...s].reduce((t, c) => t + letterValue(c), 0)); }
  function soulUrge(name) { const s = norm(name).replace(/[^AEIOUaeiou]/g, ""); if (!s) return null; return reduce([...s].reduce((t, c) => t + letterValue(c), 0)); }   // Y treated as a consonant
  function personalYear(m, d, year) { return reduce(reduce(m) + reduce(d) + reduce(year), false); }
  const NUM = {
    1: "independence, initiative, leadership", 2: "partnership, diplomacy, sensitivity", 3: "expression, creativity, sociability", 4: "structure, reliability, hard work",
    5: "freedom, change, adventure", 6: "care, responsibility, home and family", 7: "reflection, analysis, inner life", 8: "ambition, power, material mastery",
    9: "compassion, idealism, completion", 11: "intuition and inspiration (a master number — a heightened 2)", 22: "the master builder (a master number — a heightened 4)", 33: "the master teacher (a master number — a heightened 6)",
  };
  const PY = { 1: "a fresh start", 2: "patience and partnership", 3: "creativity and socialising", 4: "building foundations", 5: "change and movement", 6: "home, family and responsibility", 7: "rest and reflection", 8: "achievement and finances", 9: "endings and letting go" };

  // ---------------- tarot birth cards (Mary K. Greer) ----------------
  const MAJORS = ["The Fool","The Magician","The High Priestess","The Empress","The Emperor","The Hierophant","The Lovers","The Chariot","Strength","The Hermit","Wheel of Fortune","Justice","The Hanged Man","Death","Temperance","The Devil","The Tower","The Star","The Moon","The Sun","Judgement","The World"];
  const MAJOR_TEXT = { 1: "willpower and skill", 2: "intuition and inner knowing", 3: "nurturing and creativity", 4: "structure and authority", 5: "tradition and teaching", 6: "choice and union", 7: "drive and direction", 8: "inner strength and compassion", 9: "solitude and wisdom", 10: "cycles and turning points", 11: "fairness and truth", 12: "surrender and new perspective", 13: "endings and renewal", 14: "balance and moderation", 15: "attachment and shadow", 16: "sudden change and revelation", 17: "hope and healing", 18: "dreams and the unknown", 19: "joy and vitality", 20: "awakening and calling", 21: "completion and wholeness", 22: "beginnings and trust (The Fool)" };
  function birthCards(y, m, d) {
    let n = y + m + d, steps = [n];
    while (n > 22) { n = digits(n); steps.push(n); }
    const cards = [n]; let k = n; while (k > 9) { k = digits(k); cards.push(k); }
    const constellation = cards[cards.length - 1];
    return { sum: y + m + d, steps, numbers: cards, constellation, cards: cards.map((x) => (x === 22 ? MAJORS[0] : MAJORS[x])) };
  }

  // ---------------- Chinese zodiac ----------------
  const ANIMALS = ["Rat","Ox","Tiger","Rabbit","Dragon","Snake","Horse","Goat","Monkey","Rooster","Dog","Pig"];
  const STEM_EL = ["Wood","Wood","Fire","Fire","Earth","Earth","Metal","Metal","Water","Water"];
  const _cny = {};
  // Chinese calendar rule (as used by the Purple Mountain Observatory / HKO): month 11 contains the December solstice;
  // (Checked against the lunardate tables for 1901–2098: all match except 1916, when China kept Beijing local time, UTC+7:46.)
  // months start on the China-Standard-Time date of the new moon; in a 13-month span the first month with no
  // principal solar term (zhongqi, Sun at a multiple of 30°) is the leap month. New Year starts month 1.
  const cstDay = (t) => new Date(t.date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  function month11(y) {
    const sol = A().Seasons(y).dec_solstice, sd = cstDay(sol);
    let nm = A().SearchMoonPhase(0, sol.AddDays(-32), 40);
    for (;;) { const nx = A().SearchMoonPhase(0, nm.AddDays(1), 40); if (cstDay(nx) > sd) return nm; nm = nx; }
  }
  function lunarNewYear(year) {   // -> "YYYY-MM-DD" in China Standard Time (UTC+8)
    if (_cny[year]) return _cny[year];
    const start = month11(year - 1), end = cstDay(month11(year));
    const nms = [start];
    while (cstDay(nms[nms.length - 1]) < end) nms.push(A().SearchMoonPhase(0, nms[nms.length - 1].AddDays(1), 40));
    let leap = -1;
    if (nms.length - 1 === 13) {
      for (let i = 0; i < 13 && leap < 0; i++) {
        const a = cstDay(nms[i]), b = cstDay(nms[i + 1]);
        let has = false;
        for (let k = 0; k < 12 && !has; k++) { const t = A().SearchSunLongitude(k * 30, nms[i].AddDays(-2), 35); if (t) { const d = cstDay(t); if (d >= a && d < b) has = true; } }
        if (!has) leap = i;
      }
    }
    const idx = leap === 1 || leap === 2 ? 3 : 2;
    return (_cny[year] = cstDay(nms[idx]));
  }
  function chineseSign(y, m, d) {
    const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, ny = lunarNewYear(y);
    const cy = iso < ny ? y - 1 : y, branch = mod(cy - 4) % 12, stem = (((cy - 4) % 10) + 10) % 10;
    return { year: cy, animal: ANIMALS[branch], branch, element: STEM_EL[stem], polarity: stem % 2 ? "Yin" : "Yang", newYear: lunarNewYear(cy), onBoundary: iso === ny };
  }
  const TRINES = [["Rat","Dragon","Monkey"],["Ox","Snake","Rooster"],["Tiger","Horse","Dog"],["Rabbit","Goat","Pig"]];
  const HARMONY = [["Rat","Ox"],["Tiger","Pig"],["Rabbit","Dog"],["Dragon","Rooster"],["Snake","Monkey"],["Horse","Goat"]];
  const HARM = [["Rat","Goat"],["Ox","Horse"],["Tiger","Snake"],["Rabbit","Dragon"],["Monkey","Pig"],["Rooster","Dog"]];
  const GEN = { Wood: "Fire", Fire: "Earth", Earth: "Metal", Metal: "Water", Water: "Wood" }, CTRL = { Wood: "Earth", Earth: "Water", Water: "Fire", Fire: "Metal", Metal: "Wood" };
  const has = (list, a, b) => list.some((g) => g.includes(a) && g.includes(b) && a !== b);
  function chineseRelation(a, b) {
    const out = [];
    if (a.animal === b.animal) out.push({ kind: "same", text: `Both ${a.animal}s: you recognise each other’s instincts, and may share the same blind spots.` });
    if (has(TRINES, a.animal, b.animal)) out.push({ kind: "trine (San He)", text: `${a.animal} and ${b.animal} belong to the same trine (San He), traditionally the most compatible grouping.` });
    if (has(HARMONY, a.animal, b.animal)) out.push({ kind: "six harmonies (Liu He)", text: `${a.animal} and ${b.animal} are a Six Harmonies (Liu He) pair, traditionally a supportive match.` });
    if (Math.abs(a.branch - b.branch) === 6) out.push({ kind: "clash (Liu Chong)", text: `${a.animal} and ${b.animal} sit opposite each other (Liu Chong, a clash): strong contrasts that need patience.` });
    if (has(HARM, a.animal, b.animal)) out.push({ kind: "harm (Liu Hai)", text: `${a.animal} and ${b.animal} are a Six Harms (Liu Hai) pair, traditionally prone to misunderstandings.` });
    if (!out.length) out.push({ kind: "neutral", text: `${a.animal} and ${b.animal} have no special traditional pairing — an ‘average’, workable match where personalities matter most.` });
    let el;
    if (a.element === b.element) el = `Both ${a.element}: same element, mutual understanding.`;
    else if (GEN[a.element] === b.element) el = `${a.element} generates ${b.element} in the Five Phases cycle: the first tends to nourish the second.`;
    else if (GEN[b.element] === a.element) el = `${b.element} generates ${a.element} in the Five Phases cycle: the second tends to nourish the first.`;
    else if (CTRL[a.element] === b.element) el = `${a.element} overcomes ${b.element} in the Five Phases cycle: watch for one person dominating.`;
    else el = `${b.element} overcomes ${a.element} in the Five Phases cycle: watch for one person dominating.`;
    return { relations: out, element: el };
  }

  // ---------------- assemble the report ----------------
  function person(p, label) {
    const name = (p.name || label).trim() || label;
    return { ...p, label: name, y: +p.y, m: +p.m, d: +p.d };
  }
  function compute(pa, pb, opts = {}) {
    const a = person(pa, "Person A"), b = person(pb, "Person B"), na = a.label, nb = b.label;
    const today = opts.today ? new Date(opts.today) : new Date(), thisYear = today.getFullYear();
    const ca = chart(a), cb = chart(b), sections = [];
    const timeNote = (c, n) => (!c.hasTime ? `${n}’s birth time is unknown, so ${n}’s Ascendant and houses are skipped and ${n}’s Moon is approximate (somewhere between ${fmt(c.moonRange.from)} and ${fmt(c.moonRange.to)} on that date${c.moonRange.signs.length > 1 ? " — it changed sign that day, so the Moon sign itself is uncertain" : ""}).` : !c.hasPlace ? `${n}’s birthplace is missing, so ${n}’s Ascendant and houses are skipped.` : null);
    const notes = [timeNote(ca, na), timeNote(cb, nb)].filter(Boolean);

    // 1. Synastry
    const syn = synastry(ca, cb, na, nb), easy = syn.rows.filter((r) => r.tone === "easy"), hard = syn.rows.filter((r) => r.tone === "hard"), blend = syn.rows.filter((r) => r.tone === "blend");
    sections.push({ id: "synastry", system: "Western astrology", title: "Synastry: how your planets meet",
      summary: `${syn.rows.length} contacts between ${na}’s and ${nb}’s personal planets (plus Saturn, North Node${ca.exact && cb.exact ? " and Ascendants" : ""}). Tightest first.`,
      details: syn.rows.map((r) => r.text), data: syn,
      strengths: easy.slice(0, 4).map((r) => `${LBL(r.a)}–${LBL(r.b)} ${r.aspect}: ${PLANET[r.a]} and ${PLANET[r.b]} flow naturally.`),
      friction: hard.slice(0, 4).map((r) => `${LBL(r.a)}–${LBL(r.b)} ${r.aspect}: ${PLANET[r.a]} and ${PLANET[r.b]} can rub.`),
      advice: [hard.length ? "Name the friction points out loud; squares and oppositions tend to soften when both people expect them." : "With few hard contacts, make sure ease doesn’t turn into taking each other for granted.",
        blend.length ? "Conjunctions are intense: notice when one person’s style swallows the other’s." : "Without conjunctions, build shared rituals that create a sense of ‘us’."],
      method: `Planet positions from astronomy-engine. Orbs: 8° for conjunction/opposition/trine/square involving the Sun or Moon, 6° otherwise; sextiles 5° with a light, 4° otherwise; Ascendant 5° (sextile 4°). ${syn.tally.definition} Totals here: flowing ${syn.tally.flowing}, challenging ${syn.tally.challenging}, blending ${syn.tally.blending}.`,
      notes, resources: [R.synastryWiki, R.synastryCafe, R.aspectsWiki, R.aspectsCafe, R.astroEngine, R.swisseph] });

    // 2. Element & modality balance
    const ba = balance(ca), bb = balance(cb), combined = {}, cmod = {};
    for (const e of ELEMENT) combined[e] = ba.elements[e] + bb.elements[e];
    for (const m of MODALITY) cmod[m] = ba.modalities[m] + bb.modalities[m];
    const top = (o) => Object.entries(o).sort((x, y) => y[1] - x[1]), lowE = top(combined).filter(([, v]) => v <= 2).map(([k]) => k);
    const topA = top(ba.elements)[0][0], topB = top(bb.elements)[0][0];
    sections.push({ id: "balance", system: "Western astrology", title: "Element & modality balance",
      summary: `${na} leans ${topA} (${ELEM_TEXT[topA]}); ${nb} leans ${topB} (${ELEM_TEXT[topB]}). Together you are strongest in ${top(combined)[0][0]} and ${top(cmod)[0][0].toLowerCase()} energy (${MOD_TEXT[top(cmod)[0][0]]}).`,
      details: [`${na}: ${Object.entries(ba.elements).map(([k, v]) => `${k} ${v}`).join(", ")} · ${Object.entries(ba.modalities).map(([k, v]) => `${k} ${v}`).join(", ")}`,
        `${nb}: ${Object.entries(bb.elements).map(([k, v]) => `${k} ${v}`).join(", ")} · ${Object.entries(bb.modalities).map(([k, v]) => `${k} ${v}`).join(", ")}`,
        `Together: ${Object.entries(combined).map(([k, v]) => `${k} ${v}`).join(", ")} · ${Object.entries(cmod).map(([k, v]) => `${k} ${v}`).join(", ")}`],
      data: { a: ba, b: bb, combined, modalities: cmod },
      strengths: [topA === topB ? `You share an ${topA} emphasis, so you ‘get’ each other’s pace.` : `${topA} and ${topB} bring different gifts: ${ELEM_TEXT[topA]} plus ${ELEM_TEXT[topB]}.`],
      friction: lowE.length ? [`Little ${lowE.join(" and ")} between you: ${lowE.map((e) => ELEM_TEXT[e]).join("; ")} may need conscious effort.`] : ["No element is missing between you."],
      advice: [`Lean on each other’s strongest element, and plan around the weakest one${lowE.length ? ` (${lowE.join(", ")})` : ""}.`],
      method: "Weights: Sun, Moon and Ascendant 2 each; Mercury, Venus, Mars, Jupiter and Saturn 1 each; Uranus, Neptune and Pluto left out (generational). Ascendant only counts when birth time and place are known.",
      notes, resources: [R.triplicityWiki, R.signWiki] });

    // 3. Moon signs
    const mr = signRel(ca.pos.Moon, cb.pos.Moon);
    sections.push({ id: "moon", system: "Western astrology", title: "Moon sign compatibility",
      summary: `${na}’s Moon is in ${signOf(ca.pos.Moon)}${ca.hasTime ? "" : " (approx.)"}, ${nb}’s in ${signOf(cb.pos.Moon)}${cb.hasTime ? "" : " (approx.)"}: ${mr.text}.`,
      details: [`The Moon describes what makes each of you feel safe and cared for. ${elemOf(ca.pos.Moon)} Moon (${na}) wants ${ELEM_TEXT[elemOf(ca.pos.Moon)]}; ${elemOf(cb.pos.Moon)} Moon (${nb}) wants ${ELEM_TEXT[elemOf(cb.pos.Moon)]}.`],
      data: { a: signOf(ca.pos.Moon), b: signOf(cb.pos.Moon), steps: mr.steps, aRange: ca.moonRange, bRange: cb.moonRange },
      strengths: [mr.steps === 0 || mr.steps === 4 || mr.steps === 2 ? "Your emotional languages are naturally close." : mr.steps === 6 ? "Opposite Moons often feel magnetic and can fill in each other’s gaps." : "Different emotional styles mean you can learn new ways to care."],
      friction: [mr.steps === 3 || mr.steps === 5 || mr.steps === 1 ? "What soothes one of you may not soothe the other; ask rather than assume." : mr.steps === 6 ? "You may want opposite things when stressed." : "Similar moods can amplify each other on bad days."],
      advice: ["Each of you finish the sentence: “I feel looked after when…” and compare answers."], notes, resources: [R.synastryCafe, R.signWiki] });

    // 4. Venus–Mars
    const vm = [["Venus", "Mars", ca, cb, na, nb], ["Mars", "Venus", ca, cb, na, nb]].map(([p, q, x, y, n1, n2]) => {
      const asp = aspectBetween(x.pos[p], y.pos[q], p, q), rel = signRel(x.pos[p], y.pos[q]);
      return `${n1}’s ${p} in ${signOf(x.pos[p])} and ${n2}’s ${q} in ${signOf(y.pos[q])}: ${rel.text}${asp ? `; exact ${asp.name} within ${asp.orb}°` : "; no close aspect"}.`;
    });
    const vv = signRel(ca.pos.Venus, cb.pos.Venus);
    sections.push({ id: "venus-mars", system: "Western astrology", title: "Venus & Mars: affection and desire",
      summary: `Venus shows how each of you gives and receives love; Mars shows desire and how conflict plays out.`,
      details: [...vm, `Venus to Venus (${signOf(ca.pos.Venus)} / ${signOf(cb.pos.Venus)}): ${vv.text} — how similar your tastes and love languages are.`],
      strengths: syn.rows.filter((r) => ["Venus-Mars","Mars-Venus","Venus-Venus"].includes(`${r.a}-${r.b}`) && r.tone !== "hard").map((r) => `${LBL(r.a)}–${LBL(r.b)} ${r.aspect} (orb ${r.orb}°).`).concat(["Attraction themes are worth talking about openly."]).slice(0, 3),
      friction: syn.rows.filter((r) => ["Venus","Mars"].includes(r.a) && ["Venus","Mars"].includes(r.b) && r.tone === "hard").map((r) => `${LBL(r.a)}–${LBL(r.b)} ${r.aspect} (orb ${r.orb}°): passion and irritation can arrive together.`).concat(["Mars contacts show where arguments start; agree how you’ll cool down."]).slice(0, 3),
      advice: ["Ask each other what makes you feel wanted, and what makes you feel crowded."], notes, resources: [R.synastryCafe, R.aspectsCafe] });

    // 5. Saturn & Node contacts
    const sn = syn.rows.filter((r) => ["Saturn","Node"].includes(r.a) || ["Saturn","Node"].includes(r.b));
    sections.push({ id: "saturn-node", system: "Western astrology", title: "Saturn & North Node: commitment and growth",
      summary: sn.length ? `${sn.length} Saturn or North Node contact${sn.length > 1 ? "s" : ""} to personal planets.` : "No close Saturn or North Node contacts to personal planets.",
      details: sn.length ? sn.map((r) => r.text) : ["Saturn contacts are traditionally read as ‘glue’ and responsibility (and sometimes heaviness); Node contacts as a sense of shared direction. Neither appears within orb here."],
      strengths: sn.filter((r) => r.tone !== "hard").map((r) => `${LBL(r.a)}–${LBL(r.b)} ${r.aspect}: steadiness or shared purpose.`).slice(0, 3),
      friction: sn.filter((r) => r.tone === "hard").map((r) => [r.a, r.b].includes("Saturn") ? `${LBL(r.a)}–${LBL(r.b)} ${r.aspect}: one person may feel judged or held back.` : `${LBL(r.a)}–${LBL(r.b)} ${r.aspect}: your directions in life may pull apart at times.`).slice(0, 3),
      advice: ["Talk about expectations and long-term plans early; Saturn themes reward honesty about limits."],
      method: "Mean lunar node (Meeus, Astronomical Algorithms ch. 47). Saturn and Node contacts are only counted to the other person’s Sun, Moon, Mercury, Venus or Mars.",
      notes, resources: [R.nodeWiki, R.synastryCafe] });

    // 6. Composite
    const mid = (x, y) => mod(x + diff(y, x) / 2);
    const comp = { Sun: mid(ca.pos.Sun, cb.pos.Sun), Moon: mid(ca.pos.Moon, cb.pos.Moon) };
    if (ca.exact && cb.exact) comp.ASC = mid(ca.pos.ASC, cb.pos.ASC);
    const moonApprox = !ca.hasTime || !cb.hasTime;
    sections.push({ id: "composite", system: "Western astrology", title: "Composite chart: the relationship as its own thing",
      summary: `Composite Sun ${fmt(comp.Sun)}, Moon ${fmt(comp.Moon)}${moonApprox ? " (approx.)" : ""}${comp.ASC !== undefined ? `, Ascendant ${fmt(comp.ASC)}` : ""}.`,
      details: [`Composite Sun in ${signOf(comp.Sun)} (${elemOf(comp.Sun)}): the relationship’s purpose leans toward ${ELEM_TEXT[elemOf(comp.Sun)]}.`,
        `Composite Moon in ${signOf(comp.Moon)} (${elemOf(comp.Moon)}): together you feel most at home with ${ELEM_TEXT[elemOf(comp.Moon)]}.${moonApprox ? " Approximate because a birth time is missing." : ""}`,
        comp.ASC !== undefined ? `Composite Ascendant in ${signOf(comp.ASC)}: how you come across as a pair.` : "Composite Ascendant skipped: it needs both birth times and places."],
      data: comp, strengths: [`The ${elemOf(comp.Sun)} composite Sun gives the relationship a clear theme to build on.`], friction: [signRel(comp.Sun, comp.Moon).steps === 3 || signRel(comp.Sun, comp.Moon).steps === 6 ? "Composite Sun and Moon are in tension: what the relationship wants and what it needs can differ." : "With composite Sun and Moon in step, the risk is comfort turning into routine."],
      advice: ["Treat the composite as a shared project: what is this relationship for?"],
      method: "Midpoint composite: each point is the halfway point along the shorter arc between the two people’s positions.", notes, resources: [R.compositeCafe] });

    // 7. House overlays
    const overlays = [];
    for (const [host, guest, nh, ng] of [[ca, cb, na, nb], [cb, ca, nb, na]]) if (host.exact) {
      const HT = { 1: "self and appearance", 2: "money and values", 3: "communication", 4: "home and family", 5: "romance, fun and creativity", 6: "daily routines and health", 7: "partnership", 8: "intimacy and shared resources", 9: "beliefs and travel", 10: "career and reputation", 11: "friendship and hopes", 12: "the private, hidden self" };
      for (const p of ["Sun","Moon","Venus","Mars"]) { if (p === "Moon" && !guest.hasTime) continue; const h = houseOf(guest.pos[p], host.cusps); overlays.push(`${ng}’s ${p} falls in ${nh}’s ${h}${h === 1 ? "st" : h === 2 ? "nd" : h === 3 ? "rd" : "th"} house (${HT[h]}).`); }
    }
    sections.push({ id: "houses", system: "Western astrology", title: "House overlays: where you land in each other’s life",
      summary: overlays.length ? "Where each person’s Sun, Moon, Venus and Mars fall in the other’s houses (Placidus)." : "Skipped: house overlays need a birth time and place for at least one of you.",
      details: overlays.length ? overlays : ["Add a birth time and birthplace to see which areas of life each person activates for the other."],
      strengths: overlays.filter((t) => /(5th|7th|1st|11th)/.test(t)).slice(0, 3), friction: overlays.filter((t) => /(8th|12th|6th)/.test(t)).map((t) => t + " Rewarding but can feel intense or hard to see.").slice(0, 3),
      advice: ["Notice which life areas the other person ‘lights up’ for you."], method: "Placidus house cusps from the host’s birth time and place.", notes, resources: [R.housesWiki] });

    // 8. Numerology
    const lpA = lifePath(a.y, a.m, a.d), lpB = lifePath(b.y, b.m, b.d), pyA = personalYear(a.m, a.d, thisYear), pyB = personalYear(b.m, b.d, thisYear);
    const exA = a.fullName ? expression(a.fullName) : null, exB = b.fullName ? expression(b.fullName) : null, suA = a.fullName ? soulUrge(a.fullName) : null, suB = b.fullName ? soulUrge(b.fullName) : null;
    const nd = [`Life Path: ${na} ${lpA} (${NUM[lpA]}); ${nb} ${lpB} (${NUM[lpB]}).`,
      exA !== null && exB !== null ? `Expression (full birth name): ${na} ${exA} (${NUM[exA]}); ${nb} ${exB} (${NUM[exB]}).` : "Expression and Soul Urge need both full birth names.",
      suA !== null && suB !== null ? `Soul Urge (vowels): ${na} ${suA} (${NUM[suA]}); ${nb} ${suB} (${NUM[suB]}).` : null,
      `Personal Year ${thisYear}: ${na} ${pyA} (${PY[pyA]}); ${nb} ${pyB} (${PY[pyB]}).${pyA === pyB ? " You’re in the same personal year — similar chapters." : ""}`].filter(Boolean);
    sections.push({ id: "numerology", system: "Numerology (Pythagorean)", title: "Numerology",
      summary: `Life Paths ${lpA} and ${lpB}${lpA === lpB ? " — the same number" : ""}.`, details: nd,
      data: { lifePath: [lpA, lpB], expression: [exA, exB], soulUrge: [suA, suB], personalYear: [pyA, pyB], year: thisYear },
      strengths: [lpA === lpB ? `Shared Life Path ${lpA}: similar life lessons.` : `${NUM[lpA].split(",")[0]} meets ${NUM[lpB].split(",")[0]}: complementary drives.`],
      friction: [lpA === lpB ? "Same number can mean the same blind spots." : "Different life rhythms; respect each other’s pace."],
      advice: [pyA === pyB ? "Use this shared personal year as a joint theme." : `This year ${na} is in ${PY[pyA]} while ${nb} is in ${PY[pyB]}; support each other’s different focus.`],
      method: "Pythagorean table (A=1 … I=9, J=1 … R=9, S=1 … Z=8). Life Path: reduce month, day and year separately, add, then reduce, keeping master numbers 11, 22 and 33. Expression = all letters of the full birth name; Soul Urge = vowels A E I O U (Y counted as a consonant). Personal Year = birth month + birth day + current year, reduced to 1–9. Other numerology methods can give different results.",
      notes: [], resources: [R.numerologyWiki, R.numerologyCafe] });

    // 9. Tarot birth cards
    const tA = birthCards(a.y, a.m, a.d), tB = birthCards(b.y, b.m, b.d);
    const shared = tA.numbers.filter((x) => tB.numbers.includes(x));
    sections.push({ id: "tarot", system: "Tarot birth cards", title: "Tarot birth cards",
      summary: `${na}: ${tA.cards.join(" / ")}. ${nb}: ${tB.cards.join(" / ")}.`,
      details: [`${na}: ${a.m} + ${a.d} + ${a.y} = ${tA.sum} → ${tA.steps.slice(1).join(" → ") || tA.sum}. ${tA.cards.map((c, i) => `${c} (${MAJOR_TEXT[tA.numbers[i]]})`).join("; ")}.`,
        `${nb}: ${b.m} + ${b.d} + ${b.y} = ${tB.sum} → ${tB.steps.slice(1).join(" → ") || tB.sum}. ${tB.cards.map((c, i) => `${c} (${MAJOR_TEXT[tB.numbers[i]]})`).join("; ")}.`,
        tA.constellation === tB.constellation ? `You share the ${tA.constellation} constellation: the same archetypal lesson seen from ${shared.length ? "the same card" : "different cards"}.` : `Different constellations (${tA.constellation} and ${tB.constellation}): each brings an archetype the other can learn from.`],
      data: { a: tA, b: tB }, strengths: [`${tA.cards[0]} brings ${MAJOR_TEXT[tA.numbers[0]]}; ${tB.cards[0]} brings ${MAJOR_TEXT[tB.numbers[0]]}.`],
      friction: [tA.constellation === tB.constellation ? "A shared archetype can mean shared struggles." : "Your core archetypes ask different things of life."],
      advice: ["Pull both birth cards from your deck and lay them side by side: what conversation do they have?"],
      method: "Mary K. Greer’s method: add month + day + year, then add the digits until the result is 22 or less (22 = The Fool). If that number is 10 or more, its digit sum gives a second card (and so on).",
      notes: [], resources: [R.greerTag, R.greerEmperor, R.greerBook, R.majorWiki] });

    // 10. Chinese zodiac
    const zA = chineseSign(a.y, a.m, a.d), zB = chineseSign(b.y, b.m, b.d), zr = chineseRelation(zA, zB);
    const zn = [zA.onBoundary ? `${na} was born on Lunar New Year’s day (${zA.newYear}); depending on the hour and time zone the sign could be the previous year’s.` : null,
      zB.onBoundary ? `${nb} was born on Lunar New Year’s day (${zB.newYear}); depending on the hour and time zone the sign could be the previous year’s.` : null].filter(Boolean);
    sections.push({ id: "chinese", system: "Chinese zodiac", title: "Chinese zodiac",
      summary: `${na}: ${zA.polarity} ${zA.element} ${zA.animal} (year from ${zA.newYear}). ${nb}: ${zB.polarity} ${zB.element} ${zB.animal} (year from ${zB.newYear}).`,
      details: [...zr.relations.map((r) => r.text), zr.element], data: { a: zA, b: zB, relations: zr.relations.map((r) => r.kind) },
      strengths: zr.relations.filter((r) => /trine|harmon|same/.test(r.kind)).map((r) => r.text).concat(/generates|same element/i.test(zr.element) ? [zr.element] : []).slice(0, 3),
      friction: zr.relations.filter((r) => /clash|Liu Hai/.test(r.kind)).map((r) => r.text).concat(/overcomes/.test(zr.element) ? [zr.element] : []).slice(0, 3),
      advice: ["In Chinese astrology the year animal is only one layer (month, day and hour pillars matter too); treat this as a starting point."],
      method: "The animal year starts at Lunar New Year, computed as the second new moon after the December solstice in China Standard Time (checked against the Hong Kong Observatory tables). Element from the heavenly stem of that year. Pairings follow the traditional trines, six harmonies, clashes and harms.",
      notes: zn, resources: [R.chineseWiki, R.wuxingWiki, R.sexagenaryWiki, R.cnyWiki, R.hko] });

    const FALL = { strengths: "No standout strengths in this layer — that’s neutral, not negative.", friction: "No notable friction in this layer.", advice: "Use this section as a conversation starter." };
    for (const sec of sections) for (const k of ["strengths", "friction", "advice"]) { sec[k] = (sec[k] || []).filter(Boolean); if (!sec[k].length) sec[k].push(FALL[k]); }
    return { version: 1, created: today.toISOString(), people: [{ name: na, birth: strip(a), hasTime: ca.hasTime, hasPlace: ca.hasPlace }, { name: nb, birth: strip(b), hasTime: cb.hasTime, hasPlace: cb.hasPlace }],
      sections, disclaimer: DISCLAIMER, research: RESEARCH, timeNotes: notes };
  }
  const strip = (p) => ({ y: p.y, m: p.m, d: p.d, hour: p.hour ?? null, minute: p.minute ?? null, tz: p.tz || null, lat: p.lat ?? null, lon: p.lon ?? null, place: p.place || "" });

  const api = { compute, chart, synastry, aspectBetween, lifePath, expression, soulUrge, personalYear, reduce, birthCards, chineseSign, lunarNewYear, chineseRelation, meanNode, signRel, RESOURCES: R, DISCLAIMER };
  root.TarotCompat = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
