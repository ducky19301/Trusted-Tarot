/* v23 Cohesive reading: all cards of one reading read together, plus the same person's last 2-4 readings.
   Built ONLY from data already in the app: cards.json (upright/reversed text, keywords, number, element, suit,
   "In a spread" notes, Waite lines, sit-with prompts), PRACTICE_DATA (number themes per suit, court stages),
   the spread's position meanings, the person's own saved readings and intentions.
   The combining steps are this app's own method and are labelled "Our method". No narrator, no verdicts. */
(() => {
  "use strict";
  const W = typeof window !== "undefined" ? window : globalThis;
  const ELEM = { Wands: ["Fire", "drive, ambition, creative energy"], Cups: ["Water", "feelings, relationships, intuition"], Swords: ["Air", "thoughts, words, conflict and decisions"], Pentacles: ["Earth", "money, body, work and practical life"] };
  const REV_WAYS = "This app reads a reversal three ways: blocked (it can't get through), delayed (not yet) or overdone (too much of it).";
  const sents = (t) => String(t || "").split(/(?<=[.?!])\s+(?=[A-Z“"'])/).filter(Boolean);
  const first = (t, n) => sents(t).slice(0, n).join(" ");
  const isRev = (o) => /^rev/i.test(String(o || ""));
  const lc = (s) => String(s || "").toLowerCase();
  const list = (a) => a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const nm = (r) => r.card.name + (isRev(r.orientation) ? " (reversed)" : "");
  const nm2 = (r) => r.card.name + (isRev(r.orientation) ? ", reversed" : "");
  const kw = (r, n = 3) => ((r.card.keywords || {})[isRev(r.orientation) ? "reversed" : "upright"] || []).slice(0, n);
  const pipNum = (c) => c.arcana === "major" ? null : (/^Ace/.test(c.name) ? 1 : (+c.number >= 1 && +c.number <= 10 ? +c.number : null));
  const court = (c) => c.arcana !== "major" && !pipNum(c) ? (c.name.match(/^(Page|Knight|Queen|King)/) || [])[1] : null;

  /* intention: new field (v23) first, then the older ways it was kept */
  function intentOf(e) {
    if (!e) return null;
    if (e.intent && String(e.intent.text || "").trim()) return { type: e.intent.type === "question" ? "question" : "intention", text: String(e.intent.text).trim() };
    if (String(e.intention || "").trim()) return { type: "intention", text: String(e.intention).trim() };
    if (String(e.question || "").trim()) return { type: "question", text: String(e.question).trim() };
    const m = String(e.notes || e.note || "").match(/^(Intention|Question):\s*(.+)$/m);
    return m ? { type: lc(m[1]), text: m[2].trim() } : null;
  }

  /* past readings: same person only (the caller passes ONE person's list), before this date, newest first */
  function pickPast(list_, beforeDate, opts = {}) {
    const max = opts.max || 4, ex = new Set(opts.exclude || []);
    const all = (list_ || []).filter((e) => e && e.date && e.date < beforeDate && (e.cards || []).length)
      .sort((a, b) => (b.date + (b.created_at || "")).localeCompare(a.date + (a.created_at || ""))).slice(0, max);
    return { offered: all, used: all.filter((e) => !ex.has(e.id || e.date)) };
  }

  function resolve(cards, kb) {
    const byName = new Map(kb.cards.map((c) => [lc(c.name), c])), byId = new Map(kb.cards.map((c) => [c.id, c]));
    return (cards || []).map((x) => ({ card: byId.get(x.id) || byName.get(lc(x.name)), orientation: x.orientation, position: x.position || "", pm: x.pm || (kb.posMeanings || {})[x.position] || "" })).filter((r) => r.card);
  }

  function build(input, kb) {
    const rows = resolve(input.cards, kb), intent = input.intent && String(input.intent.text || "").trim() ? input.intent : null;
    const past = (input.past || []).map((e) => ({ date: e.date, intent: intentOf(e), rows: resolve(e.cards, kb) })).filter((e) => e.rows.length);
    const NUM = kb.numbers || [], COURTS = kb.courts || [];
    const secs = [], qs = [], used = new Set(["app"]);
    const you = input.person && input.person.kind === "guest" ? input.person.name : "you";
    const yourQ = intent ? `“${intent.text}”` : "";

    /* 1. what this reading is about */
    secs.push({ id: "about", title: intent ? (intent.type === "question" ? "Your question" : "Your intention") : "A general reading", label: "From your entry",
      paras: [intent ? `This reading was pulled for ${yourQ}. Each card below is read against that, in the order of the spread.`
        : `No intention or question was set, so this is a general reading: what the ${rows.length} card${rows.length > 1 ? "s" : ""} show about where things stand for ${you} right now.`] });

    /* 2. card by card, in its position */
    const cardParas = rows.map((r, i) => {
      const rev = isRev(r.orientation), c = r.card, ws = (c.waite || {})[rev ? "reversed" : "upright"];
      const pos = r.position ? `In the ${r.position} position${r.pm ? ` (${r.pm})` : ""}, ` : `As card ${i + 1}, `;
      let p = `${pos}${nm(r)}: ${first(rev ? c.reversed : c.upright, 3)}`;
      if (intent && kw(r).length) p += ` Held against ${yourQ}, its key words here are ${list(kw(r))}.`;
      if (rev) p += ` ${REV_WAYS} If it were upright it would read: ${first(c.upright, 1)}`;
      if (ws) { p += ` Waite's ${rev ? "reversed" : "upright"} line: “${ws}”`; used.add("pkt"); }
      return p;
    });
    secs.push({ id: "cards", title: "Card by card", label: "Our text · Waite, Pictorial Key (Part III)", paras: cardParas });

    /* 3. how the cards connect (our method, using the app's correspondences) */
    const con = [];
    if (rows.length > 1) {
      const flow = rows.map((r) => `${r.position ? r.position.toLowerCase() + ": " : ""}${nm2(r)} (${list(kw(r, 2))})`);
      con.push(`Read in order, the spread runs ${flow.join(", then ")}. Each card answers its own position's question, so read them as one sentence that runs in that order.`);
      const els = {}; rows.forEach((r) => { const e = r.card.arcana === "major" ? String(r.card.element || "").split(" ")[0] : (ELEM[r.card.suit] || [])[0]; if (e) (els[e] = els[e] || []).push(r.card.name); });
      const eKeys = Object.keys(els);
      if (eKeys.length) con.push(`Elements present: ${eKeys.map((e) => `${e} (${els[e].join(", ")})`).join("; ")}. ${eKeys.map((e) => { const s = Object.values(ELEM).find((x) => x[0] === e); return s ? `${e} covers ${s[1]}` : ""; }).filter(Boolean).join("; ")}.${eKeys.length === 1 ? " Everything sits in one element, so the whole reading stays in that area of life." : ""}`);
      const suits = {}; rows.forEach((r) => r.card.suit && (suits[r.card.suit] = (suits[r.card.suit] || 0) + 1));
      Object.entries(suits).filter(([, n]) => n > 1).forEach(([s, n]) => con.push(`${n} cards are ${s}, so ${ELEM[s] ? ELEM[s][1] : "that suit's subject"} is the main subject here.`));
      const majors = rows.filter((r) => r.card.arcana === "major");
      if (majors.length) con.push(`${majors.length} of ${rows.length} cards ${majors.length === 1 ? "is a Major card" : "are Major cards"} (${majors.map(nm).join(", ")}). In this app's lessons, Majors mark the larger themes, so ${majors.length === 1 ? (majors[0].position ? `the ${majors[0].position} position carries extra weight` : "that card carries extra weight") : "the reading leans toward a bigger life theme"}.`);
      else con.push("There are no Major cards, so in this app's lessons this reads as everyday matters you can act on directly.");
      const nums = {}; rows.forEach((r) => { const n = pipNum(r.card); if (n) (nums[n] = nums[n] || []).push(r); });
      Object.entries(nums).forEach(([n, rs]) => { const t = NUM.find((x) => x.n === +n); if (!t) return;
        const per = rs.map((r) => t.suits && t.suits[lc(r.card.suit)] ? `${r.card.name}: ${t.suits[lc(r.card.suit)]}` : "").filter(Boolean);
        con.push(`${rs.length > 1 ? `The number ${n} repeats (${rs.map(nm).join(", ")}). ` : ""}${t.name}: ${first(t.theme, 1)}${per.length ? " " + per.join(" ") : ""}`); });
      rows.filter((r) => court(r.card)).forEach((r) => { const s = COURTS.find((x) => x.rank === court(r.card)); if (s) con.push(`${r.card.name} is a court card. ${s.rank}: ${s.stage}. ${first(s.text, 1)}`); });
      const revs = rows.filter((r) => isRev(r.orientation));
      if (revs.length) con.push(`${revs.length} of ${rows.length} cards ${revs.length === 1 ? "is" : "are"} reversed (${revs.map((r) => r.card.name).join(", ")}). ${REV_WAYS} Ask which of the three fits each reversed card.`);
      // the app's own "In a spread" notes that name another card in this reading
      rows.forEach((r) => rows.forEach((o) => { if (o === r) return;
        const hit = sents(r.card.inASpread).find((s) => s.includes(o.card.name)); if (hit) con.push(`From the ${r.card.name} page, "In a spread": ${hit}`); }));
    }
    if (con.length) secs.push({ id: "connect", title: "How the cards connect", label: "Our method · uses the app's card, number, suit and court data", paras: con });

    /* 4. putting it together */
    if (rows.length > 1) {
      const pieces = rows.map((r) => `${r.position ? `for ${r.position.toLowerCase()}` : "then"} ${nm2(r)}, which in this app's text is about ${list(kw(r, 3))}`);
      let p = `Put together, ${intent ? `for ${yourQ}` : "as a general reading"}: ${pieces.join("; ")}.`;
      const last = rows[rows.length - 1];
      p += ` The last card${last.position ? `, in ${last.position}` : ""}, is where the reading points: ${first(isRev(last.orientation) ? last.card.reversed : last.card.upright, 1)}`;
      p += " This is one way to join the cards, not a prediction. Your own reading of them matters more.";
      secs.push({ id: "together", title: "Read as one", label: "Our method", paras: [p] });
    }

    /* 5. past readings for the same person */
    if (past.length) {
      const pp = [];
      pp.push(`Your last ${past.length} reading${past.length > 1 ? "s" : ""} before this one: ${past.map((e) => `${e.date} (${e.rows.map(nm).join(", ")}${e.intent ? `; ${e.intent.type}: “${e.intent.text}”` : ""})`).join("; ")}.`);
      const now = new Map(rows.map((r) => [r.card.name, r]));
      const rep = []; past.forEach((e) => e.rows.forEach((r) => { if (now.has(r.card.name)) rep.push({ date: e.date, r, now: now.get(r.card.name) }); }));
      rep.forEach((x) => pp.push(`${x.r.card.name} also came up on ${x.date}${isRev(x.r.orientation) !== isRev(x.now.orientation) ? `, then ${isRev(x.r.orientation) ? "reversed" : "upright"} and now ${isRev(x.now.orientation) ? "reversed" : "upright"}` : `, ${isRev(x.r.orientation) ? "reversed" : "upright"} both times`}. A card that comes back is worth a closer look: ${first(isRev(x.now.orientation) ? x.now.card.reversed : x.now.card.upright, 1)}`));
      const allRows = past.flatMap((e) => e.rows).concat(rows), sc = {};
      allRows.forEach((r) => { const k = r.card.suit || "Major"; sc[k] = (sc[k] || 0) + 1; });
      const top = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] > 1) pp.push(`Across these ${past.length + 1} readings there are ${allRows.length} cards, and the most common group is ${top[0] === "Major" ? "Major cards" : top[0]} (${top[1]} of ${allRows.length})${ELEM[top[0]] ? `, ${ELEM[top[0]][0]}: ${ELEM[top[0]][1]}` : ""}.`);
      const pastN = {}; past.flatMap((e) => e.rows).forEach((r) => { const n = pipNum(r.card); if (n) pastN[n] = (pastN[n] || 0) + 1; });
      rows.forEach((r) => { const n = pipNum(r.card); if (n && pastN[n] && !rep.some((x) => x.now === r)) { const t = NUM.find((x) => x.n === n); pp.push(`The number ${n} (${r.card.name}) showed up in your recent readings too${t ? `. ${t.name}: ${first(t.theme, 1)}` : "."}`); } });
      past.forEach((e) => e.rows.forEach((pr) => rows.forEach((r) => { const hit = sents(r.card.inASpread).find((s) => s.includes(pr.card.name)); if (hit) pp.push(`${pr.card.name} from ${e.date} is named on the ${r.card.name} page, "In a spread": ${hit}`); })));
      const pi = past.find((e) => e.intent);
      if (pi && intent && lc(pi.intent.text) !== lc(intent.text)) pp.push(`On ${pi.date} the ${pi.intent.type} was “${pi.intent.text}”. Compare it with today's: is this the same subject seen from a new side, or something new?`);
      if (pp.length === 1) pp.push("None of today's cards or numbers repeat from those readings, so this reading starts a different thread.");
      secs.push({ id: "past", title: "Your past readings", label: `Your own saved readings · same person only · Our method`, paras: pp });
      rep.slice(0, 1).forEach((x) => qs.push(`${x.r.card.name} came back from ${x.date}. What has and hasn't changed in that part of your life since then?`));
    } else {
      secs.push({ id: "past", title: "Your past readings", label: "Your own saved readings", paras: ["This is the first saved reading with cards for this person, so there is nothing earlier to compare with yet. Once there are two or three more, this part will show what repeats."] });
    }

    /* 6. reflection questions: from each card's own sit-with prompt, the intention, reversals, past */
    rows.forEach((r) => { const q = sents(r.card.sitWith)[0]; if (q) qs.push(r.position ? `${r.card.name} (${r.position}): ${q}` : `${r.card.name}: ${q}`); });
    if (intent) qs.push(`Read the cards again with ${yourQ} in mind. Which card fits it best, and which seems not to fit at all?`);
    else qs.push("If you had set an intention for this reading, what would it have been, looking at these cards now?");
    rows.filter((r) => isRev(r.orientation)).slice(0, 1).forEach((r) => qs.push(`${r.card.name} is reversed. Is it blocked, delayed or overdone for you right now, and how can you tell?`));
    if (rows.length > 1) qs.push(`What links ${rows[0].card.name} and ${rows[rows.length - 1].card.name} in your own life this week?`);
    secs.push({ id: "questions", title: "Questions to think about", label: "From each card's sit-with prompt (our text) and your entry", paras: [], questions: qs });

    /* summary for Today: first sentences of the strongest parts */
    const sm = [];
    if (rows.length > 1) sm.push(`${intent ? `For ${yourQ}: ` : ""}${rows.map((r) => `${r.position ? r.position + ": " : ""}${nm2(r)} (${list(kw(r, 2))})`).join("; ")}.`);
    else if (rows[0]) sm.push(`${nm(rows[0])}: ${first(isRev(rows[0].orientation) ? rows[0].card.reversed : rows[0].card.upright, 1)}`);
    if (con[1]) sm.push(con[1].split(". ")[0] + ".");
    if (past.length) sm.push(`Tied to your last ${past.length} reading${past.length > 1 ? "s" : ""}.`);
    sm.push(`${qs.length} questions to think about.`);
    const sources = [...used];
    return { summary: sm.join(" "), sections: secs, questions: qs, sources, pastUsed: past.map((e) => e.date), general: !intent };
  }

  const METHOD = [
    "Each card: its position meaning, this app's upright or reversed text, its key words, and Waite's line for that orientation.",
    "Links between cards: the order of positions, shared elements and suits, repeated numbers (with the app's number-by-suit notes), Major and court cards, reversals, and any card's \"In a spread\" note that names another card in the reading.",
    "With an intention, each card is held against it. Without one, the reading stays general.",
    "Past readings: the same person's last 2 to 4 saved readings with cards (you can untick any). Repeated cards, numbers, suits and earlier intentions are compared.",
    "Questions at the end come from each card's own sit-with prompt and from your entry.",
    "Nothing is added from outside the app. The way the pieces are joined is this app's own method, labelled Our method. There is no verdict and no prediction.",
  ];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function html(res) {
    return `<div class="coh">${res.sections.map((s) => `<section class="coh-sec" data-coh="${s.id}"><h4>${esc(s.title)}</h4><small class="coh-lab">${esc(s.label)}</small>
      ${s.paras.map((p) => `<p>${esc(p)}</p>`).join("")}${s.questions ? `<ol class="coh-q">${s.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>` : ""}</section>`).join("")}
      <details class="coh-det"><summary>Details and sources</summary>
        <p><b>Card meanings:</b> this app's own text, upright and reversed · <span class="ln-status st-app">Our text</span></p>
        ${res.sources.includes("pkt") ? `<p><b>Waite's lines:</b> A. E. Waite, <i>The Pictorial Key to the Tarot</i> (1911), Part III · <span class="ln-status st-partly">Partly read</span> (all 78 card lines checked word for word; Parts I and II not read in full)</p>` : ""}
        <p><b>Numbers, suits, elements, court stages:</b> this app's Learn data · <span class="ln-status st-app">Our text</span> · tradition, not science</p>
        <p><b>Past readings:</b> your own saved readings${res.pastUsed.length ? ": " + esc(res.pastUsed.join(", ")) : " (none yet)"}</p>
        <p class="muted">Tarot is a tool for reflection. We know of no study showing it predicts events.</p></details>
      <details class="coh-det"><summary>How this reading is built</summary><ol>${METHOD.map((m) => `<li>${esc(m)}</li>`).join("")}</ol></details></div>`;
  }
  W.Cohesive = { build, pickPast, intentOf, html, METHOD, isRev };
})();
