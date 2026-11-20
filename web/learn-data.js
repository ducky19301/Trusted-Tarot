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
    openstax: { author: "OpenStax", work: "Astronomy 2e, section 2.3: Astrology and Astronomy", year: "2022", read: "partly", where: "OpenStax textbook", url: "https://openstax.org/books/astronomy-2e/pages/2-3-astrology-and-astronomy", note: "Used for the distinction between tropical zodiac signs, astronomical constellations and scientific astronomy." },
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
      C("The tropical zodiac divides the ecliptic into twelve equal 30-degree signs anchored to the equinoxes; these are not identical to the unequal astronomical constellations.", "openstax"),
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

    { id: "sky.planets.personal", title: "Personal planets: Sun through Mars", cards: [
      C("The Sun represents vitality, conscious identity and the direction a person is learning to embody. Its sign describes style, its house describes the life area, and its aspects show how this function interacts with the rest of the chart.", "app", {term:"Sun",def:"Vitality, conscious identity and purpose"}),
      C("The Moon represents needs, habits, memory, nourishment and instinctive responses. Its sign and house can be used to ask what creates emotional steadiness, without treating the placement as a diagnosis.", "app", {term:"Moon",def:"Needs, habits, memory and emotional security"}),
      C("Mercury represents thought, language, learning, listening and exchange. Its placement can prompt questions about how someone gathers information and communicates under pressure; it does not measure intelligence.", "app", {term:"Mercury",def:"Thought, language, learning and communication"}),
      C("Venus represents affection, attraction, pleasure, aesthetics, values and reciprocity. It can describe what someone appreciates and how they seek harmony, but it does not determine whom they will love.", "app", {term:"Venus",def:"Affection, attraction, pleasure and values"}),
      C("Mars represents action, initiative, desire, courage, anger and boundaries. Its constructive expression includes clear assertion; no astrological placement excuses aggression or coercion.", "app", {term:"Mars",def:"Action, desire, initiative and assertion"})
    ], put: { prompt: "Choose one personal planet in your chart. Combine its function, sign, house and closest aspect into a grounded interpretation.", fields: ["Planet and placement", "What it may describe", "Mature expression and growth edge"] } },
    { id: "sky.planets.social", title: "Jupiter and Saturn: growth and responsibility", cards: [
      C("Jupiter is traditionally associated with growth, teaching, faith, philosophy, law, generosity and the search for meaning. Its house can show where the chart's symbolism emphasizes expansion and opportunity.", "ptolemy", {term:"Jupiter",def:"Growth, teaching, faith and meaning"}),
      C("Jupiter's shadow is excess: overpromising, overconfidence or assuming that optimism replaces planning. A mature expression pairs generosity with discernment.", "app", {term:"Jupiter's growth edge",def:"Excess, overpromising and insufficient discernment"}),
      C("Saturn is associated with time, boundaries, discipline, responsibility, limits and craft. It is often interpreted as the area where patient effort can build durable competence.", "ptolemy", {term:"Saturn",def:"Time, boundaries, discipline and responsibility"}),
      C("Saturn's shadow can appear as fear, rigidity or harsh self-judgment. A mature expression is accountability without cruelty toward oneself or others.", "app", {term:"Saturn's growth edge",def:"Fear, rigidity and harsh self-judgment"}),
      C("Jupiter and Saturn are complementary symbols: one expands, the other defines limits and structure. A useful reading asks how opportunity can be made sustainable.", "app", {term:"Jupiter and Saturn together",def:"Balancing expansion with structure"})
    ], put: { prompt: "Find Jupiter and Saturn in your chart. Where do growth and responsibility need to work together?", fields: ["Jupiter placement", "Saturn placement", "A practical balance"] } },
    { id: "sky.planets.outer", title: "Uranus, Neptune and Pluto", cards: [
      C("Uranus was discovered in 1781 and is used in modern astrology for disruption, independence, invention and liberation. Because it moves slowly, its sign is shared by a broad birth cohort.", "app", {term:"Uranus",def:"Independence, disruption and invention"}),
      C("Neptune was discovered in 1846 and is used in modern astrology for imagination, ideals, spirituality, compassion and blurred boundaries. Its house and close aspects make its symbolism more personally specific.", "app", {term:"Neptune",def:"Imagination, ideals and blurred boundaries"}),
      C("Pluto was discovered in 1930 and is used in modern astrology for power, compulsion, endings, renewal and deep structural change. Its sign is generational; its house and close personal aspects add individual context.", "app", {term:"Pluto",def:"Power, compulsion, renewal and transformation"}),
      C("Outer-planet sign placements should not be treated as unique personality traits because many people born in the same era share them. Look for house placement and close contacts to personal planets or angles.", "app", {term:"Generational placement",def:"A slow-moving planet's sign shared by many people of the same era"}),
      C("The outer planets were unknown to Ptolemy and Lilly. Their meanings are modern astrological developments and should not be attributed to ancient authors.", "app", {term:"Historical distinction",def:"Outer-planet meanings are modern, not ancient Ptolemaic doctrine"})
    ], put: { prompt: "Choose one outer planet in your chart. Is its sign generational, and what makes its house or aspects personal?", fields: ["Planet and sign", "House or close aspect", "Your interpretation"] } },
    { id: "sky.signs.elements", title: "The four elements in depth", cards: [
      C("Fire signs are Aries, Leo and Sagittarius. In modern symbolic shorthand, Fire emphasizes initiative, inspiration, courage and the urge to act.", "app", {term:"Fire",def:"Initiative, inspiration and action"}),
      C("Earth signs are Taurus, Virgo and Capricorn. Earth emphasizes material reality, patience, resources, practical skills and what can be built or maintained.", "app", {term:"Earth",def:"Practicality, resources and steadiness"}),
      C("Air signs are Gemini, Libra and Aquarius. Air emphasizes ideas, language, perspective, social exchange and the ability to compare possibilities.", "app", {term:"Air",def:"Ideas, language and social exchange"}),
      C("Water signs are Cancer, Scorpio and Pisces. Water emphasizes feeling, memory, empathy, attachment and responses to emotional atmosphere.", "app", {term:"Water",def:"Feeling, memory and emotional response"}),
      C("An element is a broad symbolic family, not a complete description of a person. Count the whole chart and note which planets and angles carry the element before describing a dominant pattern.", "app", {term:"Element balance",def:"A whole-chart count and interpretation of elemental emphasis"})
    ], put: { prompt: "Count the elements represented by your Sun, Moon, Ascendant and personal planets. Which element is emphasized, and what evidence supports that?", fields: ["Fire", "Earth", "Air", "Water", "What stands out?"] } },
    { id: "sky.signs.modalities", title: "Cardinal, fixed and mutable signs", cards: [
      C("Cardinal signs are Aries, Cancer, Libra and Capricorn. They begin seasons in the tropical zodiac and are symbolically associated with initiating, organizing and starting movement.", "ptolemy", {term:"Cardinal",def:"Initiating, organizing and beginning"}),
      C("Fixed signs are Taurus, Leo, Scorpio and Aquarius. They occupy the middle of each season and are symbolically associated with sustaining, stabilizing and concentrating effort.", "ptolemy", {term:"Fixed",def:"Sustaining, stabilizing and concentrating"}),
      C("Mutable signs are Gemini, Virgo, Sagittarius and Pisces. They occupy the end of each season and are symbolically associated with adapting, translating and preparing for change.", "app", {term:"Mutable",def:"Adapting, translating and preparing for change"}),
      C("Element and modality combine to create a more specific style. Pisces is mutable Water, Leo is fixed Fire, Libra is cardinal Air and Taurus is fixed Earth.", "app", {term:"Element plus modality",def:"A combined description of a sign's symbolic style"}),
      C("A chart with many placements in one modality may emphasize starting, sustaining or adapting. This is a pattern to explore, not a permanent limitation.", "app", {term:"Modality emphasis",def:"A repeated pattern of initiating, sustaining or adapting"})
    ], put: { prompt: "Find the modalities of your Sun, Moon and Ascendant. Which mode appears most often, and where might balance help?", fields: ["Sun modality", "Moon modality", "Ascendant modality", "Reflection"] } },
    { id: "sky.signs.individual", title: "All twelve signs: gifts and growth edges", cards: [
      C("Aries initiates directly and values courage; its growth edge is pausing before acting. Taurus seeks steadiness and sensory comfort; its growth edge is allowing necessary change.", "app", {term:"Aries and Taurus",def:"Aries: initiative and courage; Taurus: steadiness and continuity"}),
      C("Gemini connects ideas and asks questions; its growth edge is sustained focus. Cancer protects and nurtures; its growth edge is naming needs without retreating into defensiveness.", "app", {term:"Gemini and Cancer",def:"Gemini: curiosity and exchange; Cancer: care and protection"}),
      C("Leo creates, expresses and gives warmth; its growth edge is sharing attention. Virgo observes and refines; its growth edge is avoiding perfectionism and worry.", "app", {term:"Leo and Virgo",def:"Leo: creativity and expression; Virgo: discernment and refinement"}),
      C("Libra seeks fairness and dialogue; its growth edge is making decisions and tolerating disagreement. Scorpio investigates depth and trust; its growth edge is avoiding control and suspicion.", "app", {term:"Libra and Scorpio",def:"Libra: fairness and dialogue; Scorpio: depth and trust"}),
      C("Sagittarius explores meaning and horizons; its growth edge is following through. Capricorn builds structure and competence; its growth edge is not measuring all worth through achievement.", "app", {term:"Sagittarius and Capricorn",def:"Sagittarius: exploration and meaning; Capricorn: structure and mastery"}),
      C("Aquarius questions conventions and sees systems; its growth edge is staying emotionally present. Pisces imagines and empathizes; its growth edge is maintaining boundaries and checking assumptions.", "app", {term:"Aquarius and Pisces",def:"Aquarius: independence and systems; Pisces: imagination and empathy"})
    ], put: { prompt: "Choose your Sun, Moon and rising signs. For each, write one strength and one possible overuse without treating either as inevitable.", fields: ["Sun: strength and growth edge", "Moon: strength and growth edge", "Rising: strength and growth edge"] } },
    { id: "sky.houses.personal", title: "Houses 1–6: personal life arenas", cards: [
      C("The first house concerns the body, self-presentation, approach and beginnings. The Ascendant is its cusp in the house system used by this app.", "lilly", {term:"First house",def:"Body, self-presentation and approach"}),
      C("The second house concerns possessions, resources, income, skills and values. It can prompt questions about security and what a person considers worth investing in.", "lilly", {term:"Second house",def:"Resources, possessions and values"}),
      C("The third house concerns communication, siblings, local movement and everyday learning. It can show where a chart's symbolism is linked with information exchange.", "lilly", {term:"Third house",def:"Communication, siblings and everyday learning"}),
      C("The fourth house concerns home, family, roots and private foundations. It should not be used to claim that a specific family event occurred.", "lilly", {term:"Fourth house",def:"Home, family and roots"}),
      C("The fifth house concerns creativity, pleasure, play, romance and self-expression. It is a useful symbolic lens for what feels joyful or worth making.", "lilly", {term:"Fifth house",def:"Creativity, pleasure, play and romance"}),
      C("The sixth house concerns work routines, service, maintenance and health habits. It is not a medical diagnosis and cannot replace professional healthcare.", "lilly", {term:"Sixth house",def:"Routines, service and maintenance"})
    ], put: { prompt: "Choose a planet in houses 1–6. Compare the planet's function with the house's life arena and write one practical example.", fields: ["Planet and house", "What it symbolizes", "Everyday example"] } },
    { id: "sky.houses.relational", title: "Houses 7–12: relational and collective arenas", cards: [
      C("The seventh house concerns committed partnership, agreements, contracts and one-to-one encounters. Read its sign, ruler and any planets in the house.", "lilly", {term:"Seventh house",def:"Partnership, agreements and one-to-one encounters"}),
      C("The eighth house concerns shared resources, debt, inheritance, intimacy, trust and transitions. Avoid frightening claims about death or unavoidable loss.", "lilly", {term:"Eighth house",def:"Shared resources, intimacy and transitions"}),
      C("The ninth house concerns higher learning, ethics, law, religion, philosophy and long-distance travel. It often represents the search for a wider framework of meaning.", "lilly", {term:"Ninth house",def:"Higher learning, ethics and wider horizons"}),
      C("The tenth house concerns vocation, public responsibility, reputation and visibility. The Midheaven is the key angle associated with this area.", "lilly", {term:"Tenth house",def:"Vocation, public role and reputation"}),
      C("The eleventh house concerns friends, groups, networks, collective projects and hopes for the future. It can prompt questions about belonging and contribution.", "lilly", {term:"Eleventh house",def:"Friends, networks and collective aims"}),
      C("The twelfth house concerns retreat, solitude, institutions, hidden processes and rest. It should never be used to label someone doomed, secretive or mentally unwell.", "lilly", {term:"Twelfth house",def:"Retreat, solitude and hidden processes"})
    ], put: { prompt: "Find a planet in houses 7–12. Describe the life arena without turning the symbolism into a prediction.", fields: ["Planet and house", "Life arena", "Grounded interpretation"] } },
    { id: "sky.aspects.major", title: "Major aspects: conjunction through opposition", cards: [
      C("A conjunction is approximately 0 degrees. The two planetary functions are read as blended or intensified, and the result depends on which planets are involved.", "app", {term:"Conjunction",def:"Blending or intensification of two functions"}),
      C("A sextile is approximately 60 degrees. It is traditionally considered supportive or cooperative, though the opportunity may still require deliberate action.", "ptolemy", {term:"Sextile",def:"A 60-degree aspect traditionally read as cooperative"}),
      C("A square is approximately 90 degrees. It is traditionally read as friction, conflict or a demand for adjustment and action.", "ptolemy", {term:"Square",def:"A 90-degree aspect traditionally read as discordant or challenging"}),
      C("A trine is approximately 120 degrees. It is traditionally considered harmonious or flowing and may describe resources that come naturally.", "ptolemy", {term:"Trine",def:"A 120-degree aspect traditionally read as harmonious"}),
      C("An opposition is approximately 180 degrees. It highlights polarity and the need to balance two functions, sometimes by noticing projection or competing priorities.", "ptolemy", {term:"Opposition",def:"A 180-degree aspect of polarity and balancing"})
    ], put: { prompt: "Choose one major aspect in your natal chart. Identify both planets, the angle and one constructive way to work with the symbolism.", fields: ["Aspect", "Two functions involved", "Constructive expression"] } },
    { id: "sky.aspects.orbs", title: "Orbs, applying aspects and minor aspects", cards: [
      C("An orb is the angular distance between an actual planetary separation and an exact aspect angle. Astrologers differ on acceptable orbs; this app should state the rule it uses.", "engine", {term:"Orb",def:"Distance from the exact aspect angle"}),
      C("An applying aspect is moving toward exactness; a separating aspect has passed exactness and is moving apart. This describes relative motion at the time being calculated.", "engine", {term:"Applying and separating",def:"Moving toward or away from exactness"}),
      C("A quincunx is approximately 150 degrees and is often interpreted as a need to adjust between unlike functions. Its use varies among astrological schools.", "app", {term:"Quincunx",def:"A 150-degree aspect often read as adjustment"}),
      C("A semisextile is approximately 30 degrees; a semisquare 45 degrees; a sesquiquadrate 135 degrees. These minor aspects are used with smaller orbs and less agreement.", "app", {term:"Minor aspects",def:"Additional angular relationships with more variable use"}),
      C("A tight aspect is closer to exact than a wide one. Prioritize the closest major aspects before interpreting every possible minor connection.", "app", {term:"Aspect priority",def:"Weighing close aspects before wide or minor ones"})
    ], put: { prompt: "Find your closest natal aspect. Record its orb and whether it is applying or separating, then explain why closeness affects its priority.", fields: ["Aspect and orb", "Applying or separating", "Why it stands out"] } },
    { id: "sky.whole.ruler", title: "Chart ruler and planetary rulership", cards: [
      C("The chart ruler is the planet that rules the sign on the Ascendant. It is a traditional organizing point for reading the chart as a whole.", "app", {term:"Chart ruler",def:"Planetary ruler of the Ascendant sign"}),
      C("Traditional rulership assigns Aries to Mars, Taurus and Libra to Venus, Gemini and Virgo to Mercury, Cancer to the Moon and Leo to the Sun.", "ptolemy", {term:"Traditional personal rulerships",def:"Mars, Venus, Mercury, Moon and Sun rule the corresponding signs"}),
      C("Traditional rulership assigns Sagittarius and Pisces to Jupiter, and Capricorn and Aquarius to Saturn. Modern astrologers often add Neptune, Uranus and Pluto as co-rulers.", "ptolemy", {term:"Jupiter and Saturn rulerships",def:"Jupiter traditionally rules Sagittarius and Pisces; Saturn rules Capricorn and Aquarius"}),
      C("Read the chart ruler by its sign, house, aspects and condition. Its placement describes where the chart's central approach is symbolically directed.", "app", {term:"Chart ruler placement",def:"The chart ruler's sign, house and aspects"}),
      C("A chart ruler in a difficult aspect does not mean a bad life. It is one symbolic tension among many and should be read with strengths, choices and context.", "app", {term:"Responsible interpretation",def:"A chart placement is not a verdict or fate"})
    ], put: { prompt: "Find your Ascendant sign and traditional chart ruler. Where is that planet placed, and what does that suggest as a recurring life theme?", fields: ["Ascendant sign", "Chart ruler", "Sign and house", "Your interpretation"] } },
    { id: "sky.whole.synthesis", title: "Synthesis: read combinations, not labels", cards: [
      C("Start with the Big Three and chart ruler, then note planets close to the angles. This establishes the chart's main symbolic anchors before adding detail.", "app", {term:"First pass",def:"Big Three, chart ruler and angular planets"}),
      C("For each placement, combine planet, sign, house and closest aspects. This answers what function is emphasized, how it is expressed, where it appears and what modifies it.", "app", {term:"Placement synthesis",def:"Planet plus sign plus house plus aspects"}),
      C("Look for repetition: several placements in one element, modality, house or aspect pattern. Repeated themes deserve more attention than an isolated minor detail.", "app", {term:"Repeated themes",def:"Patterns repeated across several chart factors"}),
      C("When chart symbols conflict, describe the tension rather than erasing one side. Someone may value stability and still need independence; both can be true in different settings.", "app", {term:"Holding tension",def:"Describing apparently conflicting needs without forcing one label"}),
      C("A useful interpretation ends with a reflective question and a practical choice. It should not claim certainty about personality, history, health or future events.", "app", {term:"Reflective conclusion",def:"A grounded question and practical choice rather than a prediction"})
    ], put: { prompt: "Write a short reading using at least three chart factors. Include one strength, one tension and one practical reflection question.", fields: ["Three factors", "Strength", "Tension", "Reflection question"] } },
    { id: "sky.transits.cycles", title: "Longer cycles: Saturn, Jupiter and eclipses", cards: [
      C("A Saturn return occurs when transiting Saturn returns to approximately its natal position, usually around ages 29–30, 58–60 and 88–90. Astrologers interpret it as a period for responsibility and reassessment.", "app", {term:"Saturn return",def:"Saturn's return to its natal position about every 29.5 years"}),
      C("Jupiter takes roughly twelve years to orbit the Sun, so Jupiter returns occur around ages 12, 24, 36 and onward. Astrologers associate them with growth, learning and renewed opportunity.", "engine", {term:"Jupiter return",def:"Jupiter's return to its natal position about every 12 years"}),
      C("Eclipses are astronomical alignments involving the Sun, Earth and Moon near the lunar nodes. Their dates are calculable; the meanings assigned to them in astrology are symbolic and vary by school.", "engine", {term:"Eclipse",def:"An alignment involving the Sun, Earth and Moon"}),
      C("A cycle can be used as a reflection calendar, not a forecast of unavoidable crisis. The app must never tell a user that a transit guarantees illness, separation, disaster or loss.", "app", {term:"Non-deterministic timing",def:"Using cycles as reflection prompts rather than guaranteed events"}),
      C("The date, time zone, moving planet, natal point, aspect and orb should be visible in a transit report. That lets a learner inspect the calculation instead of trusting a dramatic sentence.", "engine", {term:"Transit transparency",def:"Showing the data behind a transit interpretation"})
    ], put: { prompt: "Choose one upcoming or recent cycle. Separate the astronomical timing from the traditional interpretation and write a grounded question.", fields: ["Cycle", "Calculated fact", "Traditional meaning", "Reflection question"] } },
    { id: "sky.compatibility", title: "Compatibility: all twelve signs with nuance", cards: [
      C("A Sun-sign pairing is a first-pass comparison, not full synastry. Compare Moon, Venus, Mars, Ascendant, seventh-house factors and inter-chart aspects for a fuller picture.", "app", {term:"Sun-sign compatibility",def:"A limited first-pass comparison using only two Sun signs"}),
      C("Water and Earth signs are often described as mutually supportive in element-based astrology: Water emphasizes feeling and Earth emphasizes steadiness. This is a symbolic convention, not a rule about actual couples.", "app", {term:"Water and Earth",def:"A traditional element pairing emphasizing feeling and grounding"}),
      C("Fire and Air are often described as mutually energizing: Fire emphasizes initiative and Air emphasizes ideas and exchange. Differences in pace and emotional expression still need communication.", "app", {term:"Fire and Air",def:"A traditional element pairing emphasizing energy and ideas"}),
      C("Opposite signs can be interpreted as complementary polarities, but opposition does not guarantee attraction or compatibility. The rest of both charts and the real relationship matter.", "app", {term:"Opposite signs",def:"A symbolic polarity that may invite balance, not a guaranteed match"}),
      C("A healthy relationship depends on consent, safety, trust, shared values, communication and repair. No chart score should be used to excuse disrespect or override someone's choices.", "app", {term:"Relationship reality check",def:"Observed behavior, consent, safety and mutual respect"})
    ], put: { prompt: "Compare two Sun signs, then list what you would need to know before making a full synastry interpretation.", fields: ["Sun-sign themes", "What seems complementary", "What needs communication", "Missing chart information"] } },
    { id: "sky.synastry", title: "Synastry: comparing two complete charts", cards: [
      C("Synastry compares two natal charts by examining aspects between planets and angles, as well as the way one person's planets fall into the other's houses.", "app", {term:"Synastry",def:"A comparison of two natal charts"}),
      C("Moon contacts can be used to explore emotional rhythms and comfort; Venus contacts affection and values; Mars contacts desire and conflict; Saturn contacts responsibility and limits.", "app", {term:"Personal-planet contacts",def:"Moon for needs, Venus for affection, Mars for action and Saturn for commitment"}),
      C("House overlays describe which life areas one person's planets activate in the other's chart. House overlays depend on reliable birth times and the selected house system.", "app", {term:"House overlay",def:"One person's planet placed in another person's house"}),
      C("A close aspect may feel significant in a reading, but it does not establish whether a relationship is healthy. Observe consistency, accountability, boundaries and how conflict is repaired.", "app", {term:"Behavioral evidence",def:"Real-world behavior used to evaluate relationship health"}),
      C("If a birth time is unknown, label angles and house overlays as unavailable or uncertain. Do not silently calculate them as though the time were exact.", "engine", {term:"Unknown birth time",def:"Do not treat Ascendant, angles or houses as exact"})
    ], put: { prompt: "Plan a synastry reading. List the birth data needed, the placements you would compare and the real-world questions that matter more than a score.", fields: ["Birth information", "Planet contacts", "House overlays", "Relationship questions"] } },
    { id: "sky.growth", title: "Maturity, boundaries and fulfillment", cards: [
      C("A placement's strength can become an overuse under stress. Sensitivity can support empathy but may need boundaries; independence can support initiative but may become isolation.", "app", {term:"Strength and overuse",def:"A resource that can become unbalanced under stress"}),
      C("Read the sixth house and its ruler for routines and daily maintenance, the fifth for joy and creative expression, the ninth for meaning and learning, and the eleventh for community and shared aims.", "lilly", {term:"Life-area reflection",def:"Using houses as symbolic prompts for routines, joy, meaning and community"}),
      C("The second and eighth houses are traditionally used to explore personal and shared resources. They should prompt practical reflection, not financial certainty or advice to take risks.", "lilly", {term:"Resources",def:"Personal resources in the second and shared resources in the eighth"}),
      C("The fourth house and IC can prompt reflection on privacy, roots and belonging. They cannot prove a person's family history or establish that a particular event occurred.", "lilly", {term:"Private foundations",def:"Home, roots and private life as symbolic themes"}),
      C("Fulfillment is tested in lived experience. Ask which activities align with your values, strengthen relationships, support wellbeing and leave room for rest and agency.", "app", {term:"Fulfillment",def:"A lived assessment of values, wellbeing, connection and agency"})
    ], put: { prompt: "Choose one chart theme and translate it into a small real-world experiment for the next week. Record what actually helps.", fields: ["Chart theme", "Small experiment", "What I noticed", "What I will change"] } },
    { id: "sky.numerology", title: "Numerology and your natal chart", cards: [
      C("Pythagorean numerology assigns values to letters and reduces totals using a stated method. Common calculations include Life Path from the birth date and Expression from the full birth name.", "app", {term:"Pythagorean numerology",def:"A symbolic number system assigning values to letters and dates"}),
      C("Life Path is commonly calculated from the birth date. The app should display each reduction step and state whether it preserves 11, 22 and 33 as master numbers.", "app", {term:"Life Path",def:"A birth-date calculation using a stated reduction rule"}),
      C("Expression uses all letters of the full birth name; Soul Urge uses vowels; Personality uses consonants. If the full birth name is missing, these name-based numbers must not be guessed.", "app", {term:"Name-based numbers",def:"Expression from all letters, Soul Urge from vowels, Personality from consonants"}),
      C("Personal Year, Month and Day numbers use the birth month and day with the current calendar period, following the app's stated reduction method. They are numerology, not planetary positions.", "app", {term:"Personal cycles",def:"Numerology calculations for a year, month or day"}),
      C("Astrology, tarot and numerology have different histories and methods. A journal can place their symbolic themes side by side while clearly labeling calculated astronomy, number arithmetic and personal reflection.", "app", {term:"Integrated journal",def:"A clearly labeled reflection connecting separate symbolic systems"})
    ], put: { prompt: "Calculate your Life Path and Personal Day using the app's method. Compare the number theme with a chart placement and write your own interpretation.", fields: ["Life Path calculation", "Personal Day calculation", "Chart placement", "Your reflection"] } },
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
