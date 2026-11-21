/* Trusted Tarot — appearance settings (complete design theme plus accessibility preferences).
   Loaded in <head> so the page paints in the right theme. Saved in this browser (localStorage) only.
   The defaults are the app's original look (dark, gold, moon back, medium text, classic serif, stars on). */
(function (root) {
  "use strict";
  const KEY = "tt-appearance";
  const OPTIONS = {
    designTheme: [["celestial", "Celestial Luxe"], ["editorial", "Mystic Editorial"], ["cosmic", "Modern Cosmic"]],
    theme: [["system", "Match device"], ["dark", "Dark"], ["light", "Light"]],
    accent: [["gold", "Gold"], ["rose", "Rose"], ["teal", "Teal"], ["violet", "Violet"], ["silver", "Silver"]],
    cardback: [["moon", "Moon"], ["sun", "Sun"], ["star", "Star"], ["plain", "Plain"]],
    size: [["s", "Small"], ["m", "Medium"], ["l", "Large"], ["xl", "Extra large"]],
    typeface: [["classic", "Classic serif"], ["modern", "Modern sans"], ["readable", "Easy-read"]],
    density: [["comfortable", "Comfortable"], ["compact", "Compact"]],
  };
  const DEFAULTS = { designTheme: "celestial", theme: "dark", accent: "gold", cardback: "moon", size: "m", typeface: "classic", stars: true, motion: false, density: "comfortable" };
  const valid = (k, v) => k === "stars" || k === "motion" ? typeof v === "boolean" : (OPTIONS[k] || []).some(([x]) => x === v);
  function clean(p) { const o = { ...DEFAULTS }; for (const k of Object.keys(DEFAULTS)) if (p && valid(k, p[k])) o[k] = p[k]; return o; }
  function load() { try { return clean(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) { return { ...DEFAULTS }; } }
  const mq = root.matchMedia ? root.matchMedia("(prefers-color-scheme: light)") : null;
  function apply(p) {
    p = clean(p); const h = document.documentElement;
    const theme = p.theme === "system" ? (mq && mq.matches ? "light" : "dark") : p.theme;
    Object.assign(h.dataset, { designTheme: p.designTheme, theme, accent: p.accent, cardback: p.cardback, size: p.size, typeface: p.typeface, stars: p.stars ? "on" : "off", motion: p.motion ? "reduce" : "full", density: p.density });
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = theme === "light" ? "#f6f1e7" : "#07060f";
    return p;
  }
  let cur = apply(load());
  if (mq && mq.addEventListener) mq.addEventListener("change", () => { if (cur.theme === "system") apply(cur); });
  async function syncUp(p) {
    const B = root.TAROT_BACKEND; if (!B || !root.TAROT_APPEARANCE_SYNC) return;
    try { const id = await B.uid(); if (!id) return; await B.sb.from("profiles").update({ prefs: p }).eq("id", id); B.resetProfile(); } catch (_) { /* stays saved on this device */ }
  }
  function set(patch, opts = {}) {
    cur = apply({ ...cur, ...patch });
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (_) {}
    if (!opts.local) syncUp(cur);
    return cur;
  }
  // pull from the profile once signed in (profile wins over this device if it has anything saved)
  async function syncDown() {
    const B = root.TAROT_BACKEND; if (!B || !root.TAROT_APPEARANCE_SYNC) return;
    try { const p = await B.profile(); if (p && p.prefs && Object.keys(p.prefs).length) set(clean(p.prefs), { local: true }); } catch (_) {}
  }
  root.TAROT_APPEARANCE = { OPTIONS, DEFAULTS, get: () => ({ ...cur }), set, apply, clean, syncDown, reset: () => set({ ...DEFAULTS }) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(syncDown, 0)); else setTimeout(syncDown, 0);
})(window);
