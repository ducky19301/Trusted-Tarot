/* Trusted Tarot v17 — the app's old Python server, rebuilt to run in the browser on top of Supabase.
   app.js / practice.js still call the same /api/*, /social/* and /auth/status URLs; this file answers them
   (same rules as server.py + accounts.py) using Supabase Auth, the private `docs` table and the private
   `uploads` storage bucket. Nothing here is secret: the Supabase "anon/publishable" key is meant for browsers;
   row-level security (supabase/schema.sql) is what keeps each person's data private. */
(() => {
  "use strict";
  const CFG = window.TAROT_CONFIG || {};
  const EMAIL_DOMAIN = CFG.emailDomain || "users.trustedtarot.app";
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "trusted-tarot-auth" },
  });
  window.TAROT_SB = sb;
  const _fetch = window.fetch.bind(window);

  // ---------- small helpers (same behaviour as server.py) ----------
  const pad = (n) => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const nowIso = () => { const d = new Date(), o = -d.getTimezoneOffset(); return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${o >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(o) / 60))}:${pad(Math.abs(o) % 60)}`; };
  const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const newId = (p) => `${p}-${hex(5)}`;
  const clean = (s, limit = 2000) => (!s ? "" : String(s).trim().slice(0, limit).replace(/&/g, "and").replace(/[<>]/g, ""));
  const slugify = (s) => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "guest");
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, IMG_RE = /^[a-z]{2}[0-9a-z]{2}\.jpg$/;
  const VALID_SOURCES = new Set(["physical deck", "digital app", "unknown", "photo"]);
  class HttpErr extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const bad = (m) => new HttpErr(400, m), missing = (m) => new HttpErr(404, m);

  // ---------- session / profile ----------
  let _session = null, _profile = null;
  async function session() {
    if (_session) return _session;
    const { data } = await sb.auth.getSession();
    _session = data.session; return _session;
  }
  sb.auth.onAuthStateChange((_e, s) => { _session = s; if (!s) _profile = null; });
  const uid = async () => { const s = await session(); if (!s) throw new HttpErr(401, "login required"); return s.user.id; };
  async function profile() {
    if (_profile) return _profile;
    const id = await uid();
    const { data, error } = await sb.from("profiles").select("*").eq("id", id).single();
    if (error) throw error;
    _profile = data; return data;
  }

  // ---------- cards (static file, built from cards.json + card-knowledge.json) ----------
  let _cards = null;
  async function loadCards() {
    if (!_cards) { const r = await _fetch("/data/cards.json"); if (!r.ok) throw new Error("cards missing"); _cards = await r.json(); }
    return _cards;
  }
  async function parseCards(payload, required = true, defaultSource = "digital app", allowUnknown = false) {
    const raw = payload.cards || [];
    if (!Array.isArray(raw) || raw.length > 12 || (required && !raw.length)) throw bad(required ? "Provide 1–12 cards" : "cards must be a list (max 12)");
    const all = await loadCards();
    const byId = new Map(all.map((c) => [c.id, c])), byName = new Map(all.map((c) => [c.name.toLowerCase(), c]));
    return raw.map((rc) => {
      let c = rc.id ? byId.get(String(rc.id)) : null;
      if (!c && rc.name) c = byName.get(String(rc.name).trim().toLowerCase());
      if (!c) throw bad(`Unknown card: '${rc.id || rc.name}'`);
      const o = String(rc.orientation || "").toLowerCase();
      if (!["upright", "reversed"].includes(o) && !(allowUnknown && o === "unknown")) throw bad(`Orientation must be upright or reversed for ${c.name}`);
      const s = String(rc.source || defaultSource).toLowerCase();
      if (!VALID_SOURCES.has(s)) throw bad(`Unknown source '${s}'`);
      return [c, o, s, clean(rc.position, 40)];
    });
  }
  const cardBrief = (rows, withImg = false) => rows.map(([c, o, s, p]) => ({ name: c.name, orientation: o, source: s, ...(p ? { position: p } : {}), ...(withImg ? { img: c.img } : {}) }));
  function cleanGenerated(g) {
    if (!g || typeof g !== "object") return null;
    const t = (v, n = 4000) => clean(v, n) || null;
    const cards = (g.cards || []).slice(0, 15).filter((c) => c && typeof c === "object").map((c) => ({
      label: t(c.label, 80), name: t(c.name, 80), orientation: t(c.orientation, 20), core: t(c.core),
      others: (c.others || []).slice(0, 12).filter((o) => o && o.text).map((o) => ({ label: t(o.label, 60), text: t(o.text) })),
    }));
    if (!cards.length) return null;
    const out = { summary: t(g.summary, 6000), cards, generated_at: nowIso() };
    const fg = g.forGuest;
    if (fg && fg.notes) out.forGuest = { title: t(fg.title, 120), notes: fg.notes.slice(0, 20).filter(Boolean).map((x) => t(x, 400)) };
    return out;
  }

  // ---------- per-user documents (optimistic concurrency on updated_at) ----------
  const DEFAULTS = { entries: () => [], guests: () => [], outbox: () => [], gaps: () => [], practice: () => emptyPractice() };
  async function readDoc(kind) {
    const id = await uid();
    const { data, error } = await sb.from("docs").select("data, updated_at").eq("user_id", id).eq("kind", kind).maybeSingle();
    if (error) throw error;
    return data ? { data: data.data, ver: data.updated_at } : { data: DEFAULTS[kind](), ver: null };
  }
  async function getDoc(kind) { return (await readDoc(kind)).data; }
  async function mutate(kind, fn) {
    const id = await uid();
    for (let attempt = 0; attempt < 5; attempt++) {
      const cur = await readDoc(kind);
      const result = await fn(cur.data);
      const stamp = new Date().toISOString();
      if (cur.ver === null) {
        const { error } = await sb.from("docs").insert({ user_id: id, kind, data: cur.data, updated_at: stamp });
        if (!error) return result;
        if (error.code !== "23505") throw error;
      } else {
        const { data, error } = await sb.from("docs").update({ data: cur.data, updated_at: stamp }).eq("user_id", id).eq("kind", kind).eq("updated_at", cur.ver).select("kind");
        if (error) throw error;
        if (data && data.length) return result;
      }
    }
    throw new Error("Saving clashed with another device; please try again.");
  }

  // ---------- photos (private bucket, files under <user id>/uploads/...) ----------
  function sniffExt(b) {
    const s = (i, n) => String.fromCharCode(...b.slice(i, i + n));
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return [".jpg", "image/jpeg"];
    if (b[0] === 0x89 && s(1, 3) === "PNG") return [".png", "image/png"];
    if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return [".webp", "image/webp"];
    if (["GIF87a", "GIF89a"].includes(s(0, 6))) return [".gif", "image/gif"];
    if (s(4, 4) === "ftyp" && ["heic", "heix", "mif1", "msf1", "heim", "hevc"].includes(s(8, 4))) return [".heic", "image/heic"];
    return null;
  }
  async function savePhotos(photos, subdir) {
    if (!photos || !photos.length) return [];
    if (!Array.isArray(photos) || photos.length > 8) throw bad("Up to 8 photos");
    const id = await uid(), decoded = [];
    for (const p of photos) {
      let raw = p && typeof p === "object" ? p.data : p;
      if (typeof raw !== "string") throw bad("photo data must be base64");
      if (raw.startsWith("data:")) raw = raw.split(",", 2)[1];
      const bin = atob(raw), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      if (bytes.length > 25 * 1024 * 1024) throw bad("Photo too large (25 MB max)");
      const ext = sniffExt(bytes);
      if (!ext) throw bad("Unsupported image type (jpg, png, webp, gif, heic)");
      decoded.push([bytes, ext]);
    }
    const paths = [];
    for (const [bytes, [ext, type]] of decoded) {
      const rel = `uploads/${subdir}/${newId("ph")}${ext}`;
      const { error } = await sb.storage.from("uploads").upload(`${id}/${rel}`, bytes, { contentType: type, upsert: false });
      if (error) throw new Error("Photo upload failed: " + error.message);
      paths.push(rel);
    }
    return paths;
  }

  // ---------- journal (entries) + outbox ----------
  async function addOutbox(record) {
    const rec = { id: newId("ob"), ...record, created_at: nowIso() };
    await mutate("outbox", (ob) => { ob.push(rec); });
    return rec;
  }
  const summaryFor = (c, o) => o === "reversed" ? c.reversed : o === "unknown" ? `Orientation not recorded. Upright: ${c.upright} Reversed: ${c.reversed}` : c.upright;
  async function savePersonal(date, rows, note = "", labels = null, photos = null, reading = "", meta = null) {
    let added = [], skipped = [];
    await mutate("entries", (entries) => {
      if (!Array.isArray(entries)) throw bad("entries is not a list");
      added = []; skipped = [];
      let day = entries.find((e) => e.date === date); const isNew = !day;
      if (isNew) day = { date, cards: [], notes: null };
      for (const [c, o, s, pos] of rows) {
        if ((day.cards || []).some((x) => x.name === c.name && x.orientation === o && x.source === s)) { skipped.push(c.name); continue; }
        const f = String(c.img).split("/").pop(); if (!IMG_RE.test(f)) throw bad("Bad image name");
        (day.cards = day.cards || []).push({ ...(pos ? { position: pos } : {}), name: c.name, orientation: o, img: `img/${f}`, source: s, summary: summaryFor(c, o), sitWith: c.sitWith, astro: null });
        added.push(c.name);
      }
      // v23: intention and spread are real fields now (old entries keep the "Intention: ..." line in notes)
      if (meta && added.length) { if (meta.intent) day.intent = meta.intent; if (meta.spread) day.spread = meta.spread; if (meta.cohesive) day.cohesive = meta.cohesive; }
      const newPhotos = (photos || []).filter((p) => !(day.photos || []).includes(p));
      if (!added.length && !newPhotos.length) return;
      const extra = [], nm = (c, o) => `${c.name}${o === "reversed" ? " (reversed)" : ""}`;
      if (labels && rows.length === 3 && labels.length === 3 && added.length) extra.push(`3-card spread (${labels.join(" · ")}): ${rows.map(([c, o]) => nm(c, o)).join(" · ")}`);
      else if (labels && labels.length === rows.length && rows.length > 1 && added.length) extra.push(`${rows.length}-card spread: ${rows.map(([c, o], i) => `${labels[i]}: ${nm(c, o)}`).join(" · ")}`);
      if (note) extra.push(`Note — ${note}`);
      if (reading) extra.push(`Reading — ${reading}`);
      if (extra.length) day.notes = [day.notes, ...extra].filter(Boolean).join("\n\n");
      if (newPhotos.length) day.photos = (day.photos || []).concat(newPhotos);
      if (isNew) { entries.push(day); entries.sort((a, b) => (a.date || "").localeCompare(b.date || "")); }
    });
    if (!added.length && !(photos || []).length) return { added: [], skipped, backup: null, outbox: null };
    const addedRows = rows.filter((r) => added.includes(r[0].name));
    const rec = addedRows.length ? await addOutbox({ kind: "self_draw", date, cards: addedRows.map(([c, o, s]) => ({ name: c.name, orientation: o, source: s })), status: "pending_astro" }) : null;
    return { added, skipped, backup: null, outbox: rec };
  }
  const findGuest = (guests, gid) => { const g = guests.find((x) => x.id === gid || x.slug === gid); if (!g) throw missing("no such guest"); return g; };
  async function resolveGuestReading(gid, rid, body) {
    const rows = body.cards && body.cards.length ? await parseCards(body, true, "photo") : null;
    let out;
    await mutate("guests", (guests) => {
      const g = findGuest(guests, gid), r = (g.readings || []).find((x) => x.id === rid);
      if (!r) throw missing("no such reading");
      if (rows) r.cards = cardBrief(rows, true);
      if (body.reading !== undefined && body.reading !== null) r.reading = String(body.reading).trim().slice(0, 8000) || null;
      r.status = r.reading ? "read" : (r.status || "needs_reading"); r.resolved_at = nowIso();
      out = [g, r];
    });
    await mutate("outbox", (ob) => { for (const o of ob) if (o.kind === "guest_reading" && o.reading_id === rid && o.status === "needs_reading") { o.status = "resolved"; o.resolved_at = nowIso(); } });
    return out;
  }

  // ---------- practice ----------
  const LEITNER = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 16 }, RATINGS = new Set(["knew", "sort", "didnt"]);
  const KINDS = new Set(["pick", "flashcard", "quiz", "real", "daily", "reading"]);
  function emptyPractice() { return { version: 1, reviews: {}, reviewLog: [], pulls: [], readings: [], lessons: {}, quizzes: [], days: [] }; }
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  async function practiceCard(id) { const c = (await loadCards()).find((x) => x.id === String(id || "")); if (!c) throw bad(`Unknown card id '${id}'`); return c; }
  function fixPractice(p) { if (!p || typeof p !== "object" || Array.isArray(p)) p = emptyPractice(); for (const [k, v] of Object.entries(emptyPractice())) if (!(k in p)) p[k] = v; return p; }
  async function practiceMutate(fn) {
    return mutate("practice", async (p) => { Object.assign(p, fixPractice(p)); const r = await fn(p); const t = today(); if (!p.days.includes(t)) { p.days.push(t); p.days.sort(); } return r; });
  }
  function applyReview(p, cardId, orientation, rating, mode) {
    if (!RATINGS.has(rating)) throw bad("rating must be knew, sort or didnt");
    if (!["upright", "reversed"].includes(orientation)) orientation = "upright";
    if (!KINDS.has(mode)) mode = "flashcard";
    const r = p.reviews[cardId] || { box: 1, seen: 0, knew: 0, sort: 0, didnt: 0 };
    let box = +r.box || 1; box = rating === "knew" ? Math.min(box + 1, 5) : rating === "didnt" ? 1 : box;
    const days = rating === "knew" ? LEITNER[box] : rating === "sort" ? 1 : 0;
    Object.assign(r, { box, due: addDays(today(), days), last: nowIso(), seen: (+r.seen || 0) + 1, [rating]: (+r[rating] || 0) + 1 });
    p.reviews[cardId] = r;
    p.reviewLog.push({ at: nowIso(), card: cardId, orientation, rating, mode }); p.reviewLog = p.reviewLog.slice(-3000);
    return r;
  }
  async function cleanPullCards(raw, noteKey = "impression") {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 12) throw bad("Provide 1-12 cards");
    const out = [];
    for (const rc of raw) {
      if (!rc || typeof rc !== "object") throw bad("cards must be objects");
      const c = await practiceCard(rc.id), o = String(rc.orientation || "").toLowerCase();
      if (!["upright", "reversed"].includes(o)) throw bad("orientation must be upright or reversed");
      const d = { id: c.id, name: c.name, orientation: o }, pos = clean(rc.position, 60), note = clean(rc[noteKey], 4000);
      if (pos) d.position = pos; if (note) d[noteKey] = note; if (RATINGS.has(rc.rating)) d.rating = rc.rating;
      out.push(d);
    }
    return out;
  }

  // ---------- astrology (web/astro.js) ----------
  const PLACES = window.TAROT_PLACES || {};
  function resolvePlace(place) {
    const p = String(place || "").trim().toLowerCase().replace(/\s+/g, " ").replace(", usa", "").replace(", us", "");
    if (!p) return null; if (PLACES[p]) return PLACES[p];
    const hits = Object.entries(PLACES).filter(([k]) => k.split(",")[0] === p.split(",")[0].trim()).map(([, v]) => v);
    return hits.length === 1 ? hits[0] : null;
  }
  function guestBirth(g) {
    const b = g.birth || {};
    if (!b.date) return [null, "Add a birth date first (Edit birth details)."];
    const [y, m, d] = b.date.split("-").map(Number);
    let { lat, lon, tz } = b;
    if (lat == null || lat === "" || lon == null || lon === "" || !tz) {
      const hit = resolvePlace(b.place);
      if (!hit) return [null, `I can't place “${b.place || "no place"}” offline. Add latitude, longitude and the time zone (e.g. America/Denver) in Edit birth details.`];
      lat = lat == null || lat === "" ? hit[0] : lat; lon = lon == null || lon === "" ? hit[1] : lon; tz = tz || hit[2];
    }
    let hour = null, minute = null; if (b.time) [hour, minute] = b.time.split(":").map(Number);
    return [{ y, m, d, hour, minute, tz, lat: +lat, lon: +lon }, null];
  }
  function cachedAstro(key, birth, date) {
    const k = `tt-astro-${key}-${date}`;
    try { const hit = localStorage.getItem(k); if (hit) return JSON.parse(hit); } catch (_) {}
    const out = window.TarotAstro.run(birth, date);
    try { for (const x of Object.keys(localStorage)) if (x.startsWith(`tt-astro-${key}-`) && x !== k) localStorage.removeItem(x); localStorage.setItem(k, JSON.stringify(out)); } catch (_) {}
    return out;
  }
  function ownBirth(p) {
    const b = p.birth; if (!b || !b.y) return null;
    if (b.tz && b.lat != null && b.lon != null) return { y: b.y, m: b.m, d: b.d, hour: b.hour ?? null, minute: b.minute ?? null, tz: b.tz, lat: +b.lat, lon: +b.lon };
    return { y: b.y, m: b.m, d: b.d, hour: null, minute: null, tz: "UTC", lat: 0, lon: 0 };
  }

  // ---------- share a guest reading as PNG / PDF (canvas port of tools/share_render.py) ----------
  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  async function renderShare(job) {
    const W = 1080, PAD = 64, GOLD = "rgb(212,175,55)", TEXT = "rgb(243,239,230)", MUTED = "rgb(168,160,184)";
    const serif = (n) => `bold ${n}px "DejaVu Serif", Georgia, serif`, sans = (n) => `${n}px "DejaVu Sans", system-ui, sans-serif`, sansb = (n) => `bold ${n}px "DejaVu Sans", system-ui, sans-serif`;
    const blocks = [], para = (t, font = sans(28), color = TEXT, size = 28) => { if (t) blocks.push(["text", String(t), font, color, size]); };
    blocks.push(["text", `Reading for ${job.guest}`, serif(56), GOLD, 56]);
    para([job.date, job.spread].filter(Boolean).join(" · "), sans(28), MUTED, 28);
    if (job.question) para(`“${job.question}”`, sans(30), TEXT, 30);
    if (job.birth) para(`Born ${job.birth}` + (job.sun ? ` · Sun in ${job.sun}` : ""), sans(26), MUTED, 26);
    blocks.push(["cards", job.cards]);
    const gen = job.generated || {};
    for (const c of job.cards) {
      para(`${c.position && !["upright", "reversed"].includes(c.position.toLowerCase()) ? c.position + ": " : ""}${c.name} (${c.orientation || "upright"})`, sansb(30), GOLD, 30);
      const gc = (gen.cards || []).find((x) => x.name === c.name); if (gc && gc.core) para(gc.core);
    }
    if (gen.summary) { para("Together", sansb(30), GOLD, 30); para(gen.summary); }
    if (gen.forGuest) { para(gen.forGuest.title, sansb(30), GOLD, 30); for (const n of gen.forGuest.notes || []) para("• " + n); }
    if (job.reading) { para("Reading", sansb(30), GOLD, 30); para(job.reading); }
    if (job.note) para("Note: " + job.note, sans(26), MUTED, 26);
    para(job.brand || "Tarot", sans(22), MUTED, 22);
    const m = document.createElement("canvas").getContext("2d");
    const wrap = (t, font) => { m.font = font; const out = []; for (const line of t.split("\n")) { let cur = ""; for (const w of line.split(/\s+/)) { const tryS = cur ? cur + " " + w : w; if (m.measureText(tryS).width > W - 2 * PAD && cur) { out.push(cur); cur = w; } else cur = tryS; } out.push(cur); } return out; };
    const items = []; let y = PAD;
    const imgs = await Promise.all(job.cards.map((c) => loadImg("/deck-img/" + String(c.img || "").split("/").pop())));
    for (const b of blocks) {
      if (b[0] === "text") { for (const line of wrap(b[1], b[2])) { items.push(["t", y, line, b[2], b[3]]); y += Math.round(b[4] * 1.4); } y += 14; }
      else { const n = b[1].length, cw = Math.min(220, Math.floor((W - 2 * PAD - (n - 1) * 16) / Math.max(n, 1))), ch = Math.round(cw * 1.72); items.push(["c", y, cw, ch]); y += ch + 28; }
    }
    const H = y + PAD, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"); g.fillStyle = "rgb(7,6,15)"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgb(90,75,30)"; g.lineWidth = 2; g.strokeRect(20, 20, W - 40, H - 40); g.textBaseline = "top";
    for (const it of items) {
      if (it[0] === "t") { g.font = it[3]; g.fillStyle = it[4]; g.fillText(it[2], PAD, it[1]); continue; }
      const [, iy, cw, ch] = it; let x = PAD;
      job.cards.forEach((c, i) => {
        const im = imgs[i];
        if (im) { g.save(); if (String(c.orientation).toLowerCase() === "reversed") { g.translate(x + cw, iy + ch); g.rotate(Math.PI); g.drawImage(im, 0, 0, cw, ch); } else g.drawImage(im, x, iy, cw, ch); g.restore(); }
        else { g.strokeStyle = GOLD; g.strokeRect(x, iy, cw, ch); }
        x += cw + 16;
      });
    }
    if (job.fmt === "png") return await new Promise((r) => cv.toBlob(r, "image/png"));
    if (!window.jspdf) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/vendor/jspdf.umd.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const PH = Math.round(W * 1.414), pdf = new window.jspdf.jsPDF({ unit: "px", format: [W, PH], hotfixes: ["px_scaling"] });
    for (let top = 0, first = true; top < H; top += PH, first = false) {
      const pc = document.createElement("canvas"); pc.width = W; pc.height = PH; const pg = pc.getContext("2d");
      pg.fillStyle = "rgb(7,6,15)"; pg.fillRect(0, 0, W, PH); pg.drawImage(cv, 0, top, W, Math.min(PH, H - top), 0, 0, W, Math.min(PH, H - top));
      if (!first) pdf.addPage([W, PH]); pdf.addImage(pc.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, W, PH);
    }
    return pdf.output("blob");
  }

  // ---------- routes ----------
  async function GET(path) {
    if (path === "/api/cards") return loadCards();
    if (path === "/api/entries") return getDoc("entries");
    if (path === "/api/guests") return getDoc("guests");
    let m = path.match(/^\/api\/guests\/([\w-]+)$/); if (m) return findGuest(await getDoc("guests"), m[1]);
    if (path === "/api/outbox") return getDoc("outbox");
    if (path === "/api/outbox/pending") return (await getDoc("outbox")).filter((o) => ["pending_astro", "needs_identification", "needs_reading"].includes(o.status));
    if (path === "/api/gaps") return getDoc("gaps");
    if (path === "/api/astro/today") {
      const p = await profile(), b = ownBirth(p);
      if (!b) throw Object.assign(bad("Add your birthday to your account to get a daily horoscope."), { extra: { needs: "birth" } });
      return cachedAstro(p.is_owner ? "owner" : "me", b, today());
    }
    if (path === "/api/profile/birth") { const p = await profile(), b = p.birth && p.birth.y ? p.birth : null; return { birth: b, name: b ? (p.display || p.username || "") : null }; }   // compat tab: Person 1 (own row only)
    if (path === "/api/moon") {
      const mo = cachedAstro("moon", { y: 2000, m: 1, d: 1, hour: null, minute: null, tz: "UTC", lat: 0, lon: 0 }, today()).moon, el = +mo.elongation;
      return { date: today(), phase: mo.phase, sign: mo.sign, elongation: el, special: el < 12 || el > 348 ? "new" : Math.abs(el - 180) < 12 ? "full" : null };
    }
    m = path.match(/^\/api\/guests\/([\w-]+)\/horoscope$/);
    if (m) {
      const g = findGuest(await getDoc("guests"), m[1]), [birth, why] = guestBirth(g);
      if (!birth) throw Object.assign(bad(why), { extra: { needs: "birth" } });
      return { guest: g.name, ...window.TarotAstro.run(birth, today()) };
    }
    if (path === "/api/today") { await uid(); return { date: today() }; }
    if (path === "/api/practice") return fixPractice(await getDoc("practice"));
    throw missing("not found");
  }

  async function POST(path, body) {
    const date = body.date || today();
    if (!DATE_RE.test(String(date))) throw bad("date must be YYYY-MM-DD");
    let m;
    async function deletePrivatePhotos(paths) {
      const safe = [...new Set((paths || []).filter((p) => typeof p === "string" && /^uploads\/[A-Za-z0-9/_-]+\.(?:jpg|jpeg|png|webp|gif|heic)$/i.test(p)))];
      if (!safe.length) return;
      const id = await uid();
      const { error } = await sb.storage.from("uploads").remove(safe.map((p) => id + "/" + p));
      if (error) throw error;
    }
    if ((m = path.match(/^\/api\/entries\/(\\d{4}-\\d{2}-\\d{2})\/journal$/))) {
      const d = m[1], journal = clean(body.journal, 12000);
      let entry;
      await mutate("entries", (entries) => {
        entry = entries.find((e) => e.date === d);
        if (!entry) throw missing("no entry for " + d);
        entry.journal = journal;
        entry.journal_updated_at = nowIso();
      });
      return { ok: true, date: d, journal: entry.journal, updated_at: entry.journal_updated_at };
    }
    if ((m = path.match(/^\/api\/entries\/(\\d{4}-\\d{2}-\\d{2})\/astro\/auto$/))) {
      const d = m[1], p = await profile(), birth = ownBirth(p);
      if (!birth) throw bad("Add your birth date in account settings before generating personal Astro tie-ins.");
      const day = (await getDoc("entries")).find((e) => e.date === d);
      if (!day || !day.cards || !day.cards.length) throw missing("No saved cards for " + d);
      const sky = window.TarotAstro.run(birth, d);
      const cards = await loadCards();
      const aspects = (sky.aspects || []).slice(0, 3);
      const moon = sky.moon || {};
      const astroLines = {};
      for (const drawn of day.cards) {
        const source = cards.find((c) => c.name.toLowerCase() === String(drawn.name).toLowerCase());
        const suit = source && source.arcana === "major" ? "a major-life theme" : source ? "a " + String(source.suit || "tarot").toLowerCase() + " theme" : "this card's theme";
        const lead = aspects.length ? aspects.map(x => x.transit + " " + x.aspect + " natal " + x.natal + " (" + x.orb + "°)").join("; ") : "no close natal aspects in the selected orb";
        astroLines[drawn.name] = "Personal chart context: Moon in " + (moon.sign || "an unknown sign") + " (" + (moon.phase || "phase unavailable") + "). " + (aspects.length ? "Notable transits: " + lead + ". " : "No close natal transits were found in this guide's orb. ") + "Reflection lens: read " + drawn.name + (drawn.orientation === "reversed" ? " reversed" : " upright") + " as " + suit + "; where does its traditional meaning meet the actual choices and circumstances of this date? This is a reflective association, not a prediction.";
      }
      const weave = "Day weave — The sky for this date places the Moon in " + (moon.sign || "an unavailable sign") + " during the " + (moon.phase || "unavailable") + " phase. " + (aspects.length ? "The closest natal contacts are " + aspects.map(x => x.transit + " " + x.aspect + " natal " + x.natal + " (" + x.orb + "°)").join(", ") + ". " : "No close natal contacts were identified in this guide's orb. ") + "Use the cards as prompts for observation, not as evidence that planetary positions caused events.";
      let saved;
      await mutate("entries", (entries) => {
        saved = entries.find((e) => e.date === d);
        if (!saved) throw missing("No entry for " + d);
        for (const c of saved.cards || []) c.astro = astroLines[c.name] || c.astro || null;
        saved.notes = [saved.notes, weave].filter(Boolean).join("\\n\\n");
        saved.astro_generated_at = nowIso();
      });
      await mutate("outbox", (ob) => { for (const o of ob) if (o.date === d && o.status === "pending_astro") { o.status = "done"; o.done_at = nowIso(); o.completed_by = "personal-chart-auto"; } });
      return { ok: true, date: d, entry: saved, sky };
    }
    if ((m = path.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})\/delete$/))) {
      const d = m[1]; let photos = [];
      await mutate("entries", (entries) => {
        const i = entries.findIndex((entry) => entry.date === d);
        if (i < 0) throw missing("no entry for " + d);
        photos = (entries[i].photos || []).slice(); entries.splice(i, 1);
      });
      await mutate("outbox", (ob) => {
        for (const rec of ob) if (rec.date === d && rec.kind === "self_photo") photos.push(...(rec.photos || []));
        return ob.filter((rec) => !(rec.date === d && (rec.kind === "self_draw" || rec.kind === "self_photo")));
      });
      await deletePrivatePhotos(photos);
      return { ok: true, date: d, deleted: true };
    }
    if ((m = path.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})\/cards\/delete$/))) {
      const d = m[1]; let removed;
      await mutate("entries", (entries) => {
        const day = entries.find((entry) => entry.date === d); if (!day) throw missing("no entry for " + d);
        const i = Number.isInteger(body.index) ? body.index : -1;
        const at = i >= 0 && i < day.cards.length && (!body.name || day.cards[i].name === body.name) ? i : day.cards.findIndex((card) => card.name === body.name && (!body.orientation || card.orientation === body.orientation));
        if (at < 0) throw missing("no matching card"); removed = day.cards.splice(at, 1)[0];
      });
      await mutate("outbox", (ob) => {
        for (const rec of ob) if (rec.date === d && rec.kind === "self_draw" && Array.isArray(rec.cards)) {
          let skipped = false;
          rec.cards = rec.cards.filter((card) => { if (!skipped && card.name === removed.name && card.orientation === removed.orientation) { skipped = true; return false; } return true; });
        }
        return ob.filter((rec) => !(rec.date === d && rec.kind === "self_draw" && (!rec.cards || !rec.cards.length)));
      });
      return { ok: true, date: d, deleted_card: removed.name };
    }
    if ((m = path.match(/^\/api\/guests\/([\w-]+)\/readings\/([\w-]+)\/delete$/))) {
      const gid = m[1], rid = m[2]; let photos = [], guestId;
      await mutate("guests", (guests) => {
        const guest = findGuest(guests, gid); guestId = guest.id;
        const at = (guest.readings || []).findIndex((reading) => reading.id === rid); if (at < 0) throw missing("no such reading");
        photos = (guest.readings[at].photos || []).slice(); guest.readings.splice(at, 1);
      });
      await mutate("outbox", (ob) => {
        for (const rec of ob) if (rec.kind === "guest_reading" && rec.guest_id === guestId && rec.reading_id === rid) photos.push(...(rec.photos || []));
        return ob.filter((rec) => !(rec.kind === "guest_reading" && rec.guest_id === guestId && rec.reading_id === rid));
      });
      await deletePrivatePhotos(photos);
      return { ok: true, guest_id: guestId, reading_id: rid, deleted: true };
    }
    if ((m = path.match(/^\/api\/guests\/([\w-]+)\/readings\/([\w-]+)\/cards\/delete$/))) {
      const gid = m[1], rid = m[2]; let removed, guestId;
      await mutate("guests", (guests) => {
        const guest = findGuest(guests, gid); guestId = guest.id;
        const reading = (guest.readings || []).find((item) => item.id === rid); if (!reading) throw missing("no such reading");
        const cards = reading.cards || [], i = Number.isInteger(body.index) ? body.index : -1;
        const at = i >= 0 && i < cards.length && (!body.name || cards[i].name === body.name) ? i : cards.findIndex((card) => card.name === body.name && (!body.orientation || card.orientation === body.orientation));
        if (at < 0) throw missing("no matching card"); removed = cards.splice(at, 1)[0];
      });
      await mutate("outbox", (ob) => {
        for (const rec of ob) if (rec.kind === "guest_reading" && rec.guest_id === guestId && rec.reading_id === rid && Array.isArray(rec.cards)) {
          let skipped = false;
          rec.cards = rec.cards.filter((card) => { if (!skipped && card.name === removed.name && card.orientation === removed.orientation) { skipped = true; return false; } return true; });
        }
      });
      return { ok: true, guest_id: guestId, reading_id: rid, deleted_card: removed.name };
    }
    if (path === "/api/practice/review") {
      const c = await practiceCard(body.card || body.id), rating = String(body.rating || "").toLowerCase();
      const r = await practiceMutate((p) => {
        const r = applyReview(p, c.id, String(body.orientation || "upright").toLowerCase(), rating, String(body.mode || "flashcard"));
        const pull = body.pullId != null && p.pulls.find((x) => x.id === body.pullId), idx = body.index;
        if (pull && Number.isInteger(idx) && idx >= 0 && idx < pull.cards.length && pull.cards[idx].id === c.id) pull.cards[idx].rating = rating;
        return r;
      });
      return { ok: true, card: c.id, review: r };
    }
    if (path === "/api/practice/pull") {
      const cards = await cleanPullCards(body.cards);
      const pull = { id: newId("pp"), date, mode: body.mode === "real" ? "real" : "virtual", spread: cards.length === 3 ? "ppf" : "one",
        reversals: body.reversals === undefined ? true : !!body.reversals, context: clean(body.context, 20) || "pick", cards, created_at: nowIso() };
      await practiceMutate((p) => { p.pulls.push(pull); });
      return { ok: true, pull };
    }
    if (path === "/api/practice/reading") {
      const cards = await cleanPullCards(body.cards, "note"), spread = clean(body.spreadId, 40);
      if (!spread) throw bad("spreadId required");
      const rd = { id: newId("pr"), date, spreadId: spread, spreadName: clean(body.spreadName, 80) || spread, question: clean(body.question, 300) || null,
        source: body.source === "real" ? "real" : "app", cards, overall: clean(body.overall, 4000) || null, created_at: nowIso() };
      await practiceMutate((p) => { p.readings.push(rd); });
      return { ok: true, reading: rd };
    }
    if (path === "/api/practice/lesson") {
      const lid = clean(body.id, 40); if (!/^[a-z0-9-]{1,40}$/.test(lid)) throw bad("lesson id required");
      const lessons = await practiceMutate((p) => { if (body.done === undefined || body.done) p.lessons[lid] = nowIso(); else delete p.lessons[lid]; return p.lessons; });
      return { ok: true, lessons };
    }
    if (path === "/api/practice/quiz") {
      const kind = clean(body.kind, 30) || "mixed", score = parseInt(body.score, 10), total = parseInt(body.total, 10);
      if (Number.isNaN(score) || Number.isNaN(total)) throw bad("score and total must be numbers");
      if (!(score >= 0 && score <= total && total <= 50)) throw bad("score/total out of range");
      const q = { at: nowIso(), date, kind, score, total };
      await practiceMutate((p) => { p.quizzes.push(q); p.quizzes = p.quizzes.slice(-500); });
      return { ok: true, quiz: q };
    }
    if (path === "/api/practice/day") {
      const dd = await practiceMutate((p) => { p.dailyDone = p.dailyDone || []; if (!p.dailyDone.includes(date)) p.dailyDone.push(date); return p.dailyDone; });
      return { ok: true, dailyDone: dd };
    }
    if (path === "/api/entries") {
      const rows = await parseCards(body);
      const labels = Array.isArray(body.spreadLabels) ? body.spreadLabels.map((x) => clean(x, 40)).slice(0, 12) : null;
      const it = body.intent && typeof body.intent === "object" && clean(body.intent.text, 300) ? { type: body.intent.type === "question" ? "question" : "intention", text: clean(body.intent.text, 300) } : null;
      const ex = body.cohesive && Array.isArray(body.cohesive.exclude) ? body.cohesive.exclude.map((x) => clean(x, 40)).filter(Boolean).slice(0, 20) : [];
      return { ok: true, date, ...(await savePersonal(date, rows, clean(body.note), labels, null, "", { intent: it, spread: clean(body.spread, 80) || null, cohesive: { exclude: ex } })) };
    }
    if ((m = path.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})\/astro$/))) {
      const d = m[1], cardAstro = body.cardAstro || {}; let weave = String(body.weave || "").trim();
      if (typeof cardAstro !== "object" || (!Object.keys(cardAstro).length && !weave)) throw bad("Provide cardAstro {cardName: text} and/or weave");
      let day;
      await mutate("entries", (entries) => {
        day = entries.find((e) => e.date === d); if (!day) throw missing(`no entry for ${d}`);
        const names = new Set((day.cards || []).map((c) => c.name.toLowerCase())), unknown = Object.keys(cardAstro).filter((n) => !names.has(n.toLowerCase()));
        if (unknown.length) throw bad(`Cards not on ${d}: ${unknown.join(", ")}`);
        for (const c of day.cards || []) for (const [n, t] of Object.entries(cardAstro)) if (n.toLowerCase() === c.name.toLowerCase() && String(t).trim()) c.astro = String(t).trim();
        if (weave) { if (!/^Day weave\s*[—:-]/.test(weave)) weave = "Day weave — " + weave; day.notes = [day.notes, weave].filter(Boolean).join("\n\n"); }
      });
      const closed = [];
      if ((day.cards || []).every((c) => c.astro)) await mutate("outbox", (ob) => { closed.length = 0; for (const o of ob) if (o.date === d && o.status === "pending_astro") { o.status = "done"; o.done_at = nowIso(); closed.push(o.id); } });
      return { ok: true, date: d, backup: null, outbox_done: closed, entry: day };
    }
    if (path === "/api/photos") {
      if (!body.photos || !body.photos.length) throw bad("Attach at least one photo");
      const tags = await parseCards(body, false, "physical deck"), paths = await savePhotos(body.photos, date);
      const rec = await addOutbox({ kind: "self_photo", date, photos: paths, cards: cardBrief(tags), note: clean(body.note) || null, status: "needs_identification" });
      return { ok: true, outbox: rec };
    }
    if ((m = path.match(/^\/api\/outbox\/([\w-]+)\/(done|resolve)$/))) {
      const [, oid, action] = m;
      const rec = (await getDoc("outbox")).find((r) => r.id === oid); if (!rec) throw missing("no such outbox id");
      if (action === "done") { let out; await mutate("outbox", (ob) => { out = ob.find((r) => r.id === oid); out.status = "done"; out.done_at = nowIso(); }); return { ok: true, record: out }; }
      if (rec.kind === "guest_reading") { const [g, r] = await resolveGuestReading(rec.guest_id, rec.reading_id, body); return { ok: true, guest_id: g.id, reading: r }; }
      if (rec.kind !== "self_photo") throw bad("Only self_photo / guest_reading records can be resolved; use /done for astro");
      if (rec.status === "resolved") throw new HttpErr(409, "already resolved");
      const rows = await parseCards(body, true, "physical deck");
      const res = await savePersonal(rec.date, rows, rec.note || "", null, rec.photos, clean(body.reading, 8000));
      let out; await mutate("outbox", (ob) => { out = ob.find((r) => r.id === oid); out.status = "resolved"; out.resolved_at = nowIso(); out.resolved_cards = cardBrief(rows); });
      return { ok: true, record: out, ...res };
    }
    if (path === "/api/guests") {
      const name = clean(body.name, 80); if (!name) throw bad("Name required");
      let out;
      await mutate("guests", (guests) => {
        const ex = guests.find((g) => g.name.toLowerCase() === name.toLowerCase());
        if (ex) { out = { ok: true, guest: ex, existing: true }; return; }
        let slug = slugify(name), n = 2; while (guests.some((g) => g.slug === slug)) slug = `${slugify(name)}-${n++}`;
        const g = { id: newId("g"), slug, name, note: clean(body.note, 600) || null, created_at: nowIso(), readings: [] };
        guests.push(g); out = { ok: true, guest: g };
      });
      return out;
    }
    if ((m = path.match(/^\/api\/guests\/([\w-]+)\/readings$/))) {
      const rows = await parseCards(body, false, "physical deck");
      const g0 = findGuest(await getDoc("guests"), m[1]);
      const photos = await savePhotos(body.photos, `guests/${g0.slug}`);
      if (!rows.length && !photos.length) throw bad("Add a photo or tag at least one card");
      const r = { id: newId("r"), date, question: clean(body.question, 300) || null, spread: clean(body.spread, 40) || null, photos,
        cards: cardBrief(rows, true), note: clean(body.note) || null, reading: null, status: "needs_reading", created_at: nowIso() };
      const gen = cleanGenerated(body.generated_reading); if (gen) r.generated_reading = gen;
      let g; await mutate("guests", (guests) => { g = findGuest(guests, m[1]); (g.readings = g.readings || []).push(r); });
      const rec = await addOutbox({ kind: "guest_reading", guest_id: g.id, guest_name: g.name, reading_id: r.id, date, photos, cards: cardBrief(rows), question: r.question, status: "needs_reading" });
      return { ok: true, guest_id: g.id, reading: r, outbox: rec };
    }
    if ((m = path.match(/^\/api\/guests\/([\w-]+)\/profile$/))) {
      const b = { date: clean(body.birth_date, 10) || null, time: clean(body.birth_time, 5) || null, place: clean(body.birth_place, 120) || null,
        lat: body.lat || null, lon: body.lon || null, tz: clean(body.tz, 60) || null };
      if (b.date && !DATE_RE.test(b.date)) throw bad("Birth date must be YYYY-MM-DD");
      if (b.time && !/^\d{1,2}:\d{2}$/.test(b.time)) throw bad("Birth time must be HH:MM");
      for (const k of ["lat", "lon"]) if (b[k] !== null) { b[k] = parseFloat(b[k]); if (Number.isNaN(b[k])) throw bad(`could not convert ${k} to a number`); }
      if (b.tz) { try { new Intl.DateTimeFormat("en-US", { timeZone: b.tz }); } catch (_) { throw bad(`No time zone found with key ${b.tz}`); } }
      let g;
      await mutate("guests", (guests) => {
        g = findGuest(guests, m[1]); g.birth = b; g.birth_name = clean(body.birth_name, 120) || null; delete g.sun_sign;
        const [birth] = guestBirth(g);
        try {
          if (birth) g.sun_sign = window.TarotAstro.run(birth, today()).natal.Sun.sign;
          else if (b.date) {
            const [y, mo, d] = b.date.split("-").map(Number);
            const signs = new Set([[0, 0], [23, 59]].map(([h, mi]) => window.TarotAstro.run({ y, m: mo, d, hour: h, minute: mi, tz: "UTC", lat: 0, lon: 0 }, today()).natal.Sun.sign));
            if (signs.size === 1) g.sun_sign = [...signs][0];
          }
        } catch (_) {}
      });
      return { ok: true, guest: g };
    }
    if ((m = path.match(/^\/api\/guests\/([\w-]+)\/insights$/))) {
      const kind = String(body.kind || ""); if (!["horoscope", "numerology"].includes(kind)) throw bad("kind must be horoscope or numerology");
      const text = clean(body.text, 12000); if (!text) throw bad("Nothing to save");
      const rec = { id: newId("i"), kind, date: today(), title: clean(body.title, 120) || kind[0].toUpperCase() + kind.slice(1), text, created_at: nowIso() };
      let g; await mutate("guests", (guests) => { g = findGuest(guests, m[1]); (g.insights = g.insights || []).push(rec); });
      return { ok: true, guest_id: g.id, insight: rec };
    }
    if ((m = path.match(/^\/api\/guests\/([\w-]+)\/readings\/([\w-]+)\/generated$/))) {
      const gen = cleanGenerated(body.generated_reading); if (!gen) throw bad("generated_reading with at least one card required");
      let g, r; await mutate("guests", (guests) => { g = findGuest(guests, m[1]); r = (g.readings || []).find((x) => x.id === m[2]); if (!r) throw missing("no such reading"); r.generated_reading = gen; });
      return { ok: true, guest_id: g.id, reading: r };
    }
    if ((m = path.match(/^\/api\/guests\/([\w-]+)\/readings\/([\w-]+)\/resolve$/))) { const [g, r] = await resolveGuestReading(m[1], m[2], body); return { ok: true, guest_id: g.id, reading: r }; }
    if (path === "/api/gaps/resolve") {
      const orient = String(body.orientation || "").toLowerCase();
      if (!["upright", "reversed", "unknown"].includes(orient)) throw bad("orientation must be upright, reversed or unknown (I don't remember)");
      const gap = (await getDoc("gaps")).find((x) => x.id === body.id);
      if (!gap) throw missing("no such gap"); if (gap.status !== "open") throw new HttpErr(409, "gap already resolved");
      const rows = await parseCards({ cards: [{ id: gap.card_id, name: gap.name, orientation: orient, source: gap.source || "unknown" }] }, true, "digital app", true);
      const res = await savePersonal(gap.date, rows);
      let out; await mutate("gaps", (gaps) => { out = gaps.find((x) => x.id === body.id); Object.assign(out, { status: "resolved", orientation: orient, resolved_at: nowIso() }); });
      return { ok: true, gap: out, ...res };
    }
    throw missing("not found");
  }

  async function SHARE(gid, rid, fmt, body) {
    const g = findGuest(await getDoc("guests"), gid), r = (g.readings || []).find((x) => x.id === rid);
    if (!r) throw missing("no such reading");
    const inc = body.include || {}, p = await profile(), withReading = inc.reading === undefined ? true : !!inc.reading;
    const blob = await renderShare({ fmt, guest: g.name, date: r.date, question: r.question, spread: r.spread,
      cards: (r.cards || []).map((c) => ({ name: c.name, orientation: c.orientation, position: c.position, img: c.img })),
      reading: withReading ? r.reading : null, generated: withReading ? r.generated_reading : null, note: inc.notes ? r.note : null,
      brand: (p.display || p.username) + "’s Tarot", birth: inc.birth ? (g.birth || {}).date : null, sun: inc.birth ? g.sun_sign : null });
    return new Response(blob, { status: 200, headers: { "Content-Type": fmt === "png" ? "image/png" : "application/pdf", "Content-Disposition": `attachment; filename="${slugify(g.name)}-${r.date}.${fmt}"` } });
  }

  async function rpc(fn, args) { const { data, error } = await sb.rpc(fn, args); if (error) throw bad(String(error.message || "Request failed").replace(/^["']|["']$/g, "")); return data; }
  async function SOCIAL(method, path, b) {
    await uid();
    if (method === "GET" && path === "/social/me") return rpc("social_me");
    if (method === "GET" && path === "/social/feed") return rpc("social_feed");
    if (method !== "POST") throw missing("not found");
    if (path === "/social/request") return { ok: true, status: await rpc("social_request", { p_username: b.username || "" }) };
    if (path === "/social/accept" || path === "/social/decline") { await rpc("social_respond", { p_username: String(b.username || "").toLowerCase(), p_accept: path.endsWith("accept") }); return { ok: true }; }
    if (path === "/social/unfriend") { await rpc("social_unfriend", { p_username: String(b.username || "").toLowerCase() }); return { ok: true }; }
    if (path === "/social/invite") return { ok: true, friend: await rpc("social_invite_accept", { p_token: String(b.token || "") }) };
    if (path === "/social/share") { await rpc("social_share", { p_kind: b.kind, p_ref: b.ref == null ? "" : String(b.ref), p_title: b.title || "", p_payload: b.payload || {} }); return { ok: true }; }
    if (path === "/social/unshare") { await rpc("social_unshare", { p_kind: b.kind, p_ref: String(b.ref) }); return { ok: true }; }
    throw missing("not found");
  }
  async function AUTH_STATUS() {
    const p = await profile(), b = p.birth;
    return { proxied: true, logged_in: true, user: p.username, display: p.display, owner: !!p.is_owner,
      birth: b && b.y ? `${String(b.y).padStart(4, "0")}-${pad(b.m)}-${pad(b.d)}` : null };
  }

  // ---------- fetch shim: same-origin /api, /social, /auth/status are answered here ----------
  const OFFLINE_OK = /^\/api\/(entries|today|gaps|guests|outbox|practice|astro\/today)$/;
  const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...extra } });
  const isNetErr = (e) => e instanceof TypeError || /Failed to fetch|NetworkError|Load failed|network/i.test(String(e && e.message));
  window.fetch = async (input, init = {}) => {
    let url; try { url = new URL(typeof input === "string" ? input : input.url, location.href); } catch (_) { return _fetch(input, init); }
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== location.origin || !(path.startsWith("/api/") || path.startsWith("/social/") || path === "/auth/status")) return _fetch(input, init);
    const method = String(init.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    let body = {};
    if (method === "POST" && init.body) { try { body = JSON.parse(init.body); } catch (_) { return json({ error: "bad json" }, 400); } if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "JSON object expected" }, 400); }
    const cacheKey = "tt-api-" + path;
    try {
      if (path === "/auth/status") return json(await AUTH_STATUS());
      if (path.startsWith("/social/")) return json(await SOCIAL(method, path, body));
      const sm = path.match(/^\/api\/guests\/([\w-]+)\/readings\/([\w-]+)\/share\.(png|pdf)$/);
      if (sm && method === "POST") return await SHARE(sm[1], sm[2], sm[3], body);
      const data = method === "GET" ? await GET(path) : await POST(path, body);
      if (method === "GET" && OFFLINE_OK.test(path)) { try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {} }
      return json(data);
    } catch (e) {
      if (e instanceof HttpErr) return json({ error: e.message, ...(e.extra || {}) }, e.status);
      if (isNetErr(e) && method === "GET" && OFFLINE_OK.test(path)) { const hit = localStorage.getItem(cacheKey); if (hit) return new Response(hit, { status: 200, headers: { "Content-Type": "application/json", "X-Tarot-Offline": "1" } }); }
      if (isNetErr(e)) throw new TypeError("Failed to fetch");
      if (e && (e.code === "PGRST301" || /JWT/.test(String(e.message)))) return json({ error: "login required" }, 401);
      console.error(e);
      return json({ error: String((e && e.message) || e) }, 500);
    }
  };

  // ---------- private files: /uploads/... and /journal.pdf become short-lived signed links ----------
  const signed = new Map();
  async function signedUrl(rel) {
    const hit = signed.get(rel); if (hit && hit.exp > Date.now()) return hit.url;
    const id = await uid();
    const { data, error } = await sb.storage.from("uploads").createSignedUrl(`${id}/${rel}`, 3600);
    if (error) return null;
    signed.set(rel, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 }); return data.signedUrl;
  }
  function privatePath(v) {
    if (!v) return null;
    try { const u = new URL(v, location.href); if (u.origin !== location.origin) return null;
      if (u.pathname.startsWith("/uploads/")) return decodeURIComponent(u.pathname.slice(1));
      if (u.pathname === "/journal.pdf" || u.pathname === "/Natalie-Tarot-Journal.pdf") return "journal.pdf";
    } catch (_) {}
    return null;
  }
  async function fix(el) {
    for (const attr of ["src", "href"]) {
      const rel = privatePath(el.getAttribute && el.getAttribute(attr)); if (!rel) continue;
      const u = await signedUrl(rel); if (u) el.setAttribute(attr, u);
    }
  }
  const scan = (root) => { if (root.nodeType !== 1) return; fix(root); root.querySelectorAll && root.querySelectorAll('[src^="/uploads/"],[href^="/uploads/"],[href$="journal.pdf"],[href$="Tarot-Journal.pdf"]').forEach(fix); };
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === "attributes") fix(m.target); else m.addedNodes.forEach(scan); } })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "href"] });
  document.addEventListener("DOMContentLoaded", () => scan(document.body));

  // ---------- log out (index.html's form posted to /logout on the old server) ----------
  document.addEventListener("submit", async (e) => {
    if (e.target && e.target.id === "logoutForm") { e.preventDefault(); await sb.auth.signOut(); try { for (const k of Object.keys(localStorage)) if (k.startsWith("tt-")) localStorage.removeItem(k); } catch (_) {} location.href = "/login"; }
  }, true);

  // not signed in -> login page (keeps the place you were going, e.g. a friend invite link)
  session().then((s) => { if (!s && !/^\/(login|signup)/.test(location.pathname)) location.replace("/login?next=" + encodeURIComponent(location.pathname + location.search + location.hash)); });
  window.TAROT_BACKEND = { sb, EMAIL_DOMAIN, renderShare, GET, POST };
})();
