/* v17: data calls are answered by backend.js (Supabase); no ngrok header needed any more. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const base = (p) => String(p || "").split("/").pop();
  const deckImg = (p) => "/deck-img/" + base(p);
  const journalImg = (p) => "/journal-img/" + base(p);
  const thumbImg = (p) => "/deck-thumb/" + base(p);     // ~240px JPEG for grids, pickers and small images
  const uploadUrl = (p) => "/" + String(p || "").replace(/^\/+/, "");
  const REVERSED_CHANCE = 0.4;
  const LABELS = { lcr: ["Left", "Center", "Right"], ppf: ["Past", "Present", "Future"] };
  const TABS = ["today", "journal", "compat", "guests", "cards", "practice", "astro", "meditate", "friends"];
  const MORE_TABS = ["compat", "guests", "astro", "meditate", "friends"];   // behind "More" in the phone bottom bar

  const S = {
    cards: [], byName: new Map(), entries: [], gaps: [], guests: [], outbox: [],
    src: "digital", count: 1, labels: "lcr", deck: [], drawn: [], saved: false, savedMine: false, todayView: "draw",
    pickSlot: 0, pickOpen: true, pickGroup: null, lastShare: null,
    jIndex: 0, suit: "all", query: "", medLoaded: false, guestSel: null,
  };

  function localDate(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function fmtDate(iso, opts = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  }
  const short = (iso) => fmtDate(iso, { month: "short", day: "numeric" });
  const isRev = (o) => String(o || "").toLowerCase() === "reversed";
  const isUnknown = (o) => String(o || "").toLowerCase() === "unknown";
  const badge = (o) => isUnknown(o) ? `<span class="badge unknown">Orientation not recorded</span>`
    : `<span class="badge ${isRev(o) ? "reversed" : ""}">${isRev(o) ? "Reversed" : "Upright"}</span>`;
  /* first sentence of a meaning, for the one-line summaries */
  const oneLine = (t) => { const s = String(t || "").trim().split(/(?<=[.!?])\s+(?=[A-Z“"‘'])/)[0] || ""; return s.length > 170 ? s.slice(0, 165).replace(/\s+\S*$/, "") + "…" : s; };
  const cardFor = (c) => S.cards.find((x) => x.id === c.id) || S.byName.get(String(c.name || "").toLowerCase()) || null;
  const entryLine = (c, k) => isUnknown(c.orientation)
    ? (k ? "Upright, it would mean: " + oneLine(k.upright) : "Orientation not recorded.")
    : oneLine(c.summary || (k && (isRev(c.orientation) ? k.reversed : k.upright)));
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const kwHTML = (c, o) => { const k = c.keywords && c.keywords[isRev(o) ? "reversed" : "upright"]; return Array.isArray(k) && k.length ? `<div class="kw ${isRev(o) ? "rev" : ""}">${k.map((w) => `<span>${esc(w)}</span>`).join("")}</div>` : ""; };
  /* Card info sections (Cards modal, Today, Journal): native <details> so they fold nicely on a phone. */
  const LEAN = { "Yes": "yes", "Leans yes": "yes", "Maybe": "maybe", "Not yet": "wait", "Leans no": "no", "No": "no" };
  const WAITE_SRC = "A. E. Waite, The Pictorial Key to the Tarot (1911)";
  function infoHTML(c, o, { open = ["meaning"], skip = [], extra = [] } = {}) {
    const rev = isRev(o), side = rev ? "reversed" : "upright";
    const t = (c.topics && c.topics[side]) || {}, w = c.waite || null;
    const p = (v) => (v ? `<p>${esc(v)}</p>` : "");
    const sec = (key, title, body) => (body && !skip.includes(key)
      ? `<details class="info-sec" data-key="${key}"${open.includes(key) ? " open" : ""}><summary>${title}</summary><div class="info-body">${body}</div></details>` : "");
    const yn = t.yesNo ? `<p class="yn"><span class="lean lean-${LEAN[t.yesNo.lean] || "maybe"}">${esc(t.yesNo.lean)}</span><span>${esc(t.yesNo.why)}</span></p>` : "";
    const sym = c.symbols && c.symbols.length ? `<ul class="symbols">${c.symbols.map((x) => `<li><strong>${esc(x.symbol)}</strong><span>${esc(x.meaning)}</span></li>`).join("")}</ul>` : "";
    const wq = w && (w[side] || w.picture) ? [
      w[side] ? `<blockquote class="waite-quote"><span class="wq-label">${rev ? "Reversed" : "Divinatory meanings"}</span>${esc(w[side])}</blockquote>` : "",
      c.waiteNote && c.waiteNote[side] ? `<div class="wq-plain"><span class="wq-label">In plain words</span><p>${esc(c.waiteNote[side])}</p></div>` : "",
      rev && w.note ? `<p class="wq-note">${esc(w.note)}</p>` : "",
      w.picture ? `<blockquote class="waite-quote picture"><span class="wq-label">The picture</span>${esc(w.picture)}</blockquote>` : "",
      `<p class="wq-source">${esc(w.source || WAITE_SRC)}</p>`].join("") : "";
    const stars = c.numerologyAstrology ? `${c.element ? `<span class="el-tag">${esc(c.element)}</span>` : ""}${p(c.numerologyAstrology)}` : "";
    return `<div class="info">${[
      sec("meaning", "Meaning", kwHTML(c, o) + p(rev ? c.reversed : c.upright)),
      sec("love", "Love", p(t.love)),
      sec("work", "Work", p(t.work)),
      sec("money", "Money", p(t.money)),
      sec("advice", "Advice", p(t.advice)),
      sec("person", "As a person", p(t.asAPerson)),
      sec("yesno", "Yes or no", yn),
      sec("symbols", "Symbols", sym),
      sec("waite", "Waite’s words", wq),
      sec("older", "Older meanings", olderHTML(c.olderMeanings)),
      sec("imagehist", "Imagery history", p(c.imageryHistory)),
      sec("history", "History", p(c.history)),
      sec("stars", "Number and stars", stars),
      sec("spread", "Reading it with other cards", p(c.inASpread)),
      sec("sit", "Sit with", c.sitWith ? `<p class="sit">${esc(c.sitWith)}</p>` : ""),
      sec("readmore", "Read more", readMoreHTML(c)),
      ...extra.map(([k, title, body]) => sec(k, title, body)),
    ].join("")}</div>`;
  }

  /* Older meanings: verbatim Mathers (1888), Book T (1912) title, Waite's extra Lesser Arcana list, then our plain note. */
  function olderHTML(om) {
    if (!om) return "";
    const q = (v) => `“${esc(String(v).replace(/[.\s]+$/, ""))}.”`;
    const m = om.mathers, g = om.goldenDawn, wa = om.waiteAdditional;
    return [
      m ? `<div class="older-block"><h5>Mathers, 1888 <span>“${esc(m.title)}”</span></h5>
        <p><b>Upright</b> ${q(m.upright)}</p><p><b>Reversed</b> ${q(m.reversed)}</p>
        ${m.remarks ? `<p class="older-rem"><b>Etteilla's notes, via Mathers</b> ${q(m.remarks)}</p>` : ""}
        <p class="wq-source"><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.source)}</a></p></div>` : "",
      g ? `<div class="older-block"><h5>Golden Dawn, Book T</h5><p class="older-title">“${esc(g.title)}”</p>
        ${g.printedFor ? `<p class="older-rem">Printed in 1912 under the heading ${esc(g.printedFor)}.</p>` : ""}
        <p class="wq-source"><a href="${esc(g.url)}" target="_blank" rel="noopener">${esc(g.source)}</a></p></div>` : "",
      wa ? `<div class="older-block"><h5>Waite's additional meanings</h5>
        ${wa.upright ? `<p><b>Upright</b> ${q(wa.upright)}</p>` : ""}${wa.reversed ? `<p><b>Reversed</b> ${q(wa.reversed)}</p>` : ""}
        <p class="wq-source"><a href="${esc(wa.url)}" target="_blank" rel="noopener">Waite, Pictorial Key, Part III §4</a></p></div>` : "",
      om.note ? `<p class="older-note">${esc(om.note)}</p>` : "",
    ].join("");
  }
  function readMoreHTML(c) {
    const r = c.readMore; if (!r) return "";
    const li = (u, t, sub) => u ? `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a><small>${esc(sub)}</small></li>` : "";
    return `<ul class="readmore">${li(r.pictorialKey, `Waite on the ${c.name}`, "The Pictorial Key, sacred-texts.com · free")}${li(r.pictorialKeyWikisource, "The Pictorial Key on Wikisource", "Searchable full text · free")}${li(r.mathers, "Mathers' 1888 meanings", "sacred-texts.com archive · free")}</ul>
      <button type="button" class="link-btn open-resources">All resources ›</button>`;
  }
  function resourcesHTML() {
    const R = (window.PRACTICE_DATA && window.PRACTICE_DATA.RESOURCES) || [];
    return `<div class="resources"><h2 id="modalTitle">Resources</h2>
      <p class="muted">Books and pages for going further. Free ones are marked. The app quotes only Waite, Mathers and Book T; the other books are listed for what they cover.</p>
      ${R.map((g) => `<section><h4>${esc(g.group)}</h4><ul>${g.items.map((it) => `<li><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>${it.free ? ` <span class="free">free</span>` : ` <span class="paid">book</span>`}<p>${esc(it.note)}</p></li>`).join("")}</ul></section>`).join("")}</div>`;
  }
  function openResources() {
    $("#modalBody").innerHTML = resourcesHTML();
    $("#modal").hidden = false; $(".modal-card").scrollTop = 0; $(".modal-close").focus();
  }
  document.addEventListener("click", (e) => { if (e.target.closest(".open-resources")) { e.preventDefault(); openResources(); } });
  const openKeys = (root) => $$("details.info-sec[open]", root).map((d) => d.dataset.key);
  const photosHTML = (paths) => paths && paths.length ? `<div class="photos-row">${paths.map((p) => `<a href="${esc(uploadUrl(p))}" target="_blank" rel="noopener"><img src="${esc(uploadUrl(p))}" alt="Photo of the cards" loading="lazy" /></a>`).join("")}</div>` : "";

  /* v10: ride out 1-2 minute public-link drops. GETs retry with backoff (and the service worker serves the last
     good copy meanwhile); writes are sent again once only when the server treats a repeat as harmless. */
  const DELAYS = [3000, 6000, 12000]; const MAX_WAIT = 180000;
  const SAFE_RESEND = /^\/api\/(entries|gaps\/resolve)$/; // entries skips exact duplicates; resolve is idempotent
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let probing = null;
  function banner(on, text) {
    let b = document.getElementById("netBanner");
    if (!b) { b = document.createElement("div"); b.id = "netBanner"; b.setAttribute("role", "status"); b.setAttribute("aria-live", "polite"); document.body.appendChild(b); }
    if (text) b.textContent = text;
    b.hidden = !on;
  }
  class NetDrop extends Error {}
  // after a drop (or a "no such guest"), reload guests/entries from the network so writes never use stale ids
  // never re-renders an open "add reading" form, so nothing she typed is lost
  function refreshLists() {
    setTimeout(async () => {
      try {
        const [entries, gaps, guests, outbox] = await fetchAll();
        Object.assign(S, { entries, gaps, guests, outbox });
        renderRecap(); renderGaps(); renderJournal(); renderAstro(); renderSavedToday();
        if (!document.getElementById("nrSave")) renderGuestsTab();
        else $("#guestNames").innerHTML = S.guests.map((g) => `<option value="${esc(g.name)}"></option>`).join("");
      } catch (_) {}
    }, 0);
  }
  async function rawApi(path, body) {
    let res;
    try { res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: path === "/api/cards" ? "default" : "no-store" }); }
    catch (_) { throw new NetDrop("offline"); }
    if (res.status === 401) { location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search + location.hash); throw new Error("Please log in again"); }
    const ct = res.headers.get("content-type") || "";
    if (res.headers.get("ngrok-error-code") || !ct.includes("json") || res.status === 502 || res.status === 503 || res.status === 504) throw new NetDrop("bad gateway"); // ngrok offline / warning page
    const data = await res.json().catch(() => { throw new NetDrop("bad json"); });
    if (res.status === 404 && data.error === "no such guest") {
      refreshLists();
      const err = new Error("that guest isn’t on the server (the list was out of date). Guests has been refreshed; tap save again. Your cards are still filled in.");
      err.noGuest = true; throw err;
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return { data, offline: res.headers.get("X-Tarot-Offline") === "1" };
  }
  function waitForLink() {
    if (probing) return probing;
    banner(true, "Reconnecting…");
    probing = (async () => {
      const t0 = Date.now();
      for (let i = 0; Date.now() - t0 < MAX_WAIT; i++) {
        await sleep(DELAYS[i] || 20000);
        try { const r = await rawApi("/api/today"); if (!r.offline) { banner(false); refreshLists(); return true; } } catch (e) { if (!(e instanceof NetDrop)) { banner(false); refreshLists(); return true; } }
      }
      banner(true, "Still offline. Your screen is kept; pull down to refresh later.");
      return false;
    })().finally(() => { probing = null; });
    return probing;
  }
  async function api(path, body) {
    if (!body) {
      for (;;) {
        try {
          const r = await rawApi(path);
          if (r.offline) waitForLink(); // cached copy now, banner + background reconnect
          return r.data;
        } catch (e) {
          if (!(e instanceof NetDrop)) throw e;
          if (!(await waitForLink())) throw new Error("The connection dropped. Pull down to refresh, or reopen the app.");
        }
      }
    }
    try { return (await rawApi(path, body)).data; }
    catch (e) {
      if (!(e instanceof NetDrop)) throw e;
      if (!SAFE_RESEND.test(path)) { waitForLink(); throw new Error("Not saved yet: the connection dropped. Please tap save again once \u201cReconnecting…\u201d is gone."); }
      banner(true, "Reconnecting… not saved yet, will retry");
      if (!(await waitForLink())) throw new Error("Not saved yet: still offline. Please try again later.");
      try { return (await rawApi(path, body)).data; }
      catch (e2) { if (e2 instanceof NetDrop) throw new Error("Not saved yet: the connection dropped again. Please tap save again."); throw e2; }
    }
  }
  function segSelect(group, btn) { $$(".seg-btn", group).forEach((b) => b.classList.toggle("active", b === btn)); }

  /* ---------- reusable: card tag list (search + orientation [+ position]) ---------- */
  function TagList(container, { withPos = false, onChange = () => {} } = {}) {
    const rows = [];
    function render() {
      container.innerHTML = rows.map((r, i) => `
        <div class="tag-row ${withPos ? "with-pos" : ""}" data-i="${i}">
          <input list="cardNames" placeholder="Card name…" aria-label="Card name" value="${esc(r.text || "")}" />
          ${withPos ? `<input class="pos" placeholder="Position (e.g. Past)" aria-label="Position" value="${esc(r.position || "")}" />` : ""}
          <div class="seg seg-sm"><button type="button" class="seg-btn ${!isRev(r.orientation) ? "active" : ""}" data-o="upright">Upright</button><button type="button" class="seg-btn ${isRev(r.orientation) ? "active" : ""}" data-o="reversed">Reversed</button></div>
          <button type="button" class="x" aria-label="Remove card">×</button>
        </div>`).join("") + `<button type="button" class="link-btn">＋ Add a card</button>`;
      $$(".tag-row", container).forEach((el) => {
        const r = rows[Number(el.dataset.i)];
        const inp = $("input:not(.pos)", el);
        inp.addEventListener("input", () => { r.text = inp.value; r.card = S.byName.get(inp.value.trim().toLowerCase()) || null; onChange(); });
        const pos = $(".pos", el); if (pos) pos.addEventListener("input", () => { r.position = pos.value; onChange(); });
        $$("[data-o]", el).forEach((b) => b.addEventListener("click", () => { segSelect(b.parentElement, b); r.orientation = b.dataset.o; onChange(); }));
        $(".x", el).addEventListener("click", () => { rows.splice(Number(el.dataset.i), 1); render(); onChange(); });
      });
      $(".link-btn", container).addEventListener("click", () => { rows.push({ text: "", card: null, orientation: "upright" }); render(); const ins = $$("input:not(.pos)", container); ins[ins.length - 1].focus(); });
    }
    render();
    return {
      cards: (source) => rows.filter((r) => r.card).map((r) => ({ id: r.card.id, orientation: r.orientation, source, ...(withPos && r.position ? { position: r.position } : {}) })),
      rows: () => rows.filter((r) => r.card).map((r) => ({ card: r.card, orientation: r.orientation, position: withPos ? (r.position || "") : "" })),
      unknown: () => rows.filter((r) => r.text && r.text.trim() && !r.card).map((r) => r.text.trim()),
      reset: () => { rows.length = 0; render(); },
      load: (list) => { rows.length = 0; list.forEach((x) => rows.push({ text: x.card.name, card: x.card, orientation: x.orientation, position: x.position || "" })); render(); onChange(); },
    };
  }

  function horoscopeText(h) {
    const b3 = h.big_three || {};
    return [`Big three: Sun in ${b3.Sun}, Moon in ${b3.Moon}${b3.Ascendant ? `, ${b3.Ascendant} rising` : ""}.`, h.note || "", ...h.text,
      h.dos && h.dos.length ? "Do: " + h.dos.join(" ") : "", h.donts && h.donts.length ? "Don’t: " + h.donts.join(" ") : ""].filter(Boolean).join("\n");
  }
  function wireGuestBirth(g) {
    const box = $("#gInsight");
    const show = (kind, title, text) => {
      box.innerHTML = `<article class="g-reading"><header><h3>${esc(title)}</h3></header><p class="g-text" style="white-space:pre-line">${esc(text)}</p>
        <div class="actions" style="justify-content:flex-start"><button class="btn btn-gold btn-sm" id="gInsSave">Save to ${esc(g.name)}’s history</button></div><p class="status" id="gInsSt"></p></article>`;
      $("#gInsSave").addEventListener("click", async () => {
        try { $("#gInsSave").disabled = true; await api(`/api/guests/${g.id}/insights`, { kind, title, text }); $("#gInsSt").textContent = "Saved."; await loadAll(); }
        catch (e) { $("#gInsSt").textContent = "Couldn’t save: " + e.message; $("#gInsSave").disabled = false; }
      });
    };
    $("#gbSave").addEventListener("click", async () => {
      const st = $("#gbStatus");
      try {
        st.textContent = "Saving…";
        await api(`/api/guests/${g.id}/profile`, { birth_date: $("#gbDate").value, birth_time: $("#gbTime").value, birth_place: $("#gbPlace").value,
          birth_name: $("#gbName").value, lat: $("#gbLat").value.trim(), lon: $("#gbLon").value.trim(), tz: $("#gbTz").value.trim() });
        await loadAll();
      } catch (e) { st.textContent = "Couldn’t save: " + e.message; }
    });
    $("#gHoro").addEventListener("click", async () => {
      box.innerHTML = `<p class="muted">Working out ${esc(g.name)}’s chart…</p>`;
      try { const h = await api(`/api/guests/${g.id}/horoscope`); show("horoscope", `Horoscope for ${localDate()}`, horoscopeText(h)); }
      catch (e) { box.innerHTML = `<p class="status err">${esc(e.message)}</p>`; }
    });
    $("#gNum").addEventListener("click", () => {
      if (!g.birth || !g.birth.date) { box.innerHTML = `<p class="status err">Add a birth date first (Edit birth details).</p>`; return; }
      const nm = numerology(g.birth.date, g.birth_name);
      const text = nm.rows.map((r) => `${r.label} ${r.n}: ${r.meaning} (${r.how})`).join("\n") + (g.birth_name ? "" : "\nAdd the full birth name for Expression, Soul Urge and Personality.") + "\nTraditional numerology interpretation, not science.";
      show("numerology", `Numerology for ${localDate()}`, text);
    });
  }
  async function renderAstroToday() {
    const el = $("#astroToday"); if (!el) return;
    if (el.dataset.date === localDate() && el.innerHTML) return;
    el.dataset.date = localDate();
    if (window.AstroUI && window.HoroscopeStory) {
      // Load the full birth profile once so historical journal dates can be calculated against the same natal chart.
      if (!S.birthProfile) { try { const profile = await api("/api/profile/birth"); if (profile && profile.birth) S.birthProfile = profile.birth; } catch (_) {} }
      await window.AstroUI.render(el, { name: (ME.name || "").split(" ")[0], date: localDate(), birthDate: ME.birth, fullName: ME.name, entries: S.entries, load: async () => { const h = await api("/api/astro/today"); S.astroToday = h; return h; } });
      if (S.birthProfile) { renderJournal(); renderAstro(); }
      return;
    }
    try {
      const h = await api("/api/astro/today"); S.astroToday = h;
      el.innerHTML = `<article class="day astro-today"><h2>Today · ${esc(fmtDate(h.date, { weekday: "long", month: "long", day: "numeric" }))}</h2>
        ${h.text.map((t) => `<p>${esc(t)}</p>`).join("")}</article>`;
    } catch (e) { el.innerHTML = `<p class="muted">Today’s horoscope isn’t available right now (${esc(e.message)}).</p>`; }
  }

  /* ---------- v13: Pythagorean numerology + guest tie-ins (traditional interpretation, not science) ---------- */
  const MASTER = new Set([11, 22, 33]);
  const dsum = (n) => String(n).split("").reduce((x, y) => x + Number(y), 0);
  const red = (n) => { while (n > 9 && !MASTER.has(n)) n = dsum(n); return n; };
  const LET = (ch) => ((ch.charCodeAt(0) - 65) % 9) + 1;
  const NUM_MEAN = { 1: "independence, starting things, leading", 2: "partnership, diplomacy, sensitivity", 3: "expression, creativity, joy",
    4: "structure, steady work, building", 5: "freedom, change, adventure", 6: "care, responsibility, home and family",
    7: "reflection, study, inner life", 8: "power, money, achievement", 9: "compassion, completion, giving back",
    11: "master number: intuition, inspiration, sensitivity", 22: "master number: the master builder, big practical vision",
    33: "master number: the master teacher, healing through service" };
  function numerology(birthDate, fullName, today = localDate()) {
    const [y, m, d] = birthDate.split("-").map(Number), [ty, tm, td] = today.split("-").map(Number);
    const out = [];
    const lp = red(red(m) + red(d) + red(dsum(y)));
    out.push(["Life Path", lp, `${m} → ${red(m)}, ${d} → ${red(d)}, ${y} → ${red(dsum(y))}`]);
    const letters = String(fullName || "").toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
    if (letters) {
      const vow = [...letters].filter((c) => "AEIOU".includes(c)), con = [...letters].filter((c) => !"AEIOU".includes(c));
      const tot = (xs) => red(xs.reduce((s, c) => s + LET(c), 0));
      out.push(["Expression", tot([...letters]), "all letters of the full birth name"]);
      if (vow.length) out.push(["Soul Urge", tot(vow), "vowels A E I O U (Y counted as a consonant)"]);
      if (con.length) out.push(["Personality", tot(con), "consonants"]);
    }
    out.push(["Birthday", red(d), `day ${d}`]);
    const py = red(red(m) + red(d) + red(dsum(ty)));
    const pm = red(py + red(tm)), pd = red(pm + red(td));
    out.push(["Personal Year", py, `for ${ty}`], ["Personal Month", pm, `month ${tm}`], ["Personal Day", pd, today]);
    return { rows: out.map(([label, n, how]) => ({ label, n, how, meaning: NUM_MEAN[n] || "" })), lp, py };
  }
  const SIGN_ELEM = { Aries: "Fire", Leo: "Fire", Sagittarius: "Fire", Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
    Gemini: "Air", Libra: "Air", Aquarius: "Air", Cancer: "Water", Scorpio: "Water", Pisces: "Water" };
  // Golden Dawn sign -> Major; only used when that card's own text in the app's data names the sign
  const GD_SIGN = { Aries: "The Emperor", Taurus: "The Hierophant", Gemini: "The Lovers", Cancer: "The Chariot", Leo: "Strength", Virgo: "The Hermit",
    Libra: "Justice", Scorpio: "Death", Sagittarius: "Temperance", Capricorn: "The Devil", Aquarius: "The Star", Pisces: "The Moon" };
  function guestTies(g) {
    if (!g || !g.birth || !g.birth.date) return null;
    const [y, m, d] = g.birth.date.split("-").map(Number);
    const bc = window.TarotPractice && window.TarotPractice.birthCard ? window.TarotPractice.birthCard(y, m, d) : null;
    const birthCards = bc ? bc.chain.map((n) => S.cards.find((c) => c.arcana === "major" && Number(c.number) === n)).filter(Boolean) : [];
    const nm = numerology(g.birth.date, g.birth_name);
    const sign = g.sun_sign || null;
    let ruler = sign && S.byName.get((GD_SIGN[sign] || "").toLowerCase());
    if (ruler && !String(ruler.numerologyAstrology || "").includes(sign)) ruler = null;
    return { name: g.name, birthCards, lp: nm.lp, py: nm.py, sign, ruler, elem: sign ? SIGN_ELEM[sign] : null };
  }
  function tieNotes(ties, cards) {
    if (!ties) return null;
    const notes = [];
    if (ties.birthCards.length) notes.push(`Birth card${ties.birthCards.length > 1 ? "s" : ""}: ${ties.birthCards.map((c) => c.name).join(" and ")}.`);
    cards.forEach((x) => {
      const c = x._c, n = Number(c.number), pipOrMajor = c.arcana === "major" || n <= 10;
      if (ties.birthCards.some((b) => b.id === c.id)) notes.push(`${c.name} is ${ties.name}’s birth card.`);
      if (pipOrMajor && n === ties.lp) notes.push(`${c.name} carries ${n}, ${ties.name}’s Life Path number.`);
      if (pipOrMajor && n === ties.py) notes.push(`${c.name} carries ${n}, ${ties.name}’s Personal Year number.`);
      if (ties.ruler && ties.ruler.id === c.id) notes.push(`${c.name} is the Golden Dawn card of ${ties.sign}, ${ties.name}’s Sun sign.`);
      const el = String(c.element || "").split(" ")[0];
      if (ties.elem && el === ties.elem) notes.push(`${c.name} is ${/^[AEIOU]/.test(el) ? "an" : "a"} ${el} card, the element of ${ties.name}’s ${ties.sign} Sun.`);
    });
    return notes.length ? { title: `For ${ties.name}`, notes } : null;
  }

  /* ---------- v12: "write the reading as it goes", built only from the card data the app already has ---------- */
  const first = (s) => { s = String(s || "").trim(); const m = s.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : s).trim(); };
  const ORIENT_WORD = /^(upright|reversed)$/i;
  function buildReading(rows, ties = null) {
    const cards = rows.filter((r) => r.card).map((r, i) => {
      const c = r.card, rev = isRev(r.orientation), o = rev ? "reversed" : "upright", opp = rev ? "upright" : "reversed";
      const label = r.position && !ORIENT_WORD.test(r.position.trim()) ? r.position.trim() : `Card ${i + 1}`;
      const others = [];
      if (c[opp]) others.push({ label: `If read ${opp}`, text: c[opp] });
      const kw = c.keywords && c.keywords[o]; if (kw && kw.length) others.push({ label: "Keywords", text: kw.join(", ") });
      const tp = (c.topics && c.topics[o]) || {};
      [["love", "Love"], ["work", "Work"], ["money", "Money"], ["advice", "Advice"]].forEach(([k, l]) => { if (tp[k]) others.push({ label: l, text: tp[k] }); });
      return { label, name: c.name, orientation: o, core: c[o] || "", others, _c: c };
    });
    if (!cards.length) return null;
    const parts = [];
    parts.push(cards.map((x) => `${x.label}: ${x.name} (${x.orientation})`).join(" · ") + ".");
    const revN = cards.filter((x) => x.orientation === "reversed").length;
    if (cards.length > 1) parts.push(`${revN} of ${cards.length} reversed.`);
    const tally = {}; cards.forEach((x) => { const k = x._c.arcana === "major" ? "Major Arcana" : (x._c.suit || ""); if (k) tally[k] = (tally[k] || 0) + 1; });
    const tl = Object.entries(tally).sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k} ${n}`);
    if (tl.length && cards.length > 1) parts.push(`Mix: ${tl.join(", ")}.`);
    const threads = cards.map((x) => { const kw = x._c.keywords && x._c.keywords[x.orientation]; return kw && kw.length ? `${x.name}: ${kw.slice(0, 2).join(", ")}` : ""; }).filter(Boolean);
    if (threads.length) parts.push(`Threads: ${threads.join("; ")}.`);
    const adv = cards.map((x) => { const a2 = x._c.topics && x._c.topics[x.orientation] && x._c.topics[x.orientation].advice; return a2 ? `${x.name}: ${first(a2)}` : ""; }).filter(Boolean);
    if (adv.length) parts.push(`Advice from the cards: ${adv.join(" ")}`);
    const forG = tieNotes(ties, cards);
    return { summary: parts.join(" "), cards: cards.map(({ _c, ...rest }) => rest), ...(forG ? { forGuest: forG } : {}) };
  }
  function genReadingHTML(gr, { live = false } = {}) {
    if (!gr || !gr.cards || !gr.cards.length) return live ? `<p class="muted" style="font-size:.85rem">Add a card and the reading builds here as you go.</p>` : "";
    return `<div class="gen-reading">${gr.cards.map((x) => `
      <div class="gen-card"><b>${esc(x.label || "")}: ${esc(x.name || "")}</b> <span class="tag">${esc(x.orientation || "")}</span>
        ${x.core ? `<p>${esc(x.core)}</p>` : ""}
        ${x.others && x.others.length ? `<details><summary>Other ways to read it</summary><ul>${x.others.map((o) => `<li><b>${esc(o.label || "")}:</b> ${esc(o.text || "")}</li>`).join("")}</ul></details>` : ""}
      </div>`).join("")}
      ${gr.summary ? `<p class="gen-summary"><b>Together:</b> ${esc(gr.summary)}</p>` : ""}
      ${gr.forGuest ? `<div class="gen-for"><b>${esc(gr.forGuest.title)}</b><ul>${gr.forGuest.notes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}</div>`;
  }

  /* ---------- reusable: photo picker (downscales to ≤2400px JPEG when possible) ---------- */
  async function fileToPhoto(file) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      return { name: file.name, data: cv.toDataURL("image/jpeg", 0.9) };
    } catch {
      const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      return { name: file.name, data };
    }
  }
  function PhotoPicker(inputs, thumbs, onChange = () => {}) {
    const list = [];
    const render = () => {
      thumbs.innerHTML = list.map((p, i) => `<span class="thumb"><img src="${p.data}" alt="${esc(p.name)}" /><button type="button" class="x" data-i="${i}" aria-label="Remove photo">×</button></span>`).join("");
      $$(".x", thumbs).forEach((b) => b.addEventListener("click", () => { list.splice(Number(b.dataset.i), 1); render(); }));
      onChange(list);
    };
    inputs.forEach((inp) => inp.addEventListener("change", async () => {
      for (const f of inp.files) if (list.length < 8) list.push(await fileToPhoto(f));
      inp.value = ""; render();
    }));
    return { get list() { return list; }, reset: () => { list.length = 0; render(); } };
  }

  /* ---------------- tabs ---------------- */
  const moreBtn = $("#moreBtn"), moreMenu = $("#moreMenu");
  function closeMore() { moreMenu.hidden = true; moreBtn.setAttribute("aria-expanded", "false"); }
  function showTab(name) {
    const full = String(name || ""); name = full.split("?")[0];
    if (!TABS.includes(name)) name = "today";
    $$(".tab[data-tab]").forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("active", on); t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
      if (on && t.offsetParent && getComputedStyle(t.parentElement).position !== "fixed") t.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    const inMore = MORE_TABS.includes(name);
    moreBtn.classList.toggle("active", inMore); moreBtn.setAttribute("aria-selected", String(inMore));
    $$("[data-goto]", moreMenu).forEach((b) => b.classList.toggle("active", b.dataset.goto === name));
    closeMore();
    TABS.forEach((t) => { $("#panel-" + t).hidden = t !== name; });
    if (window.TarotApp && window.TarotApp.onShow) window.TarotApp.onShow(name);
    if (name === "meditate" && !S.medLoaded) { setMed($(".seg-btn[data-med].active").dataset.med); S.medLoaded = true; }
    if (name === "friends") renderFriends();
    if (name === "compat" && window.TAROT_COMPAT_UI) window.TAROT_COMPAT_UI.show();
    if (location.hash.slice(1).split("?")[0] !== name) history.replaceState(null, "", location.pathname + location.search + "#" + name);
  }
  $$(".tab[data-tab]").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = moreMenu.hidden;
    moreMenu.hidden = !open; moreBtn.setAttribute("aria-expanded", String(open));
    if (open) $("button", moreMenu).focus();
  });
  $$("[data-goto]", moreMenu).forEach((b) => b.addEventListener("click", () => { showTab(b.dataset.goto); window.scrollTo({ top: 0 }); moreBtn.focus(); }));
  document.addEventListener("click", (e) => { if (!moreMenu.hidden && !e.target.closest("#moreMenu, #moreBtn")) closeMore(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !moreMenu.hidden) { closeMore(); moreBtn.focus(); } });
  /* tablist keyboard pattern: arrows / Home / End move between the visible tabs */
  $(".tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const vis = $$(".tab", $(".tabs")).filter((t) => t.offsetParent !== null);
    let i = vis.indexOf(document.activeElement); if (i < 0) return;
    i = e.key === "Home" ? 0 : e.key === "End" ? vis.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + vis.length) % vis.length;
    vis[i].focus(); if (vis[i].dataset.tab) showTab(vis[i].dataset.tab);
    e.preventDefault();
  });
  window.addEventListener("hashchange", () => showTab(location.hash.slice(1)));

  /* ---------------- today ---------------- */

  /* ---------- import a past reading from the home screen ---------- */
  const importToggle = $("#importReadingToggle"), importPanel = $("#importReadingPanel");
  if (importToggle && importPanel) {
    $("#importReadingDate").value = localDate();
    importToggle.addEventListener("click", () => {
      importPanel.hidden = !importPanel.hidden;
      importToggle.setAttribute("aria-expanded", String(!importPanel.hidden));
    });
    async function loadPdfText(file) {
      if (!window.pdfjsLib) {
        await new Promise((resolve,reject) => {
          const script=document.createElement("script");
          script.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          script.onload=resolve; script.onerror=()=>reject(new Error("Could not load the PDF reader. You can copy and paste the PDF text instead."));
          document.head.appendChild(script);
        });
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const doc=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise, pages=[];
      for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),content=await page.getTextContent();pages.push(content.items.map(x=>x.str).join(" "));}
      return pages.join("\n\n");
    }
    function cardLinesFromText(text) {
      const found=[];
      const sorted=[...S.cards].sort((a,b)=>b.name.length-a.name.length);
      const lower=String(text||"").toLowerCase();
      for(const card of sorted){
        const at=lower.indexOf(card.name.toLowerCase());
        if(at<0||found.some(x=>x.name===card.name))continue;
        const near=lower.slice(Math.max(0,at-50),Math.min(lower.length,at+card.name.length+55));
        const orientation=/reversed|\brev(?:erse)?\b/.test(near)?"reversed":"upright";
        const line=String(text).slice(Math.max(0,at-50),Math.min(String(text).length,at+card.name.length+55));
        const pos=(line.match(/\b(past|present|future|situation|challenge|advice|outcome|self|environment|hopes|fears)\b/i)||[])[0]||"";
        found.push({name:card.name,orientation,position:pos});
      }
      return found;
    }
    function writeCardLines(rows) {
      $("#importReadingCards").value=rows.map(x=>x.name+" | "+(x.orientation||"upright")+" | "+(x.position||"")).join("\n");
    }
    function parseCardLines() {
      const rows=[];
      $("#importReadingCards").value.split(/\n|;/).map(x=>x.trim()).filter(Boolean).forEach(line=>{
        const parts=line.split(/\s*\|\s*|\t|,\s*/).map(x=>x.trim()),name=parts[0];
        const card=S.byName.get(name.toLowerCase())||S.cards.find(x=>x.name.toLowerCase()===name.toLowerCase());
        if(!card)throw new Error("I couldn't match this card name: "+name+". Check its spelling against the Cards tab.");
        const orientation=/rev/i.test(parts[1]||"")?"reversed":"upright";
        const position=parts[2]||"";
        rows.push({id:card.id,name:card.name,orientation,position,source:"physical deck"});
      });
      if(rows.length>12)throw new Error("A reading can contain up to 12 cards.");
      return rows;
    }
    async function selectedFileText(file) {
      if(!file)return "";
      const name=file.name.toLowerCase();
      if(file.type==="application/pdf"||name.endsWith(".pdf"))return loadPdfText(file);
      if(file.type.startsWith("image/"))return null;
      return file.text();
    }
    $("#importReadingDetect").addEventListener("click",async()=>{
      const status=$("#importReadingStatus"),file=$("#importReadingFile").files[0];
      try{
        status.textContent="Reading file and detecting card names…";
        if(file&&file.type.startsWith("image/")){status.textContent="This is an image. Save it to the photo-identification queue, then confirm the cards there.";return;}
        const text=await selectedFileText(file)||$("#importReadingText").value;
        if(text)$("#importReadingText").value=text.slice(0,8000);
        let rows=[];
        if(file&&file.name.toLowerCase().endsWith(".json")){
          const data=JSON.parse(text),raw=Array.isArray(data)?data:(data.cards||(data.reading&&data.reading.cards)||[]);
          if(data.date)$("#importReadingDate").value=String(data.date).slice(0,10);
          if(data.question||data.intent)$("#importReadingQuestion").value=typeof data.intent==="object"?data.intent.text:(data.question||"");
          if(data.spread||data.spreadName)$("#importReadingSpread").value=data.spread||data.spreadName;
          const notes=data.note||data.notes||data.overall||(data.reading&&data.reading.overall)||"";
          if(notes)$("#importReadingText").value=String(notes).slice(0,8000);
          rows=raw.map(x=>typeof x==="string"?({name:x,orientation:"upright",position:""}):({name:x.name||x.cardName||x.card||"",orientation:/rev/i.test(x.orientation||"")?"reversed":"upright",position:x.position||x.label||""})).filter(x=>x.name);
        }else rows=cardLinesFromText(text);
        writeCardLines(rows);
        status.textContent=rows.length?("Detected "+rows.length+" card"+(rows.length===1?"":"s")+". Review names and orientations before saving."):"No card names were recognized. Add them in the Cards field using one card per line.";
      }catch(e){status.textContent="Could not read this file: "+e.message;}
    });
    $("#importReadingSave").addEventListener("click",async()=>{
      const status=$("#importReadingStatus"),file=$("#importReadingFile").files[0],date=$("#importReadingDate").value;
      try{
        if(!date)throw new Error("Choose the date of the original reading.");
        status.textContent="Saving…";
        const note=["Imported past reading",$("#importReadingQuestion").value.trim()?("Question — "+$("#importReadingQuestion").value.trim()):"",$("#importReadingText").value.trim(),file?("Original file — "+file.name):""].filter(Boolean).join("\n\n");
        if(file&&file.type.startsWith("image/")){
          const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Could not read the image."));reader.readAsDataURL(file);});
          const tags=$("#importReadingCards").value.trim()?parseCardLines():[];
          await api("/api/photos",{date,photos:[{data}],note,cards:tags});
          status.textContent="Photo uploaded to the identification queue for "+date+". Confirm the cards there and the reading will be added to Journal and Astro.";
          await loadAll(); return;
        }
        const cards=parseCardLines();
        if(!cards.length)throw new Error("Add at least one recognized card before saving the reading.");
        const res=await api("/api/entries",{date,cards,note,spread:$("#importReadingSpread").value.trim()||"Imported reading",intent:$("#importReadingQuestion").value.trim()?{type:"question",text:$("#importReadingQuestion").value.trim()}:null});
        await loadAll();
        status.textContent=res.added&&res.added.length?"Saved "+res.added.length+" card"+(res.added.length===1?"":"s")+" to Journal and Astro for "+date+".":"Those cards were already in that day's journal; no duplicates were added.";
      }catch(e){status.textContent="Could not import: "+e.message;}
    });
  }

  const stage = $("#stage"), readings = $("#readings"), saveBox = $("#saveBox"), hint = $("#todayHint"), saveStatus = $("#saveStatus");
  const quick = $("#quick"), readMore = $("#readMore");
  const todaysEntry = () => S.entries.find((d) => d.date === localDate() && d.cards && d.cards.length);
  const hasUnsavedDraw = () => S.src === "digital" && S.drawn.length > 0 && !S.saved;
  const discardOk = () => !hasUnsavedDraw() || confirm("Put back the card you just drew? It isn’t saved yet.");

  $$("[data-src]").forEach((b) => b.addEventListener("click", () => {
    if (S.src === b.dataset.src || !discardOk()) return;
    segSelect(b.parentElement, b); S.src = b.dataset.src; resetDraw();
  }));
  $$("[data-count]").forEach((b) => b.addEventListener("click", () => {
    if (S.count === Number(b.dataset.count) || !discardOk()) return;
    segSelect(b.parentElement, b); S.spreadKey = null; $("#spreadSel").value = ""; S.count = Number(b.dataset.count); $("#labelSet").hidden = S.count !== 3; resetDraw();
  }));
  $$("[data-labels]").forEach((b) => b.addEventListener("click", () => {
    segSelect(b.parentElement, b); S.labels = b.dataset.labels; if (S.src === "physical") renderPickers(); renderToday();
  }));

  function resetDraw() {
    S.drawn = S.src === "physical" ? Array.from({ length: S.count }, () => ({ card: null, orientation: "upright", flipped: true })) : [];
    S.saved = false; S.savedMine = false; setSaveStatus("");
    Object.assign(S, { pickSlot: 0, pickOpen: true, pickGroup: null });
    $("#digitalControls").hidden = S.src !== "digital";
    $("#physicalControls").hidden = S.src !== "physical";
    $("#photoBox").hidden = S.src !== "photo";
    $("#spreadRow").hidden = S.src === "photo";
    if (S.src === "physical") { renderPickers(); cohIntentPhysical(); }
    hint.textContent = S.src === "digital" ? "Shuffle when you’re ready, then draw."
      : S.src === "physical" ? "Tap the card" + (S.count > 1 ? "s" : "") + " you pulled, then set how " + (S.count > 1 ? "each" : "it") + " landed." : "";
    renderToday();
  }
  const posLabel = (i) => { const l = labelsNow(); return l ? l[i] : null; };

  /* Physical deck: tap grid of thumbnails by Major/suit (same layout as the Practice fast picker), search kept. */
  const GROUPS = ["Major", "Wands", "Cups", "Swords", "Pentacles"];
  const groupOf = (c) => (c.arcana === "major" ? "Major" : c.suit);
  const RANK = { 1: "Ace", 11: "Page", 12: "Knight", 13: "Queen", 14: "King" };
  const shortName = (c) => (c.arcana === "major" ? c.name.replace(/^The /, "") : (RANK[Number(c.number)] || String(c.number)));
  const orientSeg = (o) => `<div class="seg seg-sm" role="group" aria-label="Orientation">
      <button type="button" class="seg-btn ${!isRev(o) ? "active" : ""}" data-o="upright" aria-pressed="${!isRev(o)}">Upright</button>
      <button type="button" class="seg-btn ${isRev(o) ? "active" : ""}" data-o="reversed" aria-pressed="${isRev(o)}">Reversed</button></div>`;

  function renderPickers() {
    const wrap = $("#physicalControls");
    const slot = Math.max(0, Math.min(S.pickSlot || 0, S.drawn.length - 1)), d = S.drawn[slot];
    if (!d) { wrap.innerHTML = ""; return; }
    const open = S.pickOpen || !S.drawn.every((x) => x.card);
    const group = S.pickGroup || (d.card ? groupOf(d.card) : "Major");
    const list = S.cards.filter((c) => groupOf(c) === group);
    const chips = S.count > 1 ? `<div class="pp-slots" role="group" aria-label="Which position">${S.drawn.map((x, i) => `<button type="button" class="chip ${i === slot ? "active" : ""}" data-slot="${i}" aria-pressed="${i === slot}">${esc(posLabel(i))}: ${x.card ? esc(x.card.name) + (isRev(x.orientation) ? " (rev.)" : "") : "…"}</button>`).join("")}</div>` : "";
    wrap.innerHTML = `<div class="pp fp">${chips}
      ${open ? `<input type="search" class="pp-search" list="cardNames" placeholder="Or search by name…" aria-label="Search card by name" />
      <div class="seg seg-sm fp-groups" role="group" aria-label="Part of the deck">${GROUPS.map((g) => `<button type="button" class="seg-btn ${g === group ? "active" : ""}" data-g="${g}" aria-pressed="${g === group}">${g}</button>`).join("")}</div>
      <div class="pp-grid ${group === "Major" ? "majors" : ""}">${list.map((c) => { const on = !!(d.card && d.card.id === c.id); return `<button type="button" class="pp-card ${on ? "on" : ""}" data-id="${c.id}" aria-label="${esc(c.name)}" aria-pressed="${on}"><img src="${thumbImg(c.img)}" alt="" loading="lazy" /><span>${esc(shortName(c))}</span></button>`; }).join("")}</div>` : ""}
      <div class="fp-foot">${orientSeg(d.orientation)}<span class="fp-chosen">${d.card ? esc(d.card.name) : "Tap your card"}</span>${open ? "" : `<button type="button" class="link-btn pp-change">Change card</button>`}</div>
    </div>`;
    const changed = () => { S.saved = false; S.savedMine = false; setSaveStatus(""); renderPickers(); renderToday(); };
    const choose = (c) => {
      d.card = c; S.pickGroup = groupOf(c);
      const next = S.drawn.findIndex((x) => !x.card);
      if (next >= 0) S.pickSlot = next; else S.pickOpen = false;
      changed();
    };
    $$("[data-slot]", wrap).forEach((b) => b.addEventListener("click", () => { S.pickSlot = Number(b.dataset.slot); S.pickOpen = true; S.pickGroup = null; renderPickers(); }));
    $$("[data-g]", wrap).forEach((b) => b.addEventListener("click", () => { S.pickGroup = b.dataset.g; renderPickers(); }));
    $$("[data-id]", wrap).forEach((b) => b.addEventListener("click", () => choose(S.cards.find((c) => c.id === b.dataset.id))));
    $$("[data-o]", wrap).forEach((b) => b.addEventListener("click", () => { d.orientation = b.dataset.o; changed(); }));
    const ch = $(".pp-change", wrap); if (ch) ch.addEventListener("click", () => { S.pickOpen = true; renderPickers(); });
    const search = $(".pp-search", wrap);
    if (search) {
      const apply = () => { const c = S.byName.get(search.value.trim().toLowerCase()); if (c) { search.blur(); choose(c); } };
      search.addEventListener("input", apply); search.addEventListener("change", apply);
    }
  }

  function flipHTML(d, i) {
    const label = posLabel(i);
    const front = d.card ? `<img src="${deckImg(d.card.img)}" alt="${esc(d.card.name)}${isRev(d.orientation) ? " (reversed)" : ""}" class="${isRev(d.orientation) ? "reversed-img" : ""}" decoding="sync" data-retry="0" onerror="window.__tarotImgRetry && window.__tarotImgRetry(this)" />` : "";
    return `<div class="slot">
      ${label ? `<span class="slot-label">${esc(label)}</span>` : ""}
      <button class="flip ${d.flipped && d.card ? "flipped settled" : ""}" data-i="${i}" aria-label="${d.flipped && d.card ? esc(d.card.name) : "Turn card over"}" style="animation-delay:${i * 0.12}s">
        <div class="flip-inner"><div class="face back"></div><div class="face front">${front}</div></div>
      </button></div>`;
  }
  /* Short view right under the card: name, orientation, one line. The long sections live under "Read more". */
  function quickHTML(d, i) {
    const c = d.card, label = posLabel(i);
    return `<div class="quick-row">
      <h3>${esc(c.name)}</h3>
      <div class="meta">${label ? `<span class="badge pos">${esc(label)}</span>` : ""}${badge(d.orientation)}<span class="tag">${esc(drawSource())}</span></div>
      <p class="one-line">${esc(oneLine(isRev(d.orientation) ? c.reversed : c.upright))}</p>
    </div>`;
  }
  function readingHTML(d, i) {
    const c = d.card, label = posLabel(i);
    return `<article class="reading">
      <h3>${esc(c.name)}</h3>
      <div class="meta">${label ? `<span class="badge pos">${esc(label)}</span>` : ""}${badge(d.orientation)}<span class="tag">${S.src === "physical" ? "physical deck" : "digital app"}</span></div>
      ${infoHTML(c, d.orientation, { open: ["meaning", "love", "work", "money", "advice", "person", "yesno", "symbols", "spread", "sit", "pos", "opp", "for"], extra: cardExtras(d, i) })}
    </article>`;
  }

  function renderToday() {
    const three = S.count === 3, many = S.count > 3;
    stage.className = "stage " + (many ? "many" : three ? "three" : "one");
    readings.className = "readings" + (three ? " three" : "");
    if (S.src === "photo") { stage.innerHTML = ""; readings.innerHTML = ""; quick.innerHTML = ""; readMore.hidden = true; saveBox.hidden = true; return; }
    if (S.src === "digital" && !S.drawn.length) {
      stage.innerHTML = Array.from({ length: S.count }, (_, i) => flipHTML({ card: null, flipped: false }, i)).join("");
      $$(".flip", stage).forEach((f) => { f.disabled = true; f.style.opacity = ".55"; f.style.cursor = "default"; });
    } else if (S.src === "physical" && S.drawn.every((d) => !d.card)) {
      stage.innerHTML = "";
    } else {
      stage.innerHTML = S.drawn.map((d, i) => d.card || S.src === "digital" ? flipHTML(d, i) : `<div class="slot">${posLabel(i) ? `<span class="slot-label">${esc(posLabel(i))}</span>` : ""}<div class="flip" style="opacity:.35"><div class="flip-inner"><div class="face back"></div></div></div></div>`).join("");
    }
    $$(".flip[data-i]", stage).forEach((f) => f.addEventListener("click", () => {
      const d = S.drawn[Number(f.dataset.i)];
      if (!d || !d.card || d.flipped) return;
      d.flipped = true; f.classList.add("flipped"); f.setAttribute("aria-label", d.card.name);
      setTimeout(() => f.classList.add("settled"), 900);
      setTimeout(renderReadings, 380);
    }));
    renderReadings();
  }
  function updateDrawButtons() {
    const drawn = S.src === "digital" && S.drawn.length > 0;
    $("#shuffleBtn").hidden = $("#drawBtn").hidden = drawn;
    const r = $("#redrawBtn"); r.hidden = !drawn;
    r.innerHTML = S.saved ? `<span aria-hidden="true">✦</span> Pull another` : `<span aria-hidden="true">↺</span> Redraw`;
  }

  /* v23 cohesive reading: all cards together + the same person's last 2-4 readings (public/cohesive.js) */
  const cohKB = () => { const pm = {}; Object.values(SPREADS).forEach((sp) => sp.pos.forEach(([n, m]) => { pm[n] = pm[n] || m; })); Object.entries(LCR_MEAN).forEach(([n, m]) => { pm[n] = m; });
    return { cards: S.cards, numbers: (window.PRACTICE_DATA || {}).NUMBERS || [], courts: ((window.PRACTICE_DATA || {}).COURT_STAGES || []).filter((x) => x.rank), posMeanings: pm }; };
  const cohExKey = (d) => "tt.coh.ex." + d;
  const cohEx = (d, day) => { try { const v = JSON.parse(localStorage.getItem(cohExKey(d)) || "null"); if (Array.isArray(v)) return v; } catch (e) {} return (day && day.cohesive && day.cohesive.exclude) || []; };
  const cohSetEx = (d, arr) => { try { localStorage.setItem(cohExKey(d), JSON.stringify(arr)); } catch (e) {} };
  const cohMine = () => S.entries || [];
  function cohPickerHTML(offered, ex) {
    if (!offered.length) return `<p class="muted small coh-none">No earlier readings yet, so there is nothing to tie in.</p>`;
    return `<div class="coh-pick"><span class="label">Past readings tied in · yours only · last ${offered.length}</span>${offered.map((e) => { const k = e.id || e.date; return `<label class="coh-pk"><input type="checkbox" data-coh-ex="${esc(k)}" ${ex.includes(k) ? "" : "checked"}/> <b>${esc(short(e.date))}</b> · ${esc((e.cards || []).map((c) => c.name + (isRev(c.orientation) ? " (rev)" : "")).join(", "))}</label>`; }).join("")}<small class="muted">Untick any you want left out.</small></div>`;
  }
  function wireCohPicker(root, date, rerender) {
    $$("[data-coh-ex]", root).forEach((b) => b.addEventListener("change", () => { const ex = new Set(cohEx(date)); b.checked ? ex.delete(b.dataset.cohEx) : ex.add(b.dataset.cohEx); cohSetEx(date, [...ex]); rerender(); }));
  }
  function renderCohToday(complete) {
    let box = $("#cohToday");
    if (!box) { box = document.createElement("div"); box.id = "cohToday"; box.className = "coh-today"; stage.after(box); }
    const guest = S.forWho && S.forWho.kind === "guest";
    if (!complete || S.src === "photo" || guest || !window.Cohesive || S.drawn.length < 1) { box.innerHTML = ""; box.hidden = true; return; }
    box.hidden = false;
    const date = localDate(), ex = cohEx(date), pk = Cohesive.pickPast(cohMine(), date, { exclude: ex });
    const res = Cohesive.build({ cards: S.drawn.map((d, i) => ({ id: d.card.id, orientation: d.orientation, position: posLabel(i) || "", pm: (posMeaning(i) || {}).meaning || "" })), intent: S.intent, past: pk.used, person: { kind: "me" } }, cohKB());
    box.innerHTML = `<div class="coh-sum"><span class="label">The cards together${res.general ? " · general reading" : ""}</span><p>${esc(res.summary)}</p>
      ${cohPickerHTML(pk.offered, ex)}
      <button class="btn btn-gold btn-sm" id="cohMore">${S.saved && S.savedMine ? "Read more in Journal ›" : "Save and read more in Journal ›"}</button>
      <small class="muted">The full reading ends with questions to think about.</small></div>`;
    wireCohPicker(box, date, () => renderCohToday(true));
    $("#cohMore", box).addEventListener("click", async () => {
      if (!(S.saved && S.savedMine)) { $("#saveMineBtn").click(); for (let i = 0; i < 40 && !S.savedMine; i++) await new Promise((r) => setTimeout(r, 150)); }
      const days = sortedDays(); const i = days.findIndex((d) => d.date === date); if (i >= 0) S.jIndex = i;
      showTab("journal"); renderJournal(); const j = $("#cohJournal"); if (j) j.scrollIntoView({ block: "start" });
    });
  }
  function cohJournalHTML(day) {
    if (!window.Cohesive || !(day.cards || []).length) return "";
    const ex = cohEx(day.date, day), pk = Cohesive.pickPast(cohMine(), day.date, { exclude: ex });
    const res = Cohesive.build({ cards: day.cards, intent: Cohesive.intentOf(day), past: pk.used, person: { kind: "me" } }, cohKB());
    return `<div class="notes coh-journal" id="cohJournal"><span class="label">The reading together · ${day.cards.length} card${day.cards.length === 1 ? "" : "s"}${res.general ? " · general" : ""}</span>${cohPickerHTML(pk.offered, ex)}${Cohesive.html(res)}</div>`;
  }
  function cohGuestHTML(g, r) {
    if (!window.Cohesive || !(r.cards || []).length) return "";
    const pk = Cohesive.pickPast((g.readings || []).filter((x) => x.id !== r.id), r.date + "\uffff", {});
    const res = Cohesive.build({ cards: r.cards, intent: Cohesive.intentOf(r), past: pk.used.filter((x) => x.date <= r.date), person: { kind: "guest", name: g.name } }, cohKB());
    return `<details class="gen-wrap coh-guest"><summary>The cards together${pk.used.length ? ` · with ${esc(g.name)}’s past readings` : ""}</summary><p class="muted small">Only ${esc(g.name)}’s own readings are used.</p>${Cohesive.html(res)}</details>`;
  }
  function cohIntentPhysical() {
    const pc = $("#physicalControls"); if (!pc || $("#cohIntentP")) return;
    const w = document.createElement("div"); w.id = "cohIntentP"; w.innerHTML = `<p class="muted small">Your own deck: set an intention (optional), pick each card and whether it came up upright or reversed.</p>${intentHTML()}`; pc.prepend(w); wireIntent(w);
  }
  function renderReadings() {
    const shown = S.drawn.map((d, i) => [d, i]).filter(([d]) => d.card && d.flipped);
    quick.innerHTML = shown.map(([d, i]) => quickHTML(d, i)).join("");
    readings.innerHTML = shown.map(([d, i]) => readingHTML(d, i)).join("");
    readMore.hidden = !shown.length;
    const complete = S.drawn.length === S.count && S.drawn.every((d) => d.card && d.flipped);
    saveBox.hidden = !complete;
    $("#saveMineBtn").disabled = $("#saveGuestBtn").disabled = S.saved;
    $("#saveMineBtn").textContent = S.saved && S.savedMine ? "Saved ✓" : S.count > 1 ? "Save as my cards" : "Save as my card";
    $("#shareRow").hidden = !(S.saved && S.savedMine);
    updateDrawButtons();
    afterFlip(shown, complete);
    renderCohToday(complete);
    if (S.src === "digital" && S.drawn.length && !complete) hint.textContent = "Tap " + (S.count > 1 ? "each card" : "the card") + " to turn it over.";
    else if (S.src === "digital" && complete) hint.textContent = S.saved ? "Saved. Sit with what arrived." : "Sit with what arrived. Save it, or tap Redraw to start over.";
    else if (S.src === "physical") hint.textContent = complete ? (S.saved ? "Saved." : "Check how " + (S.count > 1 ? "each one" : "it") + " landed, then save.")
      : "Tap the card" + (S.count > 1 ? "s" : "") + " you pulled, then set how " + (S.count > 1 ? "each" : "it") + " landed.";
  }

  function doShuffle() {
    if (S.src === "digital" && S.drawn.length) return;   // a drawn card stays until it is saved or Redraw is tapped
    S.deck = shuffle(S.cards); S.drawn = []; S.saved = false; setSaveStatus("");
    renderToday();
    $$(".flip", stage).forEach((f, i) => f.animate([{ transform: "none" }, { transform: `translateX(${i % 2 ? 14 : -14}px) rotate(${i % 2 ? 4 : -4}deg)` }, { transform: "none" }], { duration: 520, iterations: 2 }));
    hint.textContent = "Shuffled · 78 cards, ready when you are.";
  }
  /* v15: a card picture that fails (link drop) retries twice, then falls back to the small thumbnail */
  window.__tarotImgRetry = (img) => {
    const n = Number(img.dataset.retry || 0), name = base(img.getAttribute("src").split("?")[0]);
    img.dataset.retry = String(n + 1);
    if (n < 2) setTimeout(() => { img.src = deckImg(name) + "?r=" + Date.now(); }, 1500 * (n + 1));
    else if (n === 2) img.src = thumbImg(name);
    else img.classList.add("img-fail");
  };
  const preload = (cards) => cards.forEach((c) => { const im = new Image(); im.src = deckImg(c.img); });
  function doDraw() {
    if (S.drawn.length) return;                         // no accidental re-rolls: use Redraw
    if (S.deck.length < S.count) S.deck = shuffle(S.cards);
    S.drawn = S.deck.splice(0, S.count).map((card) => ({ card, orientation: Math.random() < REVERSED_CHANCE ? "reversed" : "upright", flipped: false }));
    preload(S.drawn.map((d) => d.card));
    S.saved = false; S.savedMine = false; S.dfDone = false; S.clar = []; setSaveStatus("");
    renderToday();
  }
  function doRedraw() {
    S.drawn = []; S.saved = false; S.savedMine = false; S.deck = shuffle(S.cards); setSaveStatus("");
    renderToday();
    hint.textContent = "Fresh deck. Shuffle or draw when you’re ready.";
  }
  $("#shuffleBtn").addEventListener("click", doShuffle);
  $("#drawBtn").addEventListener("click", () => { if (S.drawn.length) return; openWho(doDraw); });
  $("#redrawBtn").addEventListener("click", doRedraw);
  /* ---------- v15: spreads, who-is-it-for, live full readings, guest routing, one-card pop-up ---------- */
  const SPREADS = {
    ppf: { name: "Past · Present · Future", pos: [["Past", "what led here and still shapes things"], ["Present", "where things stand now"], ["Future", "where this is heading if nothing changes"]] },
    sao: { name: "Situation · Action · Outcome", pos: [["Situation", "what is really going on"], ["Action", "what to do about it"], ["Outcome", "the likely result of that action"]] },
    mbs: { name: "Mind · Body · Spirit", pos: [["Mind", "your thoughts and mental state"], ["Body", "your physical life, health and material world"], ["Spirit", "your inner life and what your soul needs"]] },
    five: { name: "Five-card cross", pos: [["Present", "the heart of the matter now"], ["Past", "what is passing out of the situation"], ["Future", "what is coming in"], ["Root", "the cause underneath it all"], ["Potential", "the best that can come of it"]] },
    rel: { name: "Relationship", pos: [["You", "your part, feelings and needs"], ["Them", "the other person’s part, feelings and needs"], ["The bond", "the connection itself"], ["Strengths", "what holds you together"], ["Challenges", "what pulls you apart"], ["Where it’s heading", "the direction of the relationship"]] },
    horseshoe: { name: "Horseshoe", pos: [["Past", "past influences"], ["Present", "the current situation"], ["Hidden influences", "what you can’t see yet"], ["Obstacles", "what stands in the way"], ["Others", "the people and surroundings involved"], ["Advice", "the best course of action"], ["Outcome", "the likely outcome"]] },
    celtic: { name: "Celtic Cross", pos: [["Present", "the situation at the heart of the question"], ["Challenge", "what crosses you, the immediate obstacle"], ["Foundation", "the root of the matter, deep in the past"], ["Recent past", "what is just passing"], ["Crown", "your conscious goal, the best that can be achieved"], ["Near future", "what comes next"], ["Self", "your attitude and how you see yourself"], ["Environment", "other people and outside influences"], ["Hopes and fears", "what you hope for or dread"], ["Outcome", "where it all leads"]] },
  };
  const LCR_MEAN = { Left: "what came before or the first influence", Center: "the heart of the matter", Right: "what comes next" };
  function posMeaning(i) {
    if (S.spreadKey) { const p = SPREADS[S.spreadKey].pos[i]; return p ? { name: p[0], meaning: p[1] } : null; }
    if (S.count === 3) { const n = LABELS[S.labels][i]; return { name: n, meaning: LCR_MEAN[n] || SPREADS.ppf.pos.find((x) => x[0] === n)[1] }; }
    return null;
  }
  const labelsNow = () => (S.spreadKey ? SPREADS[S.spreadKey].pos.map((p) => p[0]) : S.count === 3 ? LABELS[S.labels] : null);
  const ME = { name: "Natalie", short: "N", birth: "1997-03-07", sign: "Pisces" };
  const SUIT_SENSE = { Wands: "Fire: drive, ambition, creative energy", Cups: "Water: feelings, relationships, intuition",
    Swords: "Air: thoughts, words, conflict and decisions", Pentacles: "Earth: money, body, work and practical life" };
  const elemOf = (c) => String(c.element || "").split(" ")[0];
  const FRIEND = { Fire: ["Air"], Air: ["Fire"], Water: ["Earth"], Earth: ["Water"] }, OPPOSE = { Fire: "Water", Water: "Fire", Air: "Earth", Earth: "Air" };
  const majorsBy = (chain) => chain.map((n) => S.cards.find((c) => c.arcana === "major" && Number(c.number) === n)).filter(Boolean);
  function personMe(onDate = localDate()) {
    syncSign();
    const nm = ME.birth ? numerology(ME.birth, null, onDate) : { rows: [], lp: null, py: null }, pd = nm.rows.find((r) => r.label === "Personal Day");
    const [by, bm, bd] = ME.birth ? ME.birth.split("-").map(Number) : [];
    const bc = ME.birth && window.TarotPractice && window.TarotPractice.birthCard ? window.TarotPractice.birthCard(by, bm, bd) : null;
    const past = S.entries.filter((e) => e.date < onDate).flatMap((e) => (e.cards || []).map((c) => ({ date: e.date, name: c.name, orientation: c.orientation, q: null })));
    return { isMe: true, name: ME.name, short: ME.short, lp: nm.lp, py: nm.py, pd: pd ? pd.n : null, sign: ME.sign, elem: ME.sign ? SIGN_ELEM[ME.sign] : null,
      birthCards: bc ? majorsBy(bc.chain) : [], ruler: ME.sign ? S.byName.get((GD_SIGN[ME.sign] || "").toLowerCase()) || null : null, past, astro: S.astroToday && S.astroToday.date === onDate ? S.astroToday : null };
  }
  function personFor(g) {
    const past = (g.readings || []).flatMap((r) => (r.cards || []).map((c) => ({ date: r.date, name: c.name, orientation: c.orientation, q: r.question })));
    const t = guestTies(g);
    const base = { isMe: false, id: g.id, name: g.name, short: g.name, past, astro: null, birthCards: [], lp: null, py: null, pd: null, sign: g.sun_sign || null, elem: g.sun_sign ? SIGN_ELEM[g.sun_sign] : null, ruler: null };
    if (!t) return base;
    const pd = numerology(g.birth.date, g.birth_name).rows.find((r) => r.label === "Personal Day");
    return { ...base, birthCards: t.birthCards, lp: t.lp, py: t.py, pd: pd ? pd.n : null, ruler: t.ruler };
  }
  const curPerson = () => { if (S.forWho && S.forWho.kind === "guest") { const g = S.guests.find((x) => x.id === S.forWho.id); return g ? personFor(g) : null; } return personMe(); };
  const yourOf = (p) => (p.isMe ? "your" : p.name + "’s");
  function cardTies(c, o, p) {
    if (!p) return [];
    const out = [], n = Number(c.number), counted = c.arcana === "major" || n <= 10;
    const prev = p.past.filter((x) => String(x.name).toLowerCase() === c.name.toLowerCase());
    if (prev.length) out.push(`${p.isMe ? "You’ve" : p.name + " has"} drawn ${c.name} before: ${prev.slice(-4).map((x) => `${short(x.date)} (${isRev(x.orientation) ? "reversed" : isUnknown(x.orientation) ? "orientation not recorded" : "upright"})${x.q ? ` on “${x.q}”` : ""}`).join(", ")}. ${prev.some((x) => !isUnknown(x.orientation) && isRev(x.orientation) !== (o === "reversed")) ? "It came the other way up before, so notice what has shifted." : "This theme is still active."}`);
    if (p.birthCards.some((b) => b.id === c.id)) out.push(`${c.name} is ${yourOf(p)} birth card, so it speaks to a lifelong theme.`);
    if (counted && p.lp && n === p.lp) out.push(`It carries ${n}, ${yourOf(p)} Life Path number (${NUM_MEAN[n]}).`);
    if (counted && p.py && n === p.py) out.push(`It carries ${n}, ${yourOf(p)} Personal Year number (${NUM_MEAN[n]}).`);
    if (counted && p.pd && n === p.pd) out.push(`It carries ${n}, ${yourOf(p)} Personal Day number today (${NUM_MEAN[n]}).`);
    if (p.ruler && p.ruler.id === c.id && String(c.numerologyAstrology || "").includes(p.sign)) out.push(`It is the Golden Dawn card of ${p.sign}, ${yourOf(p)} Sun sign.`);
    const el = elemOf(c);
    if (p.elem && el === p.elem) out.push(`${el} is the element of ${yourOf(p)} ${p.sign} Sun, so this card works with ${p.isMe ? "your" : "their"} nature.`);
    else if (p.elem && OPPOSE[p.elem] === el) out.push(`${el} is the opposite element to ${yourOf(p)} ${p.sign} Sun (${p.elem}), so this card may feel less natural and asks for a different approach.`);
    if (p.isMe && p.astro && p.astro.moon && SIGN_ELEM[p.astro.moon.sign] === el) out.push(`Today’s Moon is in ${p.astro.moon.sign}, a ${el} sign, the same element as this card.`);
    return out;
  }
  function cardExtras(d, i) {
    const c = d.card, o = isRev(d.orientation) ? "reversed" : "upright", opp = o === "upright" ? "reversed" : "upright", p = curPerson();
    const pm = posMeaning(i), ex = [];
    if (pm) ex.push(["pos", `Position: ${esc(pm.name)}`, `<p><b>${esc(pm.name)}</b> shows ${esc(pm.meaning)}. ${esc(c.name)} ${o} here: ${esc(((c.keywords || {})[o] || []).join(", "))}.</p>${c.inASpread ? `<p>${esc(c.inASpread)}</p>` : ""}`]);
    ex.push(["opp", `Other ways to read it (${opp})`, `<p>${esc(c[opp] || "")}</p>${kwHTML(c, opp)}`]);
    const t = cardTies(c, o, p);
    if (t.length) ex.push(["for", `For ${esc(p.isMe ? "you, " + ME.short : p.name)}`, `<ul>${t.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`]);
    return ex;
  }
  const tp = (x, k) => ((x.c.topics || {})[x.o] || {})[k];
  function fullReadingHTML(rows, p) {
    const cs = rows.filter((r) => r.card).map((r, i) => ({ c: r.card, o: isRev(r.orientation) ? "reversed" : "upright", pos: r.position || null, pm: r.pm || null, i }));
    if (!cs.length) return "";
    const L = []; const sec = (t, body) => body && L.push(`<section class="df-sec"><h4>${t}</h4>${body}</section>`);
    const kw = (x) => ((x.c.keywords || {})[x.o] || []).slice(0, 3).join(", ");
    const isec = intentSection(cs); if (isec) L.push(isec);
    sec("The cards", `<ol>${cs.map((x) => `<li><b>${esc(x.pos || "Card " + (x.i + 1))}</b>${x.pm ? ` <span class="muted">(${esc(x.pm)})</span>` : ""}: ${esc(x.c.name)}, ${x.o}. ${esc(x.c[x.o])}</li>`).join("")}</ol>`);
    if (cs.length > 1) {
      const story = cs.map((x, k) => `${k === 0 ? "It opens with" : k === cs.length - 1 ? "and it lands on" : "then"} ${x.c.name}${x.o === "reversed" ? " reversed" : ""}${x.pos ? " in " + x.pos : ""} (${kw(x)})`).join(", ");
      const a = ((cs[0].c.keywords || {})[cs[0].o] || [""])[0], z = ((cs[cs.length - 1].c.keywords || {})[cs[cs.length - 1].o] || [""])[0];
      sec("The overall story", `<p>${esc(story)}.</p><p>${esc(`The movement is from ${a} toward ${z}.`)} ${esc(tp(cs[cs.length - 1], "advice") || "")}</p>`);
      const maj = cs.filter((x) => x.c.arcana === "major").length, rev = cs.filter((x) => x.o === "reversed").length;
      const suits = {}; cs.forEach((x) => { if (x.c.suit) suits[x.c.suit] = (suits[x.c.suit] || 0) + 1; });
      const nums = {}; cs.forEach((x) => { const n = Number(x.c.number); if (x.c.arcana !== "major" && n <= 10) (nums[n] = nums[n] || []).push(x.c.name); });
      const courts = cs.filter((x) => x.c.arcana !== "major" && Number(x.c.number) > 10);
      const it = [];
      it.push(`${maj} of ${cs.length} are Major Arcana: ${maj / cs.length >= .5 ? "this is about big life themes and turning points more than day-to-day choices." : maj ? "a few big themes run under everyday matters." : "this is about everyday matters you can steer directly."}`);
      Object.entries(suits).sort((q, w) => w[1] - q[1]).forEach(([s2, n]) => it.push(`${s2} ×${n} (${SUIT_SENSE[s2]}).`));
      const missing = Object.keys(SUIT_SENSE).filter((s2) => !suits[s2]);
      if (cs.length >= 5 && missing.length) it.push(`No ${missing.join(" or ")} appeared, so ${missing.map((m) => SUIT_SENSE[m].split(": ")[1]).join("; ")} ${missing.length > 1 ? "are" : "is"} not the focus.`);
      it.push(`${rev} of ${cs.length} reversed: ${rev === 0 ? "energy flows openly." : rev / cs.length > .5 ? "much is blocked, delayed or turned inward; look at what is being held back." : "some of it is blocked or internal."}`);
      Object.entries(nums).filter(([, v]) => v.length > 1).forEach(([n, v]) => it.push(`The number ${n} repeats (${v.join(", ")}): ${NUM_MEAN[n] || ""}.`));
      if (courts.length) it.push(`Court cards (${courts.map((x) => x.c.name).join(", ")}) often stand for people or roles in the situation.`);
      for (let k = 0; k + 1 < cs.length; k++) { const e1 = elemOf(cs[k].c), e2 = elemOf(cs[k + 1].c); if (!e1 || !e2) continue;
        if (OPPOSE[e1] === e2) it.push(`${cs[k].c.name} (${e1}) next to ${cs[k + 1].c.name} (${e2}): opposing elements weaken each other, so there is friction to work through.`);
        else if (e1 === e2) it.push(`${cs[k].c.name} and ${cs[k + 1].c.name} share ${e1}, which strengthens both.`);
        else if ((FRIEND[e1] || []).includes(e2)) it.push(`${cs[k].c.name} (${e1}) and ${cs[k + 1].c.name} (${e2}) are friendly elements and support each other.`); }
      sec("How the cards work together", `<ul>${it.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`);
    }
    [["love", "Love"], ["work", "Work"], ["money", "Money"]].forEach(([k, t]) => sec(`${t} across the spread`, cs.map((x) => tp(x, k) ? `<p><b>${esc(x.c.name)}${x.pos ? " · " + esc(x.pos) : ""}:</b> ${esc(tp(x, k))}</p>` : "").join("")));
    const yn = cs.map((x) => tp(x, "yesNo")).filter(Boolean);
    if (yn.length) { const yes = yn.filter((y) => /yes/i.test(y.lean)).length, no = yn.filter((y) => /no/i.test(y.lean)).length;
      sec("Yes or no", `<p>${yes} lean yes, ${no} lean no, ${yn.length - yes - no} maybe or not yet. Overall: <b>${yes > no ? "leans yes" : no > yes ? "leans no" : "mixed, not settled yet"}</b>.</p>`); }
    if (p) {
      const t = [];
      if (p.lp) t.push(`Numerology (Pythagorean): Life Path ${p.lp} (${NUM_MEAN[p.lp]}), Personal Year ${p.py} (${NUM_MEAN[p.py]})${p.pd ? `, Personal Day ${p.pd} (${NUM_MEAN[p.pd]})` : ""}.`);
      if (p.birthCards.length) t.push(`Birth card${p.birthCards.length > 1 ? "s" : ""}: ${p.birthCards.map((b) => b.name).join(" and ")}${cs.some((x) => p.birthCards.some((b) => b.id === x.c.id)) ? ", and it showed up in this spread." : "."}`);
      if (p.sign) { const same = cs.filter((x) => elemOf(x.c) === p.elem).map((x) => x.c.name); t.push(`Sun in ${p.sign} (${p.elem})${same.length ? `: ${same.join(", ")} share${same.length === 1 ? "s" : ""} that element.` : "; no card in this spread shares that element."}`); }
      if (p.isMe && p.astro && p.astro.text) t.push(`Today’s sky for you: ${p.astro.text.slice(0, 2).join(" ")}`);
      cs.forEach((x) => cardTies(x.c, x.o, p).filter((s2) => / drawn .* before:/.test(s2)).forEach((s2) => t.push(s2)));
      if (p.past.length) { const sc = {}; p.past.forEach((x) => { const k2 = S.byName.get(String(x.name).toLowerCase()); const g2 = k2 ? (k2.arcana === "major" ? "Major Arcana" : k2.suit) : null; if (g2) sc[g2] = (sc[g2] || 0) + 1; });
        const top = Object.entries(sc).sort((q, w) => w[1] - q[1])[0]; if (top) t.push(`Across ${p.past.length} saved card${p.past.length === 1 ? "" : "s"}, ${top[0]} has come up most (${top[1]}×).`); }
      if (!p.isMe && !p.lp) t.push(`Add ${p.name}’s birthday in Guests for numerology and astrology ties.`);
      sec(`For ${esc(p.isMe ? "you, " + ME.short : p.name)}`, `<ul>${t.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`);
    }
    sec("Advice", cs.map((x) => tp(x, "advice") ? `<p><b>${esc(x.c.name)}:</b> ${esc(tp(x, "advice"))}</p>` : "").join(""));
    sec("Sit with", cs.map((x) => x.c.sitWith ? `<p class="sit">${esc(x.c.sitWith)}</p>` : "").join(""));
    return `<article class="df-full-reading"><h3>${cs.length > 1 ? "Full reading" : "Your reading"}${p ? ` · for ${esc(p.isMe ? "you" : p.name)}` : ""}</h3>${L.join("")}</article>`;
  }
  const flowRows = () => S.drawn.map((d, i) => ({ card: d.card, orientation: d.orientation, position: posLabel(i) || "", pm: (posMeaning(i) || {}).meaning || null })).filter((r) => r.card);
  function afterFlip(shown, complete) {
    let full = $("#dfFull"); if (!full) { full = document.createElement("div"); full.id = "dfFull"; full.className = "df-full"; quick.after(full); }
    let who = $("#dfWho"); if (!who) { who = document.createElement("p"); who.id = "dfWho"; who.className = "df-wholine"; stage.before(who); }
    who.hidden = !(S.src === "digital" && S.drawn.length && S.forWho);
    if (!who.hidden) who.textContent = (S.forWho.kind === "guest" ? `Reading for ${S.forWho.name}` : "Reading for you") + (S.spreadKey ? " · " + SPREADS[S.spreadKey].name : "");
    if (S.src !== "digital" || !S.drawn.length) { full.innerHTML = ""; S.clar = []; renderClarReadings(); return; }
    if (shown.length) readMore.open = true;
    if (!complete) { full.innerHTML = shown.length && S.count > 1 ? `<p class="muted df-writing">Writing the reading… ${shown.length} of ${S.count} cards turned.</p>` : ""; return; }
    if (S.dfDone) return; S.dfDone = true;
    const rows = flowRows();
    if (S.forWho && S.forWho.kind === "guest") {
      full.innerHTML = `<p class="df-route">↪ Taking this reading to ${esc(S.forWho.name)}’s page in Guests…</p>`;
      setTimeout(() => { S.pendingGuest = { gid: S.forWho.id, rows, intent: intentNote(), q: S.intent && S.intent.text.trim(), spread: S.spreadKey ? SPREADS[S.spreadKey].name : S.count === 3 ? `3-card (${LABELS[S.labels].join(" · ")})` : "One card" }; S.guestSel = S.forWho.id; showTab("guests"); renderGuestsTab(); window.scrollTo({ top: 0 }); }, 1100);
      return;
    }
    renderFull();
    if (S.count === 1) popup(rows[0]);
  }
  function popup(r) {
    const c = r.card, o = isRev(r.orientation) ? "reversed" : "upright", p = personMe(), t = cardTies(c, o, p);
    $("#modalBody").innerHTML = `<div class="df-pop"><p class="df-pop-eye">✦ For you, ${ME.short}</p>
      <div class="df-pop-head"><img src="${deckImg(c.img)}" alt="${esc(c.name)}" class="${o === "reversed" ? "reversed-img" : ""}" /><div><h2 id="modalTitle">${esc(c.name)}</h2>${badge(o)}${kwHTML(c, o)}</div></div>
      ${t.length ? `<h4>Just for you</h4><ul>${t.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${fullReadingHTML([r], p)}
      ${infoHTML(c, o, { open: ["person", "symbols"], skip: ["meaning", "love", "work", "money", "advice", "sit", "yesno"] })}</div>`;
    $("#modal").hidden = false; $(".modal-card").scrollTop = 0;
  }
  function openWho(cb) {
    if (S.src !== "digital") return cb();
    if (!S.astroToday) api("/api/astro/today").then((h) => { S.astroToday = h; }).catch(() => {});
    let sh = $("#whoSheet"); if (sh) sh.remove();
    sh = document.createElement("div"); sh.id = "whoSheet"; sh.className = "who-sheet";
    const gs = [...S.guests].sort((a, b) => (lastDate(b) || "").localeCompare(lastDate(a) || ""));
    sh.innerHTML = `<div class="who-backdrop" data-x></div><div class="who-card" role="dialog" aria-modal="true" aria-labelledby="whoTitle">
      <p class="eyebrow">Before we draw</p><h2 id="whoTitle">Who is this reading for?</h2>
      <p class="muted">I’ll tie it to their past readings, astrology and numerology.</p>
      ${intentHTML()}
      <button class="who-opt" data-me><span>✦ Me (${esc(ME.name)})</span><small>${esc([ME.sign ? ME.sign + " Sun" : "", ME.birth ? "Life Path " + numerology(ME.birth, null).lp : ""].filter(Boolean).join(" · ") || "your readings")}</small></button>
      ${gs.map((g) => `<button class="who-opt" data-g="${g.id}"><span>${esc(g.name)}</span><small>${(g.readings || []).length} past reading${(g.readings || []).length === 1 ? "" : "s"}${g.sun_sign ? " · " + esc(g.sun_sign) + " Sun" : ""}</small></button>`).join("")}
      <details class="who-new"><summary class="who-opt"><span>＋ New guest</span><small>name & birthday</small></summary>
        <input id="whoName" placeholder="Name" maxlength="80" /><input id="whoBday" type="date" aria-label="Birthday (optional)" />
        <button class="btn btn-gold btn-sm" id="whoAdd">Add & draw</button><p class="status" id="whoSt"></p></details>
      <button class="link-btn who-cancel" data-x>Cancel</button></div>`;
    document.body.appendChild(sh); wireIntent(sh);
    const go = (fw) => { S.forWho = fw; S.dfDone = false; S.clar = []; sh.remove(); cb(); };
    $$("[data-x]", sh).forEach((b) => b.addEventListener("click", () => sh.remove()));
    $("[data-me]", sh).addEventListener("click", () => go({ kind: "me" }));
    $$("[data-g]", sh).forEach((b) => b.addEventListener("click", () => { const g = S.guests.find((x) => x.id === b.dataset.g); go({ kind: "guest", id: g.id, name: g.name }); }));
    $("#whoAdd", sh).addEventListener("click", async () => {
      const name = $("#whoName").value.trim(), bd = $("#whoBday").value, st = $("#whoSt");
      if (!name) { st.textContent = "Add a name."; return; }
      try { st.textContent = "Adding…"; const g = await ensureGuest(name);
        if (bd) await api(`/api/guests/${g.id}/profile`, { birth_date: bd });
        await loadAll(); go({ kind: "guest", id: g.id, name: g.name }); }
      catch (e) { st.textContent = "Couldn’t add: " + e.message; }
    });
  }
  $("#spreadSel").addEventListener("change", (e) => {
    const k = e.target.value;
    if (!discardOk()) { e.target.value = S.spreadKey || ""; return; }
    if (!k) { S.spreadKey = null; return; }
    S.spreadKey = k; S.count = SPREADS[k].pos.length;
    $$("[data-count]").forEach((b) => b.classList.remove("active")); $("#labelSet").hidden = true; resetDraw();
  });


  const drawSource = () => (S.src === "physical" ? "physical deck" : "digital app");
  const payloadCards = () => S.drawn.map((d, i) => ({ id: d.card.id, orientation: d.orientation, source: drawSource(), ...(posLabel(i) ? { position: posLabel(i) } : {}) }));
  function setSaveStatus(msg, err) { saveStatus.textContent = msg; saveStatus.classList.toggle("err", !!err); }
  const lockSave = (on) => { $("#saveMineBtn").disabled = $("#saveGuestBtn").disabled = on; };

  $("#saveMineBtn").addEventListener("click", async () => {
    try {
      lockSave(true);
      const clar = (S.clar || []).map((x) => ({ id: x.card.id, orientation: x.orientation, source: drawSource(), position: clarLabel(x) }));
      const note = [intentNote(), $("#noteInput").value].filter(Boolean).join("\n");
      const res = await api("/api/entries", { date: localDate(), cards: [...payloadCards(), ...clar], note, spreadLabels: clar.length ? null : labelsNow(), intent: S.intent && S.intent.text.trim() ? { type: S.intent.type, text: S.intent.text.trim() } : null, spread: S.spreadKey ? SPREADS[S.spreadKey].name : S.count === 3 ? `3-card (${LABELS[S.labels].join(" · ")})` : S.count === 1 ? "One card" : `${S.count} cards`, cohesive: { exclude: cohEx(localDate()) } });
      S.saved = true; S.savedMine = true;
      $("#dfFull") && $(".clar-bar", $("#dfFull")) && $(".clar-bar", $("#dfFull")).remove();
      S.lastShare = S.drawn.map((d, i) => ({ name: d.card.name, orientation: d.orientation, source: drawSource(), position: posLabel(i) }));
      setSaveStatus(!res.added.length ? "Already in today’s journal — nothing new to add." : "Saved to today’s journal." + (res.skipped.length ? ` (${res.skipped.join(", ")} was already there.)` : ""));
      $("#noteInput").value = "";
      renderReadings();
      await loadAll();
    } catch (e) { setSaveStatus("Couldn’t save: " + e.message, true); lockSave(false); }
  });
  $("#shareBtn").addEventListener("click", () => shareCards(S.lastShare || [], saveStatus));

  /* Share: the phone's share sheet when there is one, otherwise copy the text. */
  function shareText(cards) {
    const word = (o) => (isUnknown(o) ? "orientation not recorded" : isRev(o) ? "reversed" : "upright");
    const srcs = [...new Set(cards.map((c) => c.source).filter(Boolean))];
    const one = srcs.length === 1;
    const parts = cards.map((c) => `${c.position ? c.position + ": " : ""}${c.name}, ${word(c.orientation)}${!one && c.source ? ` (${c.source})` : ""}`);
    return `Today's card${cards.length > 1 ? "s" : ""}: ${parts.join("; ")}${one ? ` (${srcs[0]})` : ""}`;
  }
  async function shareCards(cards, statusEl) {
    if (!cards.length) return;
    const text = shareText(cards);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (_) {} ta.remove();
    }
    if (statusEl) { statusEl.classList.remove("err"); statusEl.textContent = "Copied to clipboard: " + text; }
  }

  /* Today opens on today's saved card when there is one. */
  function renderSavedToday() {
    const day = todaysEntry(), box = $("#todaySaved");
    const showSaved = S.todayView === "saved" && !!day;
    box.hidden = !showSaved; $("#todayDraw").hidden = showSaved;
    $("#backToSaved").hidden = showSaved || !day;
    if (!showSaved) return;
    const n = day.cards.length;
    box.innerHTML = `<p class="ts-eyebrow">${esc(fmtDate(day.date, { weekday: "long", month: "long", day: "numeric" }))}</p>
      <h2 class="ts-title">${n > 1 ? "Your cards today" : "Your card today"}</h2>
      <div class="ts-cards ${n > 1 ? "many" : ""}">${day.cards.map((c) => { const k = cardFor(c); return `<div class="ts-item">
        <button type="button" class="ts-card" ${k ? `data-id="${k.id}"` : ""} data-o="${esc(c.orientation)}" aria-label="Open the full meaning of ${esc(c.name)}">
          <img src="${deckImg(c.img || (k && k.img))}" alt="${esc(c.name)}${isRev(c.orientation) ? " (reversed)" : ""}" class="${isRev(c.orientation) ? "reversed-img" : ""}" /></button>
        <div class="ts-info"><h3>${esc(c.name)}</h3><div class="meta">${badge(c.orientation)}<span class="tag">${esc(c.source || "")}</span></div>
          <p class="one-line">${esc(entryLine(c, k))}</p></div></div>`; }).join("")}</div>
      <div class="actions">
        <button type="button" class="btn btn-ghost" id="tsShare"><span aria-hidden="true">⇪</span> Share</button>
        <button type="button" class="btn btn-gold" id="tsAnother"><span aria-hidden="true">✦</span> Pull another / spread</button>
      </div>
      <p class="status" id="tsStatus" role="status" aria-live="polite"></p>`;
    $$(".ts-card[data-id]", box).forEach((b) => b.addEventListener("click", () => openCard(b.dataset.id, b.dataset.o)));
    $("#tsShare").addEventListener("click", () => shareCards(day.cards.map((c) => ({ name: c.name, orientation: c.orientation, source: c.source })), $("#tsStatus")));
    $("#tsAnother").addEventListener("click", () => { S.todayView = "draw"; renderSavedToday(); window.scrollTo({ top: 0 }); });
  }
  $("#backToSaved").addEventListener("click", () => { S.todayView = "saved"; renderSavedToday(); window.scrollTo({ top: 0 }); });

  async function ensureGuest(name, note) {
    const res = await api("/api/guests", { name, note });
    return res.guest;
  }
  $("#saveGuestBtn").addEventListener("click", async () => {
    const name = $("#guestName").value.trim();
    if (!name) { $(".note-fields").open = true; $(".guest-fields").open = true; $("#guestName").focus(); setSaveStatus("Who is this reading for? Add a name below.", true); return; }
    try {
      lockSave(true);
      const g = await ensureGuest(name);
      await api(`/api/guests/${g.id}/readings`, { date: localDate(), cards: payloadCards(), question: $("#guestQuestion").value, spread: S.spreadKey ? SPREADS[S.spreadKey].name : S.count === 3 ? `3-card (${LABELS[S.labels].join(" · ")})` : "One card", note: $("#noteInput").value });
      S.saved = true; S.savedMine = false; S.guestSel = g.id;
      setSaveStatus(`Saved to ${g.name}’s readings in Guests — not in your journal.`);
      $("#guestName").value = $("#guestQuestion").value = $("#noteInput").value = "";
      renderReadings();
      await loadAll();
    } catch (e) { setSaveStatus("Couldn’t save: " + e.message, true); lockSave(false); }
  });

  // Photo of my own cards
  const photoTags = TagList($("#photoTags"));
  const photoPicker = PhotoPicker([$("#photoCamera"), $("#photoPick")], $("#photoThumbs"), (l) => { $("#savePhotoBtn").disabled = !l.length; });
  $("#savePhotoBtn").addEventListener("click", async () => {
    const st = $("#photoStatus"); st.classList.remove("err");
    const unknown = photoTags.unknown();
    if (unknown.length) { st.textContent = `Not a card name: ${unknown.join(", ")} — pick from the list or remove it.`; st.classList.add("err"); return; }
    try {
      $("#savePhotoBtn").disabled = true; st.textContent = "Saving…";
      await api("/api/photos", { date: localDate(), photos: photoPicker.list.map((p) => ({ name: p.name, data: p.data })), cards: photoTags.cards("physical deck"), note: $("#photoNote").value });
      st.textContent = "Photo saved. TaroBot will read your cards shortly.";
      photoPicker.reset(); photoTags.reset(); $("#photoNote").value = "";
      await loadAll();
    } catch (e) { st.textContent = "Couldn’t save: " + e.message; st.classList.add("err"); $("#savePhotoBtn").disabled = false; }
  });

  /* ---------------- journal ---------------- */
  const sortedDays = () => [...S.entries].sort((a, b) => b.date.localeCompare(a.date));
  function notesHTML(text) {
    if (!text) return "";
    return text.split(/\n\s*\n/).map((para) => `<p>${para.split("\n").map((line) => {
      const m = line.match(/^(Day weave|Theme|Together|Dos|Don[’']ts|Note|Reading|3-card spread[^:—]*)(\s*[—:]\s*)(.*)$/);
      return m ? `<b>${esc(m[1])}</b>${esc(m[2])}${esc(m[3])}` : esc(line);
    }).join("<br/>")}</p>`).join("");
  }

  function renderGaps() {
    const open = S.gaps.filter((g) => g.status === "open");
    const waiting = S.outbox.filter((o) => o.kind === "self_photo" && o.status === "needs_identification");
    $("#gapBox").innerHTML =
      (open.length ? `<div class="gap-card"><h4>✦ Needs your input</h4>${open.map((g) => `
        <div class="gap-row" data-id="${esc(g.id)}">
          <img src="${thumbImg(g.img)}" alt="" loading="lazy" />
          <p><b>${esc(fmtDate(g.date, { weekday: "short", month: "short", day: "numeric" }))}</b> · ${esc(g.name)} — orientation unknown. Was it upright or reversed?</p>
          <div class="actions"><button class="btn btn-ghost btn-sm" data-o="upright">Upright</button><button class="btn btn-ghost btn-sm" data-o="reversed">Reversed</button><button class="btn btn-ghost btn-sm btn-quiet" data-o="unknown">I don’t remember</button></div>
          <p class="gap-hint">“I don’t remember” saves the card to that day as <i>orientation not recorded</i>.</p>
        </div>`).join("")}</div>` : "") +
      (waiting.length ? `<div class="waiting"><h4>☽ Waiting for TaroBot</h4>${waiting.map((o) => `
        <p>${esc(short(o.date))} · ${o.photos.length} photo${o.photos.length === 1 ? "" : "s"}${o.cards && o.cards.length ? " · tagged: " + o.cards.map((c) => esc(c.name)).join(", ") : ""}</p>${photosHTML(o.photos)}`).join("")}</div>` : "");
    $$(".gap-row", $("#gapBox")).forEach((row) => $$("[data-o]", row).forEach((b) => b.addEventListener("click", async () => {
      $$("button", row).forEach((x) => (x.disabled = true));
      try {
        const res = await api("/api/gaps/resolve", { id: row.dataset.id, orientation: b.dataset.o });
        await loadAll();
        const idx = sortedDays().findIndex((d) => d.date === res.gap.date);
        if (idx >= 0) showDay(idx);
      } catch (e) { alert("Couldn’t save: " + e.message); $$("button", row).forEach((x) => (x.disabled = false)); }
    })));
  }

  /* "Astro tie-in pending" only while a pending_astro outbox record lists the card; otherwise a neutral note. */
  const astroPending = (date, name) => S.outbox.some((o) => o.status === "pending_astro" && o.date === date && (o.cards || []).some((x) => String(x.name).toLowerCase() === String(name).toLowerCase()));
  const astroLine = (date, c) => c.astro ? `<p class="astro-text">${esc(c.astro)}</p>`
    : astroPending(date, c.name) ? `<span class="pending">Astro tie-in pending</span>` : `<span class="no-astro">No astro note</span>`;

  /* ---------- streak + monthly recap (client-side from /api/entries) ---------- */
  const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
  const SUIT_LABEL = { Major: "Major Arcana" };
  function monthStats(month) {
    const days = S.entries.filter((d) => String(d.date).startsWith(month) && d.cards && d.cards.length);
    const cards = days.flatMap((d) => d.cards);
    const suits = new Map();
    let rev = 0, up = 0;
    cards.forEach((c) => {
      const k = cardFor(c), g = k ? groupOf(k) : ((String(c.name).match(/of (\w+)$/) || [])[1] || "Major");
      suits.set(g, (suits.get(g) || 0) + 1);
      if (isRev(c.orientation)) rev++; else if (!isUnknown(c.orientation)) up++;
    });
    const top = [...suits].sort((a, b) => b[1] - a[1])[0];
    const lean = rev + up === 0 ? "" : rev > up ? "mostly reversed" : up > rev ? "mostly upright" : "upright and reversed evenly";
    return { days: days.length, cards: cards.length, top: top && top[1] > 1 ? `${SUIT_LABEL[top[0]] || top[0]} ×${top[1]}` : "", lean };
  }
  function streak() {
    const have = new Set(S.entries.filter((d) => d.cards && d.cards.length).map((d) => d.date));
    let d = localDate(); if (!have.has(d)) d = addDays(d, -1);
    let n = 0; while (have.has(d)) { n++; d = addDays(d, -1); }
    return { n, today: have.has(localDate()) };
  }
  function recapParts() {
    const today = localDate(), month = today.slice(0, 7), st = streak(), m = monthStats(month);
    const fmt = (x) => [`${x.days} day${x.days === 1 ? "" : "s"}`, x.top, x.lean].filter(Boolean).join(" · ");
    let monthTxt = m.days ? `This month: ${fmt(m)}` : "This month: no cards yet";
    let lastTxt = "";
    if (!m.days) {
      const prev = addDays(month + "-01", -1).slice(0, 7), pm = monthStats(prev);
      if (pm.days) lastTxt = `${fmtDate(prev + "-01", { month: "long" })}: ${fmt(pm)}`;
    }
    const streakTxt = st.n ? `Streak: ${st.n} day${st.n === 1 ? "" : "s"}${st.today ? "" : " (draw today to keep it)"}` : "No streak yet. Today can start one.";
    return { monthTxt, lastTxt, streakTxt, st };
  }
  function renderRecap() {
    const r = recapParts();
    $("#recapBox").innerHTML = `<div class="recap"><div class="recap-main"><span class="recap-streak">${r.st.n ? `<b>${r.st.n}</b> day streak` : "No streak yet"}</span>
      <p>${esc(r.monthTxt)}</p>${r.lastTxt ? `<p class="muted">${esc(r.lastTxt)}</p>` : ""}</div>
      ${r.st.n && !r.st.today ? `<p class="recap-tip">Draw today to keep it going.</p>` : !r.st.n ? `<p class="recap-tip">Today can start one.</p>` : ""}</div>`;
    renderMyPatterns();
    $("#todayRecap").textContent = [r.st.n ? `Streak ${r.st.n} day${r.st.n === 1 ? "" : "s"}` : "", r.monthTxt].filter(Boolean).join(" · ");
  }

  function renderJournal() {
    const days = sortedDays();
    S.jIndex = Math.min(S.jIndex, Math.max(days.length - 1, 0));
    $("#jDates").innerHTML = days.map((d, i) => `<button class="date-chip ${i === S.jIndex ? "active" : ""}" data-i="${i}">${esc(short(d.date))}</button>`).join("");
    $$(".date-chip").forEach((b) => b.addEventListener("click", () => showDay(Number(b.dataset.i))));
    $("#jPrev").disabled = S.jIndex <= 0;
    $("#jNext").disabled = S.jIndex >= days.length - 1;
    const day = days[S.jIndex];
    if (!day) { $("#jPage").innerHTML = `<p class="center muted">No entries yet.</p>`; return; }
    const n = day.cards.length;
    $("#jPage").innerHTML = `
      <h2 class="page-date">${esc(fmtDate(day.date))}</h2>
      <div class="actions" style="justify-content:flex-end"><button type="button" class="btn btn-ghost btn-sm" data-delete-personal-reading="${esc(day.date)}">Delete reading</button></div>
      <p class="page-sub">${n} card${n === 1 ? "" : "s"} · ${esc([...new Set(day.cards.map((c) => c.source || "draw"))].join(" · "))}</p>
      ${(() => { const nm=ME.birth?numerology(ME.birth,null,day.date):null, pd=nm&&nm.rows.find(r=>r.label==="Personal Day"), current=S.astroToday&&S.astroToday.date===day.date?S.astroToday:null, historic=S.birthProfile&&window.TarotAstro?window.TarotAstro.run(S.birthProfile,day.date):current; return pd?`<div class="astro-journal-summary"><b>Astro + numerology · Personal Day ${pd.n}</b><p>Life Path ${nm.lp}: ${esc(NUM_MEAN[nm.lp]||"")}. Personal Day: ${esc(pd.meaning)}.</p>${historic&&historic.moon?`<p>Moon in ${esc(historic.moon.sign)} · ${esc(historic.moon.phase)}.</p>`:""}${historic&&historic.aspects&&historic.aspects.length?`<p>Transits: ${historic.aspects.slice(0,2).map(x=>`${esc(x.transit)} ${esc(x.aspect)} natal ${esc(x.natal)} · ${x.orb}°`).join(" · ")}.</p>`:""}<p class="muted">Reflection: where did these themes appear in your choices, relationships or daily routines?</p></div>`:""; })()}
      <div class="day-cards">${day.cards.map((c, cardIndex) => `
        <div class="day-card">
          <img src="${thumbImg(c.img)}" alt="${esc(c.name)}" class="${isRev(c.orientation) ? "reversed-img" : ""}" loading="lazy" />
          <div>
            <h3>${esc(c.name)}</h3>
            <div class="meta" style="display:flex;gap:.4rem;align-items:center;margin:.35rem 0 .6rem">${badge(c.orientation)}<span class="tag">${esc(c.source || "")}</span></div>
            <p>${esc(c.summary || "")}</p>
            <p class="sit">${esc(c.sitWith || "")}</p>
            <button type="button" class="link-btn" data-delete-personal-card data-date="${esc(day.date)}" data-index="${cardIndex}" data-name="${esc(c.name)}" data-orientation="${esc(c.orientation)}">Remove this card</button>
            ${(() => { const k = S.cards.find((x) => x.id === c.id) || S.byName.get(String(c.name || "").toLowerCase()); return k ? infoHTML(k, c.orientation, { open: [], skip: ["sit"] }) : ""; })()}
            <span class="label">Astro · chart weave</span>
            ${astroLine(day.date, c)}
            ${(() => { const k = S.cards.find((x) => x.id === c.id) || S.byName.get(String(c.name || "").toLowerCase()); const ties = k ? cardTies(k, c.orientation, personMe(day.date)) : []; return ties.length ? `<div class="astro-card-ties"><b>Chart + numerology links</b>${ties.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` : ""; })()}
          </div>
        </div>`).join("")}</div>
      ${cohJournalHTML(day)}
      ${day.photos && day.photos.length ? `<div class="notes"><span class="label">Photo of the spread</span>${photosHTML(day.photos)}</div>` : ""}
      ${day.notes ? `<div class="notes"><span class="label">Day notes</span>${notesHTML(day.notes)}</div>` : ""}
      <div class="j-share">${shareToggle("reading", day.date)}</div>`;
    wireCohPicker($("#jPage"), day.date, renderJournal);
    const chip = $(".date-chip.active"); if (chip && !$("#panel-journal").hidden) chip.scrollIntoView({ block: "nearest", inline: "center" });
  }
  function showDay(i) {
    const dir = i > S.jIndex ? "turn-fwd" : "turn-back";
    S.jIndex = i; renderJournal();
    const p = $("#jPage"); p.classList.remove("turn-fwd", "turn-back"); void p.offsetWidth; p.classList.add(dir);
  }
  $("#jPrev").addEventListener("click", () => S.jIndex > 0 && showDay(S.jIndex - 1));
  $("#jNext").addEventListener("click", () => S.jIndex < S.entries.length - 1 && showDay(S.jIndex + 1));
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-personal-reading], [data-delete-personal-card], [data-delete-guest-reading], [data-delete-guest-card]");
    if (!button) return;
    const personalReading = button.hasAttribute("data-delete-personal-reading");
    const personalCard = button.hasAttribute("data-delete-personal-card");
    const guestReading = button.hasAttribute("data-delete-guest-reading");
    const label = personalReading || guestReading ? "this entire reading and its saved photos" : "this card from the reading";
    if (!confirm("Delete " + label + "? This cannot be undone.")) return;
    button.disabled = true;
    try {
      if (personalReading) {
        const date = button.getAttribute("data-delete-personal-reading");
        await api("/api/entries/" + encodeURIComponent(date) + "/delete", { date });
      } else if (personalCard) {
        const date = button.dataset.date;
        await api("/api/entries/" + encodeURIComponent(date) + "/cards/delete", { date, index: Number(button.dataset.index), name: button.dataset.name, orientation: button.dataset.orientation });
      } else if (guestReading) {
        const gid = button.dataset.gid, rid = button.dataset.rid;
        await api("/api/guests/" + encodeURIComponent(gid) + "/readings/" + encodeURIComponent(rid) + "/delete", {});
      } else {
        const gid = button.dataset.gid, rid = button.dataset.rid;
        await api("/api/guests/" + encodeURIComponent(gid) + "/readings/" + encodeURIComponent(rid) + "/cards/delete", { index: Number(button.dataset.index), name: button.dataset.name, orientation: button.dataset.orientation });
      }
      await loadAll();
    } catch (error) {
      button.disabled = false;
      alert("Could not delete: " + error.message);
    }
  });
  document.addEventListener("keydown", (e) => {
    if ($("#panel-journal").hidden || e.target.matches("input, textarea, select") || e.target.closest(".tabs")) return;
    if (e.key === "ArrowLeft") $("#jPrev").click();
    if (e.key === "ArrowRight") $("#jNext").click();
  });

  /* ---------------- guests ---------------- */
  const lastDate = (g) => (g.readings || []).reduce((m, r) => (r.date > m ? r.date : m), "");
  function patterns(g) {
    const cardCount = new Map(), suitCount = new Map();
    let revs = 0, total = 0;
    (g.readings || []).forEach((r) => (r.cards || []).forEach((c) => {
      total++; if (isRev(c.orientation)) revs++;
      cardCount.set(c.name, (cardCount.get(c.name) || 0) + 1);
      const k = S.byName.get(c.name.toLowerCase());
      const suit = k ? (k.arcana === "major" ? "Major" : k.suit) : "?";
      suitCount.set(suit, (suitCount.get(suit) || 0) + 1);
    }));
    const cards = [...cardCount].sort((a, b) => b[1] - a[1]);
    const recurring = cards.filter(([, n]) => n > 1);
    return { total, revs, recurring: (recurring.length ? recurring : cards).slice(0, 8), suits: [...suitCount].sort((a, b) => b[1] - a[1]) };
  }

  function renderGuestsTab() {
    const act = (g) => lastDate(g) || String(g.created_at || "").slice(0, 10);
    const guests = [...S.guests].sort((a, b) => act(b).localeCompare(act(a)) || (b.readings || []).length - (a.readings || []).length);
    if (!guests.length) $("#addWrap").open = true;
    if (!guests.find((g) => g.id === S.guestSel)) S.guestSel = guests[0] ? guests[0].id : null;
    $("#peopleList").innerHTML = guests.length ? guests.map((g) => {
      const n = (g.readings || []).length, ld = lastDate(g);
      return `<button class="person ${g.id === S.guestSel ? "active" : ""}" data-id="${g.id}"><b>${esc(g.name)}</b><small>${n} reading${n === 1 ? "" : "s"}${ld ? " · last " + esc(short(ld)) : ""}</small></button>`;
    }).join("") : `<p class="muted" style="font-size:.88rem;margin:0">No one yet.</p>`;
    $$(".person").forEach((b) => b.addEventListener("click", () => { S.guestSel = b.dataset.id; renderGuestsTab(); }));
    $("#guestNames").innerHTML = guests.map((g) => `<option value="${esc(g.name)}"></option>`).join("");
    const g = guests.find((x) => x.id === S.guestSel);
    const prof = $("#profile");
    if (!g) { prof.innerHTML = `<div class="profile-head"><h2>Guest readings</h2><p class="note">Add someone you read for. Each person gets a timeline of readings, photos, and the patterns that keep showing up.</p></div>`; return; }
    const pt = patterns(g);
    const readingsSorted = [...(g.readings || [])].sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at));
    prof.innerHTML = `
      <div class="profile-head">
        <h2>${esc(g.name)}</h2>
        ${g.note ? `<p class="note">${esc(g.note)}</p>` : ""}
        <span class="label">Across ${readingsSorted.length} reading${readingsSorted.length === 1 ? "" : "s"}</span>
        ${pt.total ? `<details class="pt-wrap" open><summary>Patterns for ${esc(g.name)}</summary>${patternsHTML(guestCardList(g), g.name)}</details>`
          : `<p class="note">Patterns appear once readings have cards.</p>`}
      </div>
      <div class="g-birth">
        <p class="note" id="gBirthLine">${g.birth && g.birth.date ? `Born ${esc(g.birth.date)}${g.birth.time ? " at " + esc(g.birth.time) : " (time unknown)"}${g.birth.place ? ", " + esc(g.birth.place) : ""}${g.sun_sign ? " · Sun in " + esc(g.sun_sign) : ""}` : "No birth details yet."}</p>
        <details class="g-edit"><summary>Edit birth details</summary>
          <div class="nr-grid">
            <label class="field"><span>Birth date</span><input type="date" id="gbDate" value="${esc((g.birth || {}).date || "")}" /></label>
            <label class="field"><span>Birth time <em>(optional)</em></span><input type="time" id="gbTime" value="${esc((g.birth || {}).time || "")}" /></label>
            <label class="field"><span>Birth place <em>(city, state)</em></span><input id="gbPlace" maxlength="120" value="${esc((g.birth || {}).place || "")}" placeholder="City, State" /></label>
            <label class="field"><span>Full birth name <em>(for numerology)</em></span><input id="gbName" maxlength="120" value="${esc(g.birth_name || "")}" /></label>
            <label class="field"><span>Latitude <em>(only if the place isn’t found)</em></span><input id="gbLat" inputmode="decimal" value="${esc(String((g.birth || {}).lat ?? ""))}" /></label>
            <label class="field"><span>Longitude</span><input id="gbLon" inputmode="decimal" value="${esc(String((g.birth || {}).lon ?? ""))}" /></label>
            <label class="field"><span>Time zone <em>(e.g. America/Denver)</em></span><input id="gbTz" value="${esc((g.birth || {}).tz || "")}" /></label>
          </div>
          <div class="actions" style="justify-content:flex-start"><button class="btn btn-ghost btn-sm" id="gbSave">Save birth details</button></div>
          <p class="status" id="gbStatus" style="text-align:left"></p>
        </details>
        <div class="actions" style="justify-content:flex-start"><button class="btn btn-ghost btn-sm" id="gHoro">Horoscope</button><button class="btn btn-ghost btn-sm" id="gNum">Numerology</button></div>
        <div id="gInsight"></div>
        ${(g.insights || []).length ? `<details class="g-insights"><summary>Saved horoscopes and numerology (${g.insights.length})</summary>${[...g.insights].reverse().map((i) => `<article class="g-reading"><header><h3>${esc(i.title)} · ${esc(short(i.date))}</h3></header><p class="g-text" style="white-space:pre-line">${esc(i.text)}</p></article>`).join("")}</details>` : ""}
      </div>
      <details class="new-reading" id="newReading">
        <summary>＋ New reading for ${esc(g.name)}</summary>
        <div class="nr-grid">
          <label class="field"><span>Date</span><input type="date" id="nrDate" value="${localDate()}" /></label>
          <label class="field"><span>Question or topic <em>(optional)</em></span><input id="nrQuestion" maxlength="300" /></label>
          <label class="field"><span>Spread</span><select id="nrSpread"><option>One card</option><option>3-card spread</option><option>Celtic Cross</option><option>Other</option></select></label>
        </div>
        <div class="actions" style="justify-content:flex-start">
          <label class="btn btn-ghost btn-sm file-btn">📷 Take a photo<input type="file" accept="image/*" capture="environment" id="nrCamera" multiple hidden /></label>
          <label class="btn btn-ghost btn-sm file-btn">Choose photos<input type="file" accept="image/*" id="nrPick" multiple hidden /></label>
        </div>
        <div class="thumbs" id="nrThumbs" style="justify-content:flex-start;margin:.4rem 0"></div>
        <span class="label">Cards <em style="text-transform:none;letter-spacing:0">(optional — TaroBot can read them from the photo)</em></span>
        <div id="nrTags"></div>
        <div class="nr-live" id="nrLive"><span class="label">Reading so far</span><div id="nrLiveBody"></div></div>
        <label class="field" style="margin-top:.7rem"><span>Note <em>(optional)</em></span><textarea id="nrNote" rows="2" maxlength="600"></textarea></label>
        <div class="actions" style="justify-content:flex-start"><button class="btn btn-gold btn-sm" id="nrSave">Save reading</button></div>
        <p class="status" id="nrStatus" style="text-align:left"></p>
      </details>
      <div class="timeline">${readingsSorted.length ? readingsSorted.map((r) => `
        <article class="g-reading">
          <header><h3>${esc(fmtDate(r.date, { weekday: "short", month: "long", day: "numeric", year: "numeric" }))}</h3>
            <div class="actions"><button type="button" class="link-btn" data-delete-guest-reading data-gid="${esc(g.id)}" data-rid="${esc(r.id)}">Delete reading</button>
            ${r.reading ? `<span class="pill">Read</span>` : `<span class="pill wait">Awaiting TaroBot</span>`}</div></header>
          ${r.question ? `<p class="q">“${esc(r.question)}”</p>` : ""}
          ${r.spread ? `<span class="tag">${esc(r.spread)}</span>` : ""}
          ${r.cards && r.cards.length ? `<div class="g-cards">${r.cards.map((c, cardIndex) => { const k = S.byName.get(c.name.toLowerCase()); return `<div class="g-card"><img src="${thumbImg(c.img || (k && k.img))}" alt="" loading="lazy" class="${isRev(c.orientation) ? "reversed-img" : ""}" /><div>${esc(c.name)}<small>${c.position ? esc(c.position) + " · " : ""}${isRev(c.orientation) ? "reversed" : "upright"}</small></div><button type="button" class="link-btn" data-delete-guest-card data-gid="${esc(g.id)}" data-rid="${esc(r.id)}" data-index="${cardIndex}" data-name="${esc(c.name)}" data-orientation="${esc(c.orientation)}" aria-label="Remove ${esc(c.name)}">×</button></div>`; }).join("")}</div>` : ""}
          ${photosHTML(r.photos)}
          ${cohGuestHTML(g, r)}
          ${r.generated_reading ? `<details class="gen-wrap" open><summary>Card-by-card reading</summary>${genReadingHTML(r.generated_reading)}</details>` : ""}
          ${r.reading ? `<p class="g-text">${esc(r.reading)}</p>` : `<span class="pending" style="margin-top:.5rem">TaroBot’s reading will appear here</span>`}
          ${r.note ? `<p class="g-text muted" style="font-size:.85rem">Note: ${esc(r.note)}</p>` : ""}
          ${r.cards && r.cards.length ? `<div class="actions g-share" style="justify-content:flex-start"><button class="btn btn-ghost btn-sm" data-share-fmt="png" data-gid="${g.id}" data-rid="${r.id}">⇪ Image</button><button class="btn btn-ghost btn-sm" data-share-fmt="pdf" data-gid="${g.id}" data-rid="${r.id}">⇪ PDF</button>${shareToggle("guest_reading", r.id)}</div>` : ""}
        </article>`).join("") : `<p class="muted center">No readings yet.</p>`}</div>`;
    wireGuestBirth(g);
    const liveUpdate = () => { const b = $("#nrLiveBody"); if (b) b.innerHTML = genReadingHTML(buildReading(tags.rows(), guestTies(g)), { live: true });
      const f = $("#dfGuestFull"); if (f && tags) f.innerHTML = fullReadingHTML(tags.rows(), personFor(g)); };
    const tags = TagList($("#nrTags"), { withPos: true, onChange: liveUpdate });
    liveUpdate();
    if (S.pendingGuest && S.pendingGuest.gid === g.id) {
      const pg = S.pendingGuest; S.pendingGuest = null;
      $("#newReading").open = true;
      const sp = $("#nrSpread"); if (![...sp.options].some((o) => o.value === pg.spread)) sp.insertAdjacentHTML("beforeend", `<option>${esc(pg.spread)}</option>`); sp.value = pg.spread;
      if (pg.q) $("#nrQuestion").value = pg.q;
      $("#nrLive").insertAdjacentHTML("afterend", `<div class="df-full" id="dfGuestFull"></div>`);
      $("#nrTags").insertAdjacentHTML("afterend", `<div class="clar-bar"><span class="label">Unclear? Pull a clarifier for</span><div class="clar-btns">${pg.rows.map((r, i) => `<button type="button" class="chip" data-gclar="${i}">＋ ${esc(r.position || "Card " + (i + 1))}</button>`).join("")}</div></div>`);
      const gRows = [...pg.rows];
      $$("[data-gclar]").forEach((b) => b.addEventListener("click", () => {
        const used = new Set(gRows.map((r) => r.card.id)); const pool = S.deck.filter((c) => !used.has(c.id)); const card = pool[0] || shuffle(S.cards.filter((c) => !used.has(c.id)))[0];
        S.deck = S.deck.filter((c) => c.id !== card.id);
        const src = gRows[Number(b.dataset.gclar)];
        gRows.push({ card, orientation: Math.random() < REVERSED_CHANCE ? "reversed" : "upright", position: `${src.position || "Card " + (Number(b.dataset.gclar) + 1)} · clarifier` });
        tags.load(gRows);
      }));
      tags.load(pg.rows);
      $("#nrNote").value = ["Drawn in the app (digital deck).", pg.intent && !pg.intent.startsWith("Question") ? pg.intent : ""].filter(Boolean).join(" ");
      setTimeout(() => $("#newReading").scrollIntoView({ block: "start", behavior: "smooth" }), 80);
    }
    const pics = PhotoPicker([$("#nrCamera"), $("#nrPick")], $("#nrThumbs"));
    $("#nrSave").addEventListener("click", async () => {
      const st = $("#nrStatus"); st.classList.remove("err");
      const unknown = tags.unknown();
      if (unknown.length) { st.textContent = `Not a card name: ${unknown.join(", ")}`; st.classList.add("err"); return; }
      if (!pics.list.length && !tags.cards().length) { st.textContent = "Add a photo or at least one card."; st.classList.add("err"); return; }
      try {
        $("#nrSave").disabled = true; st.textContent = "Saving…";
        const nrPost = (id) => api(`/api/guests/${id}/readings`, { date: $("#nrDate").value || localDate(), question: $("#nrQuestion").value, spread: $("#nrSpread").value, photos: pics.list.map((p) => ({ name: p.name, data: p.data })), cards: tags.cards("physical deck"), note: $("#nrNote").value, generated_reading: buildReading(tags.rows(), guestTies(g)) });
        let saved;
        try { saved = await nrPost(g.id); }
        catch (e1) {
          if (!e1.noGuest) throw e1;
          // stale guest id: find/create this person by name on the server (POST /api/guests reuses an existing name), then save once
          const fresh = (await api("/api/guests", { name: g.name, note: g.note || "" })).guest;
          S.guestSel = fresh.id; saved = await nrPost(fresh.id);
        }
        // show it right away (optimistic), then refetch from the network
        const gg = S.guests.find((x) => x.id === (saved && saved.guest_id));
        if (gg && saved.reading && !(gg.readings || []).some((x) => x.id === saved.reading.id)) (gg.readings = gg.readings || []).push(saved.reading);
        S.guestSel = (saved && saved.guest_id) || S.guestSel;
        if (S.forWho && S.forWho.kind === "guest" && S.drawn.length) { S.drawn = []; S.saved = false; S.forWho = null; renderToday(); }
        renderGuestsTab();
        await loadAll();
        const s2 = $("#nrStatus"); if (s2) s2.textContent = "";
        $("#profile .timeline").insertAdjacentHTML("beforebegin", `<p class="status">Saved. TaroBot will write ${esc(g.name)}’s reading shortly.</p>`);
      } catch (e) { st.textContent = "Couldn’t save: " + e.message; st.classList.add("err"); $("#nrSave").disabled = false; }
    });
  }
  $("#addPerson").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#newGuestName").value.trim(); if (!name) return;
    try {
      const g = await ensureGuest(name, $("#newGuestNote").value);
      S.guestSel = g.id; $("#newGuestName").value = $("#newGuestNote").value = "";
      await loadAll();
    } catch (err) { alert("Couldn’t add: " + err.message); }
  });

  /* ---------------- cards library ---------------- */
  function renderLibrary() {
    const q = S.query.trim().toLowerCase();
    const hay = (c) => [c.name, c.upright, c.reversed, ...(c.keywords ? [...(c.keywords.upright || []), ...(c.keywords.reversed || [])] : [])].join(" ").toLowerCase();
    const list = S.cards.filter((c) => (S.suit === "all" || (S.suit === "major" ? c.arcana === "major" : c.suit === S.suit)) && (!q || hay(c).includes(q)));
    $("#cardGrid").innerHTML = list.length ? list.map((c) => `<button class="tile" data-id="${c.id}"><img src="${thumbImg(c.img)}" alt="" loading="lazy" /><span>${esc(c.name)}</span></button>`).join("") : `<p class="empty">No cards match “${esc(S.query)}”.</p>`;
    $$(".tile").forEach((t) => t.addEventListener("click", () => openCard(t.dataset.id)));
  }
  $("#resBtn").addEventListener("click", openResources);
  $("#cardSearch").addEventListener("input", (e) => { S.query = e.target.value; renderLibrary(); });
  $$("#suitChips .chip").forEach((b) => b.addEventListener("click", () => {
    $$("#suitChips .chip").forEach((x) => x.classList.toggle("active", x === b)); S.suit = b.dataset.suit; renderLibrary();
  }));
  function openCard(id, orient, open) {
    const c = S.cards.find((x) => x.id === id); if (!c) return;
    S.modal = { c, o: isRev(orient) ? "reversed" : "upright" };
    renderModal(open || ["meaning"]);
    $("#modal").hidden = false; $(".modal-card").scrollTop = 0; $(".modal-close").focus();
  }
  function renderModal(open) {
    const { c, o } = S.modal, rev = isRev(o);
    $("#modalBody").innerHTML = `<div class="detail">
      <img src="${deckImg(c.img)}" alt="${esc(c.name)}${rev ? " (reversed)" : ""}" class="${rev ? "reversed-img" : ""}" />
      <div>
        <h2 id="modalTitle">${esc(c.name)}</h2>
        <p class="suit">${c.arcana === "major" ? "Major Arcana" : esc(c.suit)} ${esc(c.suitSymbol || "")}</p>
        <div class="seg seg-sm orient-toggle" role="group" aria-label="Show upright or reversed">
          <button type="button" class="seg-btn ${rev ? "" : "active"}" data-o="upright" aria-pressed="${!rev}">Upright</button>
          <button type="button" class="seg-btn ${rev ? "active" : ""}" data-o="reversed" aria-pressed="${rev}">Reversed</button>
        </div>
        ${infoHTML(c, o, { open, extra: c.imagery ? [["imagery", "Imagery", `<p>${esc(c.imagery)}</p>`]] : [] })}
      </div></div>`;
    $$(".orient-toggle .seg-btn", $("#modalBody")).forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.o === S.modal.o) return;
      const keep = openKeys($("#modalBody")), card = $(".modal-card"), y = card.scrollTop;
      S.modal.o = b.dataset.o; renderModal(keep); card.scrollTop = y;
      $(`.orient-toggle [data-o="${b.dataset.o}"]`).focus();
    }));
  }
  const closeModal = () => { $("#modal").hidden = true; };
  $$("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  /* ---------------- astro ---------------- */
  function weaveOf(notes) {
    if (!notes) return "";
    const paras = notes.split(/\n\s*\n/).filter((p) => /^(Day weave|Dos|Don[’']ts)/m.test(p.trim()));
    return paras.length ? notesHTML(paras.join("\n\n")) : "";
  }
  function renderAstro() {
    renderAstroToday();
    const pending = S.outbox.filter((o) => o.status === "pending_astro");
    $("#astroPending").innerHTML = pending.length ? `<div class="queue"><b>Waiting for Astro</b> · ${pending.map((o) => `${esc(short(o.date))}: ${o.cards.map((c) => esc(c.name) + (isRev(c.orientation) ? " (rev.)" : "")).join(", ")}`).join(" · ")}</div>` : "";
    $("#astroList").innerHTML = sortedDays().map((day) => {
      const missing = day.cards.filter((c) => !c.astro).length;
      const pend = day.cards.filter((c) => !c.astro && astroPending(day.date, c.name)).length;
      const weave = weaveOf(day.notes);
      const historical = S.birthProfile && window.TarotAstro ? window.TarotAstro.run(S.birthProfile, day.date) : null;
      const num = ME.birth ? numerology(ME.birth, null, day.date) : null;
      const personalDay = num && num.rows.find((r) => r.label === "Personal Day");
      const sky = historical ? `<div class="astro-day-context"><b>Personal sky · ${esc(day.date)}</b><p>Moon in ${esc(historical.moon.sign)} · ${esc(historical.moon.phase)}.</p><p>${historical.aspects.slice(0,3).map(x => `${esc(x.transit)} ${esc(x.aspect)} natal ${esc(x.natal)} · ${x.orb}°`).join(" · ") || "No close natal transits in this guide's orb."}</p>${personalDay ? `<p>Personal Day ${personalDay.n}: ${esc(personalDay.meaning)} · Life Path ${num.lp}</p>` : ""}</div>` : personalDay ? `<div class="astro-day-context"><b>Numerology · Personal Day ${personalDay.n}</b><p>Life Path ${num.lp} · ${esc(personalDay.meaning)}</p></div>` : "";
      return `<section class="astro-day">
        <header><h3>${esc(fmtDate(day.date, { weekday: "short", month: "long", day: "numeric" }))}</h3>
          ${missing === 0 ? `<span class="pill">Woven</span>` : pend ? `<span class="pill wait">${pend === day.cards.length ? "Astro pending" : `${pend} pending`}</span>` : `<span class="pill quiet">${missing === day.cards.length ? "No astro note" : "Partly woven"}</span>`}</header>
        ${sky}
        ${day.cards.map((c) => `<div class="astro-card"><img src="${thumbImg(c.img)}" alt="" class="${isRev(c.orientation) ? "reversed-img" : ""}" loading="lazy" /><div>
          <div class="nm">${esc(c.name)}${isRev(c.orientation) ? " · reversed" : isUnknown(c.orientation) ? " · orientation not recorded" : ""}</div>
          ${c.astro ? `<p>${esc(c.astro)}</p>` : astroPending(day.date, c.name) ? `<span class="pending">Astro tie-in pending</span>` : `<span class="no-astro">No astro note</span>`}
          ${(() => { const k = S.cards.find((x) => x.id === c.id) || S.byName.get(String(c.name || "").toLowerCase()); const ties = k ? cardTies(k, c.orientation, personMe(day.date)) : []; return ties.length ? `<div class="astro-card-ties"><b>Chart + numerology links</b>${ties.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` : ""; })()}</div></div>`).join("")}
        ${weave ? `<div class="weave">${weave}</div>` : ""}
      </section>`;
    }).join("");
  }

  /* ---------------- meditate ---------------- */
  function setMed(file) { $("#medFrame").src = "/meditate/" + file; $("#medOpen").href = "/meditate/" + file; }
  $$("[data-med]").forEach((b) => b.addEventListener("click", () => { segSelect(b.parentElement, b); setMed(b.dataset.med); S.medLoaded = true; }));

  /* ---------------- load ---------------- */
  const fetchAll = () => Promise.all([api("/api/entries"), api("/api/gaps"), api("/api/guests"), api("/api/outbox")]);
  async function loadAll(pre) {
    const [entries, gaps, guests, outbox] = await (pre || fetchAll());
    Object.assign(S, { entries, gaps, guests, outbox });
    renderRecap(); renderGaps(); renderJournal(); renderAstro(); renderGuestsTab(); renderSavedToday();
  }
  document.addEventListener("tarot:reading-imported", () => { loadAll().catch(() => {}); });

  /* ---------- v16: account, intention/question, clarifiers, patterns, moon spreads, share, friends ---------- */
  async function loadMe() {
    try {
      const r = await fetch("/auth/status", { cache: "no-store", credentials: "same-origin" });
      if (!r.ok) return;
      const a = await r.json(); if (!a.user) return;
      S.acct = a;
      ME.name = a.display || a.user; ME.short = (ME.name[0] || "").toUpperCase(); ME.birth = a.birth || null;
      if (!a.owner) ME.sign = null;
      const eb = $(".header .eyebrow"); if (eb) eb.textContent = `${ME.name}’s Tarot`;
    } catch (_) {}
  }
  /* own Sun sign for non-owner accounts comes from their real chart (Swiss Ephemeris) */
  function syncSign() { if (S.acct && !S.acct.owner && S.astroToday && S.astroToday.big_three) ME.sign = S.astroToday.big_three.Sun || null; }

  /* 1) intention / question */
  function intentHTML() {
    const it = S.intent || { type: "intention", text: "" };
    return `<div class="intent-box"><div class="seg seg-sm" role="group" aria-label="Intention or question">
      <button type="button" class="seg-btn ${it.type === "intention" ? "active" : ""}" data-it="intention">Intention</button>
      <button type="button" class="seg-btn ${it.type === "question" ? "active" : ""}" data-it="question">Question</button></div>
      <textarea id="intentText" rows="2" maxlength="300" placeholder="${it.type === "question" ? "What do you want to ask? (optional)" : "What are you holding in mind? (optional)"}">${esc(it.text)}</textarea></div>`;
  }
  function wireIntent(root) {
    S.intent = S.intent || { type: "intention", text: "" };
    $$("[data-it]", root).forEach((b) => b.addEventListener("click", () => { S.intent.type = b.dataset.it; segSelect(b.parentElement, b);
      $("#intentText", root).placeholder = S.intent.type === "question" ? "What do you want to ask? (optional)" : "What are you holding in mind? (optional)"; }));
    $("#intentText", root).addEventListener("input", (e) => { S.intent.text = e.target.value; });
  }
  function intentSection(cs) {
    const it = S.intent; if (!it || !it.text.trim()) return "";
    const q = it.type === "question";
    const lines = cs.map((x) => { const t = (x.c.topics || {})[x.o] || {};
      return q ? `<li><b>${esc(x.c.name)}${x.pos ? " · " + esc(x.pos) : ""}:</b> ${t.yesNo ? `${esc(t.yesNo.lean)}. ${esc(t.yesNo.why)} ` : ""}${esc(t.advice || "")}</li>`
               : `<li><b>${esc(x.c.name)}${x.pos ? " · " + esc(x.pos) : ""}:</b> for this intention it brings ${esc(((x.c.keywords || {})[x.o] || []).slice(0, 3).join(", "))}. ${esc(t.advice || "")}</li>`; }).join("");
    return `<section class="df-sec df-intent"><h4>${q ? "Your question" : "Your intention"}</h4><p class="intent-q">“${esc(it.text.trim())}”</p><ul>${lines}</ul></section>`;
  }
  const intentNote = () => (S.intent && S.intent.text.trim() ? `${S.intent.type === "question" ? "Question" : "Intention"}: ${S.intent.text.trim()}` : "");

  /* 2) clarifiers: one extra card for any position, read in full and saved with the spread */
  function clarifierBar() {
    if (S.src !== "digital" || !S.drawn.length || S.saved) return "";
    const n = S.drawn.length;
    return `<div class="clar-bar"><span class="label">Unclear? Pull a clarifier for</span><div class="clar-btns">${S.drawn.map((d, i) =>
      `<button type="button" class="chip" data-clar="${i}">＋ ${esc(posLabel(i) || (n > 1 ? "Card " + (i + 1) : d.card.name))}</button>`).join("")}</div></div>`;
  }
  function addClarifier(i) {
    if (S.deck.length < 1) S.deck = shuffle(S.cards.filter((c) => !S.drawn.some((d) => d.card.id === c.id) && !(S.clar || []).some((x) => x.card.id === c.id)));
    const card = S.deck.shift();
    (S.clar = S.clar || []).push({ i, card, orientation: Math.random() < REVERSED_CHANCE ? "reversed" : "upright" });
    renderFull(); renderClarReadings();
  }
  const clarLabel = (x) => `${posLabel(x.i) || "Card " + (x.i + 1)} · clarifier`;
  function renderClarReadings() {
    let box = $("#clarReadings"); if (!box) { box = document.createElement("div"); box.id = "clarReadings"; box.className = "readings"; readings.after(box); }
    box.innerHTML = (S.clar || []).map((x) => `<article class="reading clar-reading"><h3>${esc(x.card.name)}</h3>
      <div class="meta"><span class="badge pos">${esc(clarLabel(x))}</span>${badge(x.orientation)}</div>
      <div class="clar-img"><img src="${deckImg(x.card.img)}" alt="${esc(x.card.name)}" class="${isRev(x.orientation) ? "reversed-img" : ""}" onerror="window.__tarotImgRetry && window.__tarotImgRetry(this)" /></div>
      ${infoHTML(x.card, x.orientation, { open: ["meaning", "love", "work", "money", "advice", "spread", "sit"] })}</article>`).join("");
  }
  const allRows = () => [...flowRows(), ...(S.clar || []).map((x) => ({ card: x.card, orientation: x.orientation, position: clarLabel(x), pm: "a clarifier drawn to shed light on " + (posLabel(x.i) || "that card") }))];
  function renderFull() {
    const full = $("#dfFull"); if (!full) return;
    full.innerHTML = clarifierBar() + fullReadingHTML(allRows(), personMe());
    $$("[data-clar]", full).forEach((b) => b.addEventListener("click", () => addClarifier(Number(b.dataset.clar))));
  }

  /* 3) patterns per person (real saved cards only) */
  function patternsHTML(list, who) {
    if (!list.length) return `<p class="muted">No saved cards yet for ${esc(who)}.</p>`;
    const by = (f) => { const m = new Map(); list.forEach((x) => { const k = f(x); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]); };
    const groupName = (x) => { const k = S.byName.get(String(x.name).toLowerCase()); return k ? (k.arcana === "major" ? "Major Arcana" : k.suit) : null; };
    const suits = by(groupName), cards = by((x) => x.name), rev = list.filter((x) => isRev(x.orientation)).length, max = suits.length ? suits[0][1] : 1;
    const rec = cards.filter(([, n]) => n > 1);
    const month = localDate().slice(0, 7), mList = list.filter((x) => String(x.date).startsWith(month));
    const seen = (name) => list.filter((x) => x.name === name).map((x) => short(x.date)).slice(-5).join(", ");
    return `<div class="patterns"><p class="muted">${list.length} saved card${list.length === 1 ? "" : "s"} · ${rev} reversed (${Math.round(100 * rev / list.length)}%)${mList.length ? ` · ${mList.length} this month` : ""}</p>
      <div class="pt-bars">${suits.map(([k, n]) => `<div class="pt-row"><span>${esc(k)}</span><i style="width:${Math.max(6, Math.round(100 * n / max))}%"></i><b>${n}</b></div>`).join("")}</div>
      ${rec.length ? `<span class="label">Recurring cards</span><ul class="pt-rec">${rec.slice(0, 10).map(([k, n]) => `<li><b>${esc(k)}</b> ×${n} <small>${esc(seen(k))}</small></li>`).join("")}</ul>` : `<p class="muted">No card has come up twice yet.</p>`}</div>`;
  }
  const myCardList = () => S.entries.flatMap((e) => (e.cards || []).map((c) => ({ date: e.date, name: c.name, orientation: c.orientation })));
  const guestCardList = (g) => (g.readings || []).flatMap((r) => (r.cards || []).map((c) => ({ date: r.date, name: c.name, orientation: c.orientation })));
  function renderMyPatterns() {
    let box = $("#myPatterns");
    if (!box) { box = document.createElement("details"); box.id = "myPatterns"; box.className = "pt-wrap"; $("#recapBox").after(box); }
    const open = box.open;
    box.innerHTML = `<summary>Your patterns</summary>${patternsHTML(myCardList(), "you")}`; box.open = open;
  }

  /* 4) moon-phase spread suggestion (new / full moon days only) */
  Object.assign(SPREADS, {
    newmoon: { name: "New Moon", pos: [["Where I am", "where you stand as the cycle begins"], ["What to plant", "the intention to start now"], ["What helps it grow", "what will support it"], ["What to watch for", "what could get in the way"]] },
    fullmoon: { name: "Full Moon", pos: [["What has come to light", "what this Moon is showing you"], ["What to release", "what is ready to go"], ["What to celebrate", "what has grown since the new moon"], ["Next step", "how to carry it forward"]] },
  });
  async function moonBanner() {
    let m; try { m = await api("/api/moon"); } catch (_) { return; }
    S.moon = m; const box = $("#moonBanner"); if (!box) return;
    if (!m.special) { box.hidden = true; return; }
    const k = m.special === "new" ? "newmoon" : "fullmoon";
    box.hidden = false;
    box.innerHTML = `<span class="label">${m.special === "new" ? "🌑 New Moon" : "🌕 Full Moon"} · Moon in ${esc(m.sign)}</span>
      <p>Try the ${esc(SPREADS[k].name)} spread: ${SPREADS[k].pos.map((p) => esc(p[0])).join(" · ")}.</p>
      <div class="actions" style="justify-content:flex-start"><button class="btn btn-gold btn-sm" id="moonUse">Use this spread</button><button class="btn btn-ghost btn-sm" id="moonNo">Not today</button></div>`;
    $("#moonUse").addEventListener("click", () => { $("#spreadSel").value = k; $("#spreadSel").dispatchEvent(new Event("change")); box.hidden = true; });
    $("#moonNo").addEventListener("click", () => { box.hidden = true; });
  }

  /* 5) share a guest reading as image or PDF */
  async function shareGuestReading(gid, rid, fmt, btn) {
    const old = btn.textContent; btn.disabled = true; btn.textContent = "Making…";
    try {
      const res = await fetch(`/api/guests/${gid}/readings/${rid}/share.${fmt}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ include: { reading: true } }) });
      if (!res.ok) throw new Error("couldn’t make the file (" + res.status + ")");
      const blob = await res.blob();
      const name = (res.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || `reading.${fmt}`;
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === "AbortError") return; } }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    } catch (e) { alert(e.message); }
    finally { btn.disabled = false; btn.textContent = old; }
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-share-fmt]"); if (b) shareGuestReading(b.dataset.gid, b.dataset.rid, b.dataset.shareFmt, b); });

  /* 7) friends + per-item sharing (private by default) */
  S.social = null;
  async function social(path, body) {
    const res = await fetch("/social/" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" } : { cache: "no-store", credentials: "same-origin" });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) throw new Error(res.status === 404 ? "Friends only work through the app link." : "Request failed (" + res.status + ")");
    const d = await res.json(); if (!res.ok) throw new Error(d.error || "Request failed"); return d;
  }
  const isShared = (kind, ref) => !!(S.social && S.social.mine.some((x) => x.kind === kind && x.ref === String(ref)));
  const shareToggle = (kind, ref) => S.social ? `<label class="share-tg"><input type="checkbox" data-sk="${kind}" data-sr="${esc(ref)}" ${isShared(kind, ref) ? "checked" : ""} /> <span>Share with friends</span></label>` : "";
  function sharePayload(kind, ref) {
    const cardsOut = (cs) => (cs || []).map((c) => ({ name: c.name, orientation: c.orientation, position: c.position || null, img: base(c.img || ((cardFor(c) || {}).img) || "") }));
    if (kind === "reading") { const d = S.entries.find((x) => x.date === ref); return d && { title: `My cards · ${short(d.date)}`, payload: { date: d.date, cards: cardsOut(d.cards) } }; }
    if (kind === "guest_reading") { for (const g of S.guests) { const r = (g.readings || []).find((x) => x.id === ref); if (r) return { title: `A reading I did · ${short(r.date)}`, payload: { date: r.date, spread: r.spread, cards: cardsOut(r.cards), summary: r.generated_reading ? r.generated_reading.summary : null } }; } }
    if (kind === "practice") { const r = ((S.practice || {}).readings || []).find((x) => x.id === ref); return r && { title: `Practice · ${r.spreadName || "reading"} · ${short(r.date)}`, payload: { date: r.date, spread: r.spreadName, cards: cardsOut(r.cards).map((c, i) => ({ ...c, note: (r.cards[i] || {}).note || null })) } }; }
    return null;
  }
  document.addEventListener("change", async (e) => {
    const t = e.target; if (!t.matches || !t.matches("[data-sk]")) return;
    const kind = t.dataset.sk, ref = t.dataset.sr;
    try {
      if (t.checked) { const p = sharePayload(kind, ref); if (!p) throw new Error("Couldn’t find that item."); await social("share", { kind, ref, title: p.title, payload: p.payload }); }
      else await social("unshare", { kind, ref });
      S.social = await social("me");
      $$(`[data-sk="${kind}"][data-sr="${CSS.escape(ref)}"]`).forEach((x) => { x.checked = t.checked; });
    } catch (err) { t.checked = !t.checked; alert(err.message); }
  });
  function feedItemHTML(x) {
    const p = x.payload || {};
    return `<article class="feed-item"><header><b>${esc(x.owner.display)}</b> <small>@${esc(x.owner.username)} · ${esc(x.title)}</small></header>
      <div class="g-cards">${(p.cards || []).map((c) => `<div class="g-card"><img src="${thumbImg(c.img)}" alt="" loading="lazy" class="${isRev(c.orientation) ? "reversed-img" : ""}" /><div>${esc(c.name)}<small>${c.position ? esc(c.position) + " · " : ""}${isRev(c.orientation) ? "reversed" : "upright"}</small>${c.note ? `<small>${esc(c.note)}</small>` : ""}</div></div>`).join("")}</div>
      ${p.summary ? `<p class="g-text">${esc(p.summary)}</p>` : ""}</article>`;
  }
  async function renderFriends() {
    const el = $("#friendsBody"); if (!el) return;
    try { S.social = await social("me"); } catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
    let feed = []; try { feed = await social("feed"); } catch (_) {}
    try { S.practice = S.practice || await api("/api/practice"); } catch (_) {}
    const s = S.social, link = location.origin + "/invite/" + s.invite;
    const inv = (location.hash.match(/invite=([\w-]+)/) || [])[1];
    const days = [...S.entries].filter((d) => d.cards && d.cards.length).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
    const greads = S.guests.flatMap((g) => (g.readings || []).filter((r) => r.cards && r.cards.length).map((r) => ({ g, r }))).sort((a, b) => b.r.date.localeCompare(a.r.date)).slice(0, 15);
    const pr = ((S.practice || {}).readings || []).slice(-15).reverse();
    el.innerHTML = `
      ${inv ? `<div class="fr-invite"><p>You opened a friend invite.</p><button class="btn btn-gold btn-sm" id="frInvAccept">Accept invite</button><p class="status" id="frInvSt"></p></div>` : ""}
      <div class="fr-me"><span class="label">You are</span> <b>${esc(s.user.display)}</b> <small>@${esc(s.user.username)}</small></div>
      <div class="fr-add"><input id="frName" placeholder="Friend’s username" autocapitalize="none" autocorrect="off" /><button class="btn btn-gold btn-sm" id="frSend">Add friend</button></div>
      <div class="fr-link"><span class="label">Or send your invite link</span><input readonly value="${esc(link)}" id="frLink" /><button class="btn btn-ghost btn-sm" id="frCopy">Copy</button></div>
      <p class="status" id="frSt"></p>
      ${s.incoming.length ? `<span class="label">Friend requests</span>${s.incoming.map((u) => `<div class="fr-row"><span><b>${esc(u.display)}</b> <small>@${esc(u.username)}</small></span><span><button class="btn btn-gold btn-sm" data-acc="${esc(u.username)}">Accept</button> <button class="btn btn-ghost btn-sm" data-dec="${esc(u.username)}">Decline</button></span></div>`).join("")}` : ""}
      ${s.outgoing.length ? `<p class="muted">Waiting on: ${s.outgoing.map((u) => "@" + esc(u.username)).join(", ")}</p>` : ""}
      <span class="label">Friends</span>${s.friends.length ? s.friends.map((u) => `<div class="fr-row"><span><b>${esc(u.display)}</b> <small>@${esc(u.username)}</small></span><button class="link-btn" data-unf="${esc(u.username)}">Remove</button></div>`).join("") : `<p class="muted">No friends yet.</p>`}
      <h3 class="fr-h">Shared with you</h3>${feed.length ? feed.map(feedItemHTML).join("") : `<p class="muted">Nothing shared with you yet.</p>`}
      <h3 class="fr-h">What you share</h3><p class="muted">Everything is private until you switch it on for that one item. Guest names and your notes are never shared.</p>
      <details class="fr-pick"><summary>Your readings (${days.length})</summary>${days.map((d) => `<div class="fr-row"><span>${esc(short(d.date))} · ${esc(d.cards.map((c) => c.name).join(", "))}</span>${shareToggle("reading", d.date)}</div>`).join("") || `<p class="muted">None yet.</p>`}</details>
      <details class="fr-pick"><summary>Readings you did for others (${greads.length})</summary>${greads.map(({ r }) => `<div class="fr-row"><span>${esc(short(r.date))} · ${esc(r.cards.map((c) => c.name).join(", "))}</span>${shareToggle("guest_reading", r.id)}</div>`).join("") || `<p class="muted">None yet.</p>`}</details>
      <details class="fr-pick"><summary>Practice readings (${pr.length})</summary>${pr.map((r) => `<div class="fr-row"><span>${esc(short(r.date))} · ${esc(r.spreadName || "Reading")}</span>${shareToggle("practice", r.id)}</div>`).join("") || `<p class="muted">None yet.</p>`}</details>`;
    const st = $("#frSt");
    $("#frSend").addEventListener("click", async () => { try { const r = await social("request", { username: $("#frName").value }); st.textContent = r.status === "friends" ? "You’re now friends." : r.status === "already friends" ? "You’re already friends." : "Request sent."; renderFriends(); } catch (e) { st.textContent = e.message; } });
    $("#frCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(link); st.textContent = "Invite link copied."; } catch (_) { $("#frLink").select(); document.execCommand("copy"); st.textContent = "Invite link copied."; } });
    $$("[data-acc]", el).forEach((b) => b.addEventListener("click", async () => { await social("accept", { username: b.dataset.acc }); renderFriends(); }));
    $$("[data-dec]", el).forEach((b) => b.addEventListener("click", async () => { await social("decline", { username: b.dataset.dec }); renderFriends(); }));
    $$("[data-unf]", el).forEach((b) => b.addEventListener("click", async () => { if (confirm("Remove this friend?")) { await social("unfriend", { username: b.dataset.unf }); renderFriends(); } }));
    const ia = $("#frInvAccept"); if (ia) ia.addEventListener("click", async () => { try { const r = await social("invite", { token: inv }); history.replaceState(null, "", location.pathname + "#friends"); $("#frInvSt").textContent = `You’re now friends with ${r.friend.display}.`; setTimeout(renderFriends, 900); } catch (e) { $("#frInvSt").textContent = e.message; } });
  }

  /* bridge for practice.js (Practice tab) */
  window.TarotApp = Object.assign(window.TarotApp || {}, { S, api, esc, deckImg, thumbImg, infoHTML, openCard, openResources, isRev, shuffle, badge, kwHTML, buildReading, numerology, guestTies, localDate, fmtDate, short, segSelect, showTab: (n) => showTab(n) });

  async function init() {
    const params = new URLSearchParams(location.search);
    await loadMe();
    const pre = fetchAll();                        // journal data loads alongside the deck
    pre.catch(() => {});
    S.cards = await api("/api/cards");
    S.cards.forEach((c) => S.byName.set(c.name.toLowerCase(), c));
    $("#cardNames").innerHTML = S.cards.map((c) => `<option value="${esc(c.name)}"></option>`).join("");
    S.deck = shuffle(S.cards);
    // Open on today's saved card, unless a demo/draw hook asks for the drawing table (?today=draw forces it).
    const wantsDraw = ["demo", "src", "pick"].some((k) => params.has(k)) || params.get("today") === "draw";
    S.todayView = wantsDraw ? "draw" : "saved";
    resetDraw(); renderLibrary();
    await loadAll(pre);
    if (!todaysEntry()) S.todayView = "draw";
    moonBanner();
    social("me").then((m) => { S.social = m; renderJournal(); renderGuestsTab(); }).catch(() => {});
    if (S.acct && !S.acct.owner && ME.birth) api("/api/astro/today").then((h) => { S.astroToday = h; syncSign(); }).catch(() => {});
    document.dispatchEvent(new CustomEvent("tarot:ready"));
    if (params.has("shot")) document.documentElement.classList.add("no-anim");
    // Demo hooks for screenshots (never save anything):
    // ?demo=1|3[&labels=ppf]  ?src=physical&pick=cu09:reversed  ?src=photo  ?card=ar17[&o=reversed&open=love,waite]  ?guest=<slug>
    // ?today=draw (skip the saved-card view)  ?more=1 (open the phone "More" menu)  Deep links: /#today or /?tab=today
    if (params.get("guest")) { const g = S.guests.find((x) => x.slug === params.get("guest") || x.id === params.get("guest")); if (g) { S.guestSel = g.id; renderGuestsTab(); } }
    showTab(location.hash.slice(1) || params.get("tab") || "today");
    if (params.get("demo")) {
      const n = params.get("demo") === "3" ? 3 : 1;
      $(`[data-count="${n}"]`).click();
      if (n === 3 && params.get("labels") === "ppf") $('[data-labels="ppf"]').click();
      if (!["physical", "photo"].includes(params.get("src"))) { doDraw(); S.drawn.forEach((d) => (d.flipped = true)); renderToday(); }
    }
    if (params.get("src") === "physical" || params.get("src") === "photo") $(`[data-src="${params.get("src")}"]`).click();
    if (params.get("src") === "physical") {
      (params.get("pick") || "").split(",").filter(Boolean).forEach((p, i) => {
        const [id, o] = p.split(":"); const c = S.cards.find((x) => x.id === id);
        if (c && S.drawn[i]) { S.drawn[i].card = c; S.drawn[i].orientation = o === "reversed" ? "reversed" : "upright"; }
      });
      if (S.drawn.every((d) => d.card)) S.pickOpen = false;
      renderPickers(); renderToday();
    }
    if (params.get("resources")) openResources();
    if (params.get("more")) moreBtn.click();
    if (params.get("card")) openCard(params.get("card"), params.get("o"), params.get("open") ? params.get("open").split(",") : null);
  }
  init().catch((e) => { document.querySelector(".app").insertAdjacentHTML("beforeend", `<p class="status err">Couldn’t load: ${esc(e.message)}</p>`); });
})();

/* ---------- phone app: service worker + "Log out" (only shown behind the password gate) ---------- */
(() => {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").then((reg) => {
      const chk = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") chk(); });
      setInterval(chk, 30 * 60 * 1000);
    }).catch(() => {}));
    let __swReloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (__swReloaded) return; __swReloaded = true; location.reload(); });
  }
  fetch("/auth/status", { cache: "no-store", credentials: "same-origin" })
    .then((r) => { if (r.ok) { const f = document.getElementById("logoutForm"); if (f) f.hidden = false; } })
    .catch(() => {});
})();
