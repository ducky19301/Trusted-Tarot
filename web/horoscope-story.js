/* Horoscope story, told by Astro in plain words. Every sentence comes from the phrase bank below and is tied to a computed fact
   (astro.js / astro_engine.py output). Nothing is invented. AI polish: off (not built). Dos and don'ts are picked from
   several written variants per transit, never reusing a variant within 14 days and never repeating yesterday's list. */
(() => {
  "use strict";
  // natal side (yours) and transit side (today's sky), in plain words
  const PLAN = { Sun: "your sense of self", Moon: "your feelings", Mercury: "how you think and talk", Venus: "your love life and money", Mars: "your drive and temper",
    Jupiter: "your chances to grow", Saturn: "your duties and limits", Uranus: "your need for freedom", Neptune: "your imagination", Pluto: "your sense of control",
    ASC: "the way you come across", MC: "your work and reputation" };
  const TPLAN = { Sun: "the things you focus on", Mercury: "conversations and messages", Venus: "love and money", Mars: "effort and anger", Jupiter: "openings and offers",
    Saturn: "duties and delays", Uranus: "sudden changes", Neptune: "uncertainty and imagination", Pluto: "pressure to change" };
  const HOUSE = { 1: "yourself and your body", 2: "money and self-worth", 3: "messages, siblings and short trips", 4: "home and family", 5: "creativity, fun and romance", 6: "work routines and health",
    7: "partners and one-to-one relationships", 8: "shared money, intimacy and change", 9: "learning, travel and beliefs", 10: "career and reputation", 11: "friends, groups and hopes", 12: "rest and time alone" };
  const MOON_SIGN = { Aries: "quick and impatient", Taurus: "steady and in need of comfort", Gemini: "curious and talkative", Cancer: "tender and homesick", Leo: "playful and keen to be noticed",
    Virgo: "tidy and practical", Libra: "sociable and keen to keep the peace", Scorpio: "intense and private", Sagittarius: "restless and hopeful", Capricorn: "serious and focused on getting things done",
    Aquarius: "detached and independent", Pisces: "dreamy and sensitive" };
  const PHASE = { "New Moon": "setting one intention", "Waxing Crescent": "taking a first step", "First Quarter": "pushing through something that's stuck", "Waxing Gibbous": "adjusting what you've started",
    "Full Moon": "seeing results and letting go", "Waning Gibbous": "sharing what you've learned and saying thank you", "Last Quarter": "dropping what isn't working", "Waning Crescent": "resting and looking back" };
  const NICE = { ASC: "Ascendant", MC: "Midheaven" };
  const ordn = (n) => n + ((n % 100 >= 10 && n % 100 <= 20) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"));
  const fam = (a) => (a.angle === 60 || a.angle === 120 ? "soft" : a.angle === 90 || a.angle === 180 ? "hard" : "conj");
  // story sentences (plain, no metaphors). {T}=transit planet theme, {N}=natal theme, {H}=house topic
  const BANK = {
    open: ["{name}, it's {day}, and here's what I see for you today.", "{name}, here's your {day}.", "Good morning, {name}. It's {day}, and this is your day as I read it."],
    moon: ["Today you're likely to feel {mood}. The Moon is in {sign}, and tradition reads that sign that way.", "Expect to feel {mood} today; the Moon is in {sign}.",
      "The Moon is in {sign} today, and tradition says people feel {mood} when it is."],
    phase: ["The Moon is at its {phase} phase, which tradition treats as a good time for {act}.", "It's the {phase} phase of the Moon, so {act} is worth your time today.", "In this {phase} phase, put your effort into {act}."],
    soft: ["Today {T} work in favour of {N}, so things there should go more smoothly than usual.", "Today {T} help {N}. If you've been waiting to act on it, today is a good day.",
      "There's an easy connection today, with {T} on one side and {N} on the other. Use it while it lasts."],
    hard: ["Today {T} put pressure on {N}. Expect some friction there, and give yourself extra time.", "There's tension today, with {T} on one side and {N} on the other. It's not a bad day, but slow down and choose carefully.",
      "Today {T} clash with {N}. You'll probably feel it as stress; deal with it directly instead of putting it off."],
    conj: ["Today {T} land right on {N}, so that part of your life is hard to ignore.", "Today {T} meet {N}, and that becomes the main thing going on.", "{T} are focused on {N} today. Give it your attention."],
    house: ["Where it shows up most: {H}.", "You'll notice it most around {H}.", "This mostly touches {H}."],
    quiet: ["There are no close transits to your chart today, so it's a simple day. Keep your plans small and steady.", "Nothing major is touching your chart today. It's a good day for ordinary things."],
    close: ["That's what I see. The positions are real; the meanings are tradition, for you to weigh.", "That's your day. Take what's useful and leave the rest; the planets are real, the meanings are tradition."],
  };
  // dos/don'ts: several written variants per transit planet and family
  const DO = {
    Sun: ["Let people see your work today.", "Say what you want out loud.", "Put yourself forward for something.", "Take credit for something you did well.", "Do one thing today just because you enjoy it.", "Wear something that makes you feel like yourself."],
    Moon: ["Check in with how you feel before you decide.", "Eat and sleep on time today.", "Spend time with someone who makes you feel safe.", "Make your home a bit more comfortable tonight.", "Give yourself a quiet evening.", "Call family or an old friend.", "Write down what's on your mind before bed."],
    Mercury: ["Send the message you've been drafting.", "Have the conversation you've been putting off.", "Write down your plan for the week.", "Ask the question directly.", "Make the phone call instead of emailing.", "Double-check dates and times.", "Sort out one bit of admin."],
    Venus: ["Reach out to someone you care about.", "Spend a little time on something beautiful.", "Tell someone what you appreciate about them.", "Look at your budget calmly.", "Plan a small treat with someone you like.", "Say something kind to someone today.", "Make your space a little nicer."],
    Mars: ["Put your energy into one concrete task.", "Exercise or move your body hard today.", "Start the job you've been avoiding.", "Finish one physical task completely.", "Stand up for yourself calmly if you need to.", "Get the hardest task done first.", "Take a brisk walk when you feel tense."],
    Jupiter: ["Say yes to an opportunity.", "Ask for something you want.", "Apply for or sign up for the thing you've been considering.", "Learn something new today.", "Talk to someone who knows more than you.", "Think about a bigger goal for the year.", "Be generous with your time."],
    Saturn: ["Do steady, careful work; it will hold.", "Make a schedule and keep to it.", "Finish something you committed to.", "Set one clear limit.", "Tackle the boring job you keep putting off.", "Check your savings or a long-term plan.", "Keep one promise you made to yourself."],
    Uranus: ["Try one new way of doing a routine task.", "Change one small habit.", "Say yes to an unplanned invitation.", "Leave room for a change of plan.", "Talk to someone outside your usual circle.", "Rearrange one thing in your space.", "Try a new route or a new place."],
    Neptune: ["Make time for art, music or rest.", "Write down a dream or an idea before it fades.", "Spend some quiet time alone.", "Do something kind without telling anyone.", "Listen to music you love.", "Take a walk somewhere peaceful.", "Give your eyes a break from screens."],
    Pluto: ["Take back control of one small thing.", "Clear out something you don't need.", "Be honest with yourself about one thing you've avoided.", "Have the honest talk you need to have.", "Let go of one thing you've outgrown.", "Look at where your money really goes.", "Say no to something that drains you."],
  };
  const DONT = {
    Sun: ["Don't push your will on other people.", "Don't take every comment personally.", "Don't try to be in charge of everything.", "Don't hide what you've done well.", "Don't wait for someone else to give you permission.", "Don't let pride stop you asking for help.", "Don't talk over people."],
    Moon: ["Don't make big decisions while you're upset.", "Don't skip meals or sleep.", "Don't assume others know how you feel.", "Don't bottle things up all day.", "Don't take on everyone else's moods.", "Don't eat or shop to calm down.", "Don't stay in a room that's making you tense."],
    Mercury: ["Don't send anything in a hurry; read it again first.", "Don't sign anything you haven't read.", "Don't argue by text.", "Don't assume you were understood; check.", "Don't promise a quick answer.", "Don't overbook your day.", "Don't gossip about someone who isn't there."],
    Venus: ["Don't buy something just to feel better.", "Don't agree to things only to keep the peace.", "Don't compare your relationship with others'.", "Don't ignore what you actually want.", "Don't overspend on other people to please them.", "Don't let one bad moment spoil a good evening.", "Don't hint; ask."],
    Mars: ["Don't pick fights.", "Don't rush; mistakes are more likely today.", "Don't drive or work angry.", "Don't take on more than you can finish.", "Don't lift or move things carelessly.", "Don't make it a competition.", "Don't answer anger with anger."],
    Jupiter: ["Don't over-promise.", "Don't overspend.", "Don't say yes to everything at once.", "Don't assume it'll all work out without a plan.", "Don't eat or drink more than you meant to.", "Don't stretch a deadline you know is tight.", "Don't lecture people."],
    Saturn: ["Don't treat a delay as a failure.", "Don't be harder on yourself than the situation calls for.", "Don't give up on a plan because it's slow.", "Don't take on extra work you can't do well.", "Don't put off a duty one more day.", "Don't decide you're behind; just take the next step.", "Don't let worry stop you starting."],
    Uranus: ["Don't drop a plan on a sudden urge.", "Don't quit anything today without sleeping on it.", "Don't make sudden money moves.", "Don't break something just to feel free.", "Don't ignore a sudden good idea either; write it down.", "Don't be rude to make a point.", "Don't change plans without telling the people involved."],
    Neptune: ["Don't sign or decide when things feel unclear.", "Don't ignore facts you'd rather not see.", "Don't lend money you need back.", "Don't believe everything you hear today.", "Don't try to rescue someone who hasn't asked.", "Don't lose the day to daydreams.", "Don't drink to switch off."],
    Pluto: ["Don't try to control other people.", "Don't hold on to something out of fear.", "Don't start a power struggle.", "Don't keep secrets that will hurt later.", "Don't go through someone else's things.", "Don't hold a grudge all day.", "Don't make threats, even as a joke."],
  };
  // plain everyday tips, used (and labelled "general tip") when today's planet has used up its variants in the last 14 days
  const GEN = {
    dos: ["Drink some water and step outside for ten minutes.", "Reply to one message you've left waiting.", "Tidy one small space.", "Go to bed half an hour earlier.",
      "Call someone you haven't talked to in a while.", "Write down three things you got done.", "Take a proper lunch break.", "Walk somewhere instead of driving, if you can.",
      "Cook something simple for yourself.", "Pick one task and finish it before lunch.", "Thank someone who helped you recently.", "Read for twenty minutes.",
      "Put your phone away for an hour.", "Check your calendar for the rest of the week.", "Stretch for five minutes.", "Ask a friend how they're really doing.",
      "Pay one bill or sort one bit of paperwork.", "Listen more than you talk in one conversation.", "Plan one thing to look forward to this week.", "Clear your inbox of one thing that's bothering you."],
    donts: ["Don't stay up late scrolling.", "Don't skip lunch.", "Don't say yes before you've checked your calendar.", "Don't leave the hard task until last.",
      "Don't reply when you're tired and cross.", "Don't spend money you haven't planned to.", "Don't make promises you'll resent.", "Don't compare your day with someone's posts.",
      "Don't gossip.", "Don't let small chores pile up.", "Don't cancel on someone at the last minute.", "Don't work through every break.",
      "Don't argue about something that won't matter next week.", "Don't ignore a message you need to answer.", "Don't buy anything big on impulse.", "Don't rush your morning.",
      "Don't take on someone else's job as well as your own.", "Don't assume the worst about a short reply.", "Don't drink too much coffee.", "Don't keep going when you need a rest."],
  };
  const BANNED = ["journey", "navigate", "embrace", "energy shift", "the universe", "cosmic", "manifest", "vibration", "tapestry", "delve", "unlock", "in this practice", "align with", "dance", "whisper", "celestial", "stars are telling", "destiny", "fate", "magic", "this means that", "additionally", "moreover", "furthermore", "it's important to note", "boundless", "realm", "beacon", "unleash"];

  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const dayLabel = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

  function pickVariant(list, seed) { return list[hash(seed) % list.length]; }
  // history: [{date, dos:[keys], donts:[keys]}]
  function chooseTips(aspects, date, user, history = []) {
    const recent = history.filter((h) => { const d = daysBetween(h.date, date); return d > 0 && d <= 14; });
    const used = new Set(recent.flatMap((h) => [...(h.dos || []), ...(h.donts || [])]));
    const yesterday = history.find((h) => daysBetween(h.date, date) === 1);
    const out = { dos: [], donts: [] }, keys = { dos: [], donts: [] };
    const fallback = { dos: ["Mercury", "Saturn", "Venus", "Mars", "Jupiter", "Sun", "Neptune", "Moon"], donts: ["Mercury", "Mars", "Venus", "Saturn", "Moon", "Jupiter", "Neptune", "Sun"] };
    const wants = [];
    for (const a of aspects.slice(0, 7)) {
      if (!DO[a.transit]) continue;
      const f = fam(a), soft = f === "soft" || (f === "conj" && ["Jupiter", "Venus", "Sun"].includes(a.transit));
      wants.push({ kind: soft ? "dos" : "donts", planet: a.transit, fact: `${a.transit}-${a.angle}-${a.natal}` });
    }
    // keep the list at 3 of each: fill from other planets (labelled as general tips) when today's transits give fewer
    for (const kind of ["dos", "donts"]) {
      const have = wants.filter((w) => w.kind === kind);
      for (const p of fallback[kind]) { if (have.length >= 3) break; if (!have.some((w) => w.planet === p)) have.push({ kind, planet: p, fact: null }); }
      for (const w of have.slice(0, 3)) {
        const bank = kind === "dos" ? DO[w.planet] : DONT[w.planet];
        const start = hash(`${user}|${date}|${w.planet}|${kind}`) % bank.length;
        let chosen = null, general = !w.fact;
        for (let k = 0; k < bank.length; k++) { const idx = (start + k) % bank.length, key = `${kind}:${w.planet}:${idx}`; if (!used.has(key) && !keys[kind].includes(key)) { chosen = { key, text: bank[idx] }; break; } }
        if (!chosen) { const g = GEN[kind], gs = hash(`${user}|${date}|gen|${kind}|${out[kind].length}`) % g.length;
          for (let k = 0; k < g.length; k++) { const idx = (gs + k) % g.length, key = `${kind}:gen:${idx}`; if (!used.has(key) && !keys[kind].includes(key)) { chosen = { key, text: g[idx] }; general = true; break; } } }
        if (!chosen) { const B = kind === "dos" ? DO : DONT;
          outer: for (const p of Object.keys(B)) for (let idx = 0; idx < B[p].length; idx++) { const key = `${kind}:${p}:${idx}`; if (!used.has(key) && !keys[kind].includes(key)) { chosen = { key, text: B[p][idx] }; general = true; break outer; } } }
        if (!chosen) { const idx = start, key = `${kind}:${w.planet}:${idx}`; chosen = { key, text: bank[idx] }; }
        keys[kind].push(chosen.key); used.add(chosen.key);
        out[kind].push({ text: chosen.text, fact: general ? null : w.fact, general });
      }
    }
    // never the same list two days running: yesterday's keys are inside the 14-day window above, so they are never picked again
    return { ...out, keys };
  }

  function compose(h, { name = "", user = "me", history = [] } = {}) {
    const date = h.date, paras = [], v0 = { name, day: dayLabel(date) };
    const seed = (k) => `${user}|${date}|${k}`;
    const P = (text, facts, source = "tradition") => ({ text, facts, source });
    paras.push(P(name ? fill(pickVariant(BANK.open, seed("open")), v0) : `It's ${v0.day}, and here's what I see for you today.`, ["date"], "engine"));
    const mood = MOON_SIGN[h.moon.sign], act = PHASE[h.moon.phase];
    paras.push(P(`${fill(pickVariant(BANK.moon, seed("moon")), { mood, sign: h.moon.sign })} ${fill(pickVariant(BANK.phase, seed("phase")), { phase: h.moon.phase.toLowerCase().replace(" moon", ""), act })}`, ["moon.sign", "moon.phase"]));
    const asp = (h.aspects || []).filter((a) => !(["Uranus", "Neptune", "Pluto"].includes(a.transit) && ["Uranus", "Neptune", "Pluto"].includes(a.natal))).slice(0, 4);
    const seenH = new Set();
    if (!asp.length) paras.push(P(pickVariant(BANK.quiet, seed("quiet")), ["aspects.none"]));
    for (const a of asp) {
      const f = fam(a), house = h.transits && h.transits[a.transit] && h.transits[a.transit].house;
      let s = cap(fill(pickVariant(BANK[f], seed(a.transit + a.natal)), { T: TPLAN[a.transit], N: PLAN[a.natal] }));
      if (house && !seenH.has(house)) seenH.add(house), s += " " + fill(pickVariant(BANK.house, seed("h" + a.transit)), { H: HOUSE[house] });
      paras.push(P(s, [`${a.transit}-${a.angle}-${a.natal}`], f === "conj" ? "tradition" : "ptolemy"));
    }
    paras.push(P(pickVariant(BANK.close, seed("close")), [], "app"));
    const tips = chooseTips(h.aspects || [], date, user, history);
    const details = asp.map((a) => ({ id: `${a.transit}-${a.angle}-${a.natal}`, text: `${a.transit}${a.retro ? " (retrograde)" : ""} ${a.aspect} natal ${NICE[a.natal] || a.natal}, orb ${a.orb}°, ${a.applying ? "applying" : "separating"}${h.transits && h.transits[a.transit] ? ` · ${h.transits[a.transit].pos}` : ""}${h.transits && h.transits[a.transit] && h.transits[a.transit].house ? ` · your ${ordn(h.transits[a.transit].house)} house` : ""}` }));
    return { date, paragraphs: paras, dos: tips.dos, donts: tips.donts, tipKeys: tips.keys, details, noTime: !h.has_time };
  }
  function bannedIn(text) { const t = text.toLowerCase(); return BANNED.filter((b) => t.includes(b)); }

  const HKEY = "tt.horoscope.tips.v1";
  const hist = { get(user) { try { return (JSON.parse(localStorage.getItem(HKEY) || "{}")[user] || []); } catch (e) { return []; } },
    put(user, date, keys) { try { const all = JSON.parse(localStorage.getItem(HKEY) || "{}"); const l = (all[user] || []).filter((x) => x.date !== date); l.push({ date, ...keys }); all[user] = l.slice(-30); localStorage.setItem(HKEY, JSON.stringify(all)); } catch (e) { /* ignore */ } } };

  const api = { GEN, TPLAN, compose, chooseTips, bannedIn, BANK, DO, DONT, BANNED, PLAN, HOUSE, hist };
  if (typeof window !== "undefined") window.HoroscopeStory = api;
  if (typeof module !== "undefined") module.exports = api;
})();
