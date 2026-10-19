/* Practice tab: Shuffle & pick, flashcards (Leitner), quizzes, real-deck practice, daily lesson, progress,
   plus Numerology, Learn and Spreads. Study data goes to /api/practice/* (data/practice.json) only:
   never the journal (entries.json), the outbox or Astro. */
(() => {
  "use strict";
  const D = window.PRACTICE_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const T = () => window.TarotApp;
  const esc = (v) => T().esc(v);
  const params = new URLSearchParams(location.search);
  const DEMO = params.has("pdemo");            // screenshot hooks: never write anything
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("no-anim");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const REV_CHANCE = 0.5;
  const SUITS = ["Wands", "Cups", "Swords", "Pentacles"];
  const ELEMENT = { Wands: "Fire", Cups: "Water", Swords: "Air", Pentacles: "Earth" };
  const SUIT_TOPIC = { Wands: "drive and action", Cups: "feelings and relationships", Swords: "thoughts, words and conflict", Pentacles: "money, work and the body" };
  const NUM_SHORT = { 1: "seeds and beginnings", 2: "pairs and choices", 3: "first growth", 4: "structure and pause", 5: "disruption", 6: "harmony restored", 7: "tests", 8: "movement and effort", 9: "nearly there", 10: "completion" };
  const COURT_SHORT = { 11: "Page (the beginner)", 12: "Knight (in motion)", 13: "Queen (mastery held inward)", 14: "King (mastery put to work)" };
  const RANK = { 1: "Ace", 11: "Page", 12: "Knight", 13: "Queen", 14: "King" };
  const PPF = ["Past", "Present", "Future"];

  let P = null;                 // practice.json from the server
  const V = { view: "practice", mode: null };
  const root = () => $("#practiceRoot");
  const cards = () => T().S.cards;
  const byId = (id) => cards().find((c) => c.id === id);
  const today = () => T().localDate();
  const isRev = (o) => o === "reversed";
  const side = (o) => (isRev(o) ? "reversed" : "upright");
  const group = (c) => (c.arcana === "major" ? "Major" : c.suit);
  const num = (c) => Number(c.number);
  const sents = (t) => String(t || "").split(/(?<=[.?])\s+(?=[A-Z])/).filter(Boolean);
  const firstSents = (t, n) => sents(t).slice(0, n).join(" ");
  const kws = (c, o, n = 3) => ((c.keywords && c.keywords[side(o)]) || []).slice(0, n);
  const img = (c) => T().deckImg(c.img);
  const shuffle = (a) => T().shuffle(a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shortLabel = (c) => (c.arcana === "major" ? `${c.number} ${c.name.replace(/^The /, "")}` : (RANK[num(c)] || String(num(c))));
  const cardImgTag = (c, o, cls = "") => `<img src="${img(c)}" alt="${esc(c.name)}${isRev(o) ? " (reversed)" : ""}" class="${cls} ${isRev(o) ? "reversed-img" : ""}" loading="lazy" />`;
  const theName = (n) => (/^The /.test(n) ? n : "the " + n);   // "the Ten of Wands", "The Moon"
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const orientLabel = (o) => (isRev(o) ? "Reversed" : "Upright");

  async function post(path, body) {
    if (DEMO) return { ok: true, demo: true, pull: { id: "demo" }, review: {}, lessons: P.lessons, reading: { id: "demo", ...body } };
    const res = await T().api(path, body);
    if (P && P.days && !P.days.includes(today())) P.days.push(today());   // the server marks the streak day on every write
    return res;
  }
  async function loadPractice() { P = await T().api("/api/practice"); }

  /* ---------------- sub-navigation ---------------- */
  $$("[data-pv]").forEach((b) => b.addEventListener("click", () => { T().segSelect(b.parentElement, b); V.view = b.dataset.pv; render(); window.scrollTo({ top: 0 }); }));
  function setView(v) { const b = $(`[data-pv="${v}"]`); if (b) { T().segSelect(b.parentElement, b); V.view = v; } }
  function render() {
    if (!P || !cards().length) return;
    ({ practice: renderPracticeHome, numerology: renderNumerology, learn: renderLearn, spreads: renderSpreads })[V.view]();
  }

  /* ================= fast card picker (real deck) ================= */
  function Picker(container, state, onChange) {
    state.group = state.group || (state.card ? group(state.card) : "Major");
    state.orientation = state.orientation || "upright";
    const draw = () => {
      const list = cards().filter((c) => group(c) === state.group);
      container.innerHTML = `<div class="fp">
        <div class="seg seg-sm fp-groups" role="group" aria-label="Part of the deck">${["Major", ...SUITS].map((g) => `<button type="button" class="seg-btn ${g === state.group ? "active" : ""}" data-g="${g}">${g}</button>`).join("")}</div>
        <div class="fp-grid ${state.group === "Major" ? "majors" : ""}">${list.map((c) => `<button type="button" class="fp-card ${state.card && state.card.id === c.id ? "on" : ""}" data-id="${c.id}" title="${esc(c.name)}">${esc(shortLabel(c))}</button>`).join("")}</div>
        <div class="fp-foot"><div class="seg seg-sm" role="group" aria-label="Orientation"><button type="button" class="seg-btn ${!isRev(state.orientation) ? "active" : ""}" data-o="upright">Upright</button><button type="button" class="seg-btn ${isRev(state.orientation) ? "active" : ""}" data-o="reversed">Reversed</button></div>
        <span class="fp-chosen">${state.card ? esc(state.card.name) : "Tap your card"}</span></div></div>`;
      $$("[data-g]", container).forEach((b) => b.addEventListener("click", () => { state.group = b.dataset.g; draw(); }));
      $$("[data-id]", container).forEach((b) => b.addEventListener("click", () => { state.card = byId(b.dataset.id); draw(); onChange && onChange(state); }));
      $$("[data-o]", container).forEach((b) => b.addEventListener("click", () => { state.orientation = b.dataset.o; draw(); onChange && onChange(state); }));
    };
    draw();
    return state;
  }

  /* ================= info card (the meaning, same size as the drawn card) ================= */
  function infoCardFront(c, o) {
    const s = side(o), t = (c.topics && c.topics[s]) || {}, w = c.waite || {};
    const wn = c.waiteNote && c.waiteNote[s];
    const sec = (title, body) => (body ? `<h5>${title}</h5>${body}` : "");
    const p = (v) => (v ? `<p>${esc(v)}</p>` : "");
    return `<div class="ic-scroll" tabindex="0">
      <h4>${esc(c.name)}</h4>
      <div class="ic-meta">${T().badge(o)}<span class="tag">${c.arcana === "major" ? "Major Arcana" : esc(c.suit)}</span></div>
      ${T().kwHTML(c, o)}
      ${sec("Core meaning", p(isRev(o) ? c.reversed : c.upright))}
      ${w[s] ? sec("Waite’s words", `<blockquote class="waite-quote">${esc(w[s])}</blockquote>${wn ? `<p class="ic-plain">${esc(wn)}</p>` : ""}`) : ""}
      ${sec("Love", p(t.love))}${sec("Work", p(t.work))}${sec("Money", p(t.money))}
      ${sec("Advice", p(t.advice))}
      <button type="button" class="link-btn ic-full" data-id="${c.id}" data-o="${o}">Full card page ›</button>
    </div>`;
  }
  function flipCardHTML(cls, back, front, flipped, label) {
    // a div (not a button): the info card holds its own "Full card page" button and scrolls
    return `<div class="flip ${cls} ${flipped ? "flipped" : ""}" ${flipped ? "" : `role="button" tabindex="0"`} aria-label="${esc(label)}"><div class="flip-inner"><div class="face back">${back || ""}</div><div class="face front">${front}</div></div></div>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".ic-full, .open-card");
    if (b && b.dataset.id) { e.preventDefault(); e.stopPropagation(); T().openCard(b.dataset.id, b.dataset.o || "upright", ["meaning", "waite"]); }
  }, true);

  /* ================= PRACTICE HOME ================= */
  const SP = { count: 1, reversals: true, own: false, phase: "deck", deck: [], selected: [], drawn: [], pullId: null, context: "pick", status: "", pickers: [] };

  function renderPracticeHome() {
    root().innerHTML = `
      <section class="sp" id="spSection" aria-labelledby="spTitle">
        <header class="sp-head"><h2 id="spTitle">Shuffle &amp; pick</h2><p class="muted">Shuffle, fan the deck, and choose a card by feel. Then write your first impression before the meaning turns over.</p></header>
        <div class="sp-controls">
          <div class="seg seg-sm" role="group" aria-label="How many cards"><button class="seg-btn ${SP.count === 1 ? "active" : ""}" data-spc="1">1 card</button><button class="seg-btn ${SP.count === 3 ? "active" : ""}" data-spc="3">3 cards · past, present, future</button></div>
          <label class="switch ${SP.own ? "on" : ""}"><input type="checkbox" id="spOwn" ${SP.own ? "checked" : ""} /> <span>I’m using my own deck</span></label>
          <label class="switch ${SP.reversals ? "on" : ""}" ${SP.own ? "hidden" : ""}><input type="checkbox" id="spRev" ${SP.reversals ? "checked" : ""} /> <span>Include reversals</span></label>
        </div>
        <div id="spStage"></div>
      </section>
      <nav class="p-modes" aria-label="Practice modes">
        ${[["daily", "☀", "Daily lesson", "5 flashcards, 3 questions, 1 pull"], ["flash", "❏", "Flashcards", "Spaced repetition"], ["quiz", "?", "Quiz", "10 questions"], ["real", "❖", "Real deck practice", "Your own cards"], ["progress", "▤", "Progress", "What you know"]]
          .map(([k, ic, t, s]) => `<button class="p-mode ${V.mode === k ? "active" : ""}" data-mode="${k}"><span class="pm-ic" aria-hidden="true">${ic}</span><b>${t}</b><small>${s}</small></button>`).join("")}
      </nav>
      <div id="modeArea"></div>`;
    $$("[data-spc]").forEach((b) => b.addEventListener("click", () => { SP.count = Number(b.dataset.spc); resetSP(); renderPracticeHome(); }));
    $("#spOwn").addEventListener("change", (e) => { SP.own = e.target.checked; resetSP(); renderPracticeHome(); });
    $("#spRev").addEventListener("change", (e) => { SP.reversals = e.target.checked; e.target.closest(".switch").classList.toggle("on", SP.reversals); });
    $$("[data-mode]").forEach((b) => b.addEventListener("click", () => openMode(b.dataset.mode)));
    renderSP();
    if (V.mode) renderMode();
  }
  function openMode(m) {
    if (m === "real") { SP.own = true; SP.context = "real"; resetSP(); V.mode = null; renderPracticeHome(); $("#spSection").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); return; }
    V.mode = V.mode === m ? null : m;
    $$("[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === V.mode));
    renderMode();
    if (V.mode) $("#modeArea").scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  }
  function renderMode() {
    const area = $("#modeArea"); if (!area) return;
    if (!V.mode) { area.innerHTML = ""; return; }
    ({ daily: renderDaily, flash: () => renderFlash(area), quiz: () => renderQuizPicker(area), progress: renderProgress })[V.mode](area);
  }

  /* ---------- Shuffle & pick ---------- */
  function resetSP() {
    Object.assign(SP, { phase: SP.own ? "pick" : "deck", selected: [], drawn: [], pullId: null, status: "", pickers: [] });
    if (!SP.own) SP.context = SP.context === "daily" ? "daily" : "pick";
  }
  const posName = (i) => (SP.count === 3 ? PPF[i] : null);

  function renderSP() {
    const st = $("#spStage"); if (!st) return;
    if (SP.phase === "deck" || SP.phase === "shuffling") {
      st.innerHTML = `<div class="sp-deck ${SP.phase === "shuffling" ? "shuffling" : ""}" id="spDeck" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<div class="cardback mini" style="--i:${i}"></div>`).join("")}</div>
        <p class="hint center">${SP.phase === "shuffling" ? "Shuffling…" : "78 cards, face down."}</p>
        <div class="actions"><button class="btn btn-gold" id="spShuffle" ${SP.phase === "shuffling" ? "disabled" : ""}>✦ Shuffle</button></div>`;
      $("#spShuffle").addEventListener("click", doShuffle);
      return;
    }
    if (SP.phase === "fan") {
      const need = SP.count - SP.selected.length;
      const half = Math.ceil(SP.deck.length / 2);
      st.innerHTML = `<p class="hint center">${need > 0 ? `Tap ${SP.count === 1 ? "a card" : need === 3 ? "three cards, one at a time" : `${need} more card${need === 1 ? "" : "s"}`} to pick${SP.count === 3 ? " (past, present, future)" : ""}.` : (SP.count === 1 ? "Tap it again, or turn it over below." : "Ready. Turn them over.")}</p>
        <div class="sp-fan" id="spFan" role="group" aria-label="Face-down deck">${SP.deck.map((id, i) => {
          const row = i < half ? 0 : 1, rowN = row ? SP.deck.length - half : half, j = row ? i - half : i;
          const t = rowN > 1 ? j / (rowN - 1) : 0.5, sel = SP.selected.indexOf(id);
          return `<button type="button" class="cardback fc ${sel >= 0 ? "sel" : ""}" data-id="${id}" aria-label="Face-down card ${i + 1}${sel >= 0 ? ", picked" : ""}" style="--i:${i};--x:${(t * 92).toFixed(2)};--y:${(row * 150 + 44 * Math.pow(2 * t - 1, 2)).toFixed(1)};--r:${((t - 0.5) * 44).toFixed(1)}deg">${sel >= 0 && SP.count === 3 ? `<span class="fc-n">${sel + 1}</span>` : ""}</button>`;
        }).join("")}</div>
        <div class="actions"><button class="btn btn-gold" id="spTurn" ${need > 0 ? "disabled" : ""}>☽ Turn ${SP.count === 1 ? "it" : "them"} over</button><button class="btn btn-ghost btn-sm" id="spReshuffle">Shuffle again</button></div>`;
      $$(".fc", st).forEach((b) => b.addEventListener("click", () => selectCard(b.dataset.id)));
      $("#spTurn").addEventListener("click", drawSelected);
      $("#spReshuffle").addEventListener("click", () => { SP.phase = "deck"; SP.selected = []; renderSP(); doShuffle(); });
      return;
    }
    if (SP.phase === "pick") {
      if (!SP.pickers.length) SP.pickers = Array.from({ length: SP.count }, () => ({ card: null, orientation: "upright", done: false }));
      const i = SP.pickers.findIndex((p) => !p.done);
      const cur = i < 0 ? SP.pickers.length - 1 : i;
      st.innerHTML = `<p class="hint center">Shuffle your deck, pull ${SP.count === 1 ? "a card" : "three cards"}, then choose what you got.</p>
        ${SP.count === 3 ? `<div class="sp-picked">${SP.pickers.map((p, k) => `<span class="chip ${k === cur ? "active" : ""}">${esc(posName(k))}: ${p.card ? esc(p.card.name) + (isRev(p.orientation) ? " (rev.)" : "") : "…"}</span>`).join("")}</div>` : ""}
        <div id="spPicker"></div>
        <div class="actions"><button class="btn btn-gold" id="spPlace" disabled>${cur < SP.count - 1 ? "Next card ›" : `Lay ${SP.count === 1 ? "it" : "them"} face down`}</button></div>`;
      const state = SP.pickers[cur];
      Picker($("#spPicker"), state, () => { $("#spPlace").disabled = !state.card; });
      $("#spPlace").disabled = !state.card;
      $("#spPlace").addEventListener("click", () => {
        state.done = true;
        if (SP.pickers.every((p) => p.done)) {
          SP.drawn = SP.pickers.map((p, k) => ({ card: p.card, orientation: p.orientation, faceUp: false, impression: "", meaning: false, rating: null, position: posName(k) }));
          SP.phase = "drawn"; renderSP(); autoFlip();
        } else renderSP();
      });
      return;
    }
    // drawn
    st.innerHTML = `<div class="sp-pairs ${SP.count === 3 ? "three" : ""}">${SP.drawn.map((d, i) => pairHTML(d, i)).join("")}</div>
      <p class="status" id="spStatus" role="status" aria-live="polite">${esc(SP.status)}</p>
      <div class="actions sp-again"><button class="btn btn-gold" id="spAnother">↻ Pick another</button>${SP.own ? "" : `<button class="btn btn-ghost btn-sm" id="spShuffle2">Shuffle again</button>`}</div>`;
    bindPairs(st);
    $("#spAnother").addEventListener("click", () => {
      if (SP.own) { resetSP(); renderSP(); return; }
      SP.deck = SP.deck.filter((id) => !SP.drawn.some((d) => d.card.id === id));
      if (SP.deck.length < SP.count) SP.deck = shuffle(cards().map((c) => c.id));
      Object.assign(SP, { phase: "fan", selected: [], drawn: [], pullId: null, status: "" }); renderSP();
      $("#spSection").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
    });
    const s2 = $("#spShuffle2"); if (s2) s2.addEventListener("click", () => { resetSP(); renderSP(); doShuffle(); });
  }

  function pairHTML(d, i) {
    const c = d.card;
    return `<article class="sp-pair" data-i="${i}">
      ${d.position ? `<span class="slot-label">${esc(d.position)}</span>` : ""}
      <div class="sp-row">
        <div class="sp-col">
          ${flipCardHTML("sp-card", "", cardImgTag(c, d.orientation), d.faceUp, d.faceUp ? c.name : "Face-down card")}
          <p class="sp-cap">${d.faceUp ? `<b>${esc(c.name)}</b> · ${orientLabel(d.orientation)}` : "&nbsp;"}</p>
          <div class="sp-imp-box" ${d.faceUp ? "" : "hidden"}>
            <label class="field"><span>First impression <em>(optional)</em></span>
              <textarea rows="2" maxlength="2000" class="sp-imp" placeholder="What do you see? What does it feel like?" ${d.meaning ? "readonly" : ""}>${esc(d.impression)}</textarea></label>
            ${d.meaning ? "" : `<div class="actions"><button type="button" class="btn btn-gold sp-flipmeaning">Flip the meaning</button></div>`}
          </div>
        </div>
        <div class="sp-col">
          ${flipCardHTML("sp-info", `<span class="ic-back-label">The meaning</span>`, infoCardFront(c, d.orientation), d.meaning, d.meaning ? `Meaning of ${c.name}` : "Meaning, face down")}
          <p class="sp-cap">${d.meaning ? "Scroll the card for more" : "&nbsp;"}</p>
        </div>
      </div>
      ${d.meaning ? `<div class="sp-below"><div class="rate" role="group" aria-label="How well did you know it?"><span>How well did you know it?</span>
            ${[["knew", "Knew it"], ["sort", "Sort of"], ["didnt", "Didn’t"]].map(([k, l]) => `<button type="button" class="btn btn-sm ${d.rating === k ? "btn-gold" : "btn-ghost"}" data-rate="${k}">${l}</button>`).join("")}</div>
          <details class="sp-ref"><summary>Your note beside the full reference</summary><div class="sp-ref-grid"><div class="sp-note"><span class="label">Your first impression</span><p>${d.impression ? esc(d.impression) : "<em class='muted'>No note written.</em>"}</p></div><div>${T().infoHTML(c, d.orientation, { open: ["meaning"] })}</div></div></details></div>` : ""}
    </article>`;
  }
  function bindPairs(st) {
    $$(".sp-pair", st).forEach((el) => {
      const i = Number(el.dataset.i), d = SP.drawn[i];
      $(".sp-card", el).addEventListener("click", () => { if (!d.faceUp) flipDrawn(i); });
      $$(".flip[role=button]", el).forEach((f) => f.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f.click(); } }));
      $(".sp-info", el).addEventListener("click", (e) => { if (!d.meaning && d.faceUp && !e.target.closest(".ic-full")) flipMeaning(i); });
      const ta = $(".sp-imp", el); if (ta) ta.addEventListener("input", () => { d.impression = ta.value; });
      const fm = $(".sp-flipmeaning", el); if (fm) fm.addEventListener("click", () => flipMeaning(i));
      $$("[data-rate]", el).forEach((b) => b.addEventListener("click", () => rate(i, b.dataset.rate)));
    });
  }
  async function flipDrawn(i) {
    const d = SP.drawn[i]; if (d.faceUp) return;
    d.faceUp = true;
    const el = $(`.sp-pair[data-i="${i}"] .sp-card`);
    if (el) { el.classList.add("flipped"); await wait(reduced() ? 0 : 800); }
    renderSP();
  }
  async function autoFlip() {
    await wait(reduced() ? 30 : 450);
    for (let i = 0; i < SP.drawn.length; i++) { const el = $(`.sp-pair[data-i="${i}"] .sp-card`); if (el) el.classList.add("flipped"); SP.drawn[i].faceUp = true; await wait(reduced() ? 0 : 260); }
    await wait(reduced() ? 0 : 650);
    renderSP();
  }
  async function flipMeaning(i) {
    const d = SP.drawn[i]; if (d.meaning || !d.faceUp) return;
    const ta = $(`.sp-pair[data-i="${i}"] .sp-imp`); if (ta) d.impression = ta.value;
    d.meaning = true;
    const el = $(`.sp-pair[data-i="${i}"] .sp-info`); if (el) el.classList.add("flipped");
    await wait(reduced() ? 0 : 820);
    renderSP();
    if (SP.drawn.every((x) => x.meaning) && !SP.pullId) savePull();
  }
  async function savePull() {
    try {
      const res = await post("/api/practice/pull", { mode: SP.own ? "real" : "virtual", reversals: SP.own ? true : SP.reversals, context: SP.context,
        cards: SP.drawn.map((d) => ({ id: d.card.id, orientation: d.orientation, position: d.position || undefined, impression: d.impression, rating: d.rating || undefined })) });
      SP.pullId = res.pull.id;
      if (!DEMO) P.pulls.push(res.pull);
      SP.status = "Saved to your practice pulls (not your journal).";
      if (SP.context === "daily") { await markDaily(); SP.status += " Daily lesson complete."; SP.context = "pick"; }
    } catch (e) { SP.status = "Couldn’t save: " + e.message; }
    const s = $("#spStatus"); if (s) s.textContent = SP.status;
  }
  async function rate(i, r) {
    const d = SP.drawn[i]; d.rating = r;
    $$(`.sp-pair[data-i="${i}"] [data-rate]`).forEach((b) => { b.classList.toggle("btn-gold", b.dataset.rate === r); b.classList.toggle("btn-ghost", b.dataset.rate !== r); });
    try {
      const res = await post("/api/practice/review", { card: d.card.id, orientation: d.orientation, rating: r, mode: SP.own ? "real" : "pick", pullId: SP.pullId || undefined, index: SP.pullId ? i : undefined });
      if (!DEMO && res.review) P.reviews[d.card.id] = res.review;
      if (!DEMO && SP.pullId) { const pl = P.pulls.find((x) => x.id === SP.pullId); if (pl && pl.cards[i]) pl.cards[i].rating = r; }
    } catch (e) { const s = $("#spStatus"); if (s) s.textContent = "Couldn’t save the rating: " + e.message; }
  }
  function selectCard(id) {
    const k = SP.selected.indexOf(id);
    if (k >= 0 && SP.count === 1) { drawSelected(); return; }
    if (k >= 0) SP.selected.splice(k, 1);
    else if (SP.count === 1) { if (SP.selected[0] === id) { drawSelected(); return; } SP.selected = [id]; }
    else if (SP.selected.length < SP.count) SP.selected.push(id);
    const fan = $("#spFan"), y = fan ? fan.scrollTop : 0;
    renderSP();
    const f2 = $("#spFan"); if (f2) { f2.classList.add("no-deal"); f2.scrollTop = y; }
  }
  function drawSelected() {
    if (SP.selected.length !== SP.count) return;
    SP.drawn = SP.selected.map((id, k) => ({ card: byId(id), orientation: SP.reversals && Math.random() < REV_CHANCE ? "reversed" : "upright", faceUp: false, impression: "", meaning: false, rating: null, position: posName(k) }));
    SP.phase = "drawn"; renderSP();
    $("#spSection").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
    autoFlip();
  }
  async function doShuffle() {
    SP.deck = shuffle(cards().map((c) => c.id)); SP.selected = [];
    if (reduced()) { SP.phase = "fan"; renderSP(); return; }
    SP.phase = "shuffling"; renderSP();
    $$("#spDeck .mini").forEach((m, i) => {
      const half = i % 2 ? 1 : -1;
      m.style.setProperty("--hx", `${half * (60 + Math.random() * 20)}px`);
      m.style.setProperty("--hr", `${half * (6 + Math.random() * 6)}deg`);
      m.style.setProperty("--ry", `${(i - 8) * 1.2}px`);
      m.style.setProperty("--dx", `${(Math.random() - 0.5) * 260}px`);
      m.style.setProperty("--dy", `${(Math.random() - 0.5) * 150}px`);
      m.style.setProperty("--dr", `${(Math.random() - 0.5) * 80}deg`);
    });
    await wait(1750);
    SP.phase = "fan"; renderSP();
  }

  /* ================= FLASHCARDS (Leitner boxes) ================= */
  const FC = { filter: "all", randomRev: true, queue: [], i: 0, flipped: false, done: 0, mode: "flashcard", onDone: null, limit: 20 };
  function fcPool(filter) {
    return cards().filter((c) => filter === "all" || (filter === "major" ? c.arcana === "major" : filter === "courts" ? c.arcana !== "major" && num(c) > 10 : filter === "pips" ? c.arcana !== "major" && num(c) <= 10 : c.suit === filter));
  }
  function buildQueue(filter, limit) {
    const t = today(), R = P.reviews;
    const pool = fcPool(filter);
    const due = shuffle(pool.filter((c) => R[c.id] && (R[c.id].due || t) <= t)).sort((a, b) => (R[a.id].box || 1) - (R[b.id].box || 1));
    const fresh = shuffle(pool.filter((c) => !R[c.id]));
    return [...due, ...fresh].slice(0, limit).map((c) => ({ card: c, orientation: FC.randomRev && Math.random() < 0.4 ? "reversed" : "upright" }));
  }
  function boxCounts() {
    const b = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    Object.values(P.reviews).forEach((r) => { b[r.box || 1] = (b[r.box || 1] || 0) + 1; });
    return b;
  }
  function boxesHTML() {
    const b = boxCounts(), t = today();
    const due = Object.values(P.reviews).filter((r) => (r.due || t) <= t).length;
    const fresh = cards().length - Object.keys(P.reviews).length;
    return `<div class="boxes" aria-label="Leitner boxes">${[1, 2, 3, 4, 5].map((k) => `<div class="box"><b>${b[k]}</b><small>Box ${k}</small></div>`).join("")}</div>
      <p class="hint">${due} due today · ${fresh} not studied yet. Knew it moves a card up a box (seen again in 1, 3, 7 or 16 days). Sort of keeps it for tomorrow. Didn’t sends it back to box 1.</p>`;
  }
  function renderFlash(area, opts = {}) {
    Object.assign(FC, { mode: opts.mode || "flashcard", onDone: opts.onDone || null, limit: opts.limit || 20 });
    if (!opts.keepQueue) { FC.queue = buildQueue(FC.filter, FC.limit); FC.i = 0; FC.flipped = false; FC.done = 0; }
    const draw = () => {
      const cur = FC.queue[FC.i];
      area.innerHTML = `<section class="p-panel" aria-labelledby="fcTitle">
        ${opts.embedded ? "" : `<h3 id="fcTitle">Flashcards</h3>
        <div class="p-filters"><div class="seg seg-sm" role="group" aria-label="Which cards">${[["all", "All"], ["major", "Major"], ["Wands", "Wands"], ["Cups", "Cups"], ["Swords", "Swords"], ["Pentacles", "Pentacles"], ["courts", "Courts"]].map(([k, l]) => `<button class="seg-btn ${FC.filter === k ? "active" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
          <label class="switch ${FC.randomRev ? "on" : ""}"><input type="checkbox" id="fcRev" ${FC.randomRev ? "checked" : ""}/> <span>Random reversals</span></label></div>
        ${boxesHTML()}`}
        ${cur ? `<p class="fc-count">Card ${FC.i + 1} of ${FC.queue.length}</p>
          <button type="button" class="fc-card ${FC.flipped ? "flipped" : ""}" id="fcCard" aria-label="${FC.flipped ? "Answer" : "Tap to show the meaning"}"><div class="flip-inner">
            <div class="fc-front face">${cardImgTag(cur.card, cur.orientation, "fc-img")}<span class="fc-q">What does it mean${isRev(cur.orientation) ? " reversed" : ""}?</span></div>
            <div class="fc-back face"><h4>${esc(cur.card.name)}</h4>${T().badge(cur.orientation)}${T().kwHTML(cur.card, cur.orientation)}<p>${esc(firstSents(isRev(cur.orientation) ? cur.card.reversed : cur.card.upright, 3))}</p></div>
          </div></button>
          ${FC.flipped ? `<div class="rate" role="group" aria-label="How well did you know it?">${[["knew", "Knew it"], ["sort", "Sort of"], ["didnt", "Didn’t"]].map(([k, l]) => `<button class="btn btn-sm ${k === "knew" ? "btn-gold" : "btn-ghost"}" data-r="${k}">${l}</button>`).join("")}</div>
            <div class="actions"><button class="link-btn open-card" data-id="${cur.card.id}" data-o="${cur.orientation}">Full card page ›</button></div>` : `<p class="hint center">Say or think the meaning, then tap the card.</p>`}`
        : `<div class="empty-state"><p><b>${FC.done ? `Done: ${FC.done} card${FC.done === 1 ? "" : "s"} reviewed.` : "Nothing due in this set."}</b></p>${opts.embedded ? "" : `<button class="btn btn-gold" id="fcMore">Study more</button>`}</div>`}
      </section>`;
      $$("[data-f]", area).forEach((b) => b.addEventListener("click", () => { FC.filter = b.dataset.f; FC.queue = buildQueue(FC.filter, FC.limit); FC.i = 0; FC.flipped = false; draw(); }));
      const rv = $("#fcRev", area); if (rv) rv.addEventListener("change", (e) => { FC.randomRev = e.target.checked; FC.queue = buildQueue(FC.filter, FC.limit); FC.i = 0; FC.flipped = false; draw(); });
      const card = $("#fcCard", area); if (card) card.addEventListener("click", () => { if (!FC.flipped) { FC.flipped = true; card.classList.add("flipped"); setTimeout(draw, reduced() ? 0 : 600); } });
      $$("[data-r]", area).forEach((b) => b.addEventListener("click", async () => {
        const r = b.dataset.r;
        try { const res = await post("/api/practice/review", { card: cur.card.id, orientation: cur.orientation, rating: r, mode: FC.mode }); if (!DEMO && res.review) P.reviews[cur.card.id] = res.review; } catch (e) { /* keep going */ }
        if (r === "didnt" && !opts.embedded) FC.queue.push({ ...cur });
        FC.i++; FC.done++; FC.flipped = false;
        if (FC.i >= FC.queue.length && FC.onDone) { FC.onDone(); return; }
        draw();
      }));
      const more = $("#fcMore", area); if (more) more.addEventListener("click", () => { FC.queue = buildQueue(FC.filter === "all" ? "all" : FC.filter, FC.limit); if (!FC.queue.length) FC.queue = shuffle(fcPool(FC.filter)).slice(0, 10).map((c) => ({ card: c, orientation: "upright" })); FC.i = 0; FC.done = 0; draw(); });
    };
    FC.redraw = draw;
    draw();
  }

  /* ================= QUIZZES ================= */
  const others = (c, n, pool = cards()) => shuffle(pool.filter((x) => x.id !== c.id)).slice(0, n);
  const mkOpts = (right, wrongs) => shuffle([right, ...wrongs]);
  const Q = {
    picture() {
      const c = pick(cards()), same = cards().filter((x) => group(x) === group(c));
      const opts = mkOpts(c, others(c, 3, Math.random() < 0.6 && same.length > 4 ? same : cards()));
      return { kind: "picture", prompt: "Which card is this?", media: cardImgTag(c, "upright", "q-img"), options: opts.map((o) => o.name), answer: opts.indexOf(c),
        why: `This is ${theName(c.name)}. ${firstSents(c.imagery, 1)}` };
    },
    keyword() {
      const c = pick(cards()), o = Math.random() < 0.3 ? "reversed" : "upright", k = kws(c, o, 3);
      const opts = mkOpts(c, others(c, 3));
      return { kind: "keyword", prompt: `Which card${isRev(o) ? ", reversed," : ""} matches these keywords?`, media: `<div class="kw ${isRev(o) ? "rev" : ""}">${k.map((w) => `<span>${esc(w)}</span>`).join("")}</div>`,
        options: opts.map((x) => x.name), answer: opts.indexOf(c), why: `${c.name}${isRev(o) ? " reversed" : ""}: ${kws(c, o, 5).join(", ")}.` };
    },
    meaning() {
      const c = pick(cards());
      const words = c.name.replace(/^The /, "").split(/\s+/).filter((w) => w.length > 2 && !/^of$/i.test(w));
      let s = firstSents(c.upright, 2);
      words.forEach((w) => { s = s.replace(new RegExp(`\\b(the\\s+)?${w}\\b`, "gi"), "▢▢▢"); });
      const opts = mkOpts(c, others(c, 3));
      return { kind: "meaning", prompt: "Which card does this meaning describe?", media: `<blockquote class="q-quote">${esc(s)}</blockquote>`, options: opts.map((x) => x.name), answer: opts.indexOf(c),
        why: `That’s ${theName(c.name)} upright. Keywords: ${kws(c, "upright", 4).join(", ")}.` };
    },
    suit() {
      const c = pick(cards().filter((x) => x.arcana !== "major"));
      if (Math.random() < 0.5) {
        const opts = [...SUITS];
        return { kind: "suit", prompt: "Which suit is this card from?", media: cardImgTag(c, "upright", "q-img"), options: opts, answer: opts.indexOf(c.suit),
          why: `It’s the ${c.name}. ${c.suit} is the suit of ${SUIT_TOPIC[c.suit]}.` };
      }
      const opts = ["Fire", "Water", "Air", "Earth"];
      return { kind: "suit", prompt: `What element goes with the ${c.name}?`, media: cardImgTag(c, "upright", "q-img"), options: opts, answer: opts.indexOf(ELEMENT[c.suit]),
        why: `${c.suit} go with ${ELEMENT[c.suit]} in the usual Golden Dawn scheme: Wands Fire, Cups Water, Swords Air, Pentacles Earth.` };
    },
    mixed() { return Q[pick(["picture", "keyword", "meaning", "suit"])](); },
  };
  const QUIZ_KINDS = [["mixed", "Mixed"], ["picture", "Picture → name"], ["keyword", "Keywords → card"], ["meaning", "Meaning → card"], ["suit", "Suit & element"]];
  function renderQuizPicker(area) {
    area.innerHTML = `<section class="p-panel"><h3>Quiz</h3><p class="muted">Ten questions, four choices each. You’ll see why after every answer.</p>
      <div class="q-kinds">${QUIZ_KINDS.map(([k, l]) => `<button class="btn btn-ghost" data-qk="${k}">${l}</button>`).join("")}</div>
      ${recentQuizzesHTML()}</section>`;
    $$("[data-qk]", area).forEach((b) => b.addEventListener("click", () => runQuiz(area, { title: b.textContent, kind: b.dataset.qk, make: Q[b.dataset.qk], n: 10, save: true, onDone: () => renderQuizPicker(area) })));
  }
  function recentQuizzesHTML() {
    const q = (P.quizzes || []).slice(-5).reverse();
    return q.length ? `<div class="recent"><span class="label">Recent scores</span><ul class="plain">${q.map((x) => `<li>${esc(T().short(x.date))} · ${esc(x.kind)} · <b>${x.score}/${x.total}</b></li>`).join("")}</ul></div>` : "";
  }
  function runQuiz(area, { title, kind, make, n = 10, save = true, onDone, preset }) {
    const qs = preset || [];
    while (qs.length < n) { const q = make(); if (!qs.some((x) => x.prompt === q.prompt && x.media === q.media)) qs.push(q); }
    let i = 0, score = 0, answered = null;
    const draw = () => {
      if (i >= qs.length) {
        area.innerHTML = `<section class="p-panel q-end"><h3>${esc(title)}</h3><p class="q-score"><b>${score}</b> / ${qs.length}</p>
          <p class="muted center">${score === qs.length ? "Every one right." : score >= qs.length * 0.7 ? "Solid. The ones you missed will come back in flashcards." : "Keep going. Missed cards are worth a look in the Cards tab."}</p>
          <div class="actions"><button class="btn btn-gold" id="qAgain">${onDone ? "Continue" : "Again"}</button></div></section>`;
        if (save) post("/api/practice/quiz", { kind, score, total: qs.length }).then((r) => { if (!DEMO && r.quiz) P.quizzes.push(r.quiz); }).catch(() => {});
        $("#qAgain", area).addEventListener("click", () => (onDone ? onDone(score) : runQuiz(area, { title, kind, make, n, save })));
        return;
      }
      const q = qs[i];
      area.innerHTML = `<section class="p-panel quiz" aria-live="polite"><div class="q-head"><h3>${esc(title)}</h3><span class="q-prog">Question ${i + 1} of ${qs.length} · Score ${score}</span></div>
        <p class="q-prompt">${esc(q.prompt)}</p><div class="q-media">${q.media || ""}</div>
        <div class="q-opts">${q.options.map((o, k) => `<button class="q-opt ${answered === null ? "" : k === q.answer ? "right" : k === answered ? "wrong" : "dim"}" data-k="${k}" ${answered === null ? "" : "disabled"}>${esc(o)}</button>`).join("")}</div>
        ${answered === null ? "" : `<div class="q-fb ${answered === q.answer ? "ok" : "no"}"><b>${answered === q.answer ? "Correct." : "Not quite."}</b> ${esc(q.why)}</div>
          <div class="actions"><button class="btn btn-gold" id="qNext">${i + 1 < qs.length ? "Next ›" : "See score"}</button></div>`}</section>`;
      $$(".q-opt", area).forEach((b) => b.addEventListener("click", () => { answered = Number(b.dataset.k); if (answered === q.answer) score++; draw(); }));
      const nx = $("#qNext", area); if (nx) nx.addEventListener("click", () => { i++; answered = null; draw(); });
    };
    runQuiz.answer = (k) => { const b = $$(".q-opt", area)[k]; if (b) b.click(); };
    draw();
  }

  /* ================= DAILY LESSON ================= */
  async function markDaily() {
    const res = await post("/api/practice/day", {});
    if (!DEMO && res.dailyDone) P.dailyDone = res.dailyDone;
  }
  function renderDaily(area) {
    const done = (P.dailyDone || []).includes(today());
    const steps = (k) => `<ol class="daily-steps">${["5 flashcards", "3 quiz questions", "1 real-deck pull"].map((s, j) => `<li class="${j < k ? "done" : j === k ? "now" : ""}">${s}</li>`).join("")}</ol>`;
    const step1 = () => {
      area.innerHTML = `<section class="p-panel"><h3>Daily lesson</h3>${steps(0)}<div id="dStage"></div></section>`;
      renderFlash($("#dStage", area), { embedded: true, mode: "daily", limit: 5, onDone: step2 });
    };
    const step2 = () => {
      area.innerHTML = `<section class="p-panel"><h3>Daily lesson</h3>${steps(1)}<div id="dStage"></div></section>`;
      runQuiz($("#dStage", area), { title: "Three questions", kind: "daily", make: Q.mixed, n: 3, save: true, onDone: step3 });
    };
    const step3 = () => {
      area.innerHTML = `<section class="p-panel"><h3>Daily lesson</h3>${steps(2)}
        <p>Last step: shuffle your own deck and pull one card. Write what you see before you read the meaning.</p>
        <div class="actions"><button class="btn btn-gold" id="dPull">Go to Shuffle &amp; pick ›</button><button class="btn btn-ghost btn-sm" id="dSkip">No deck with me: finish</button></div></section>`;
      $("#dPull", area).addEventListener("click", () => { SP.own = true; SP.count = 1; SP.context = "daily"; resetSP(); SP.context = "daily"; V.mode = null; renderPracticeHome(); $("#spSection").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); });
      $("#dSkip", area).addEventListener("click", async () => { await markDaily(); area.innerHTML = `<section class="p-panel"><h3>Daily lesson</h3>${steps(3)}<p class="center"><b>Done for today.</b></p></section>`; });
    };
    if (done) {
      area.innerHTML = `<section class="p-panel"><h3>Daily lesson</h3>${steps(3)}<p><b>You finished today’s lesson.</b> Come back tomorrow, or run it again for extra practice.</p><div class="actions"><button class="btn btn-ghost" id="dAgain">Run it again</button></div></section>`;
      $("#dAgain", area).addEventListener("click", step1);
    } else {
      area.innerHTML = `<section class="p-panel"><h3>Daily lesson</h3>${steps(-1)}<p>About ten minutes. Flashcards come from what’s due first.</p><div class="actions"><button class="btn btn-gold" id="dStart">Start</button></div></section>`;
      $("#dStart", area).addEventListener("click", step1);
    }
  }

  /* ================= PROGRESS ================= */
  function streak() {
    const days = new Set(P.days || []); let n = 0; const d = new Date();
    if (!days.has(T().localDate(d))) d.setDate(d.getDate() - 1);
    while (days.has(T().localDate(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function renderProgress(area) {
    const R = P.reviews, known = Object.entries(R).filter(([, r]) => (r.box || 1) >= 4).length;
    const groups = ["Major", ...SUITS].map((g) => { const list = cards().filter((c) => group(c) === g); const k = list.filter((c) => R[c.id] && R[c.id].box >= 4).length; const s = list.filter((c) => R[c.id]).length; return { g, n: list.length, k, s }; });
    const pulls = [...(P.pulls || [])].reverse().slice(0, 30);
    const rateLabel = { knew: "Knew it", sort: "Sort of", didnt: "Didn’t" };
    area.innerHTML = `<section class="p-panel"><h3>Progress</h3>
      <div class="stats"><div><b>${known}</b><small>of 78 known</small></div><div><b>${Object.keys(R).length}</b><small>studied</small></div><div><b>${streak()}</b><small>day streak</small></div><div><b>${Object.keys(P.lessons || {}).length}</b><small>of ${D.LESSONS.length} lessons</small></div></div>
      <div class="bars">${groups.map((x) => `<div class="bar-row"><span>${x.g}</span><div class="bar" role="img" aria-label="${x.g}: ${x.k} known, ${x.s} studied of ${x.n}"><i class="studied" style="width:${(x.s / x.n) * 100}%"></i><i class="known" style="width:${(x.k / x.n) * 100}%"></i></div><small>${x.k}/${x.n}</small></div>`).join("")}</div>
      <p class="legend"><span class="lg known"></span> known (box 4 or 5) <span class="lg studied"></span> studied</p>
      ${recentQuizzesHTML()}
      <h4>Practice pulls</h4>
      ${pulls.length ? `<ul class="pull-list">${pulls.map((p) => `<li><div class="pl-head"><b>${esc(T().short(p.date))}</b> · ${p.mode === "real" ? "own deck" : "app deck"}${p.context === "daily" ? " · daily" : ""}</div>
        ${p.cards.map((c) => { const k = byId(c.id); return `<div class="pl-card">${k ? `<button class="thumb-sm open-card" data-id="${c.id}" data-o="${c.orientation}">${cardImgTag(k, c.orientation)}</button>` : ""}<div><b>${c.position ? esc(c.position) + ": " : ""}${esc(c.name)}</b>${isRev(c.orientation) ? " <small>(reversed)</small>" : ""}${c.rating ? ` <span class="rate-chip ${c.rating}">${rateLabel[c.rating]}</span>` : ""}${c.impression ? `<p class="imp">“${esc(c.impression)}”</p>` : ""}</div></div>`; }).join("")}</li>`).join("")}</ul>` : `<p class="muted">No practice pulls yet. Try Shuffle &amp; pick at the top.</p>`}
      </section>`;
  }

  /* ================= NUMEROLOGY ================= */
  const NUMV = { page: "1" };
  const digitSum = (n) => String(n).split("").reduce((a, b) => a + Number(b), 0);
  const major = (n) => cards().find((c) => c.arcana === "major" && num(c) === n);
  const pip = (suit, n) => cards().find((c) => c.suit === suit && num(c) === n);
  function birthCard(y, m, d) {
    const total = m + d + y, work = [`${m} + ${d} + ${y} = ${total}`];
    let s = total;
    while (s > 22) { const ds = digitSum(s); work.push(`${String(s).split("").join(" + ")} = ${ds}`); s = ds; }
    if (s === 22) { work.push("22 counts as the Fool (0)"); return { total, work, chain: [0] }; }
    const chain = [s];
    while (s >= 10) { const ds = digitSum(s); work.push(`${String(s).split("").join(" + ")} = ${ds}`); s = ds; chain.push(s); }
    return { total, work, chain };
  }
  function miniCard(c, o = "upright") { return c ? `<button class="mini-card open-card" data-id="${c.id}" data-o="${o}">${cardImgTag(c, o)}<span>${esc(c.name)}</span></button>` : ""; }
  function renderNumerology() {
    const chips = [...D.NUMBERS.map((n) => [String(n.n), String(n.n)]), ["courts", "Courts"], ["majors", "Majors"], ["birth", "Birth card"], ["quiz", "Quiz"]];
    root().innerHTML = `<section class="p-panel"><h2>Numbers in the tarot</h2>
      <p class="muted">Each pip card carries its number’s theme, dressed in its suit. Learn ten themes and you have a head start on forty cards.</p>
      <div class="chips num-chips" role="group" aria-label="Numerology pages">${chips.map(([k, l]) => `<button class="chip ${NUMV.page === k ? "active" : ""}" data-np="${k}">${l}</button>`).join("")}</div>
      <div id="numArea"></div></section>`;
    $$("[data-np]").forEach((b) => b.addEventListener("click", () => { NUMV.page = b.dataset.np; renderNumerology(); }));
    const area = $("#numArea"), pg = NUMV.page;
    if (/^\d+$/.test(pg)) {
      const N = D.NUMBERS.find((x) => String(x.n) === pg), n = Number(pg);
      const majors = [major(n), ...cards().filter((c) => c.arcana === "major" && num(c) > 9 && digitSum(num(c)) === n)].filter(Boolean);
      area.innerHTML = `<article class="num-page"><h3>${N.n} · ${esc(N.name)}</h3><p class="lead">${esc(N.theme)}</p>
        <div class="pips4">${SUITS.map((s) => { const c = pip(s, n); return `<div class="pip">${miniCard(c)}<p><b>${s}</b> · ${esc(N.suits[s.toLowerCase()])}</p></div>`; }).join("")}</div>
        <h4>Majors with this number</h4><p>${esc(N.majors)}</p><div class="maj-row">${majors.map((c) => miniCard(c)).join("")}</div></article>`;
    } else if (pg === "courts") {
      area.innerHTML = `<article class="num-page"><h3>Court cards as stages</h3><p class="lead">Read the four ranks as steps in learning a suit: beginner, in motion, mastery held inward, mastery put to work.</p>
        ${D.COURT_STAGES.map((st, k) => `<div class="court-stage"><h4>${esc(st.rank)} · ${esc(st.stage)}</h4><p>${esc(st.text)}</p><div class="maj-row">${SUITS.map((s) => miniCard(pip(s, 11 + k))).join("")}</div></div>`).join("")}</article>`;
    } else if (pg === "majors") {
      area.innerHTML = `<article class="num-page"><h3>Reducing the Majors</h3>${D.MAJOR_NUMBERS.intro.map((p) => `<p>${esc(p)}</p>`).join("")}
        <table class="red-table"><thead><tr><th>Major</th><th>Adds to</th><th>Linked with</th></tr></thead><tbody>
        ${D.MAJOR_NUMBERS.pairs.map((pr) => { const [a, ...rest] = pr; const c = major(a); return `<tr><td>${miniCard(c)}</td><td>${String(a).split("").join(" + ")} = ${rest.join(" → ")}</td><td class="maj-row">${rest.map((r) => miniCard(major(r))).join("")}</td></tr>`; }).join("")}
        </tbody></table></article>`;
    } else if (pg === "birth") {
      const bd = NUMV.bday || "1997-03-07";
      const [y, m, d] = bd.split("-").map(Number);
      const r = birthCard(y, m, d);
      area.innerHTML = `<article class="num-page birth"><h3>Birth card</h3>
        <ol class="plain-ol">${D.BIRTH_CARD.method.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        <form class="birth-form" id="birthForm"><label class="field"><span>Birthday</span><input type="date" id="bdIn" value="${esc(bd)}" required /></label><button class="btn btn-gold btn-sm">Work it out</button></form>
        <div class="working"><span class="label">Working${bd === "1997-03-07" ? " · your birthday, March 7, 1997" : ""}</span><ul class="plain">${r.work.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
        <p class="birth-result">${r.chain.map((n) => `<b>${esc(major(n).name)}</b> (${n})`).join(" and ")}</p>
        <div class="maj-row">${r.chain.map((n) => miniCard(major(n))).join("")}</div>
        ${r.chain.length === 1 ? `<p>${esc(firstSents(major(r.chain[0]).upright, 2))}</p>` : `<p class="muted">With a pair, the higher card is the outer lesson and the single digit is the core of it.</p>`}
        <p class="credit">${esc(D.BIRTH_CARD.credit)}</p></article>`;
      $("#birthForm").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#bdIn").value; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { NUMV.bday = v; renderNumerology(); } });
    } else if (pg === "quiz") {
      const NQ = {
        theme() { const N = pick(D.NUMBERS); const opts = mkOpts(N, shuffle(D.NUMBERS.filter((x) => x !== N)).slice(0, 3)); return { prompt: "Which number has this theme?", media: `<blockquote class="q-quote">${esc(sents(N.theme)[0])}</blockquote>`, options: opts.map((x) => `${x.n} · ${x.name}`), answer: opts.indexOf(N), why: `${N.n}: ${NUM_SHORT[N.n]}.` }; },
        reduce() { const pr = pick(D.MAJOR_NUMBERS.pairs), c = major(pr[0]), right = pr[pr.length - 1]; const opts = shuffle([right, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== right)).slice(0, 3)]); return { prompt: `${c.name} is ${pr[0]}. Which single digit does it reduce to?`, media: cardImgTag(c, "upright", "q-img"), options: opts.map(String), answer: opts.indexOf(right), why: `${String(pr[0]).split("").join(" + ")} = ${pr.slice(1).join(", then ")}. So it links to ${major(right).name}.` }; },
        pips() { const c = pick(cards().filter((x) => x.arcana !== "major" && num(x) <= 10)), n = num(c); const opts = shuffle([n, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((x) => x !== n)).slice(0, 3)]); return { prompt: `The ${c.name.replace(/^\w+/, "…")} shows ${NUM_SHORT[n]}. Which number is it?`, media: "", options: opts.map(String), answer: opts.indexOf(n), why: `It’s the ${c.name}. ${n} is ${NUM_SHORT[n]}.` }; },
        court() { const k = Math.floor(Math.random() * 4), st = D.COURT_STAGES[k]; const opts = D.COURT_STAGES.map((x) => x.rank); return { prompt: `Which court rank is “${st.stage.toLowerCase()}”?`, media: "", options: opts, answer: k, why: `${st.rank}: ${st.text}` }; },
      };
      runQuiz(area, { title: "Number quiz", kind: "numbers", make: () => NQ[pick(Object.keys(NQ))](), n: 10, save: true, onDone: () => renderNumerology() });
    }
  }

  /* ================= LEARN ================= */
  const resByKey = () => Object.fromEntries(D.RESOURCES.flatMap((g) => g.items.map((i) => [i.key, i])));
  function renderLearn() {
    const R = resByKey(), done = P.lessons || {};
    root().innerHTML = `<section class="p-panel"><h2>Learn</h2><p class="muted">Twelve short lessons. Tick each one off when you’ve done the exercise. ${Object.keys(done).length} of ${D.LESSONS.length} done.</p>
      <div class="lessons">${D.LESSONS.map((l) => `<details class="lesson ${done[l.id] ? "done" : ""}" id="lesson-${l.id}" ${V.lesson === l.id ? "open" : ""}>
        <summary><span class="ls-check" aria-hidden="true">${done[l.id] ? "✓" : ""}</span>${esc(l.title)}</summary>
        <div class="ls-body">${l.body.map((p) => `<p>${esc(p)}</p>`).join("")}
          <div class="exercise"><span class="label">Try this</span><p>${esc(l.exercise)}</p>${l.id === "journaling" ? `<button class="btn btn-ghost btn-sm" data-go="journal">Open the Journal tab ›</button>` : ""}</div>
          ${l.cards && l.cards.length ? `<div class="maj-row">${l.cards.map((id) => miniCard(byId(id))).join("")}</div>` : ""}
          ${l.resources && l.resources.length ? `<p class="ls-res"><span class="label">Read more</span> ${l.resources.map((k) => R[k] ? `<a href="${esc(R[k].url)}" target="_blank" rel="noopener">${esc(R[k].title)}</a>` : "").join(" · ")}</p>` : ""}
          <label class="check"><input type="checkbox" data-lesson="${l.id}" ${done[l.id] ? "checked" : ""}/> Mark as done</label>
        </div></details>`).join("")}</div>
      <h3>Glossary</h3><dl class="glossary">${D.GLOSSARY.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join("")}</dl>
      <p><button class="link-btn open-resources">All resources ›</button></p></section>`;
    $$("[data-lesson]").forEach((cb) => cb.addEventListener("change", async () => {
      const id = cb.dataset.lesson;
      try { const r = await post("/api/practice/lesson", { id, done: cb.checked }); if (!DEMO) P.lessons = r.lessons; else { if (cb.checked) P.lessons[id] = new Date().toISOString(); else delete P.lessons[id]; } } catch (e) { cb.checked = !cb.checked; }
      V.lesson = id; renderLearn();
    }));
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => T().showTab(b.dataset.go)));
    $$(".lesson").forEach((d) => d.addEventListener("toggle", () => { if (d.open) V.lesson = d.id.replace("lesson-", ""); }));
  }

  /* ================= SPREADS ================= */
  const SPV = { tab: "library", detail: null };
  const PR = { spread: null, question: "", source: "app", phase: "setup", cards: [], overall: "", saved: null, readOnly: false, picker: null };
  const spreadById = (id) => D.SPREADS.find((s) => s.id === id);
  function layoutHTML(sp, fill, cls = "") {
    const covered = (p) => !p.cross && sp.positions.some((q) => q.cross && q.x === p.x && q.y === p.y);
    return `<div class="layout ${cls}" style="--cols:${sp.cols};--rows:${sp.rows}">${sp.positions.map((p, i) =>
      `<div class="slot-pos ${p.cross ? "crossing" : ""} ${covered(p) ? "covered" : ""}" style="grid-column:${p.x};grid-row:${p.y}">${fill(p, i)}</div>`).join("")}</div>`;
  }
  const numFill = (p) => `<div class="lay-card"><b>${p.n}</b><small>${esc(p.name)}</small></div>`;
  function renderSpreads() {
    const tabs = [["library", "Library"], ["practice", "Practice reading"], ["history", "History"], ["quiz", "Quiz"]];
    root().innerHTML = `<section class="p-panel"><h2>Spreads</h2>
      <div class="seg seg-sm sp-tabs" role="group" aria-label="Spread sections">${tabs.map(([k, l]) => `<button class="seg-btn ${SPV.tab === k ? "active" : ""}" data-st="${k}">${l}</button>`).join("")}</div>
      <div id="spArea"></div></section>`;
    $$("[data-st]").forEach((b) => b.addEventListener("click", () => { SPV.tab = b.dataset.st; if (b.dataset.st === "library") SPV.detail = null; if (b.dataset.st === "practice" && PR.readOnly) resetPR(); renderSpreads(); }));
    const area = $("#spArea");
    if (SPV.tab === "library") SPV.detail ? spreadDetail(area, spreadById(SPV.detail)) : spreadLibrary(area);
    else if (SPV.tab === "practice") practiceReading(area);
    else if (SPV.tab === "history") readingHistory(area);
    else spreadQuiz(area);
  }
  function spreadLibrary(area) {
    area.innerHTML = `<div class="spread-grid">${D.SPREADS.map((s) => `<button class="spread-tile" data-sp="${s.id}"><div class="mini-lay">${layoutHTML(s, (p) => `<i>${p.n}</i>`, "tiny")}</div><b>${esc(s.name)}</b><small>${s.count} card${s.count === 1 ? "" : "s"}</small></button>`).join("")}</div>`;
    $$("[data-sp]", area).forEach((b) => b.addEventListener("click", () => { SPV.detail = b.dataset.sp; renderSpreads(); window.scrollTo({ top: 0 }); }));
  }
  function spreadDetail(area, s) {
    area.innerHTML = `<article class="spread-detail"><button class="link-btn" id="spBack">‹ All spreads</button>
      <h3>${esc(s.name)} <small class="muted">· ${s.count} card${s.count === 1 ? "" : "s"}</small></h3>
      ${layoutHTML(s, numFill, s.id === "celtic" ? "celtic" : "")}
      <p><span class="label">When to use it</span> ${esc(s.when)}</p>
      <ol class="pos-list">${s.positions.map((p) => `<li><b>${esc(p.name)}</b> · ${esc(p.meaning)}</li>`).join("")}</ol>
      <div class="exercise"><span class="label">How to read it</span><p>${esc(s.lesson)}</p></div>
      <div class="actions"><button class="btn btn-gold" id="spPractice">Practice this spread</button></div></article>`;
    $("#spBack").addEventListener("click", () => { SPV.detail = null; renderSpreads(); });
    $("#spPractice").addEventListener("click", () => { resetPR(); PR.spread = s; SPV.tab = "practice"; renderSpreads(); });
  }
  function resetPR() { Object.assign(PR, { phase: "setup", cards: [], overall: "", saved: null, readOnly: false, picker: null, question: PR.readOnly ? "" : PR.question }); }
  function practiceReading(area) {
    const s = PR.spread || spreadById("ppf");
    if (PR.phase === "setup") {
      area.innerHTML = `<div class="pr-setup">
        <label class="field"><span>Spread</span><select id="prSpread">${D.SPREADS.map((x) => `<option value="${x.id}" ${x.id === s.id ? "selected" : ""}>${esc(x.name)} (${x.count})</option>`).join("")}</select></label>
        <label class="field"><span>Question <em>(optional)</em></span><input id="prQ" maxlength="300" value="${esc(PR.question)}" placeholder="What do I need to see about…" /></label>
        <div class="seg seg-sm" role="group" aria-label="Deck"><button class="seg-btn ${PR.source === "app" ? "active" : ""}" data-src="app">App deck</button><button class="seg-btn ${PR.source === "real" ? "active" : ""}" data-src="real">My own deck</button></div>
        ${layoutHTML(s, numFill, s.id === "celtic" ? "celtic" : "")}
        <div class="actions"><button class="btn btn-gold" id="prStart">${PR.source === "app" ? "Deal the cards" : "Enter my cards"}</button></div></div>`;
      $("#prSpread").addEventListener("change", (e) => { PR.spread = spreadById(e.target.value); PR.question = $("#prQ").value; practiceReading(area); });
      $$("[data-src]", area).forEach((b) => b.addEventListener("click", () => { PR.source = b.dataset.src; PR.question = $("#prQ").value; practiceReading(area); }));
      $("#prStart").addEventListener("click", () => {
        PR.spread = s; PR.question = $("#prQ").value.trim();
        if (PR.source === "app") { const deck = shuffle(cards()); PR.cards = s.positions.map((p, i) => ({ card: deck[i], orientation: Math.random() < 0.4 ? "reversed" : "upright", faceUp: false, note: "" })); PR.phase = "deal"; }
        else { PR.cards = []; PR.picker = { card: null, orientation: "upright" }; PR.phase = "pick"; }
        practiceReading(area);
      });
      return;
    }
    if (PR.phase === "pick") {
      const i = PR.cards.length, p = s.positions[i];
      area.innerHTML = `<p class="hint">Card ${i + 1} of ${s.count}: <b>${esc(p.name)}</b> · ${esc(p.meaning)}</p><div id="prPicker"></div>
        <div class="actions"><button class="btn btn-gold" id="prNext" disabled>${i + 1 < s.count ? "Next position ›" : "Done"}</button></div>`;
      Picker($("#prPicker"), PR.picker, () => { $("#prNext").disabled = !PR.picker.card; });
      $("#prNext").addEventListener("click", () => {
        PR.cards.push({ card: PR.picker.card, orientation: PR.picker.orientation, faceUp: true, note: "" });
        PR.picker = { card: null, orientation: "upright", group: PR.picker.group };
        if (PR.cards.length >= s.count) PR.phase = "notes";
        practiceReading(area);
      });
      return;
    }
    const slotCard = (p, i) => { const d = PR.cards[i]; return d.faceUp ? `<button class="lay-card face-up ${p.cross ? "crossed" : ""}" data-slot="${i}" title="${esc(d.card.name)}">${cardImgTag(d.card, d.orientation)}<small>${p.n}</small></button>` : `<button class="lay-card cardback" data-slot="${i}" aria-label="Turn over card ${p.n}, ${esc(p.name)}"><small>${p.n}</small></button>`; };
    const head = `${PR.question ? `<p class="pr-q">“${esc(PR.question)}”</p>` : ""}${layoutHTML(s, slotCard, s.id === "celtic" ? "celtic" : "")}`;
    if (PR.phase === "deal") {
      area.innerHTML = `${head}<p class="hint center">Tap each card to turn it over, in order.</p><div class="actions"><button class="btn btn-ghost btn-sm" id="prAll">Turn all</button></div>`;
      $$("[data-slot]", area).forEach((b) => b.addEventListener("click", () => { PR.cards[Number(b.dataset.slot)].faceUp = true; if (PR.cards.every((d) => d.faceUp)) PR.phase = "notes"; practiceReading(area); }));
      $("#prAll").addEventListener("click", () => { PR.cards.forEach((d) => (d.faceUp = true)); PR.phase = "notes"; practiceReading(area); });
      return;
    }
    if (PR.phase === "notes") {
      area.innerHTML = `${head}<p class="hint">Write what you see in each position before looking anything up.</p>
        <ol class="pr-list">${s.positions.map((p, i) => { const d = PR.cards[i]; return `<li><div class="pr-head">${cardImgTag(d.card, d.orientation, "thumb-sm")}<div><b>${p.n}. ${esc(p.name)}</b> <small class="muted">${esc(p.meaning)}</small><br/>${esc(d.card.name)}${isRev(d.orientation) ? " <small>(reversed)</small>" : ""}</div></div>
          <textarea rows="2" maxlength="4000" data-note="${i}" placeholder="Your reading of this card here">${esc(d.note)}</textarea></li>`; }).join("")}</ol>
        <label class="field"><span>The whole picture</span><textarea id="prOverall" rows="3" maxlength="4000" placeholder="How do the cards talk to each other?">${esc(PR.overall)}</textarea></label>
        <div class="actions"><button class="btn btn-gold" id="prReveal">Reveal the book meanings</button></div>`;
      $$("[data-note]", area).forEach((t) => t.addEventListener("input", () => { PR.cards[Number(t.dataset.note)].note = t.value; }));
      $("#prOverall").addEventListener("input", (e) => { PR.overall = e.target.value; });
      $("#prReveal").addEventListener("click", async () => {
        PR.phase = "reveal"; practiceReading(area);
        try {
          const r = await post("/api/practice/reading", { spreadId: s.id, spreadName: s.name, question: PR.question, source: PR.source, overall: PR.overall,
            cards: PR.cards.map((d, i) => ({ id: d.card.id, orientation: d.orientation, position: s.positions[i].name, note: d.note })) });
          PR.saved = r.reading; if (!DEMO) P.readings.push(r.reading);
          const st = $("#prStatus"); if (st) st.textContent = "Saved to your practice readings (not your journal).";
        } catch (e) { const st = $("#prStatus"); if (st) st.textContent = "Couldn’t save: " + e.message; }
      });
      return;
    }
    // reveal
    area.innerHTML = `${head}
      <ol class="pr-list">${s.positions.map((p, i) => { const d = PR.cards[i], c = d.card, k = kws(c, d.orientation, 3);
        const ref = `${p.name} (${p.meaning.charAt(0).toLowerCase() + p.meaning.slice(1)}): ${cap(theName(c.name))}${isRev(d.orientation) ? " reversed" : ""} points to ${k.length > 1 ? k.slice(0, -1).join(", ") + " and " + k[k.length - 1] : k[0] || "its core meaning"}. ${firstSents(isRev(d.orientation) ? c.reversed : c.upright, 2)}`;
        return `<li><div class="pr-head">${cardImgTag(c, d.orientation, "thumb-sm")}<div><b>${p.n}. ${esc(p.name)}</b><br/>${esc(c.name)}${isRev(d.orientation) ? " <small>(reversed)</small>" : ""}</div></div>
          <div class="pr-compare"><div class="sp-note"><span class="label">Your note</span><p>${d.note ? esc(d.note) : "<em class='muted'>No note.</em>"}</p></div><div><span class="label">The book</span><p>${esc(ref)}</p><button class="link-btn open-card" data-id="${c.id}" data-o="${d.orientation}">Full card page ›</button></div></div></li>`; }).join("")}</ol>
      ${PR.overall ? `<div class="sp-note"><span class="label">Your whole picture</span><p>${esc(PR.overall)}</p></div>` : ""}
      ${overviewHTML(PR.cards)}
      <p class="status" id="prStatus" role="status">${PR.readOnly ? `Saved ${esc(T().short(PR.savedDate || today()))}.` : ""}</p>
      <div class="actions"><button class="btn btn-gold" id="prNew">New practice reading</button></div>`;
    $$("[data-slot]", area).forEach((b) => b.addEventListener("click", () => { const d = PR.cards[Number(b.dataset.slot)]; T().openCard(d.card.id, d.orientation, ["meaning"]); }));
    $("#prNew").addEventListener("click", () => { resetPR(); PR.question = ""; practiceReading(area); });
  }
  function overviewHTML(list) {
    const cs = list.map((d) => d.card), n = cs.length;
    const majors = cs.filter((c) => c.arcana === "major").length;
    const suitCount = Object.fromEntries(SUITS.map((s) => [s, cs.filter((c) => c.suit === s).length]));
    const missing = SUITS.filter((s) => !suitCount[s]);
    const nums = {}; cs.filter((c) => c.arcana !== "major" && num(c) <= 10).forEach((c) => { nums[num(c)] = (nums[num(c)] || 0) + 1; });
    const reps = Object.entries(nums).filter(([, v]) => v > 1);
    const courts = cs.filter((c) => c.arcana !== "major" && num(c) > 10);
    const rev = list.filter((d) => isRev(d.orientation)).length;
    const top = SUITS.filter((s) => suitCount[s]).sort((a, b) => suitCount[b] - suitCount[a]);
    const lines = [];
    lines.push(`${majors} of ${n} card${n === 1 ? "" : "s"} ${majors === 1 ? "is a Major" : "are Majors"}${n > 1 ? ` (${Math.round((majors / n) * 100)}%)` : ""}. ${majors / n >= 0.5 ? "A high share usually marks a bigger turning point." : majors ? "The Majors mark the bigger themes; the rest is day to day." : "All Minors: this is about daily life and choices in your hands."}`);
    if (top.length) lines.push(`Suits: ${top.map((s) => `${suitCount[s]} ${s} (${SUIT_TOPIC[s]})`).join(", ")}.`);
    if (missing.length && n >= 4) lines.push(`Missing: ${missing.join(", ")}. Notice what the reading leaves out.`);
    if (reps.length) lines.push(`Repeated numbers: ${reps.map(([k, v]) => `${v} × ${k} (${NUM_SHORT[k]})`).join(", ")}.`);
    if (courts.length) lines.push(`${courts.length} court card${courts.length === 1 ? "" : "s"}: ${courts.map((c) => c.name).join(", ")}. These can be people, or sides of you.`);
    lines.push(rev ? `${rev} reversed. In this app’s traditional reading, reversals show something blocked, delayed or overdone.` : "No reversals.");
    const els = top.map((s) => ELEMENT[s]);
    if (els.length) lines.push(`Elements present: ${[...new Set(els)].join(", ")}.`);
    return `<div class="overview study"><span class="label">Study aid · templated from the card list, for learning only</span><ul class="plain">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`;
  }
  function readingHistory(area) {
    const list = [...(P.readings || [])].reverse();
    area.innerHTML = list.length ? `<ul class="pull-list">${list.map((r) => `<li><button class="link-btn" data-rd="${r.id}"><b>${esc(T().short(r.date))}</b> · ${esc(r.spreadName)}${r.question ? ` · “${esc(r.question)}”` : ""}</button><div class="maj-row">${r.cards.map((c) => { const k = byId(c.id); return k ? `<span class="thumb-sm">${cardImgTag(k, c.orientation)}</span>` : ""; }).join("")}</div></li>`).join("")}</ul>` : `<p class="muted">No practice readings yet.</p>`;
    $$("[data-rd]", area).forEach((b) => b.addEventListener("click", () => {
      const r = P.readings.find((x) => x.id === b.dataset.rd), s = spreadById(r.spreadId); if (!s) return;
      Object.assign(PR, { spread: s, question: r.question || "", source: r.source, overall: r.overall || "", phase: "reveal", readOnly: true, savedDate: r.date,
        cards: r.cards.map((c) => ({ card: byId(c.id), orientation: c.orientation, faceUp: true, note: c.note || "" })) });
      SPV.tab = "practice"; renderSpreads();
    }));
  }
  function spreadQuiz(area) {
    const SQ = {
      position() { const s = pick(D.SPREADS.filter((x) => x.count >= 3)), p = pick(s.positions); let pool = s.positions.filter((x) => x !== p).map((x) => x.name); if (pool.length < 3) pool = pool.concat(D.SPREADS.flatMap((x) => x.positions.map((y) => y.name))); pool = [...new Set(pool)].filter((x) => x !== p.name); const opts = shuffle([p.name, ...shuffle(pool).slice(0, 3)]); return { prompt: `In the ${s.name}, what is position ${p.n}?`, media: `<div class="mini-lay q-lay">${layoutHTML(s, (x) => `<i class="${x === p ? "hi" : ""}">${x.n}</i>`, "tiny")}</div>`, options: opts, answer: opts.indexOf(p.name), why: `Position ${p.n} is ${p.name}: ${p.meaning}.` }; },
      count() { const s = pick(D.SPREADS); const wrong = shuffle([1, 3, 5, 6, 7, 10, 12].filter((x) => x !== s.count)).slice(0, 3); const opts = shuffle([s.count, ...wrong]); return { prompt: `How many cards does the ${s.name} use?`, media: "", options: opts.map(String), answer: opts.indexOf(s.count), why: `The ${s.name} uses ${s.count}.` }; },
      which() { const s = pick(D.SPREADS.filter((x) => x.count > 1)), p = pick(s.positions); const others2 = shuffle(D.SPREADS.filter((x) => x !== s && !x.positions.some((y) => y.name === p.name))).slice(0, 3); const opts = shuffle([s, ...others2]); return { prompt: `Which spread has a position called “${p.name}”?`, media: "", options: opts.map((x) => x.name), answer: opts.indexOf(s), why: `${s.name}, position ${p.n}: ${p.meaning}.` }; },
    };
    runQuiz(area, { title: "Spread quiz", kind: "spreads", make: () => SQ[pick(Object.keys(SQ))](), n: 10, save: true, onDone: () => { SPV.tab = "library"; renderSpreads(); } });
  }

  /* ================= boot + screenshot hooks ================= */
  let hooksDone = false, shown = false;
  function applyHooks() {
    if (hooksDone) return; hooksDone = true;
    const g = (k) => params.get(k);
    if (g("pv")) setView(g("pv"));
    if (g("num")) NUMV.page = g("num");
    if (g("bday")) { NUMV.page = "birth"; NUMV.bday = g("bday"); }
    if (g("lesson")) V.lesson = g("lesson");
    if (g("stab")) SPV.tab = g("stab");
    if (g("spread")) { SPV.detail = g("spread"); SPV.tab = SPV.tab === "library" ? "library" : SPV.tab; }
    if (g("pcount") === "3") SP.count = 3;
    if (g("own") === "1") SP.own = true;
    if (g("norev") === "1") SP.reversals = false;
    const ids = (g("pcard") || "").split(",").filter(Boolean), os = (g("po") || "").split(",");
    const imps = (g("pimp") || "").split("|");
    if (g("ps") === "fan") { SP.deck = shuffle(cards().map((c) => c.id)); SP.phase = "fan"; const k = Number(g("psel") || 0); if (k) SP.selected = SP.deck.slice(k, k + SP.count); }
    if ((g("ps") === "drawn" || g("ps") === "meaning" || g("ps") === "face") && ids.length) {
      SP.count = ids.length === 3 ? 3 : 1;
      SP.drawn = ids.slice(0, SP.count).map((id, i) => ({ card: byId(id), orientation: os[i] === "reversed" || os[i] === "r" ? "reversed" : "upright", faceUp: g("ps") !== "face", impression: imps[i] || "", meaning: g("ps") === "meaning", rating: g("ps") === "meaning" ? g("prate") || null : null, position: SP.count === 3 ? PPF[i] : null }));
      SP.phase = "drawn";
    }
    if (g("ps") === "pick" && SP.own && ids.length) { SP.phase = "pick"; SP.pickers = [{ card: byId(ids[0]), orientation: os[0] === "reversed" ? "reversed" : "upright", done: false }]; }
    if (g("preading")) {
      const s = spreadById(g("preading")); SPV.tab = "practice"; PR.spread = s; PR.question = g("pq") || "";
      const pc = (g("pcards") || "").split(",").filter(Boolean).map((x) => { const [id, o] = x.split(":"); return { card: byId(id), orientation: o === "r" || o === "reversed" ? "reversed" : "upright", faceUp: true, note: "" }; });
      if (s && pc.length === s.count) {
        PR.cards = pc; PR.phase = g("reveal") === "1" ? "reveal" : "notes";
        if (g("pnotes")) { const notes = g("pnotes").split("|"); PR.cards.forEach((d, i) => (d.note = notes[i] || "")); PR.overall = g("poverall") || ""; }
        if (g("pfacedown") === "1") { PR.phase = "deal"; PR.cards.forEach((d, i) => (d.faceUp = i < Number(g("pturned") || 0))); }
      }
    }
    if (g("pmode")) V.mode = g("pmode");
  }
  function afterRenderHooks() {
    const g = (k) => params.get(k);
    if (V.view === "practice" && V.mode === "flash" && g("pflip") === "1") { const c = $("#fcCard"); if (c) { FC.flipped = true; FC.redraw(); } }
    if (g("qans") !== null && (V.mode === "quiz" || (V.view === "numerology" && NUMV.page === "quiz") || (V.view === "spreads" && SPV.tab === "quiz"))) {
      if (V.mode === "quiz") { const b = $(`[data-qk="${g("qkind") || "mixed"}"]`); if (b) b.click(); }
      runQuiz.answer(Number(g("qans")));
    }
    if (V.lesson && V.view === "learn") { const el = $("#lesson-" + V.lesson); if (el) el.scrollIntoView({ block: "start" }); }
    if (g("pscroll")) { const el = $(g("pscroll")); if (el) el.scrollIntoView({ block: "start" }); }
  }
  async function boot() {
    try { await loadPractice(); } catch (e) { root().innerHTML = `<p class="status">Couldn’t load practice data: ${esc(e.message)}</p>`; return; }
    if (!P.dailyDone) P.dailyDone = [];
    if (!$("#panel-practice").hidden) show();
  }
  function show() {
    if (!P) return;
    if (!shown) { shown = true; applyHooks(); render(); afterRenderHooks(); }
  }
  window.TarotApp = window.TarotApp || {};
  window.TarotApp.onShow = (name) => { if (name === "practice") show(); };
  window.TarotPractice = { birthCard, P: () => P, SP, render };
  if (window.TarotApp.S && window.TarotApp.S.cards && window.TarotApp.S.cards.length) boot();
  else document.addEventListener("tarot:ready", boot, { once: true });
})();
