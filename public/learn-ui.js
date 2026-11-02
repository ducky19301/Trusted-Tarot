/* Learn UI: one-idea card decks, section quizzes, the shared guided-practice flow
   (write first → clue checklist → stepwise hints → show me the meaning → optional self-rating),
   Put it together + My notes, sources footer and in-app Learn more (the only outside link sits at its bottom). */
(() => {
  "use strict";
  const L = window.LEARN_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const KEY = "tt.learn.v1";
  const store = { get() { try { return Object.assign({ seen: {}, done: {}, quizzes: [], notes: [], ratings: {} }, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return { seen: {}, done: {}, quizzes: [], notes: [], ratings: {} }; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } } };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  let SECS = null;
  const secs = () => SECS || (SECS = L.build(window.PRACTICE_DATA));
  const sec = (id) => secs().find((s) => s.id === id);
  const AREA_NAME = { learn: "Learn", numbers: "Numbers", spreads: "Spreads", sky: "Learn to read charts", tarot: "Learn" };
  const srcChip = (k) => { const s = L.SOURCES[k] || L.SOURCES.app; return `<button type="button" class="ln-chip" data-src="${k}">${esc(s.author.split(",")[0])} · ${esc(L.READ_LABEL[s.read])}</button>`; };
  const KIND = { traditional: "Tradition", study: "What studies show", "how-to": "How to", method: "Method" };

  /* ---------- in-app sheets ---------- */
  function sheet(html) {
    let el = $("#lnSheet");
    if (!el) { el = document.createElement("div"); el.id = "lnSheet"; el.className = "ln-sheet"; document.body.appendChild(el); }
    el.innerHTML = `<div class="ln-sheet-bg" data-x></div><div class="ln-sheet-card" role="dialog" aria-modal="true"><button class="modal-close" data-x aria-label="Close">×</button>${html}</div>`;
    el.hidden = false;
    $$("[data-x]", el).forEach((b) => b.addEventListener("click", () => { el.hidden = true; }));
    return el;
  }
  function sourceSheet(k) {
    const s = L.SOURCES[k];
    sheet(`<h3>${esc(s.work)}</h3><p><b>${esc(s.author)}</b>${s.year ? ` · ${esc(s.year)}` : ""}</p><p><span class="ln-status st-${s.read}">${esc(L.READ_LABEL[s.read])}</span></p>
      ${s.note ? `<p>${esc(s.note)}</p>` : ""}<p class="muted">Where to read it: ${esc(s.where)}</p><p class="muted small">The link to the source is at the bottom of Learn more, at the end of the section.</p>`);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-src]"); if (b) sourceSheet(b.dataset.src); });

  /* ---------- home ---------- */
  function home(el, area, opts = {}) {
    const st = store.get();
    const list = secs().filter((s) => area === "all" || s.area === area || (area === "tarot" && s.area !== "sky"));
    el.innerHTML = `<section class="p-panel ln-home"><h2>${esc(opts.title || AREA_NAME[area] || "Study")}</h2>
      <p class="muted">One idea per card. Each section ends with Put it together, a quiz, and its sources. Nothing here opens another site.</p>
      <div class="ln-secs">${list.map((s) => { const seen = Math.min((st.seen[s.id] || 0), s.cards.length); return `<button class="ln-sec ${st.done[s.id] ? "done" : ""}" data-sec="${s.id}">
        <b>${esc(s.title)}</b><small>${s.cards.length} cards${st.done[s.id] ? " · done ✓" : seen ? ` · ${seen} seen` : ""}</small><span class="ln-bar"><i style="width:${Math.round(100 * seen / s.cards.length)}%"></i></span></button>`; }).join("")}</div>
      <div class="actions"><button class="btn btn-ghost btn-sm" id="lnNotes">My notes (${st.notes.length})</button></div></section>`;
    $$("[data-sec]", el).forEach((b) => b.addEventListener("click", () => deck(el, b.dataset.sec, 0, () => home(el, area, opts))));
    $("#lnNotes", el).addEventListener("click", () => notes(el, () => home(el, area, opts)));
  }

  /* ---------- deck ---------- */
  function deck(el, id, i, back) {
    const s = sec(id), st = store.get();
    st.seen[id] = Math.max(st.seen[id] || 0, i + 1); store.set(st);
    if (i >= s.cards.length) return end(el, id, back);
    const c = s.cards[i];
    el.innerHTML = `<section class="p-panel ln-deck"><div class="ln-top"><button class="link-btn" id="lnBack">‹ ${esc(AREA_NAME[s.area] || "Back")}</button><span class="muted">${esc(s.title)} · ${i + 1} / ${s.cards.length}</span></div>
      <div class="ln-dots">${s.cards.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
      <article class="ln-card" data-card="${c.id}"><span class="ln-kind k-${c.kind}">${esc(KIND[c.kind] || "")}</span><p>${esc(c.text)}</p>${srcChip(c.source)}</article>
      <div class="actions ln-nav"><button class="btn btn-ghost" id="lnPrev" ${i ? "" : "disabled"}>‹ Back</button><button class="btn btn-gold" id="lnNext">${i + 1 < s.cards.length ? "Next ›" : "Finish ›"}</button></div></section>`;
    $("#lnBack", el).addEventListener("click", back);
    $("#lnPrev", el).addEventListener("click", () => deck(el, id, i - 1, back));
    $("#lnNext", el).addEventListener("click", () => deck(el, id, i + 1, back));
    swipe($(".ln-card", el), () => deck(el, id, i + 1, back), () => i && deck(el, id, i - 1, back));
    window.scrollTo({ top: 0 });
  }
  function swipe(node, next, prev) {
    let x0 = null;
    node.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    node.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (dx < -50) next(); else if (dx > 50) prev(); });
  }

  /* ---------- end of section: Put it together (before the quiz), quiz, sources, Learn more ---------- */
  function sourcesFooter(s) {
    return `<div class="ln-foot"><span class="label">Where this section came from</span>${s.sources.map((k) => { const x = L.SOURCES[k]; return `<div class="ln-src"><b>${esc(x.author)}</b>, <i>${esc(x.work)}</i>${x.year ? ` (${esc(x.year)})` : ""} · <span class="ln-status st-${x.read}">${esc(L.READ_LABEL[x.read])}</span><br/><small class="muted">${esc(x.where)}</small></div>`; }).join("")}</div>`;
  }
  function end(el, id, back) {
    const s = sec(id);
    el.innerHTML = `<section class="p-panel ln-end"><div class="ln-top"><button class="link-btn" id="lnBack">‹ ${esc(AREA_NAME[s.area] || "Back")}</button></div>
      <h3 class="center">${esc(s.title)} · ${s.cards.length} of ${s.cards.length} cards ✓</h3>
      <div class="ln-ctas"><button class="btn btn-gold" id="lnPut">✎ Put it together</button><button class="btn btn-ghost" id="lnQuiz">Take the quiz</button></div>
      <p class="muted small">Put it together comes first so you use the idea while it's fresh. What you write is saved in My notes.</p>
      ${sourcesFooter(s)}<div class="actions"><button class="btn btn-ghost btn-sm" id="lnMore">Learn more ›</button></div></section>`;
    $("#lnBack", el).addEventListener("click", back);
    $("#lnPut", el).addEventListener("click", () => putTogether(el, id, () => end(el, id, back)));
    $("#lnQuiz", el).addEventListener("click", () => quiz(el, id, () => end(el, id, back)));
    $("#lnMore", el).addEventListener("click", () => learnMore(el, id, () => end(el, id, back)));
  }
  function learnMore(el, id, back) {
    const s = sec(id);
    const links = s.sources.map((k) => L.SOURCES[k]).filter((x) => x.url);
    el.innerHTML = `<section class="p-panel ln-more"><div class="ln-top"><button class="link-btn" id="lnBack">‹ Back</button><span class="muted">Learn more · in the app</span></div>
      <h3>${esc(s.title)}: everything in one place</h3>
      <div class="ln-card"><span class="label">Key points</span><ul>${s.cards.map((c) => `<li>${esc(c.text)} <small class="muted">(${esc(KIND[c.kind] || "")})</small></li>`).join("")}</ul></div>
      ${s.tryThis ? `<div class="ln-card"><span class="label">Try this</span><p>${esc(s.tryThis)}</p></div>` : ""}
      ${s.area === "learn" && /reversal/i.test(s.title) ? `<div class="ln-card"><span class="label">What studies show</span><p>We found no studies on reading reversed cards. Reading them is a reader's choice inside the tradition.</p></div>` : ""}
      <div class="ln-card"><span class="label">About the sources</span>${s.sources.map((k) => { const x = L.SOURCES[k]; return `<p><b>${esc(x.author)}</b>, <i>${esc(x.work)}</i>. <span class="ln-status st-${x.read}">${esc(L.READ_LABEL[x.read])}</span>${x.note ? ` ${esc(x.note)}` : ""} ${esc(x.where)}.</p>`; }).join("")}</div>
      ${links.length ? `<div class="ln-leave"><span class="label">Read the source yourself</span>${links.map((x) => `<button class="link-btn ln-ext" data-url="${esc(x.url)}">${esc(x.work)} ↗ <small>(leaves the app)</small></button>`).join("<br/>")}</div>` : ""}</section>`;
    $("#lnBack", el).addEventListener("click", back);
    $$(".ln-ext", el).forEach((b) => b.addEventListener("click", () => {
      const sh = sheet(`<h3>Leave the app?</h3><p>This opens ${esc(new URL(b.dataset.url).hostname)} in your browser. Your place here is saved.</p><div class="actions"><button class="btn btn-ghost" data-x>Stay</button><button class="btn btn-gold" id="lnGo">Open</button></div>`);
      $("#lnGo", sh).addEventListener("click", () => { window.open(b.dataset.url, "_blank", "noopener"); sh.hidden = true; });
    }));
    window.scrollTo({ top: 0 });
  }

  /* ---------- Put it together + My notes ---------- */
  function putTogether(el, id, back, extra = "") {
    const s = sec(id);
    el.innerHTML = `<section class="p-panel ln-put"><div class="ln-top"><button class="link-btn" id="lnBack">✕ Close</button><span class="muted">Put it together · ${esc(s.title)}</span></div>
      <p class="q-prompt">${esc(s.put.prompt)}</p>${extra}
      ${s.put.fields.map((f, k) => `<label class="field"><span>${esc(f)}</span><textarea rows="3" maxlength="3000" data-pf="${k}"></textarea></label>`).join("")}
      <p class="hint">Use the method: look at what's there, name the parts, then say it in your own words.</p>
      <div class="actions"><button class="btn btn-gold" id="lnSave">Save to My notes</button></div><p class="status" id="lnSt"></p></section>`;
    $("#lnBack", el).addEventListener("click", back);
    $("#lnSave", el).addEventListener("click", () => {
      const answers = $$("[data-pf]", el).map((t, k) => ({ q: s.put.fields[k], a: t.value.trim() }));
      if (!answers.some((a) => a.a)) { $("#lnSt", el).textContent = "Write at least one line first."; return; }
      const st = store.get(); st.notes.push({ id: Date.now().toString(36), section: id, title: s.title, area: s.area, prompt: s.put.prompt, answers, date: today() }); store.set(st);
      $("#lnSt", el).textContent = "Saved to My notes. You can come back to it any time.";
      setTimeout(back, 900);
    });
  }
  function notes(el, back) {
    const st = store.get();
    el.innerHTML = `<section class="p-panel ln-notes"><div class="ln-top"><button class="link-btn" id="lnBack">‹ Back</button><span class="muted">My notes · ${st.notes.length}</span></div>
      ${st.notes.length ? [...st.notes].reverse().map((n) => `<article class="ln-card"><small class="muted">${esc(AREA_NAME[n.area] || "")} · ${esc(n.title)} · ${esc(n.date)}</small><p><i>${esc(n.prompt)}</i></p>${n.answers.filter((a) => a.a).map((a) => `<p><b>${esc(a.q)}</b><br/>${esc(a.a)}</p>`).join("")}
        <button class="link-btn" data-reopen="${n.section}">Reopen exercise ›</button> <button class="link-btn" data-del="${n.id}">Delete</button></article>`).join("") : `<p class="muted">Nothing yet. Finish a section and tap Put it together.</p>`}</section>`;
    $("#lnBack", el).addEventListener("click", back);
    $$("[data-reopen]", el).forEach((b) => b.addEventListener("click", () => putTogether(el, b.dataset.reopen, () => notes(el, back))));
    $$("[data-del]", el).forEach((b) => b.addEventListener("click", () => { const s2 = store.get(); s2.notes = s2.notes.filter((n) => n.id !== b.dataset.del); store.set(s2); notes(el, back); }));
  }

  /* ---------- quiz (questions only from card data; hints before answering, reasoning after) ---------- */
  const words = (t, n) => t.split(/\s+/).slice(0, n).join(" ");
  function makeQuestions(s, n = 6) {
    const qs = [], same = secs().filter((x) => x.system === s.system && x.id !== s.id), cards = s.cards;
    const mc = (prompt, right, wrongs, card, hint) => { const opts = shuffle([right, ...shuffle([...new Set(wrongs.filter((w) => w && w !== right))]).slice(0, 3)]); return { prompt, options: opts, answer: opts.indexOf(right), card, hints: hint ? [hint] : [], why: card.text }; };
    const typed = cards.filter((c) => c.term || c.theme || c.pos || c.house || c.key);
    for (const c of shuffle(typed)) {
      if (qs.length >= n) break;
      if (c.term) qs.push(mc(`What does “${c.term}” mean?`, c.def, cards.map((x) => x.def), c, `Look for the definition that describes ${c.term.toLowerCase()} itself.`));
      else if (c.theme) qs.push(mc(`What is the theme of the ${c.name}?`, c.theme, cards.map((x) => x.theme), c, "Count: Aces start things, Tens finish them. Where in the run is this number?"));
      else if (c.pos) qs.push(mc(`In this spread, what does “${c.pos}” stand for?`, c.meaning, cards.map((x) => x.meaning).concat(same.flatMap((x) => x.cards.map((y) => y.meaning))), c, "The position's name usually says it plainly."));
      else if (c.house) qs.push(mc(`Which of these does Lilly give for house ${c.house}?`, c.lilly, cards.map((x) => x.lilly), c, `The app's modern label for house ${c.house} is “${c.modern}”. Which older list is closest?`));
      else if (c.key) qs.push(mc(`In this app's readings, what does ${c.planet} stand for?`, c.key, cards.map((x) => x.key), c, "Think of what the planet was named for, or what Ptolemy says about it."));
    }
    const pool = same.flatMap((x) => x.cards);
    for (const c of shuffle(cards.filter((x) => !(x.term || x.theme || x.pos || x.house || x.key)))) {
      if (qs.length >= n || pool.length < 3) break;
      qs.push(mc("Which of these did this section teach?", c.text, shuffle(pool).slice(0, 6).map((x) => x.text), c, `It starts “${words(c.text, 4)}…”`));
    }
    if (s.id === "learn.reversals") {
      const c = cards.find((x) => /Overdone/.test(x.text)) || cards[0];
      qs.unshift({ prompt: "Three of Cups reversed. Which reading uses “overdone”?", options: ["A celebration that doesn't happen", "A night that goes too far", "A party that's postponed"], answer: 1, card: c, hints: ["The Three of Cups is a celebration.", "Overdone means too much of the card."], why: "Overdone means too much of the card: a night that goes too far. “Doesn't happen” is blocked; “postponed” is delayed." });
    }
    return qs.slice(0, n);
  }
  function quiz(el, id, back) {
    const s = sec(id), qs = makeQuestions(s);
    let i = 0, score = 0, ans = null, hintN = 0;
    const draw = () => {
      if (i >= qs.length) {
        const st = store.get(); st.quizzes.push({ section: id, score, total: qs.length, date: today() }); st.done[id] = today(); store.set(st);
        el.innerHTML = `<section class="p-panel q-end"><h3>${esc(s.title)} quiz</h3><p class="q-score"><b>${score}</b> / ${qs.length}</p>
          <p class="muted center">Every question came from a card in this section. No timer, nothing lost for a miss.</p>
          <div class="ln-ctas"><button class="btn btn-gold" id="lnBackEnd">Done</button><button class="btn btn-ghost" id="lnPut2">✎ Put it together</button></div>${sourcesFooter(s)}
          <div class="actions"><button class="btn btn-ghost btn-sm" id="lnMore">Learn more ›</button></div></section>`;
        $("#lnBackEnd", el).addEventListener("click", back);
        $("#lnPut2", el).addEventListener("click", () => putTogether(el, id, back));
        $("#lnMore", el).addEventListener("click", () => learnMore(el, id, back));
        return;
      }
      const q = qs[i], k = s.cards.indexOf(q.card) + 1;
      el.innerHTML = `<section class="p-panel quiz ln-quiz"><div class="q-head"><h3>${esc(s.title)} quiz</h3><span class="q-prog">Question ${i + 1} of ${qs.length}</span></div>
        <p class="q-prompt">${esc(q.prompt)}</p>
        ${ans === null && q.hints.length ? `<div class="ln-hints">${q.hints.slice(0, hintN).map((h, j) => `<p class="ln-hint"><b>Hint ${j + 1}</b> ${esc(h)}</p>`).join("")}${hintN < q.hints.length ? `<button class="btn btn-ghost btn-sm" id="lnHint">Hint</button>` : ""}</div>` : ""}
        <div class="q-opts">${q.options.map((o, j) => `<button class="q-opt ${ans === null ? "" : j === q.answer ? "right" : j === ans ? "wrong" : "dim"}" data-k="${j}" ${ans === null ? "" : "disabled"}>${esc(o)}</button>`).join("")}</div>
        ${ans === null ? "" : `<div class="q-fb ${ans === q.answer ? "ok" : "no"}"><b>${ans === q.answer ? "Yes." : "Not this time."} Reasoning:</b> ${esc(q.why)} <button class="link-btn" id="lnSee">See card ${k} ›</button></div>
          <div class="actions"><button class="btn btn-gold" id="lnNext">${i + 1 < qs.length ? "Next ›" : "See results"}</button></div>`}</section>`;
      const h = $("#lnHint", el); if (h) h.addEventListener("click", () => { hintN++; draw(); });
      $$(".q-opt", el).forEach((b) => b.addEventListener("click", () => { ans = +b.dataset.k; if (ans === q.answer) score++; draw(); }));
      const nx = $("#lnNext", el); if (nx) nx.addEventListener("click", () => { i++; ans = null; hintN = 0; draw(); });
      const see = $("#lnSee", el); if (see) see.addEventListener("click", () => sheet(`<span class="label">${esc(s.title)} · card ${k}</span><p>${esc(q.card.text)}</p>${srcChip(q.card.source)}`));
    };
    draw();
  }

  /* ---------- guided practice: the one flow every practice mode uses ---------- */
  const CHECK = [["see", "What I see"], ["number", "Number"], ["suit", "Suit and element"], ["mood", "Mood"], ["direction", "Direction or gaze"], ["position", "Position or reversal"]];
  const NUM_IDEA = () => Object.fromEntries((window.PRACTICE_DATA.NUMBERS || []).map((n) => [n.n, n.theme.split(".")[0]]));
  const ELEM = { Wands: ["Fire", "drive, ambition, creativity"], Cups: ["Water", "feelings, love, friendship, the inner life"], Swords: ["Air", "thought, words, decisions, conflict"], Pentacles: ["Earth", "money, work, the body, home"] };
  const sentsOf = (t) => L.sents(t);
  function cardGuide(c, orient) {
    const rev = orient === "reversed", hints = [];
    if (c.imagery) hints.push({ skill: "Look at the picture", text: sentsOf(c.imagery)[0], source: "app" });
    if (c.arcana === "major") hints.push({ skill: "Number", text: `This is Major ${c.number}. Majors show the big themes you can't simply decide your way around.`, source: "app" });
    else if (+c.number <= 10) hints.push({ skill: "Number", text: `${c.number === 1 || c.number === "1" ? "Ace" : c.number}: ${NUM_IDEA()[+c.number] || ""}.`, source: "app" });
    else hints.push({ skill: "Court", text: (window.PRACTICE_DATA.COURT_STAGES.find((x) => x.rank && c.name.startsWith(x.rank)) || {}).text || "A court card: a person or a way of acting.", source: "app" });
    if (ELEM[c.suit]) hints.push({ skill: "Suit and element", text: `${c.suit} are ${ELEM[c.suit][0].toLowerCase()}: ${ELEM[c.suit][1]}.`, source: "app" });
    if (rev) hints.push({ skill: "Apply a reversal", text: "Try it three ways: blocked, delayed or overdone. Which fits what you saw?", source: "app" });
    hints.push({ skill: "Combine", text: "Put the picture, the number and the suit together in one plain sentence.", source: "app" });
    const reveal = sentsOf(rev ? c.reversed : c.upright).slice(0, 3);
    const waite = c.waite && c.waite[rev ? "reversed" : "upright"];
    return { title: `${c.name}${rev ? " · reversed" : ""}`, hints: hints.filter((h) => h.text), reveal, revealLabel: rev ? "Reversed meaning (our text)" : "Upright meaning (our text)",
      extra: waite ? { label: `Waite's ${rev ? "reversed" : "upright"} line (Pictorial Key, Part III · checked word for word)`, text: waite, source: "pkt" } : null, nextTime: c.sitWith || "" };
  }
  // opts: {media, title, prompt, hints:[{skill,text,source}], reveal:[..], revealLabel, extra, nextTime, checklist, onRate(r), rateLabels, onNext, initial}
  function guided(el, o) {
    const S = { text: o.initial || "", checks: new Set(), hintN: 0, shown: false };
    const draw = () => {
      el.innerHTML = `<div class="gp">
        ${o.media ? `<div class="gp-media">${o.media}</div>` : ""}<p class="gp-title"><b>${esc(o.title || "")}</b></p>
        ${o.firstTip ? `<p class="hint">${esc(o.firstTip)}</p>` : ""}
        <label class="field"><span>${esc(o.prompt || "Your reading: what do you think it says?")}</span><textarea rows="3" maxlength="3000" class="gp-text" ${S.shown ? "readonly" : ""} placeholder="Write first. Check the picture, numbers, suit or element and any other clues.">${esc(S.text)}</textarea></label>
        ${(o.checklist || CHECK).length ? `<div class="gp-checks" role="group" aria-label="Clues to look at">${(o.checklist || CHECK).map(([k, l]) => `<button type="button" class="gp-chk ${S.checks.has(k) ? "on" : ""}" data-chk="${k}" aria-pressed="${S.checks.has(k)}">${S.checks.has(k) ? "✓ " : ""}${esc(l)}</button>`).join("")}</div>` : ""}
        <div class="gp-hints">${o.hints.slice(0, S.hintN).map((h, j) => `<p class="ln-hint"><b>Hint ${j + 1} · ${esc(h.skill)}</b> ${esc(h.text)}</p>`).join("")}</div>
        ${S.shown ? `<div class="gp-compare"><div class="sp-note"><span class="label">You wrote</span><p>${S.text ? esc(S.text) : "<em class='muted'>Nothing written.</em>"}</p></div>
            <div><span class="label">${esc(o.revealLabel || "The meaning")}</span>${o.reveal.map((t) => `<p class="ln-card sm">${esc(t)}</p>`).join("")}
            ${o.extra ? `<p class="gp-extra"><small class="label">${esc(o.extra.label)}</small><br/>${esc(o.extra.text)}</p>` : ""}</div></div>
            ${o.nextTime ? `<p class="gp-next"><b>Look at next time:</b> ${esc(o.nextTime)}</p>` : ""}
            <p class="muted small">Your writing is never scored. Compare: what did you notice that matches?</p>
            ${o.onRate ? `<div class="rate" role="group" aria-label="How did it go?"><span>Optional:</span>${(o.rateLabels || [["didnt", "Not yet"], ["sort", "Partly"], ["knew", "Got it"]]).map(([k, l]) => `<button type="button" class="btn btn-sm btn-ghost" data-rate="${k}">${l}</button>`).join("")}${o.onNext ? `<button type="button" class="btn btn-sm btn-ghost" data-rate="">Skip</button>` : ""}</div>` : o.onNext ? `<div class="actions"><button class="btn btn-gold" data-rate="">Next ›</button></div>` : ""}`
          : `<div class="actions gp-actions">${S.hintN < o.hints.length ? `<button type="button" class="btn btn-ghost gp-hint">Hint ${S.hintN + 1} of ${o.hints.length}</button>` : ""}<button type="button" class="btn btn-gold gp-show">Show me the meaning</button></div>`}
      </div>`;
      const ta = $(".gp-text", el); ta.addEventListener("input", () => { S.text = ta.value; });
      $$("[data-chk]", el).forEach((b) => b.addEventListener("click", () => { const k = b.dataset.chk; S.checks.has(k) ? S.checks.delete(k) : S.checks.add(k); draw(); }));
      const h = $(".gp-hint", el); if (h) h.addEventListener("click", () => { S.hintN++; draw(); });
      const sh = $(".gp-show", el); if (sh) sh.addEventListener("click", () => { S.shown = true; draw(); if (o.onShow) o.onShow(S.text); });
      $$("[data-rate]", el).forEach((b) => b.addEventListener("click", () => { if (b.dataset.rate && o.onRate) o.onRate(b.dataset.rate, S.text); else if (o.onNext) o.onNext(S.text); }));
    };
    draw();
    return S;
  }
  // a small hints block (for places that already have their own write box, like Shuffle & pick and Spreads practice)
  function hintsBlock(el, hints) {
    let n = 0;
    const draw = () => { el.innerHTML = `${hints.slice(0, n).map((h, j) => `<p class="ln-hint"><b>Hint ${j + 1} · ${esc(h.skill)}</b> ${esc(h.text)}</p>`).join("")}${n < hints.length ? `<button type="button" class="btn btn-ghost btn-sm gp-hint">Hint ${n + 1} of ${hints.length}</button>` : ""}`;
      const b = $(".gp-hint", el); if (b) b.addEventListener("click", () => { n++; draw(); }); };
    draw();
  }

  window.LearnUI = { home, deck, quiz, learnMore, putTogether, notes, guided, hintsBlock, cardGuide, makeQuestions, sections: secs, store, sheet };
})();
