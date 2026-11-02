/* Tarot Journey — Compatibility story. Turns TarotCompat.compute() output into plain paragraphs, tips and warnings.
   Uses only computed values and the knowledge base (compat-kb.js). No verdict, no score, no predictions.
   Works in the browser (window.TarotCompatStory) and in Node (tests). */
(function (root) {
  "use strict";
  const PLAIN = { Sun: "sense of self", Moon: "emotional needs", Mercury: "way of talking and thinking", Venus: "way of showing affection",
    Mars: "drive and temper", ASC: "first impression", MC: "public direction", Jupiter: "optimism", Saturn: "sense of duty and limits", Node: "long-term direction" };
  const NAME = { ASC: "Ascendant", MC: "Midheaven", Node: "North Node" };
  const nm = (p) => NAME[p] || p;
  const TIP_EASY = {
    Moon: "Use it: when one of you is upset, the other tends to read it well. Let them help.",
    Mercury: "Use it: hard conversations go better between you than with most people. Have them early.",
    Venus: "Use it: say out loud what you like about each other. It lands.",
    Mars: "Use it: do physical or practical things together. You work well side by side.",
    Sun: "Use it: back each other’s goals openly.",
    Saturn: "Use it: make real plans together. Commitments between you tend to hold.",
    Node: "Use it: talk about where each of you wants to be in five years.",
    ASC: "Use it: you read each other quickly. Check that first read now and then.",
  };
  const WARN_HARD = {
    Moon: "Watch for: assuming the other person feels what you feel. Ask instead.",
    Mercury: "Watch for: arguing about how something was said instead of what was said.",
    Venus: "Watch for: one of you feeling under-appreciated without saying so.",
    Mars: "Watch for: quick flare-ups. Agree on a pause word before you need one.",
    Sun: "Watch for: competing for the lead. Take turns on purpose.",
    Saturn: "Watch for: one of you becoming the critic. Say what is working, not only what isn’t.",
    Node: "Watch for: plans that quietly pull in different directions. Compare them out loud.",
    ASC: "Watch for: first reactions that come across harsher than meant.",
  };
  const pickKey = (r) => ["Moon", "Mercury", "Venus", "Mars", "Saturn", "Node", "Sun", "ASC"].find((k) => r.a === k || r.b === k) || "Sun";
  const kbPair = (kb, a, b) => (kb && kb.pairs || []).find((p) => { const [x, y] = p.pair.split("–"); return (x === a && y === b) || (x === b && y === a); });

  function story(res, kb) {
    kb = kb || root.TAROT_COMPAT_KB || null;
    const [A, B] = res.people.map((p) => p.name || "You");
    const sec = Object.fromEntries(res.sections.map((s) => [s.id, s]));
    const paras = [], tips = [], warnings = [];
    const rows = ((sec.synastry || {}).data || {}).rows || [];
    const easy = rows.filter((r) => r.tone === "easy").slice(0, 2), hard = rows.filter((r) => r.tone === "hard").slice(0, 2);

    // 1. what this is built from
    const known = res.people.map((p) => `${p.name}: ${p.hasTime ? "birth time known" : "no birth time"}${p.hasPlace ? ", place known" : ""}`).join("; ");
    paras.push({ id: "open", title: `${A} and ${B}`, text: `I worked this out from both birth charts (${known}). ${rows.length} contacts between your charts are close enough to count. I’ll go through the strongest ones, then the ones to watch.` + (res.timeNotes.length ? " " + res.timeNotes.join(" ") : ""), info: "synastry" });

    // 2. easy contacts
    for (const r of easy) {
      const kp = kbPair(kb, r.a, r.b), asp = kb && kb.aspects && kb.aspects[r.aspect];
      paras.push({ id: "easy-" + r.pair, title: `${A}’s ${nm(r.a)} and ${B}’s ${nm(r.b)}`, info: "synastry",
        text: `${A}, your ${PLAIN[r.a] || nm(r.a)} and ${B}’s ${PLAIN[r.b] || nm(r.b)} are ${r.orb}° from an exact ${r.aspect}${r.approximate ? " (approximate, because a birth time is missing)" : ""}. ${asp ? asp.compat.split(";")[0] + "." : ""} ${kp ? "Astrologers read this pairing as " + kp.theme.split(";")[0] + "." : ""}`.replace(/\s+/g, " ").trim() });
      tips.push(TIP_EASY[pickKey(r)]);
    }
    // 3. hard contacts
    for (const r of hard) {
      const kp = kbPair(kb, r.a, r.b);
      paras.push({ id: "hard-" + r.pair, title: `${A}’s ${nm(r.a)} and ${B}’s ${nm(r.b)}`, info: "synastry",
        text: `${B}, your ${PLAIN[r.b] || nm(r.b)} rubs against ${A}’s ${PLAIN[r.a] || nm(r.a)}: a ${r.aspect}, ${r.orb}° from exact${r.approximate ? " (approximate)" : ""}. ${kp ? "In the tradition this pairing is about " + kp.theme.split(";")[0] + "." : "Treat it as a pressure point you both know about."}`.replace(/\s+/g, " ").trim() });
      warnings.push(WARN_HARD[pickKey(r)]);
    }
    // 4. Moon
    if (sec.moon) { paras.push({ id: "moon", title: "Feeling safe", info: "moon", text: `${sec.moon.summary} ${sec.moon.friction[0] || ""}`.trim() }); if (sec.moon.advice[0]) tips.push(sec.moon.advice[0]); }
    // 5. elements
    if (sec.balance) { paras.push({ id: "balance", title: "Your mix of elements", info: "balance", text: `${sec.balance.summary} ${sec.balance.friction[0] || sec.balance.strengths[0] || ""}`.trim() }); if (sec.balance.advice[0]) tips.push(sec.balance.advice[0]); }
    // 6. Saturn / Node
    if (sec["saturn-node"]) { const s = sec["saturn-node"]; paras.push({ id: "saturn", title: "Commitment and direction", info: "saturn-node", text: `${s.summary} ${s.friction[0] && !/^No notable/.test(s.friction[0]) ? s.friction[0] : s.strengths[0] || ""}`.trim() }); if (s.advice[0]) tips.push(s.advice[0]); }
    // 7. other traditions, kept separate
    const other = ["numerology", "tarot", "chinese"].filter((k) => sec[k]).map((k) => `${sec[k].title}: ${sec[k].summary}`);
    if (other.length) paras.push({ id: "other", title: "Other traditions", info: "numerology", text: other.join(" ") + " Each of these is its own system; I don’t add them up." });
    // 8. close: no verdict
    paras.push({ id: "close", title: "What to do with this", info: "details",
      text: `None of this decides anything for you two. Use the tips below as conversation starters. ${res.disclaimer}` });

    const uniq = (xs) => [...new Set(xs.filter(Boolean))];
    return { paras, tips: uniq(tips).slice(0, 5), warnings: uniq(warnings).slice(0, 4), heat: heat(rows), people: [A, B] };
  }

  // heatmap: strongest contact per (A planet, B planet), signed by tone
  const HP = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Saturn"];
  function heat(rows) {
    const g = HP.map(() => HP.map(() => null));
    for (const r of rows) { const i = HP.indexOf(r.a), j = HP.indexOf(r.b); if (i < 0 || j < 0) continue;
      const v = (r.tone === "hard" ? -1 : r.tone === "easy" ? 1 : 0.5) * r.tightness;
      if (!g[i][j] || Math.abs(v) > Math.abs(g[i][j].v)) g[i][j] = { v: Math.round(v * 100) / 100, aspect: r.aspect, orb: r.orb }; }
    return { planets: HP, grid: g };
  }

  const api = { story, heat, PLAIN };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TarotCompatStory = api;
})(typeof window !== "undefined" ? window : globalThis);
