/* Horoscope tab: Today (Astro's story) | Learn to read charts | My chart. No outside links here except at the bottom of Learn more. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const HS = () => window.HoroscopeStory, LU = () => window.LearnUI, LD = () => window.LEARN_DATA;
  const JORDAN = { y: 1992, m: 7, d: 14, hour: 15, minute: 20, tz: "America/Los_Angeles", lat: 45.5152, lon: -122.6784 }; // made-up sample person, real computation
  const V = { view: "today", h: null, sample: false, name: "" };
  const ordn = (n) => n + ((n % 100 >= 10 && n % 100 <= 20) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"));

  function nav(el) {
    let n = $("#astroNav");
    if (!n) { n = document.createElement("div"); n.id = "astroNav"; n.className = "p-subnav seg"; n.setAttribute("role", "group"); n.setAttribute("aria-label", "Horoscope sections"); el.parentElement.insertBefore(n, el); }
    n.innerHTML = [["today", "Today"], ["learn", "Learn to read charts"], ["chart", "My chart"]].map(([k, l]) => `<button class="seg-btn ${V.view === k ? "active" : ""}" data-av="${k}">${l}</button>`).join("");
    $$("[data-av]", n).forEach((b) => b.addEventListener("click", () => { V.view = b.dataset.av; draw(el); }));
    const others = ["#astroPending", "#astroList"].map((s) => $(s)).filter(Boolean); others.forEach((o) => { o.hidden = V.view !== "today"; });
  }
  function sampleH(date) { return window.TarotAstro ? window.TarotAstro.run(JORDAN, date, Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles") : null; }

  function today(el) {
    const h = V.h, user = V.sample ? "sample-jordan" : "me";
    const s = HS().compose(h, { name: V.sample ? "Jordan" : V.name, user, history: HS().hist.get(user) });
    if (!V.sample) HS().hist.put(user, h.date, s.tipKeys);
    el.innerHTML = `<article class="day astro-today astro-story">
      ${V.sample ? `<p class="banner-sample">Sample person · Jordan (made up). The positions are really computed for Jordan's birth details. Add your own birth details to get yours.</p>` : ""}
      ${s.noTime ? `<p class="hint">No birth time saved, so I left out houses, your rising sign and your Moon's exact position.</p>` : ""}
      ${s.paragraphs.map((p, i) => `<p class="hs-p">${esc(p.text)} ${p.facts.length && p.facts[0] !== "date" ? `<button class="ln-i" data-hp="${i}" aria-label="Where this comes from">i</button>` : ""}</p>`).join("")}
      <div class="hs-tips"><div><b>Do</b><ul>${s.dos.map((t) => `<li>${esc(t.text)}${t.general ? ` <small class="muted">(general tip)</small>` : ""}</li>`).join("")}</ul></div>
      <div><b>Don't</b><ul>${s.donts.map((t) => `<li>${esc(t.text)}${t.general ? ` <small class="muted">(general tip)</small>` : ""}</li>`).join("")}</ul></div></div>
      <details class="hs-details"><summary>Details and sources</summary>
        <p class="muted small">Moon in ${esc(h.moon.sign)} · ${esc(h.moon.phase)} (${h.moon.elongation}° from the Sun) · transits for 8:00 AM local time</p>
        <ul>${s.details.map((d) => `<li>${esc(d.text)}</li>`).join("") || "<li>No close transits today.</li>"}</ul>
        <p class="small">Positions: Astronomy Engine, checked against the Swiss Ephemeris. Houses: Placidus. Aspect families (trine and sextile harmonious, square and opposition discordant): Ptolemy, <i>Tetrabiblos</i> I.16 <span class="ln-status st-partly">Partly read</span>. Planet, sign and house wording: this app's plain-language shorthand of general tradition, not quoted from a book. Studies: Carlson 1985 found astrologers did no better than chance <span class="ln-status st-partly">Partly read</span>.</p>
        <p class="small muted">The wording is written by people and picked by rules; no AI rewrites it. Tips change daily and don't repeat within 14 days on this device.</p>
        <button class="btn btn-ghost btn-sm" data-av-go="learn">Learn to read charts ›</button></details>
      </article>`;
    $$("[data-hp]", el).forEach((b) => b.addEventListener("click", () => {
      const p = s.paragraphs[+b.dataset.hp], det = s.details.filter((d) => p.facts.includes(d.id));
      LU().sheet(`<span class="label">Why I said it</span><p><i>${esc(p.text)}</i></p>${det.length ? `<span class="label">Computed</span><ul>${det.map((d) => `<li>${esc(d.text)}</li>`).join("")}</ul>` : p.facts.includes("moon.sign") ? `<span class="label">Computed</span><p>Moon in ${esc(h.moon.sign)}, ${esc(h.moon.phase)}.</p>` : ""}
        <span class="label">Tradition</span><p>${p.source === "ptolemy" ? "Ptolemy calls the trine and sextile harmonious and the square and opposition discordant (Tetrabiblos I.16, read)." : "This app's plain wording of general tradition, not quoted from one book."}</p>
        <span class="label">What studies show</span><p>In Carlson's double-blind test (Nature, 1985), astrologers matched charts to personality profiles no better than chance.</p>`);
    }));
    $$("[data-av-go]", el).forEach((b) => b.addEventListener("click", () => { V.view = b.dataset.avGo; draw(el); }));
  }
  function chart(el) {
    const h = V.h, n = h.natal, L = LD();
    const rows = Object.entries(n).map(([k, x]) => `<tr><td>${esc(k === "ASC" ? "Ascendant" : k === "MC" ? "Midheaven" : k)}</td><td>${esc(x.pos)}</td><td>${x.house ? ordn(x.house) : "–"}</td></tr>`).join("");
    el.innerHTML = `<section class="p-panel">${V.sample ? `<p class="banner-sample">Sample person · Jordan (made up), real computed chart.</p>` : ""}
      <h3>${V.sample ? "Jordan's" : "Your"} chart</h3><p class="muted small">Big three: Sun in ${esc(h.big_three.Sun)}, Moon in ${esc(h.big_three.Moon)}${h.big_three.Ascendant ? `, ${esc(h.big_three.Ascendant)} rising` : ""}. Placidus houses.</p>
      <table class="hs-table"><thead><tr><th>Point</th><th>Position</th><th>House</th></tr></thead><tbody>${rows}</tbody></table>
      <h3>Practise on this chart</h3><div id="chartGuide"></div></section>`;
    const pts = Object.entries(n).filter(([k]) => L.APP_PLANETS[k]);
    let i = 0;
    const one = () => {
      const [k, x] = pts[i % pts.length], sign = x.sign, grp = Object.entries(L.SIGN_GROUPS).find(([, v]) => v.includes(sign))[0];
      LU().guided($("#chartGuide", el), {
        title: `${k} at ${x.pos}${x.house ? `, ${ordn(x.house)} house` : ""}`, prompt: "What do you think this placement says? Write it first.",
        checklist: [["planet", "Planet"], ["sign", "Sign"], ["house", "House"], ["group", "Sign group"], ["aspects", "Aspects"]],
        hints: [{ skill: "Planet", text: `In this app's readings, ${k} stands for ${L.APP_PLANETS[k]} (modern shorthand).` },
          { skill: "Sign", text: `Ptolemy puts ${sign} among the ${grp} signs.` },
          ...(x.house ? [{ skill: "House", text: `Lilly: the ${ordn(x.house)} house signifies ${L.LILLY_HOUSES[x.house]}. The app's short label is ${L.APP_HOUSES[x.house]}.` }] : []),
          { skill: "Combine", text: "Say it in one plain sentence: the planet's theme, the sign's group, the house's matters." }],
        reveal: [`${k}: ${L.APP_PLANETS[k]}.`, `${sign}: one of Ptolemy's ${grp} signs.`, ...(x.house ? [`House ${x.house}: ${L.APP_HOUSES[x.house]} (Lilly: ${L.LILLY_HOUSES[x.house]}).`] : [])],
        revealLabel: "The pieces, side by side", nextTime: "Check the tightest aspect to this planet too.",
        onNext: () => { i++; one(); }, onRate: () => { i++; one(); },
      });
    };
    one();
  }
  function draw(el) {
    nav(el);
    if (V.view === "learn") return LU().home(el, "sky", { title: "Learn to read charts" });
    if (!V.h) { el.innerHTML = `<p class="muted">Working out the chart…</p>`; return; }
    if (V.view === "chart") return chart(el);
    today(el);
  }
  async function render(el, { load, name = "", date }) {
    V.name = name;
    try { V.h = await load(); V.sample = false; }
    catch (e) { V.h = sampleH(date); V.sample = !!V.h; if (!V.h) { el.innerHTML = `<p class="muted">Today's horoscope isn't available right now (${esc(e.message)}).</p>`; return; } }
    draw(el);
  }
  window.AstroUI = { render, draw, V, JORDAN };
})();
