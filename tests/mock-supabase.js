/* Test double for supabase-js used only by tests/e2e.py: an in-browser fake of the few Supabase calls backend.js and
   login.html make, kept in localStorage so reloads keep data. Seeded from window.MOCK_SEED (migration export). */
(() => {
  const LS = "mock-sb-db";
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)); } catch (_) { return null; } };
  let db = load();
  if (!db) {
    db = { users: [], profiles: [], docs: [], files: {}, friendships: [], requests: [], shares: [], session: null };
    const s = window.MOCK_SEED;
    if (s) {
      const id = "11111111-1111-1111-1111-111111111111";
      db.users.push({ id, email: "natalie@users.trustedtarot.app", password: "test-password-1" });
      db.profiles.push({ id, username: "natalie", display: s.profile.display, birth: s.profile.birth, is_owner: true, invite_token: "inv-natalie" });
      for (const [kind, data] of Object.entries(s.docs)) db.docs.push({ user_id: id, kind, data, updated_at: new Date().toISOString() });
    }
  }
  const save = () => localStorage.setItem(LS, JSON.stringify(db));
  save();
  const me = () => db.session && db.session.user.id;
  const listeners = [];
  const pub = (id) => { const p = db.profiles.find((x) => x.id === id); return p && { username: p.username, display: p.display || p.username }; };
  const friends = (a, b) => db.friendships.some((f) => (f[0] === a && f[1] === b) || (f[0] === b && f[1] === a));
  const befriend = (a, b) => { db.requests = db.requests.filter((r) => !((r.from === a && r.to === b) || (r.from === b && r.to === a))); if (!friends(a, b)) db.friendships.push([a, b]); };
  const byName = (u) => db.profiles.find((p) => p.username === String(u || "").trim().toLowerCase().replace(/^@/, ""));
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = "select"; this.one = null; this.ret = false; }
    select() { if (this.op !== "select") this.ret = true; return this; }
    eq(k, v) { this.f.push([k, v]); return this; }
    single() { this.one = "single"; return this; } maybeSingle() { this.one = "maybe"; return this; }
    insert(row) { this.op = "insert"; this.row = row; return this; }
    update(row) { this.op = "update"; this.row = row; return this; }
    rows() { const tbl = this.t === "docs" ? db.docs : db.profiles; return tbl.filter((r) => this.f.every(([k, v]) => String(r[k]) === String(v)) && (this.t !== "docs" || r.user_id === me()) && (this.t !== "profiles" || r.id === me())); }
    run() {
      if (!me()) return { data: null, error: { message: "JWT expired", code: "PGRST301" } };
      if (this.op === "insert") {
        if (this.row.user_id !== me()) return { error: { message: "rls" } };
        if (db.docs.some((r) => r.user_id === this.row.user_id && r.kind === this.row.kind)) return { error: { code: "23505", message: "dup" } };
        db.docs.push(JSON.parse(JSON.stringify(this.row))); save(); return { error: null };
      }
      if (this.op === "update") { const rs = this.rows(); rs.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(this.row)))); save(); return { data: rs.map((r) => ({ kind: r.kind })), error: null }; }
      const rs = JSON.parse(JSON.stringify(this.rows()));
      if (this.one === "single") return rs.length === 1 ? { data: rs[0], error: null } : { data: null, error: { message: "no rows" } };
      if (this.one === "maybe") return { data: rs[0] || null, error: null };
      return { data: rs, error: null };
    }
    then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  }
  const RPC = {
    username_available: (a) => !byName(a.p_username),
    social_me: () => ({ user: pub(me()), friends: db.profiles.filter((p) => friends(me(), p.id)).map((p) => pub(p.id)),
      incoming: db.requests.filter((r) => r.to === me()).map((r) => pub(r.from)), outgoing: db.requests.filter((r) => r.from === me()).map((r) => pub(r.to)),
      invite: db.profiles.find((p) => p.id === me()).invite_token, mine: db.shares.filter((s) => s.owner === me()).map((s) => ({ kind: s.kind, ref: s.ref })) }),
    social_feed: () => db.shares.filter((s) => friends(s.owner, me())).map((s) => ({ ...s, owner: pub(s.owner) })).reverse(),
    social_request: (a) => { const o = byName(a.p_username); if (!o || o.id === me()) throw new Error("No one with that username."); if (friends(me(), o.id)) return "already friends";
      if (db.requests.some((r) => r.from === o.id && r.to === me())) { befriend(me(), o.id); return "friends"; } db.requests.push({ from: me(), to: o.id }); return "requested"; },
    social_respond: (a) => { const o = byName(a.p_username); if (!o || !db.requests.some((r) => r.from === o.id && r.to === me())) throw new Error("No request from that person.");
      if (a.p_accept) befriend(me(), o.id); else db.requests = db.requests.filter((r) => !(r.from === o.id && r.to === me())); return null; },
    social_unfriend: (a) => { const o = byName(a.p_username); db.friendships = db.friendships.filter((f) => !(f.includes(me()) && f.includes(o && o.id))); return null; },
    social_invite_accept: (a) => { const o = db.profiles.find((p) => p.invite_token === a.p_token); if (!o || o.id === me()) throw new Error("That invite link isn’t valid."); befriend(me(), o.id); return pub(o.id); },
    social_share: (a) => { db.shares = db.shares.filter((s) => !(s.owner === me() && s.kind === a.p_kind && s.ref === a.p_ref)); db.shares.push({ id: Math.random().toString(16).slice(2, 14), owner: me(), kind: a.p_kind, ref: a.p_ref, title: a.p_title, payload: a.p_payload, at: new Date().toISOString().slice(0, 19) }); return null; },
    social_unshare: (a) => { db.shares = db.shares.filter((s) => !(s.owner === me() && s.kind === a.p_kind && s.ref === a.p_ref)); return null; },
  };
  const session = (u) => ({ access_token: "mock", user: { id: u.id, email: u.email } });
  window.supabase = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: db.session } }),
      onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async ({ email, password }) => { const u = db.users.find((x) => x.email === email && x.password === password); if (!u) return { error: { message: "Invalid login credentials" } }; db.session = session(u); save(); return { data: { session: db.session }, error: null }; },
      signUp: async ({ email, password, options }) => { if (db.users.some((x) => x.email === email)) return { error: { message: "User already registered" } };
        const id = crypto.randomUUID(), m = options.data; db.users.push({ id, email, password });
        const b = m.birth && /^\d{4}-\d{2}-\d{2}$/.test(m.birth) ? { y: +m.birth.slice(0, 4), m: +m.birth.slice(5, 7), d: +m.birth.slice(8, 10) } : null;
        db.profiles.push({ id, username: m.username, display: m.display, birth: b, is_owner: false, invite_token: "inv-" + m.username });
        db.session = session({ id, email }); save(); return { data: { session: db.session }, error: null }; },
      signOut: async () => { db.session = null; save(); listeners.forEach((cb) => cb("SIGNED_OUT", null)); return { error: null }; },
    },
    from: (t) => new Q(t),
    rpc: async (fn, args = {}) => { if (!me() && fn !== "username_available") return { data: null, error: { message: "JWT" } };
      try { const data = RPC[fn](args); save(); return { data, error: null }; } catch (e) { return { data: null, error: { message: e.message } }; } },
    storage: { from: () => ({
      upload: async (path, bytes, o) => { if (!path.startsWith(me() + "/")) return { error: { message: "rls" } }; let s = ""; bytes.forEach((b) => (s += String.fromCharCode(b))); db.files[path] = { type: o.contentType, b64: btoa(s) }; save(); return { data: { path }, error: null }; },
      createSignedUrl: async (path) => { const f = db.files[path]; if (!f || !path.startsWith(me() + "/")) return { error: { message: "not found" } }; return { data: { signedUrl: `data:${f.type};base64,${f.b64}` }, error: null }; },
    }) },
  }) };
})();
