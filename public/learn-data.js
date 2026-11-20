/* Learn data: one-idea cards, sources with honest read status, chart-reading sections.
   Tarot text is split word-for-word from PRACTICE_DATA (see tests/unit/learn.test.cjs split check). */
(() => {
  "use strict";
  const W = typeof window !== "undefined" ? window : globalThis;
  // read: "read" (opened and read in full), "partly" (some pages read), "abstract", "app" (our own text), "listed"
  const SOURCES = {
    app: { author: "This app", work: "Our own study text", read: "app", where: "Written for this app from the sources below", url: null },
    pkt: { author: "A. E. Waite", work: "The Pictorial Key to the Tarot", year: "1911", read: "partly", where: "Free on Sacred Texts (Part III holds the card pages)", url: "https://sacred-texts.com/tarot/pkt/index.htm",
      note: "Read: Part III (the card pages and divinatory meanings, on Sacred Texts and Wikisource). All 78 cards' upright and reversed Waite lines in this app were checked word for word against it on Nov 2, 2026. Parts I and II not read in full." },
    ptolemy: { author: "Claudius Ptolemy, tr. J. M. Ashmand (1822)", work: "Tetrabiblos, Book I", year: "c. 150 CE", read: "partly", where: "Free on Sacred Texts", url: "https://sacred-texts.com/astro/ptb/ptb19.htm",
      note: "Read: Book I chapters IV (planets), V (benefics and malefics), XIV (tropical, equinoctial, fixed and bicorporeal signs), XVI (configurations) and XXI (triplicities)." },
    lilly: { author: "William Lilly, ed. Zadkiel (1852)", work: "An Introduction to Astrology (from Christian Astrology, 1647), ch. IV", year: "1647/1852", read: "partly", where: "Free on Sacred Texts", url: "https://sacred-texts.com/book/an-introduction-to-astrology/chapter-iv-of-the-twelve-houses-their-nature-and-signification",
      note: "Read: chapter IV, the twelve houses and what each signifies." },
    carlson: { author: "Shawn Carlson", work: "A double-blind test of astrology, Nature 318:419–425", year: "1985", read: "partly", where: "Nature (paywalled); a scan is shared by factchecker.gr", url: "https://www.nature.com/articles/318419a0",
      note: "Read: the summary, the design of both tests (p. 419) and the conclusions (p. 425)." },
    engine: { author: "Astronomy Engine (Don Cross), checked against the Swiss Ephemeris", work: "Planet positions and Placidus houses in astro.js", read: "read", where: "This app's code", url: "https://github.com/cosinekitty/astronomy" },
    greer: { author: "Mary K. Greer", work: "Birth card method (as described in this app)", read: "listed", where: "Greer's books; not read by us", url: null, note: "We describe the arithmetic only. We have not read Greer's own text." },
  };
  const READ_LABEL = { read: "Read", partly: "Partly read", abstract: "Abstract read", app: "Our text", listed: "Listed only (not read; never quoted)" };

  const sents = (t) => String(t || "").split(/(?<=[.?!])\s+(?=[A-Z“"'])/).filter(Boolean);
  // one idea per card: max 2 sentences (3 only if very short)
  function chunk(par) {
    const s = sents(par), out = [];
    let cur = [];
    for (const x of s) {
      cur.push(x);
      const len = cur.join(" ").length;
      if (cur.length >= 2 || len > 170) { out.push(cur.join(" ")); cur = []; }
    }
    if (cur.length) { if (out.length && cur.join(" ").length < 50 && sents(out[out.length - 1]).length < 3) out[out.length - 1] += " " + cur.join(" "); else out.push(cur.join(" ")); }
    return out;
  }

  function tarotSections(D) {
    const secs = [];
    for (const l of D.LESSONS) {
      const cards = [];
      l.body.forEach((p, pi) => chunk(p).forEach((t) => cards.push({ text: t, para: pi, kind: l.method ? "ourmethod" : "traditional", source: l.resources && l.resources.includes("pkt") && /Waite/.test(t) ? "pkt" : "app" })));
      secs.push({ id: "learn." + l.id, area: "learn", system: "tarot", title: l.title, cards, tryThis: l.exercise, original: l.body, deckCards: l.cards || [],
        sources: ["app", ...(l.resources || []).includes("pkt") ? ["pkt"] : []],
        put: { prompt: l.exercise, fields: ["What did you do or notice?", "What would you tell yourself next time?"] } });
    }
    secs.push({ id: "learn.glossary", area: "learn", system: "tarot", title: "Glossary", cards: D.GLOSSARY.flatMap(([t, d]) => chunk(d).map((x, j) => ({ text: j ? x : `${t}: ${x}`, term: t, def: d, kind: "how-to", source: "app" }))), sources: ["app"],
      put: { prompt: "Pick three terms and use each one in a sentence about a reading you did.", fields: ["Your three sentences"] } });
    // numbers (tarot system only; Pythagorean stays in Numerology)
    const nc = D.NUMBERS.map((n) => ({ text: `${n.name}: ${n.theme}`, n: n.n, name: n.name, theme: n.theme, kind: "traditional", source: "app" }));
    secs.push({ id: "numbers.tarot", area: "numbers", system: "tarot-numbers", title: "Numbers in the tarot (Aces to Tens)", cards: nc, sources: ["app"],
      put: { prompt: "Work out your birth card (Numerology tab shows the steps), then write what its number idea suggests to you.", fields: ["Your birth card and number", "Where you see it in your life"] } });
    secs.push({ id: "numbers.courts", area: "numbers", system: "tarot-numbers", title: "Court cards as stages", cards: D.COURT_STAGES.map((c) => ({ text: Array.isArray(c) ? c.join(": ") : (c.rank ? `${c.rank}: ${c.text || c.meaning || ""}` : String(c.text || JSON.stringify(c))), kind: "traditional", source: "app" })), sources: ["app"],
      put: { prompt: "Pull the four courts of one suit and write which stage you are in with that subject.", fields: ["Suit and stage", "Why"] } });
    secs.push({ id: "numbers.birthcard", area: "numbers", system: "tarot-numbers", title: "Birth card method", cards: D.BIRTH_CARD.method.map((t, i) => ({ text: `Step ${i + 1}. ${t}`, kind: "method", source: "greer" })).concat([{ text: D.BIRTH_CARD.credit, kind: "method", source: "greer" }]), sources: ["greer", "app"],
      put: { prompt: "Work out the birth card for one example birthday, writing each step.", fields: ["Birthday", "Your steps", "Result"] } });
    // spreads: one position per card
    for (const s of D.SPREADS) {
      const cards = [{ text: `${s.name}: ${s.count} card${s.count > 1 ? "s" : ""}. When to use it: ${s.when || ""}`.trim(), kind: "how-to", source: "app" }]
        .concat(chunk(s.lesson || "").map((t) => ({ text: t, kind: "how-to", source: "app" })))
        .concat(s.positions.map((p) => ({ text: `Position ${p.n}, ${p.name}: ${p.meaning}.`, pos: p.name, meaning: p.meaning, kind: "how-to", source: "app" })));
      secs.push({ id: "spreads." + s.id, area: "spreads", system: "tarot", title: s.name, cards, spread: s.id, sources: ["app"],
        put: { prompt: `Lay out ${s.name} for a real question, with your deck or the app's. Write one line per position.`, fields: ["Your question", "Your reading"] } });
    }
    return secs;
  }

  // Reversals: "three ways" are this app's teaching method (lesson 5); Waite's reversed lines are on each card page.
  const REVERSAL_WAYS = [["blocked", "Blocked means the card's influence can't get through."], ["delayed", "Delayed means it's coming, just not yet."], ["overdone", "Overdone means too much of the card."]];

  /* Chart reading (Horoscope tab). Every traditional statement is tied to a page we read. */
  const SIGN_GROUPS = { tropical: ["Cancer", "Capricorn"], equinoctial: ["Aries", "Libra"], fixed: ["Taurus", "Leo", "Scorpio", "Aquarius"], bicorporeal: ["Gemini", "Virgo", "Sagittarius", "Pisces"] };
  const LILLY_HOUSES = {
    1: "the life of the person, their stature, colour, complexion, form and shape",
    2: "estate or fortune, wealth, moveable goods, money lent, profit or gain, loss or damage",
    3: "brothers, sisters, cousins, kindred, neighbours, short journeys, letters, rumours and messengers",
    4: "fathers, lands, houses, inheritance, the end of any matter, and old dwellings",
    5: "children, the state of a woman with child, banquets, taverns, plays and messengers",
    6: "servants, small animals, sickness and its cause, day-labourers and tenants",
    7: "marriage, love questions, open enemies, the other party in a lawsuit, quarrels and duels",
    8: "death, wills and legacies, the dowry of a wife, and the goods of the dead",
    9: "long journeys beyond seas, clergy, dreams, visions, foreign countries, books and learning",
    10: "kings and those in authority, mothers, honour, preferment, office, profession or trade",
    11: "friends and friendship, hope, trust, confidence, praise or dispraise",
    12: "private enemies, sorrow, imprisonment, affliction, self-undoing, and great animals such as horses",
  };
  const APP_HOUSES = { 1: "self and body", 2: "money and self-worth", 3: "messages, siblings and short trips", 4: "home and family", 5: "creativity, fun and romance", 6: "work routines and health", 7: "partners and one-to-one relationships", 8: "shared money, intimacy and change", 9: "learning, travel and beliefs", 10: "career and reputation", 11: "friends, networks and hopes", 12: "rest, retreat and the unseen" };
  const APP_PLANETS = { Sun: "identity and vitality", Moon: "feelings and needs", Mercury: "thinking, messages and talks", Venus: "love, values and money", Mars: "drive, action and anger", Jupiter: "growth, luck and opportunity", Saturn: "structure, limits and commitment", Uranus: "sudden change and freedom", Neptune: "dreams, intuition and blur", Pluto: "deep change and power" };
  const PTOLEMY_PLANETS = { Sun: "produces heat and moderate dryness (ch. IV)", Moon: "principally generates moisture (ch. IV); counted with the benefics (ch. V)", Saturn: "produces cold and dryness (ch. IV); malefic from excess of cold (ch. V)", Mars: "chiefly causes dryness and is strongly heating (ch. IV); malefic from excess of dryness (ch. V)", Jupiter: "temperate, promoting warmth and moisture (ch. IV); benefic (ch. V)", Venus: "temperate like Jupiter (ch. IV); benefic (ch. V)", Mercury: "of common influence, good or evil depending on the planets it joins (ch. V)" };

  const C = (text, source, extra = {}) => ({ text, source, kind: extra.kind || (source === "carlson" ? "study" : source === "engine" ? "how-to" : source === "app" ? "how-to" : "traditional"), ...extra });
  const CHART = [
    { id: "sky.anatomy", title: "Chart anatomy", cards: [
      C("A birth chart is a map of where the Sun, Moon and planets were, seen from the place and moment you were born.", "engine"),
      C("The wheel is split into 12 signs of 30 degrees each, starting at 0° Aries.", "engine"),
      C("The chart is also split into 12 houses. This app uses Placidus houses, which need the birth time and place.", "engine"),
      C("The Ascendant is the degree rising in the east at birth. It starts the 1st house.", "lilly"),
      C("Lilly divides the sky into four quarters by the meridian and horizon, and each quarter into three houses.", "lilly"),
      C("A common teaching shortcut: the planet says what, the sign says how, the house says where in life. It's a classroom shorthand, not a quote from the old texts.", "app", { kind: "method" }) ],
      put: { prompt: "Open My chart and find your Sun: its sign, degree and house.", fields: ["Sun sign, degree and house"] } },
    { id: "sky.bigthree", title: "The Big Three", cards: [
      C("The Big Three are your Sun sign, Moon sign and rising sign (Ascendant).", "app"),
      C("Your Sun sign comes from the date. The Moon moves about 13° a day, so its sign needs the date and roughly the time.", "engine"),
      C("The rising sign changes about every two hours, so it needs an exact birth time.", "engine"),
      C("Without a birth time, the app skips houses and the Ascendant, and calls the Moon approximate.", "engine") ],
      put: { prompt: "Write your Big Three and one line about each in your own words.", fields: ["Sun", "Moon", "Rising"] } },
    { id: "sky.planets", title: "Planets", cards: [
      ...Object.entries(PTOLEMY_PLANETS).map(([p, t]) => C(`Ptolemy: ${p} ${t}.`, "ptolemy", { planet: p })),
      C("Ptolemy counts Jupiter, Venus and the Moon as benefic, Saturn and Mars as malefic, and the Sun and Mercury as common.", "ptolemy"),
      C("Uranus, Neptune and Pluto were found long after Ptolemy and Lilly. Their meanings in this app are modern shorthand.", "app"),
      ...Object.entries(APP_PLANETS).map(([p, t]) => C(`In this app's readings, ${p} stands for ${t}. This is modern shorthand, not a quote.`, "app", { planet: p, key: t })) ],
      put: { prompt: "Pick one planet in your chart. Write what Ptolemy says about it and what the app says, then how you'd say it.", fields: ["Planet", "Your words"] } },
    { id: "sky.signs", title: "Signs", cards: [
      C("Ptolemy groups the 12 signs into four triplicities, each forming an equilateral triangle.", "ptolemy"),
      C("The first triplicity is Aries, Leo and Sagittarius, three masculine signs.", "ptolemy"),
      C("Naming the triangles fire, earth, air and water is later tradition. Ptolemy names them by their ruling planets and winds.", "ptolemy"),
      C("Ptolemy calls Cancer and Capricorn tropical: the Sun seems to turn there, at the solstices.", "ptolemy"),
      C("He calls Aries and Libra equinoctial: day and night are equal when the Sun enters them.", "ptolemy"),
      C("The four signs after these are fixed: Taurus, Leo, Scorpio and Aquarius. The season is firmly set there.", "ptolemy"),
      C("The last four are bicorporeal: Gemini, Virgo, Sagittarius and Pisces. They share the nature of the signs either side.", "ptolemy"),
      C("Modern books call these groups cardinal, fixed and mutable.", "app") ],
      put: { prompt: "For your Sun and Moon signs, write Ptolemy's group for each (tropical, equinoctial, fixed or bicorporeal).", fields: ["Sun sign and group", "Moon sign and group"] } },
    { id: "sky.houses", title: "Houses", cards: Object.keys(LILLY_HOUSES).map((n) => C(`House ${n}. Lilly: ${LILLY_HOUSES[n]}.`, "lilly", { house: +n, lilly: LILLY_HOUSES[n], modern: APP_HOUSES[n] }))
        .concat([C("The app's short labels (for example the 5th as creativity, fun and romance) are modern shorthand. Compare them with Lilly's older lists.", "app"),
          C("Lilly ranks houses by strength: angles (1, 10, 7, 4) most powerful, then succedent, then cadent.", "lilly")]),
      put: { prompt: "Find one planet in your chart and its house. Write Lilly's meaning, the app's label, and your own line.", fields: ["Planet and house", "Your line"] } },
    { id: "sky.aspects", title: "Aspects", cards: [
      C("An aspect is a set angle between two points on the wheel.", "ptolemy"),
      C("Ptolemy lists four: opposition (180°), trine (120°), square (90°) and sextile (60°).", "ptolemy"),
      C("He calls the trine and sextile harmonious, because they join signs of the same kind.", "ptolemy"),
      C("He calls the opposition and square discordant, because they join signs of different natures.", "ptolemy"),
      C("The conjunction (0°) isn't in that chapter. The app counts it, as later astrologers do.", "ptolemy"),
      C("The orb is how far from exact an aspect is. The app allows 2° for the Sun, Mercury, Venus and Mars, and 1.5° for slower planets.", "engine"),
      C("Applying means the aspect is getting closer to exact; separating means it is moving apart.", "engine") ],
      put: { prompt: "Find one aspect in your chart. Write the two planets, the angle, and whether Ptolemy calls it harmonious or discordant.", fields: ["Aspect", "Your reading"] } },
    { id: "sky.whole", title: "Reading a whole chart", cards: [
      C("Start with the Big Three, then the planets nearest the angles. Lilly says planets in angles show their effects more forcibly.", "lilly"),
      C("For each planet, say it plainly: the planet's theme, the sign's group, the house's matters.", "app", { kind: "method" }),
      C("Then look at the tightest aspects. Small orbs come first.", "engine"),
      C("Write your reading before you look anything up. Then check each clue.", "app", { kind: "method" }) ],
      put: { prompt: "Write a five-line reading of your own chart using the method.", fields: ["Your reading"] } },
    { id: "sky.transits", title: "Transits vs your chart", cards: [
      C("Your birth chart is fixed. Transits are where the planets are today.", "engine"),
      C("A transit aspect is today's planet making an angle to a point in your birth chart.", "engine"),
      C("The daily horoscope uses transits for 8:00 AM your time and keeps the seven tightest.", "engine"),
      C("The Moon changes sign about every two and a half days, so it changes the daily mood most often.", "engine") ],
      put: { prompt: "Open Today and pick one transit. Write it out in plain words.", fields: ["Transit", "Your words"] } },
    { id: "sky.evidence", title: "Does it work?", cards: [
      C("Carlson (1985) ran two double-blind tests with astrologers who helped design them.", "carlson"),
      C("Astrologers predicted they would match a chart to the right personality profile at least half the time. Chance was one in three.", "carlson"),
      C("Their choices were consistent with chance. Carlson concluded the experiment clearly refutes the astrological hypothesis.", "carlson"),
      C("The planet positions in this app are real. The meanings are tradition, for reflection, not prediction.", "app") ],
      put: { prompt: "Write one way you'll use astrology for reflection, knowing what the study found.", fields: ["Your line"] } },
  ].map((s) => ({ ...s, area: "sky", system: "western-astrology", sources: [...new Set(s.cards.map((c) => c.source))] }));

  function masteryPass(score, total) {
    return Number.isFinite(score) && Number.isFinite(total) && total > 0 && score >= Math.ceil(total * 0.8);
  }
  function build(D) {
    const secs = tarotSections(D).concat(CHART);
    for (const s of secs) s.cards.forEach((c, i) => { c.id = `${s.id}.${String(i + 1).padStart(2, "0")}`; });
    return secs;
  }
  const api = { SOURCES, READ_LABEL, REVERSAL_WAYS, SIGN_GROUPS, LILLY_HOUSES, APP_HOUSES, APP_PLANETS, CHART, chunk, sents, build, masteryPass };
  W.LEARN_DATA = api;
  if (typeof module !== "undefined") module.exports = api;
})();
