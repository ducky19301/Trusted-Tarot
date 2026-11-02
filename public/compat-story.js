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

  // ---- v8 narrative: Astro tells the story in the first person, theme by theme, from computed contacts only ----
  const has = (r, x, y) => (r.a === x && r.b === y) || (r.a === y && r.b === x);
  const anyOf = (rows, pairs) => rows.filter((r) => pairs.some(([x, y]) => has(r, x, y)));
  const toneOf = (rs) => { let e = 0, h = 0; for (const r of rs) { const w = r.tightness || 0.5; if (r.tone === "easy") e += w; else if (r.tone === "hard") h += w; else e += w / 2; } return !rs.length ? "none" : Math.min(e, h) >= 0.6 * Math.max(e, h) || (e >= 0.8 && h >= 0.8) ? "mixed" : h > e ? "hard" : "easy"; };
  const RES = { // research the tips lean on; status comes from the knowledge base so the label stays honest
    g92: "gottman_levenson_1992", joel: "joel_2020", hs: "hazan_shaver_1987", g7: "gottman_7", horse: "gottman_horsemen" };

  function story(res, kb) {
    kb = kb || root.TAROT_COMPAT_KB || null;
    const [A, B] = res.people.map((p, i) => p.name || (i ? "your partner" : "you"));
    const sec = Object.fromEntries(res.sections.map((s) => [s.id, s]));
    const rows = ((sec.synastry || {}).data || {}).rows || [];
    const sat = (((sec["saturn-node"] || {}).data || {}).rows) || [];
    const all = rows.concat(sat.filter((s) => !rows.some((r) => r.pair === s.pair)));
    const paras = [], tips = [], warnings = [];
    const add = (id, title, info, text, basis, tip, warn) => { paras.push({ id, title, info, text: text.replace(/\s+/g, " ").trim(), basis: basis.map((r) => r.pair || r).filter(Boolean) }); if (tip) tips.push(tip); if (warn) warnings.push(warn); };
    const side = (r, planet) => (r.a === planet ? A : B); // who holds that planet in a contact

    // 1. feeling safe (Moon)
    const feel = anyOf(all, [["Moon", "Moon"], ["Moon", "Sun"], ["Moon", "Venus"], ["Moon", "ASC"]]);
    const mt = toneOf(feel), md = (sec.moon || {}).data || {}, near = md.steps != null && (md.steps === 0 || md.steps === 4 || md.steps === 2);
    const noTime = res.people.filter((p) => !p.hasTime).map((p) => p.name || "one of you");
    const openNote = noTime.length ? ` ${noTime.join(" and ")}’s birth time is unknown, so a few details are approximate; the (i) buttons show exactly which.` : "";
    let t1 = `${A}, ${B}, I’m Astro, and this is your reading. I built it from both birth charts and only from what they actually show.${openNote} `;
    if (mt === "easy" || (mt === "none" && near)) t1 += `Emotionally, you two need similar things. When one of you is upset, the other usually reads it well and knows how to settle it. ${A}, ${B} tends to feel accepted around you; ${B}, ${A} tends to relax around you without trying. This is the most dependable part of your connection.`;
    else if (mt === "hard") t1 += `Emotionally, you two run on different settings. What soothes ${A} can feel like too much or too little to ${B}, and the other way round. Neither of you is wrong; you just can’t assume the other feels what you feel. This is the part of your connection that needs the most asking out loud.`;
    else t1 += `Emotionally, you overlap in some places and miss each other in others. Some days one of you knows exactly what the other needs; other days the same gesture lands flat. ${md.a && md.b ? `${A}’s Moon in ${md.a} and ${B}’s in ${md.b} describe two different ways of feeling looked after.` : ""}`;
    add("moon", "Feeling safe", "moon", t1, feel, mt === "hard" ? "Each of you finishes the sentence “I feel looked after when…” and you compare answers. Then do one thing on the other’s list this week." : "When one of you is low, let the other help instead of handling it alone. Leaning on each other is how secure couples work.", mt === "hard" ? "Watch for: guessing at each other’s feelings. Ask, even when it feels obvious." : null);

    // 2. how you talk and argue (Mercury, Mars)
    const talk = anyOf(all, [["Mercury", "Mercury"], ["Mercury", "Mars"], ["Mars", "Mars"], ["Mars", "Moon"], ["Mercury", "Moon"], ["Sun", "Mars"], ["Mercury", "Sun"]]);
    const tt = toneOf(talk), hot = talk.find((r) => r.tone === "hard" && (r.a === "Mars" || r.b === "Mars")) || talk.find((r) => r.tone === "hard");
    const fiery = hot ? side(hot, hot.a === "Mars" || hot.b === "Mars" ? "Mars" : hot.a) : null, cool = fiery === A ? B : A;
    let t2;
    if (tt === "hard" || tt === "mixed" && hot) t2 = `You two argue more than most, and your arguments follow a pattern. ${fiery} tends to bring things up fast and with heat. ${cool} tends to answer with reasons, or to go quiet. ${fiery} hears “you don’t care,” ${cool} hears “you’re attacking me,” and both of you dig in. The tip that works for pairs like you: whoever raised the issue talks for two minutes without interruption, the other repeats it back, and only then does anyone try to fix it. And the warning that matters most: in long-term studies, the couples who split up were not the ones who fought, they were the ones who stayed defensive and shut down during fights.`;
    else if (tt === "easy") t2 = `Talking is one of your strengths. You tend to follow each other’s thinking, and even a disagreement between you usually stays a conversation instead of a fight. The risk is a quieter one: because talking is easy, you can skip the hard topics until they pile up. Bring them up early, while they’re still small.`;
    else t2 = `When you disagree, neither of you is likely to explode, and neither is likely to give in quickly either. Arguments between you can go in circles. It helps to say at the start what you each actually want from the conversation: to be heard, or to decide something.`;
    add("talk", "How you talk and argue", "synastry", t2, talk, tt === "easy" ? "Put hard topics on the table early, while they’re still small." : "When one of you raises something, the other repeats it back before answering.", tt === "easy" ? "Watch for: small things left unsaid until they pile up." : "Watch for: defensiveness and shutting down mid-argument. In research those predict breakups far more than arguing does.");

    // 3. attraction and closeness (Venus, Mars)
    const pull = anyOf(all, [["Venus", "Mars"], ["Venus", "Venus"], ["Mars", "Moon"], ["Venus", "Moon"], ["Venus", "Sun"]]);
    const pt = toneOf(pull), vm = pull.filter((r) => has(r, "Venus", "Mars"));
    const reacher = (pull.find((r) => r.a === "Venus" || r.b === "Venus") ? side(pull.find((r) => r.a === "Venus" || r.b === "Venus"), "Venus") : A), roomy = reacher === A ? B : A;
    let t3;
    if (pt === "hard" || pt === "mixed") t3 = `The attraction between you is real${vm.length ? " and strong" : ""}, and so is the push-pull that comes with it. ${reacher} tends to want closeness and show it openly. ${roomy} tends to want love with room to breathe. When ${reacher} reaches and ${roomy} pulls back, ${reacher} can feel rejected and reach harder, and ${roomy} withdraws further. The tip: ${roomy} says “I need an hour, then I’m back,” and comes back on time, and ${reacher} lets the hour happen. Saying what you appreciate about each other out loud, often, matters too: feeling appreciated is one of the strongest predictors of a happy relationship.`;
    else if (pt === "easy") t3 = `Affection comes easily between you. The way ${A} shows love tends to land with ${B}, and the other way round, and the attraction feels natural rather than dramatic. Easy can turn into taken-for-granted, though. Saying what you appreciate about each other out loud, often, keeps it warm; feeling appreciated is one of the strongest predictors of a happy relationship.`;
    else t3 = `Your charts don’t say much about attraction either way, which is neutral, not a problem. Closeness between you will come from what you do more than from a spark. Saying what you appreciate about each other out loud, often, is one of the strongest predictors of a happy relationship.`;
    add("pull", "Attraction and closeness", "venus-mars", t3, pull, "Say one thing you appreciate about the other out loud every day.", pt === "easy" || pt === "none" ? null : "Watch for: reading a need for space as rejection, or disappearing without a word.");

    // 4. day to day (elements and modalities)
    const bd = (sec.balance || {}).data;
    if (bd) {
      const plan = (x) => (x.elements.Earth || 0) + (x.modalities.Fixed || 0) + (x.modalities.Cardinal || 0) / 2 - (x.elements.Fire || 0) - (x.modalities.Mutable || 0);
      const pa = plan(bd.a), pb = plan(bd.b), planner = pa >= pb ? A : B, impro = planner === A ? B : A, gap = Math.abs(pa - pb);
      const social = (x) => (x.elements.Fire || 0) + (x.elements.Air || 0) - (x.elements.Water || 0) - (x.elements.Earth || 0);
      const sa = social(bd.a), sb = social(bd.b), out = sa >= sb ? A : B, home = out === A ? B : A;
      let t4 = gap >= 3 ? `Day to day, ${planner} is the planner and ${impro} is the improviser. ${planner} sets something up, ${impro} changes it halfway, and ${planner} can quietly resent it, especially with money and trips. The tip: agree on the fixed parts first (budget, dates) and leave the rest open for ${impro}, and let any shared purchase over an agreed amount wait 48 hours.` : `Day to day, you run at a similar pace. You tend to plan, or not plan, in the same way, which saves a lot of friction. The thing to watch is that you can share the same blind spot, so let an outside deadline or a friend’s nudge cover what neither of you naturally does.`;
      t4 += Math.abs(sa - sb) >= 3 ? ` Free time runs the same way: ${home} tends to want quiet nights in, ${out} tends to want people. Pairs like you do best when they pick in advance, one social night and one quiet one, without counting who gave in last.` : ` You also tend to want the same kind of free time, which makes weekends easier than for most couples.`;
      add("daily", "Day to day", "balance", t4, ["elements", "modalities"], gap >= 3 ? "Agree the fixed parts of a plan first (budget, dates); leave the rest open." : "Pick one thing neither of you does naturally and give it a date.", gap >= 3 ? "Watch for: quiet resentment over changed plans and money. Say it the same day." : null);
    }

    // 5. who steers (Saturn, Sun)
    const lead = anyOf(all, [["Saturn", "Sun"], ["Saturn", "Moon"], ["Saturn", "Venus"], ["Saturn", "Mercury"], ["Saturn", "Mars"], ["Sun", "Sun"]]);
    const lh = lead.filter((r) => r.tone === "hard"), le = lead.filter((r) => r.tone !== "hard");
    if (lh.length) { const s = lh.find((r) => r.a === "Saturn" || r.b === "Saturn"); const crit = s ? side(s, "Saturn") : A, quiet = crit === A ? B : A;
      add("lead", "Who steers", "saturn-node", `There’s a power imbalance to watch. ${crit} tends to steer decisions and can come across as critical without noticing. ${quiet} tends to go along and then build resentment in silence. The tip: ${crit} asks “do you want my opinion?” before giving it and asks for ${quiet}’s view first, and ${quiet} says no out loud when the answer is no. ${crit} takes commitment seriously, and ${quiet} will value that once it stops feeling like judgment.`, lh, `${crit} asks for ${quiet}’s view before giving their own.`, "Watch for: criticism of the person instead of the problem. Say “I’d like…” instead of “you always…”.");
    } else if (le.length) add("lead", "Who steers", "saturn-node", `Decisions between you tend to feel shared. Neither of you is likely to take over, and commitments you make together tend to hold. Keep it that way by saying out loud when you’d like the other to take the lead, instead of assuming.`, le, "Make one real plan together this month and write it down.", null);

    // 6. what you build together
    const easyAll = all.filter((r) => r.tone === "easy"), node = all.filter((r) => r.a === "Node" || r.b === "Node");
    const comp = (sec.composite || {}).details || [];
    add("together", "What you build", sec.composite ? "composite" : "synastry", `Together, you two ${easyAll.length >= 4 ? "are steadier than either of you is alone" : "have to build your steadiness on purpose, and that is very doable"}. ${comp[0] ? comp[0].replace(/^Composite Sun in [A-Za-z]+ \((\w+)\): the relationship’s purpose leans toward/, "Your relationship leans toward").replace(/\.$/, "") + ", and it also needs fun and rest to stay warm." : ""} ${node.length ? "Your charts also point at a shared direction: talk about where each of you wants to be in five years, because you are likely to want overlapping things." : ""} A small habit that helps: once a month, ask each other, “What do you need from me this month?” and answer honestly.`, easyAll.concat(node), "Once a month, ask “What do you need from me this month?”", null);

    // 7. close: no verdict
    add("close", "What decides it", "details", `It works if you two put deliberate effort into how you argue, how you share space and how you split decisions, and it wears down if you don’t. I’m describing patterns, not fate. What decides how this goes is whether you both feel committed, feel appreciated and repair after fights, and that part is entirely yours. ${res.disclaimer || ""}`, [], null, null);

    const uniq = (xs) => [...new Set(xs.filter(Boolean))];
    const research = Object.values(RES).map((k) => kb && kb.sources && kb.sources[k] && Object.assign({ key: k }, kb.sources[k])).filter(Boolean);
    return { by: "Astro", paras, tips: uniq(tips).slice(0, 5), warnings: uniq(warnings).slice(0, 4), heat: heat(rows), people: [A, B], contacts: rows.length, research };
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
