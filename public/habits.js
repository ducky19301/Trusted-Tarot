/* Habits (v21): once-a-day lesson pop-up, lesson reminders (honest about iPhone + no push server),
   in-app fallback banner, streaks with freezes and rest days (no guilt), awards incl. a shareable
   first-day "New learner" card. Everything is stored on this device (localStorage "tt.habits.v1"). */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "tt.habits.v1";
  const PUBLIC_HOST = "tarot-public.ducky19301.workers.dev";
  const PUBLIC_URL = "https://" + PUBLIC_HOST + "/";
  const isPublic = () => location.hostname === PUBLIC_HOST;   // the private app never offers a link
  // never the page title: the private app's title carries a first name
  const appName = () => (window.TAROT_CONFIG && window.TAROT_CONFIG.appName && !/[’']s Tarot/.test(window.TAROT_CONFIG.appName) ? window.TAROT_CONFIG.appName : "Tarot practice");
  const ld = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); return ld(new Date(y, m - 1, d + n)); };
  const dow = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
  const weekKey = (s) => addDays(s, -((dow(s) + 6) % 7));   // Monday of that week
  const DEF = () => ({ days: [], frozen: [], resetOn: null, awards: {}, seenAwards: {}, popup: { on: true, skipWeekends: false, shown: null, later: null, hidden: null },
    reminder: { on: false, time: "19:30", skipDone: true, notified: null, banner: null }, rest: [], freezesPerWeek: 2, showStreak: true, awardPopups: true, shareDate: true, shareLink: false });
  const H = {
    get() { try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); const d = DEF(); return Object.assign(d, v, { popup: Object.assign(d.popup, v.popup || {}), reminder: Object.assign(d.reminder, v.reminder || {}) }); } catch (e) { return DEF(); } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const learn = () => (window.LearnUI ? window.LearnUI.store.get() : { done: {}, quizzes: [], notes: [], seen: {} });

  /* ---------- streak (pure, exported for tests) ---------- */
  // days: active dates; frozen: dates covered by a freeze; rest: weekday numbers that never break a streak
  function streakOf(h, today = ld()) {
    const act = new Set(h.days), fz = new Set(h.frozen), rest = new Set(h.rest || []);
    let d = act.has(today) ? today : addDays(today, -1), n = 0, guard = 0;
    while (guard++ < 4000) {
      if (h.resetOn && d < h.resetOn) break;
      if (act.has(d)) n++;
      else if (!(fz.has(d) || rest.has(dow(d)))) break;
      d = addDays(d, -1);
    }
    return n;
  }
  function bestStreak(h) {
    const act = new Set(h.days); let best = 0;
    for (const d of h.days) if (!act.has(addDays(d, 1))) best = Math.max(best, streakOf(Object.assign({}, h, { resetOn: null }), d));
    return Math.max(best, streakOf(h));
  }
  // a missed day = yesterday wasn't active / frozen / a rest day, and there was a streak before it
  function missed(h, today = ld()) {
    const y = addDays(today, -1);
    if (h.days.includes(today) || h.days.includes(y) || h.frozen.includes(y) || (h.rest || []).includes(dow(y)) || h.resetOn === today) return null;
    const before = streakOf(Object.assign({}, h, { days: h.days.filter((x) => x < y) }), addDays(y, -1));
    return before > 0 ? { date: y, before } : null;
  }
  const freezesLeft = (h, today = ld()) => Math.max(0, h.freezesPerWeek - h.frozen.filter((d) => weekKey(d) === weekKey(today)).length);

  /* ---------- awards ---------- */
  const AWARDS = [
    { id: "new", group: "Getting started", icon: "🌱", name: "New learner", desc: "Finished your first lesson", share: true, test: (c) => c.days >= 1 },
    { id: "d3", group: "Days in a row", icon: "3", name: "3 days", desc: "Three days of lessons in a row", test: (c) => c.best >= 3 },
    { id: "d7", group: "Days in a row", icon: "7", name: "7 days", desc: "Seven days of lessons in a row", test: (c) => c.best >= 7 },
    { id: "d30", group: "Days in a row", icon: "30", name: "30 days", desc: "Thirty days in a row", test: (c) => c.best >= 30 },
    { id: "d100", group: "Days in a row", icon: "100", name: "100 days", desc: "A hundred days in a row", test: (c) => c.best >= 100 },
    { id: "sec1", group: "Lessons and quizzes", icon: "✦", name: "First section", desc: "Finished a Learn section", test: (c) => c.sections >= 1 },
    { id: "les10", group: "Lessons and quizzes", icon: "✦✦", name: "10 lessons", desc: "Ten lessons or sections", test: (c) => c.lessons >= 10 },
    { id: "allTarot", group: "Lessons and quizzes", icon: "✦✦✦", name: "All tarot sections", desc: "Every tarot Learn section done", test: (c) => c.allTarot },
    { id: "q1", group: "Lessons and quizzes", icon: "✓", name: "First quiz", desc: "Finished a quiz", test: (c) => c.quizzes >= 1 },
    { id: "q10", group: "Lessons and quizzes", icon: "✓✓", name: "10 quizzes", desc: "Ten quizzes", test: (c) => c.quizzes >= 10 },
    { id: "qp", group: "Lessons and quizzes", icon: "★", name: "Perfect quiz", desc: "Every answer right", test: (c) => c.perfect },
    { id: "n1", group: "Put it together", icon: "✎", name: "First note", desc: "Saved a Put it together note", test: (c) => c.notes >= 1 },
    { id: "n5", group: "Put it together", icon: "✎✎", name: "5 notes", desc: "Five notes", test: (c) => c.notes >= 5 },
    { id: "n25", group: "Put it together", icon: "✎✎✎", name: "25 notes", desc: "Twenty-five notes", test: (c) => c.notes >= 25 },
  ];
  function counts(h, st) {
    const tarotSecs = window.LearnUI ? window.LearnUI.sections().filter((s) => s.area !== "sky") : [];
    const sections = Object.keys(st.done || {}).length;
    const dailies = ((window.TarotPractice && window.TarotPractice.P && window.TarotPractice.P()) || {}).dailyDone || [];
    return { days: h.days.length, best: bestStreak(h), sections, lessons: sections + dailies.length, allTarot: tarotSecs.length > 0 && tarotSecs.every((s) => st.done[s.id]),
      quizzes: (st.quizzes || []).length, perfect: (st.quizzes || []).some((q) => q.total && q.score === q.total), notes: (st.notes || []).length };
  }
  function checkAwards(quiet) {
    const h = H.get(), c = counts(h, learn()), fresh = [];
    for (const a of AWARDS) if (!h.awards[a.id] && a.test(c)) { h.awards[a.id] = ld(); fresh.push(a); }
    H.set(h);
    if (fresh.length && !quiet && h.awardPopups) awardCard(fresh[0]);
    return fresh;
  }

  /* ---------- activity ---------- */
  const doneToday = () => H.get().days.includes(ld());
  function mark(kind) {
    const h = H.get(), t = ld();
    if (!h.days.includes(t)) { h.days.push(t); h.days.sort(); }
    if (h.popup.later === t) h.popup.later = null;
    H.set(h); removeBanner(); checkAwards(false);
    return kind;
  }
  // a finished section, quiz, note or glossary round counts as today's lesson
  function hookLearn() {
    if (!window.LearnUI || window.LearnUI.store.__h) return;
    const s = window.LearnUI.store, orig = s.set.bind(s);
    s.set = (v) => { const prev = s.get(); orig(v);
      const grew = Object.keys(v.done || {}).length > Object.keys(prev.done || {}).length || (v.quizzes || []).length > (prev.quizzes || []).length || (v.notes || []).length > (prev.notes || []).length || (v.glossary || 0) > (prev.glossary || 0);
      if (grew) mark("learn"); };
    s.__h = true;
  }

  /* ---------- sheet ---------- */
  function sheet(html, cls = "") {
    let el = $("#hbSheet");
    if (!el) { el = document.createElement("div"); el.id = "hbSheet"; el.className = "ln-sheet"; document.body.appendChild(el); }
    el.innerHTML = `<div class="ln-sheet-bg" data-hx></div><div class="ln-sheet-card hb-card ${cls}" role="dialog" aria-modal="true"><button class="modal-close" data-hx aria-label="Close">×</button>${html}</div>`;
    el.hidden = false;
    $$("[data-hx]", el).forEach((b) => b.addEventListener("click", () => { el.hidden = true; }));
    return el;
  }
  const closeSheet = () => { const el = $("#hbSheet"); if (el) el.hidden = true; };

  /* ---------- daily pop-up + banner ---------- */
  function nextLesson() {
    const st = learn(), secs = window.LearnUI ? window.LearnUI.sections().filter((s) => s.area !== "sky") : [];
    const s = secs.find((x) => !st.done[x.id]) || secs[0];
    return s ? { id: s.id, title: s.title, n: s.cards.length } : null;
  }
  function goLesson() {
    closeSheet(); removeBanner();
    const L = nextLesson(), A = window.TarotApp;
    A.showTab("practice"); window.scrollTo({ top: 0 });
    const b = document.querySelector('[data-pv="learn"]'); if (b) b.click();
    setTimeout(() => { const sb = L && document.querySelector(`[data-sec="${L.id}"]`); if (sb) sb.click(); }, 60);
  }
  const deepLinked = () => { const p = new URLSearchParams(location.search); return ["card", "pmode", "reading", "share", "g", "invite"].some((k) => p.has(k)) || /^#[^?]*\?/.test(location.hash); };   // a tab hash (#journal) is not a deep link; #friends?invite=… is
  function maybePopup(force) {
    const h = H.get(), t = ld(), wk = [0, 6].includes(new Date().getDay());
    if (!force && document.querySelector(".tj-modal, .modal:not([hidden])")) return false;
    if (!force && (!h.popup.on || h.popup.shown === t || doneToday() || deepLinked() || (h.popup.skipWeekends && wk))) return false;
    h.popup.shown = t; H.set(h);
    const L = nextLesson(); if (!L) return false;
    const el = sheet(`<span class="pill">Today's lesson · about 5 min</span><h3>${esc(L.title)}</h3><p>${L.n} short cards, one idea each, then Put it together and a quiz.</p>
      <div class="actions"><button class="btn btn-gold" id="hbStart">Start lesson</button><button class="btn btn-ghost" id="hbLater">Later today</button></div>
      <p class="muted small">Shows once a day, the first time you open the app. Change this in Practice › Progress › Reminders and streaks.</p>`, "hb-pop");
    $("#hbStart", el).addEventListener("click", goLesson);
    $("#hbLater", el).addEventListener("click", () => { const x = H.get(); x.popup.later = ld(); H.set(x); closeSheet(); banner("later"); });
    $$("[data-hx]", el).forEach((b) => b.addEventListener("click", () => { const x = H.get(); if (x.popup.later !== ld()) { x.popup.hidden = ld(); H.set(x); } }));
    return true;
  }
  function removeBanner() { const b = $("#hbBanner"); if (b) b.remove(); }
  function banner(kind) {
    const host = $("#panel-today"); if (!host || doneToday()) return;
    removeBanner();
    const L = nextLesson(); if (!L) return;
    const h = H.get(), [hh, mm] = h.reminder.time.split(":").map(Number), tl = new Date(2000, 0, 1, hh, mm).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const d = document.createElement("div"); d.id = "hbBanner"; d.className = "hb-banner"; d.setAttribute("role", "status");
    d.innerHTML = `<span aria-hidden="true">${kind === "reminder" ? "⏰" : "✦"}</span><span class="hb-bt"><b>${kind === "reminder" ? `It's ${esc(tl)}, your lesson time` : "Today's lesson"}</b><small>${esc(L.title)} · about 5 min</small></span><button class="btn btn-gold btn-sm" id="hbGo">Start ›</button><button class="link-btn" id="hbX" aria-label="Hide for today">✕</button>`;
    host.prepend(d);
    $("#hbGo", d).addEventListener("click", goLesson);
    $("#hbX", d).addEventListener("click", () => { const x = H.get(); x.reminder.banner = ld(); x.popup.later = null; x.popup.hidden = ld(); H.set(x); removeBanner(); });
  }
  function refreshBanner() {
    const h = H.get(), t = ld();
    if (doneToday()) return removeBanner();
    if (h.popup.later === t) return banner("later");
    if (h.reminder.on && h.reminder.banner !== t && due(h)) banner("reminder");
  }

  /* ---------- reminders ---------- */
  const due = (h, now = new Date()) => { const [hh, mm] = h.reminder.time.split(":").map(Number); return now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm; };
  const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia && matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const canNotify = () => "Notification" in window && "serviceWorker" in navigator && (!isIOS() || standalone());
  async function tick() {
    const h = H.get(), t = ld();
    if (!h.reminder.on || h.reminder.notified === t || !due(h) || (h.reminder.skipDone && doneToday())) return refreshBanner();
    h.reminder.notified = t; H.set(h);
    const L = nextLesson(), body = `${L ? L.title + ". " : ""}About 5 minutes.`;
    if (canNotify() && Notification.permission === "granted") {
      try { const r = await navigator.serviceWorker.ready; await r.showNotification("Today's lesson is ready", { body, tag: "tt-lesson", icon: "icons/icon-192.png", data: { url: "./?lesson=1#practice" } }); } catch (e) { /* fall back below */ }
    }
    refreshBanner();
  }

  /* ---------- award card + share ---------- */
  function awardCard(a) {
    const h = H.get(); h.seenAwards[a.id] = ld(); H.set(h);
    const next = a.id === "new" ? "Next: 3 days in a row. No rush." : a.id.startsWith("d") ? "Next award whenever you get there. No rush." : "";
    const el = sheet(`<div class="hb-medal" aria-hidden="true">${esc(a.icon)}</div><h3 class="center">${esc(a.name)}</h3><p class="center muted">${esc(a.desc)}.</p>${next ? `<p class="center small">${next}</p>` : ""}
      <div class="actions">${a.share ? `<button class="btn btn-gold" id="hbShare">Share this award</button>` : ""}<button class="btn btn-ghost" data-hx>Nice</button><button class="btn btn-ghost btn-sm" id="hbAll">See all awards</button></div>
      ${a.share ? `<p class="muted small center">Sharing sends only a picture of the award. Nothing about you, your chart or your notes.</p>` : ""}`, "hb-award");
    $$("[data-hx]", el).forEach((b) => b.addEventListener("click", () => { el.hidden = true; }));
    const s = $("#hbShare", el); if (s) s.addEventListener("click", () => sharePreview(a));
    $("#hbAll", el).addEventListener("click", () => { closeSheet(); awardsSheet(); });
  }
  // the share image carries the award name, an optional date and the app name. Nothing else.
  function shareText(h) { return `I earned the New learner award in ${appName()}.` + (isPublic() && h.shareLink ? " " + PUBLIC_URL : ""); }
  function drawCard(a, h) {
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1080; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 1080, 1080); g.addColorStop(0, "#2a2150"); g.addColorStop(1, "#14102a"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1080);
    x.strokeStyle = "#c9a227"; x.lineWidth = 6; x.strokeRect(40, 40, 1000, 1000);
    x.textAlign = "center"; x.fillStyle = "#f4ecd8"; x.font = "220px serif"; x.fillText(a.icon, 540, 440);
    x.font = "bold 96px Georgia, serif"; x.fillText(a.name, 540, 620);
    x.fillStyle = "#c9b98f"; x.font = "48px Georgia, serif"; x.fillText(a.id === "new" ? "Finished my first tarot lesson" : a.desc, 540, 710);
    x.font = "40px Georgia, serif"; x.fillText(appName() + (h.shareDate ? " · " + new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : ""), 540, 900);
    return c;
  }
  function sharePreview(a) {
    const h = H.get(), cv = drawCard(a, h), url = cv.toDataURL("image/png");
    const el = sheet(`<h3>Share card</h3><img class="hb-share-img" src="${url}" alt="${esc(a.name)} award card" />
      <div class="ln-card sm"><b>On the card</b><ul><li>Award name${h.shareDate ? " and date" : ""}</li><li>App name only</li></ul><b>Never on the card</b><ul><li>Your name, birth details, chart or notes</li><li>Links${isPublic() ? " (unless you switch it on below)" : " or this app's address"}</li></ul></div>
      <label class="switch ${h.shareDate ? "on" : ""}"><input type="checkbox" id="hbDate" ${h.shareDate ? "checked" : ""} /> <span>Show the date</span></label>
      ${isPublic() ? `<label class="switch ${h.shareLink ? "on" : ""}"><input type="checkbox" id="hbLink" ${h.shareLink ? "checked" : ""} /> <span>Add the app's public link to the message</span></label>` : ""}
      <div class="actions"><button class="btn btn-gold" id="hbDo">Share…</button><a class="btn btn-ghost btn-sm" id="hbSave" download="new-learner.png" href="${url}">Save image</a></div><p class="muted small" id="hbMsg"></p>`, "hb-share");
    $("#hbDate", el).addEventListener("change", (e) => { const x = H.get(); x.shareDate = e.target.checked; H.set(x); sharePreview(a); });
    const lk = $("#hbLink", el); if (lk) lk.addEventListener("change", (e) => { const x = H.get(); x.shareLink = e.target.checked; H.set(x); sharePreview(a); });
    $("#hbDo", el).addEventListener("click", () => cv.toBlob(async (blob) => {
      const file = new File([blob], "new-learner.png", { type: "image/png" }), data = { files: [file], text: shareText(H.get()) };
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share(data); $("#hbMsg", el).textContent = "Shared."; }
        else { $("#hbSave", el).click(); $("#hbMsg", el).textContent = "This browser can't share images, so the picture was saved instead."; }
      } catch (e) { $("#hbMsg", el).textContent = e && e.name === "AbortError" ? "Not shared." : "Couldn't open the share sheet. Use Save image."; }
    }, "image/png"));
  }
  function awardsSheet() {
    checkAwards(true);
    const h = H.get(), groups = [...new Set(AWARDS.map((a) => a.group))];
    const el = sheet(`<h3>Awards <small class="muted">${Object.keys(h.awards).length} of ${AWARDS.length}</small></h3>${groups.map((g) => `<p class="label">${esc(g)}</p><div class="hb-aw">${AWARDS.filter((a) => a.group === g).map((a) => `<button type="button" class="hb-a ${h.awards[a.id] ? "" : "off"}" data-aw="${a.id}" ${h.awards[a.id] ? "" : "disabled"}><b>${esc(a.icon)}</b><small>${esc(a.name)}${a.share && h.awards[a.id] ? " · share" : ""}</small></button>`).join("")}</div>`).join("")}`, "hb-awards");
    $$("[data-aw]", el).forEach((b) => b.addEventListener("click", () => awardCard(AWARDS.find((a) => a.id === b.dataset.aw))));
  }

  /* ---------- Progress panel: streak, missed day, awards, settings ---------- */
  function panel(area) {
    checkAwards(true);
    const h = H.get(), t = ld(), n = streakOf(h), m = missed(h), left = freezesLeft(h);
    const cal = []; const start = addDays(t, -((dow(t) + 6) % 7) - 14);
    for (let i = 0; i < 21; i++) { const d = addDays(start, i); cal.push(`<i class="${h.days.includes(d) ? "d" : h.frozen.includes(d) ? "fz" : (h.rest || []).includes(dow(d)) ? "rs" : ""} ${d === t ? "now" : ""} ${d > t ? "fut" : ""}" title="${d}">${h.days.includes(d) ? "✓" : h.frozen.includes(d) ? "❄" : ""}</i>`); }
    const box = document.createElement("section"); box.className = "p-panel hb-panel"; box.id = "hbPanel";
    const st = learn();
    box.innerHTML = `${m ? `<div class="hb-back"><h3>Welcome back</h3><p>You didn't do a lesson on ${esc(new Date(m.date + "T12:00").toLocaleDateString([], { weekday: "long" }))}. That's fine.</p>
        <div class="actions">${left ? `<button class="btn btn-gold" id="hbFreeze">Use a freeze (keeps your ${m.before} day${m.before === 1 ? "" : "s"})</button>` : ""}<button class="btn btn-ghost" id="hbNew">Start a new streak</button></div>
        <p class="muted small">${left ? `You have ${left} freeze${left === 1 ? "" : "s"} left this week.` : "No freezes left this week."} Planned breaks: set rest days below and they never count against you.</p></div>` : ""}
      ${h.showStreak ? `<h3>Lesson streak</h3><div class="hb-flame"><b>${n}</b><small>day${n === 1 ? "" : "s"} in a row</small></div>
      <div class="hb-cal">${"MTWTFSS".split("").map((x) => `<i class="hd">${x}</i>`).join("")}${cal.join("")}</div>
      <p class="muted small">${doneToday() ? "Today's lesson is done." : "Any Learn section, quiz, Put it together note, glossary round or Daily lesson counts."} ${left} freeze${left === 1 ? "" : "s"} left this week.</p>` : ""}
      <div class="stats"><div><b>${Object.keys(st.done || {}).length}</b><small>sections</small></div><div><b>${(st.quizzes || []).length}</b><small>quizzes</small></div><div><b>${(st.notes || []).length}</b><small>notes</small></div><div><b>${Object.keys(h.awards).length}</b><small>awards</small></div></div>
      <div class="actions"><button class="btn btn-ghost btn-sm" id="hbAwards">All awards ›</button><button class="btn btn-ghost btn-sm" id="hbSet">Reminders and streaks ›</button></div>`;
    area.prepend(box);
    const f = $("#hbFreeze", box); if (f) f.addEventListener("click", () => { const x = H.get(); x.frozen.push(m.date); H.set(x); box.remove(); panel(area); });
    const nw = $("#hbNew", box); if (nw) nw.addEventListener("click", () => { const x = H.get(); x.resetOn = ld(); H.set(x); box.remove(); panel(area); });
    $("#hbAwards", box).addEventListener("click", awardsSheet);
    $("#hbSet", box).addEventListener("click", settings);
  }
  function settings() {
    const h = H.get(), ios = isIOS(), sa = standalone(), perm = "Notification" in window ? Notification.permission : "unsupported";
    const tog = (id, on, t, s) => `<label class="hb-tgl"><span>${t}<small>${s}</small></span><input type="checkbox" id="${id}" ${on ? "checked" : ""} /></label>`;
    const el = sheet(`<h3>Reminders and streaks</h3>
      <p class="label">Daily lesson pop-up</p>
      ${tog("sPop", h.popup.on, "Show the daily lesson when I open the app", "Once a day, on the first open after midnight (your time)")}
      ${tog("sWk", h.popup.skipWeekends, "Skip weekends", "No pop-up on Saturday or Sunday")}
      <p class="label">Reminder</p>
      ${tog("sRem", h.reminder.on, "Daily lesson reminder", "One a day, at your time")}
      <label class="field"><span>Remind me at (${esc(Intl.DateTimeFormat().resolvedOptions().timeZone || "your time")})</span><input type="time" id="sTime" value="${esc(h.reminder.time)}" /></label>
      ${tog("sSkip", h.reminder.skipDone, "Don't remind me if I've already done it", "Recommended")}
      <div class="note small">${ios && !sa ? `<b>On iPhone, notifications need the app on your Home Screen</b> (iOS 16.4 or later): tap Share in Safari, then Add to Home Screen, then open it from the icon and turn reminders on. Until then you'll get the reminder as a banner inside the app.` : ""}
        <b>How reminders work here:</b> the app sends the notification itself, so it arrives when the app is open or still running in the background. If the app is fully closed, you'll see a banner on Today next time you open it. We never send email or texts.</div>
      <div class="actions"><button class="btn btn-ghost btn-sm" id="sPerm" ${canNotify() && perm === "default" ? "" : "hidden"}>Turn on notifications</button><span class="muted small" id="sPermMsg">${perm === "granted" ? "Notifications allowed." : perm === "denied" ? "Notifications are blocked in your settings; the in-app banner still works." : !canNotify() ? "This browser can't show notifications from the app; you'll get the in-app banner." : ""}</span></div>
      <p class="label">Streaks and awards</p>
      ${tog("sStreak", h.showStreak, "Show my streak", "On Progress only, never as a pop-up")}
      ${tog("sAw", h.awardPopups, "Award pop-ups", "A small card when you reach one")}
      <div class="field"><span>Rest days (never break a streak)</span><div class="hb-rest">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => `<button type="button" class="gp-chk ${h.rest.includes(i) ? "on" : ""}" data-rest="${i}" aria-pressed="${h.rest.includes(i)}">${d}</button>`).join("")}</div></div>
      <p class="muted small">Freezes: ${h.freezesPerWeek} a week, used only when you choose.</p>
      <div class="ln-card sm"><b>What we won't do</b><ul><li>No "you're about to lose your streak" messages</li><li>No red badges or countdowns</li><li>No reminders about streaks, only about the lesson</li></ul></div>`, "hb-settings");
    const save = (fn) => { const x = H.get(); fn(x); H.set(x); };
    $("#sPop", el).addEventListener("change", (e) => save((x) => (x.popup.on = e.target.checked)));
    $("#sWk", el).addEventListener("change", (e) => save((x) => (x.popup.skipWeekends = e.target.checked)));
    $("#sRem", el).addEventListener("change", (e) => { save((x) => { x.reminder.on = e.target.checked; x.reminder.notified = null; }); });
    $("#sTime", el).addEventListener("change", (e) => save((x) => { x.reminder.time = e.target.value || "19:30"; x.reminder.notified = null; }));
    $("#sSkip", el).addEventListener("change", (e) => save((x) => (x.reminder.skipDone = e.target.checked)));
    $("#sStreak", el).addEventListener("change", (e) => save((x) => (x.showStreak = e.target.checked)));
    $("#sAw", el).addEventListener("change", (e) => save((x) => (x.awardPopups = e.target.checked)));
    $$("[data-rest]", el).forEach((b) => b.addEventListener("click", () => { const i = +b.dataset.rest; save((x) => { x.rest = x.rest.includes(i) ? x.rest.filter((y) => y !== i) : [...x.rest, i]; }); b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); }));
    const p = $("#sPerm", el); if (p) p.addEventListener("click", async () => { const r = await Notification.requestPermission(); $("#sPermMsg", el).textContent = r === "granted" ? "Notifications allowed." : "Not allowed. The in-app banner still works."; p.hidden = true; if (r === "granted") save((x) => (x.reminder.on = true)); });
  }

  /* ---------- boot ---------- */
  function boot() {
    hookLearn(); checkAwards(true);
    // the daily lesson in Practice also counts
    const P = window.TarotPractice && window.TarotPractice.P && window.TarotPractice.P();
    if (P && (P.dailyDone || []).includes(ld()) && !doneToday()) mark("daily");
    setTimeout(() => { if (!maybePopup()) refreshBanner(); }, 400);
    setInterval(tick, 60000); tick();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { maybePopup() || refreshBanner(); tick(); } });
  }
  window.Habits = { mark, panel, settings, awardsSheet, awardCard, sharePreview, maybePopup, refreshBanner, checkAwards, AWARDS, H, KEY,
    _t: { streakOf, bestStreak, missed, freezesLeft, addDays, weekKey, shareText, isPublic, drawCard } };
  if (window.TarotApp && window.TarotApp.S && window.TarotApp.S.cards && window.TarotApp.S.cards.length) boot();
  else document.addEventListener("tarot:ready", boot, { once: true });
})();
