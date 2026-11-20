/* Trusted Tarot — Settings sheet (Appearance + My chart). Private app: no account settings here; nothing leaves this browser.
   Appearance values come from appearance.js (window.TAROT_APPEARANCE). */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  function appearanceHTML() {
    const AP = window.TAROT_APPEARANCE; if (!AP) return "";
    const p = AP.get(), O = AP.OPTIONS;
    const seg = (k, label) => `<label>${label}</label><div class="tj-seg" role="radiogroup" aria-label="${label}">${O[k].map(([v, t]) =>
      `<button type="button" role="radio" aria-checked="${p[k] === v}" class="tj-opt${p[k] === v ? " on" : ""}" data-ap="${k}" data-v="${v}">${k === "accent" ? `<i class="tj-sw sw-${v}" aria-hidden="true"></i>` : ""}${t}</button>`).join("")}</div>`;
    const tog = (k, label) => `<label class="tj-check"><input type="checkbox" data-apc="${k}" ${p[k] ? "checked" : ""}> ${label}</label>`;
    const designThemes = [
      ["celestial", "Celestial Luxe", "Midnight velvet · gilded tarot · lunar ornament", "✦", "celestial"],
      ["editorial", "Mystic Editorial", "Warm parchment · ink · antique botanical motifs", "☾", "editorial"],
      ["cosmic", "Modern Cosmic", "Jewel tones · vivid planets · zodiac geometry", "☼", "cosmic"]
    ];
    const designPicker = `<div class="tj-design-picker" role="radiogroup" aria-label="Design style">${designThemes.map(([v, name, desc, glyph, cls]) =>
      `<button type="button" role="radio" aria-checked="${p.designTheme === v}" class="tj-design-card ${cls}${p.designTheme === v ? " on" : ""}" data-design-theme="${v}">
        <span class="tj-design-art" aria-hidden="true">${glyph}<i></i><b></b></span>
        <span class="tj-design-copy"><strong>${name}</strong><small>${desc}</small></span>
        <span class="tj-design-check" aria-hidden="true">${p.designTheme === v ? "✓" : ""}</span>
      </button>`).join("")}</div>`;
    return `<div class="tj-sec" id="st-look"><h3>Design style</h3><p class="tj-why">Choose a complete visual world. Artwork, typography, surfaces, navigation and colors all change together.</p>
      ${designPicker}
      <div class="tj-subsettings"><h3>Fine-tune</h3>
      ${seg("theme", "Light or dark mode")} ${seg("accent", "Accent color")}${seg("cardback", "Card back")}${seg("size", "Text size")}${seg("typeface", "Typeface")}${seg("density", "Spacing")}
      ${tog("stars", "Starfield background")}${tog("motion", "Reduce motion")}
      <div class="tj-btns"><button class="tj-btn" id="st-lookreset" type="button">Reset appearance</button></div></div></div>`;
  }
  function wire(box) {
    const AP = window.TAROT_APPEARANCE; if (!AP) return;
    box.querySelectorAll("[data-design-theme]").forEach((b) => b.onclick = () => {
      AP.set({ designTheme: b.dataset.designTheme });
      box.querySelectorAll("[data-design-theme]").forEach((x) => {
        const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on));
        const check = x.querySelector(".tj-design-check"); if (check) check.textContent = on ? "✓" : "";
      });
    });
    box.querySelectorAll("[data-ap]").forEach((b) => b.onclick = () => {
      AP.set({ [b.dataset.ap]: b.dataset.v });
      box.querySelectorAll(`[data-ap="${b.dataset.ap}"]`).forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); });
    });
    box.querySelectorAll("[data-apc]").forEach((c) => c.onchange = () => AP.set({ [c.dataset.apc]: c.checked }));
    const r = box.querySelector("#st-lookreset"); if (r) r.onclick = () => { AP.reset(); box.querySelector("#st-look").outerHTML = appearanceHTML(); wire(box); };
  }
  async function myChart() {
    try { const r = await fetch("/api/profile/birth", { cache: "no-store" }); const j = r.ok ? await r.json() : null; const b = j && j.birth;
      if (!b || !b.y) return `<p class="tj-why">No birth details saved yet.</p>`;
      const t = b.hour != null ? ` · ${pad(b.hour % 12 || 12)}:${pad(b.minute || 0)} ${b.hour < 12 ? "AM" : "PM"}` : "";
      return `<p class="tj-me"><b>${esc(j.name || "")}</b> · ${esc(new Date(Date.UTC(b.y, b.m - 1, b.d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }))}${t}${b.place ? " · " + esc(b.place) : ""} <span aria-label="locked">🔒</span></p>
        <p class="tj-why">Used as Person 1 in Compatibility and for your daily horoscope.</p>`;
    } catch (_) { return `<p class="tj-why">Couldn’t load your birth details right now.</p>`; }
  }
  async function open() {
    const prev = document.activeElement;
    const back = document.createElement("div"); back.className = "tj-back";
    back.innerHTML = `<div class="tj-modal" role="dialog" aria-modal="true" aria-labelledby="st-h"><p class="tj-step">Settings</p><h2 id="st-h">Look and feel</h2>
      ${appearanceHTML()}
      <div class="tj-sec"><h3>My chart</h3><div id="st-chart"><p class="tj-why">Loading…</p></div></div>
      <div class="tj-btns"><button class="tj-btn pri" id="st-close" type="button">Done</button></div></div>`;
    document.body.appendChild(back);
    const close = () => { back.remove(); document.removeEventListener("keydown", key); if (prev && prev.focus) prev.focus(); };
    const key = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", key);
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    $("#st-close", back).onclick = close;
    wire(back);
    setTimeout(() => ($(".tj-opt.on", back) || $("#st-close", back)).focus(), 0);
    $("#st-chart", back).innerHTML = await myChart();
  }
  function addGear() {
    const h = document.querySelector(".header"); if (!h || document.getElementById("tjGear")) return;
    const g = document.createElement("button"); g.type = "button"; g.id = "tjGear"; g.className = "tj-gear"; g.setAttribute("aria-label", "Settings");
    g.innerHTML = `<span aria-hidden="true">⚙︎</span> Settings`; g.onclick = open; h.appendChild(g);
  }
  window.TAROT_SETTINGS = { open };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addGear); else addGear();
})();
