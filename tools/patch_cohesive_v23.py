"""Apply the v23 cohesive-reading hooks to an app.js (repo public/ or box static/). Idempotent."""
import sys, re
p = sys.argv[1]; s = open(p).read()
if "/* v23 cohesive" in s: print("already patched", p); sys.exit(0)
def rep(old, new, count=1):
    global s
    assert old in s, "missing anchor: " + old[:80]
    s = s.replace(old, new, count)

HOOKS = r'''
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
'''
rep("  function renderReadings() {", HOOKS + "  function renderReadings() {")
rep("    afterFlip(shown, complete);", "    afterFlip(shown, complete);\n    renderCohToday(complete);")
rep('    if (S.src === "physical") renderPickers();', '    if (S.src === "physical") { renderPickers(); cohIntentPhysical(); }')
# save intention + spread as real fields (old entries keep working: intentOf() falls back to notes)
rep('spreadLabels: clar.length ? null : labelsNow() });',
    'spreadLabels: clar.length ? null : labelsNow(), intent: S.intent && S.intent.text.trim() ? { type: S.intent.type, text: S.intent.text.trim() } : null, spread: S.spreadKey ? SPREADS[S.spreadKey].name : S.count === 3 ? `3-card (${LABELS[S.labels].join(" · ")})` : S.count === 1 ? "One card" : `${S.count} cards`, cohesive: { exclude: cohEx(localDate()) } });')
# journal: after the cards
m = re.search(r'\n      \$\{day\.photos && day\.photos\.length \?', s); assert m
s = s[:m.start()] + "\n      ${cohJournalHTML(day)}" + s[m.start():]
rep("    const chip = $(\".date-chip.active\"); if (chip && !$(\"#panel-journal\").hidden)", "    wireCohPicker($(\"#jPage\"), day.date, renderJournal);\n    const chip = $(\".date-chip.active\"); if (chip && !$(\"#panel-journal\").hidden)")
# guests: each reading, that guest's history only
rep("          ${r.generated_reading ? `<details class=\"gen-wrap\" open>", "          ${cohGuestHTML(g, r)}\n          ${r.generated_reading ? `<details class=\"gen-wrap\" open>")
open(p, "w").write(s); print("patched", p)
