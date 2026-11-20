/* Horoscope tab: Today (Astro's story) | Learn to read charts | My chart. No outside links here except at the bottom of Learn more. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const HS = () => window.HoroscopeStory, LU = () => window.LearnUI, LD = () => window.LEARN_DATA;
  const JORDAN = { y: 1992, m: 7, d: 14, hour: 15, minute: 20, tz: "America/Los_Angeles", lat: 45.5152, lon: -122.6784 }; // made-up sample person, real computation
  const V = { view: "today", h: null, sample: false, name: "", birthDate: null, fullName: "", entries: [] };
  const ordn = (n) => n + ((n % 100 >= 10 && n % 100 <= 20) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"));


  const PLANET_GUIDE = {
    Sun:["identity, vitality, conscious purpose and creative direction","build confidence through chosen values and meaningful work","needing approval or treating one role as your entire identity","What do I want to stand for when nobody is watching?"],
    Moon:["emotional needs, memory, habits, instinct and nourishment","name needs clearly and build routines that restore you","reacting automatically or expecting others to guess what you need","What helps me feel safe, and what is a habit rather than a true need?"],
    Mercury:["thinking, language, learning, listening and exchange","ask clear questions and communicate with curiosity","overthinking, rushing to conclusions or talking past people","How do I learn best, and how do I check that I have understood?"],
    Venus:["affection, attraction, values, pleasure, beauty and reciprocity","show care while keeping self-respect and clear values","people-pleasing, spending to soothe feelings or avoiding honest disagreement","What do I value, and how do I give and receive affection?"],
    Mars:["action, desire, initiative, anger, courage and boundaries","act directly while respecting consent and other people's limits","reactivity, conflict for its own sake or suppressing anger until it erupts","How can I assert a need without overriding someone else?"],
    Jupiter:["growth, faith, teaching, meaning, opportunity and generosity","stay open while checking facts and making sustainable plans","overpromising, excess or confusing confidence with certainty","Where can I grow without losing discernment?"],
    Saturn:["time, responsibility, boundaries, discipline, craft and maturity","build competence through patient effort and fair standards","fear, rigidity, shame or believing rest must be earned","Where can structure support me without becoming punishment?"],
    Uranus:["independence, disruption, invention, liberation and experimentation","make room for originality and change with thoughtful timing","impulsive rupture or rejecting support to prove independence","Where do I need freedom, and what responsibilities remain?"],
    Neptune:["imagination, ideals, empathy, spirituality, art and blurred boundaries","use imagination compassionately while keeping clear agreements","idealizing people, avoidance or treating intuition as proof","What inspires me, and what facts or boundaries should I check?"],
    Pluto:["power, control, compulsion, endings, renewal and deep change","face difficult truths and use influence responsibly","all-or-nothing thinking, control struggles or refusing to release what harms you","Where can I choose honesty over control?"]
  };
  const SIGN_GUIDE = {
    Aries:["direct, initiating, courageous and fast-moving","impatience or acting before listening"],Taurus:["steady, sensory, loyal and resource-conscious","stubbornness or staying with comfort after it stops helping"],
    Gemini:["curious, verbal, adaptable and connective","scattered attention or avoiding depth through distraction"],Cancer:["protective, receptive, nurturing and memory-rich","defensiveness or indirect communication of needs"],
    Leo:["expressive, warm, creative and generous","pride or needing constant recognition"],Virgo:["observant, practical, discerning and service-oriented","perfectionism, worry or excessive criticism"],
    Libra:["relational, diplomatic, aesthetic and fairness-seeking","indecision or people-pleasing to avoid disagreement"],Scorpio:["intense, investigative, loyal and perceptive","suspicion, control or all-or-nothing reactions"],
    Sagittarius:["exploratory, candid, philosophical and hopeful","restlessness, overstatement or weak follow-through"],Capricorn:["strategic, patient, responsible and ambitious","rigidity or measuring worth only through achievement"],
    Aquarius:["independent, inventive, systemic and community-minded","detachment or contrarianism that overlooks feelings"],Pisces:["imaginative, compassionate, receptive and intuitive","porous boundaries, avoidance or idealizing situations"]
  };
  const HOUSE_GUIDE = {1:"self-presentation, body, approach and beginnings",2:"resources, income, possessions, skills and self-worth",3:"communication, siblings, local movement and everyday learning",4:"home, family, roots and private foundations",5:"creativity, play, romance and self-expression",6:"work routines, service, maintenance and health habits",7:"partnership, agreements and one-to-one encounters",8:"shared resources, debt, intimacy, trust and transitions",9:"higher learning, ethics, beliefs and long-distance travel",10:"vocation, public role, responsibility and reputation",11:"friends, networks, groups and collective aims",12:"rest, retreat, solitude, institutions and hidden processes"};
  const CHART_RULER = {Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"};
  function natalAspects(natal) {
    const names=Object.keys(natal||{}).filter(k=>natal[k]&&Number.isFinite(Number(natal[k].lon))),out=[],angles=[[0,"conjunction"],[60,"sextile"],[90,"square"],[120,"trine"],[180,"opposition"]];
    for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){const a=natal[names[i]],b=natal[names[j]],sep=Math.abs((((Number(a.lon)-Number(b.lon))+540)%360)-180);for(const [angle,label] of angles){const orb=Math.abs(sep-angle);if(orb<=6)out.push({a:names[i],b:names[j],label,orb:+orb.toFixed(2)});}}
    return out.sort((a,b)=>a.orb-b.orb);
  }
  function chartGuideHTML(h) {
    const n=h.natal||{},placements=Object.entries(n).filter(([k])=>PLANET_GUIDE[k]);
    const cards=placements.map(([k,x])=>{const p=PLANET_GUIDE[k],sg=SIGN_GUIDE[x.sign]||["a distinct symbolic style","a possible stress expression"],house=x.house?HOUSE_GUIDE[x.house]:"house unavailable because birth time is not recorded",ord=x.house?x.house+(x.house===1?"st":x.house===2?"nd":x.house===3?"rd":"th"):"";
      return `<details class="astro-detail"><summary><b>${esc(k)} in ${esc(x.sign)}</b><span>${esc(x.pos||"")}${ord?" · "+ord+" house":""}</span></summary>
        <p><b>What this planet means:</b> ${esc(p[0])}.</p><p><b>Your sign's style:</b> ${esc(sg[0])}. A possible stress expression is ${esc(sg[1])}.</p>
        <p><b>Your house:</b> ${esc(house)}. This is the life area where this planet's symbolism is emphasized.</p><p><b>Mature expression:</b> ${esc(p[1])}.</p>
        <p><b>Watch for:</b> ${esc(p[2])}.</p><p><b>Reflection:</b> ${esc(p[3])}</p></details>`;}).join("");
    const angles=Object.entries(n).filter(([k])=>["ASC","MC"].includes(k)).map(([k,x])=>`<details class="astro-detail"><summary><b>${k==="ASC"?"Ascendant":"Midheaven"} · ${esc(x.sign)}</b><span>${esc(x.pos||"")}</span></summary><p>${k==="ASC"?"The Ascendant marks the eastern horizon. In astrology it describes approach, presentation and first response; its traditional ruler is the chart ruler.":"The Midheaven marks the upper meridian. In astrology it is used for public direction, vocation, responsibility and visibility."}</p></details>`).join("");
    const ruler=n.ASC&&CHART_RULER[n.ASC.sign],asp=natalAspects(n),aspectHTML=asp.length?asp.slice(0,24).map(a=>`<li><b>${esc(a.a)} ${esc(a.label)} ${esc(a.b)}</b> · ${a.orb}° orb. ${a.orb<=2?"Very close in this guide's 6° major-aspect rule.":"Within the guide's 6° major-aspect rule."}</li>`).join(""):"<li>No major natal aspects fell within this guide's 6° orb.</li>";
    const life=[["Personality and identity","Start with Sun, Moon, Ascendant and chart ruler. Combine conscious direction, emotional needs and outward approach; no single placement is the whole personality."],["Everyday life","Read Mercury, Mars, Moon and the sixth house for communication, energy, emotional rhythms and routines. Translate the symbolism into habits you can actually observe."],["What others may see","Read the Ascendant, first-house planets and planets close to the ASC or MC. This describes an astrological presentation theme, not what every person thinks of you."],["Private self and home","Read the Moon, fourth house, IC and their rulers. Explore privacy, roots and emotional replenishment without assuming a particular family history."],["Love and intimacy","Read Venus, Mars, Moon, fifth and seventh houses, Descendant and their rulers. Consider affection, desire, emotional safety, boundaries and repair."],["Work, purpose and money","Read the MC and tenth house for public direction, sixth for routines, second for personal resources and eighth for shared resources. Include Saturn, Jupiter and the relevant rulers."],["Maturity, downfalls and watch-fors","For each placement, distinguish a strength from its possible overuse. A chart does not prove trauma, illness, a past event or an unavoidable flaw."],["Dos and donts","Do use placements to ask specific questions, notice patterns and choose practical skills. Do not use a chart to excuse harm, diagnose yourself, make a major decision from fear or treat a symbolic reading as certainty."],["Happiness and fulfillment","Use the fifth, ninth and eleventh houses, Venus, Jupiter and the Sun to explore joy, creativity, meaning and community. Test every idea against your values and lived experience."]];
    const lifeHTML=life.map(([t,b])=>`<details class="astro-detail"><summary><b>${esc(t)}</b></summary><p>${esc(b)}</p></details>`).join("");
    return `<section class="astro-study-block"><h3>Every placement in your chart</h3><p class="muted">Each interpretation combines the planet's function, the sign's style and the house's life area. These are astrological traditions and reflection prompts, not scientifically established personality facts.</p><p><b>Traditional chart ruler:</b> ${esc(ruler||"Unavailable without a timed Ascendant")}. It is the traditional ruler of your Ascendant sign.</p>${angles}${cards}</section>
      <section class="astro-study-block"><h3>Major aspects in your birth chart</h3><p>Calculated from the natal longitudes above. This guide shows major aspects within a 6° orb and lists the closest first; different schools use different orbs.</p><ul>${aspectHTML}</ul></section>
      <section class="astro-study-block"><h3>What this can mean across your life</h3>${lifeHTML}</section>`;
  }
  const COMPAT_GUIDE = {
    Aries:"Good potential: directness, momentum and shared adventure. Friction: impatience or turning disagreement into a contest. Best style: honest, active and independent, with clear repair after conflict. Hardest style: controlling or chronically reactive. Love them through direct appreciation, respect for autonomy and reliable follow-through.",
    Taurus:"Good potential: loyalty, steadiness, sensuality and practical care. Friction: stubbornness or different appetites for change. Best style: secure, affectionate and consistent. Hardest style: possessive or emotionally avoidant. Love them through dependable actions, shared comfort and honest conversations about money and values.",
    Gemini:"Good potential: humor, conversation, curiosity and mental stimulation. Friction: inconsistency or using wit to dodge vulnerable topics. Best style: playful but emotionally accountable. Hardest style: dismissive or chronically ambiguous. Love them through interesting conversation, flexibility and clear agreements.",
    Cancer:"Good potential: tenderness, care, home-building and emotional attunement. Friction: defensiveness, indirect hints or retreating instead of speaking. Best style: emotionally safe and nurturing without smothering. Hardest style: guilt, control or silent treatment. Love them through reassurance, patience and direct kindness.",
    Leo:"Good potential: warmth, creativity, generosity and shared celebration. Friction: pride or competition for attention. Best style: affectionate, expressive and mutually encouraging. Hardest style: humiliating or withholding affection as punishment. Love them through sincere appreciation and room to shine together.",
    Virgo:"Good potential: practical support, thoughtful attention and shared improvement. Friction: criticism, worry or trying to fix feelings too quickly. Best style: steady, considerate and clear about expectations. Hardest style: nitpicking or treating love like a performance review. Love them through reliability, specific appreciation and useful help that is actually wanted.",
    Libra:"Good potential: cooperation, fairness, social ease and aesthetic connection. Friction: indecision or avoiding conflict to keep the peace. Best style: balanced, communicative and respectful. Hardest style: passive-aggressive or one-sided. Love them through fairness, shared decisions and honest disagreement without cruelty.",
    Scorpio:"Good potential: loyalty, depth, emotional courage and strong trust. Friction: suspicion, secrecy or power struggles. Best style: intimate, transparent and boundaried. Hardest style: surveillance, manipulation or testing loyalty. Love them through consistency, honesty and respect for privacy.",
    Sagittarius:"Good potential: optimism, learning, travel and shared discovery. Friction: bluntness, restlessness or avoiding commitments. Best style: adventurous but dependable. Hardest style: restricting freedom or making promises without follow-through. Love them through curiosity, humor and room to explore while keeping agreements.",
    Capricorn:"Good potential: ambition, stability, long-term planning and practical devotion. Friction: emotional reserve or letting work outrank connection. Best style: committed, respectful and future-minded. Hardest style: transactional or chronically unavailable. Love them through trust, dependable action and space for vulnerability.",
    Aquarius:"Good potential: friendship, originality, shared causes and intellectual freedom. Friction: detachment or treating emotional needs as illogical. Best style: equal, open-minded and independent with deliberate affection. Hardest style: dismissive or controlling. Love them through respect for individuality and honest emotional presence.",
    Pisces:"Good potential: empathy, imagination, tenderness and creative connection. Friction: blurred boundaries, idealization or avoiding difficult facts. Best style: compassionate but grounded, with clear expectations. Hardest style: rescuing, guilt or chronic ambiguity. Love them through gentleness, consistency, direct communication and boundaries that protect both people."
  };
  function compatibility(el) {
    const natal=V.h&&V.h.natal||{},sun=natal.Sun?natal.Sun.sign:"unavailable",label=V.sample?"Sample chart Sun sign":"Your calculated Sun sign",anchors=["Moon","Venus","Mars","ASC"].filter(k=>natal[k]).map(k=>(k==="ASC"?"Rising":k)+" in "+natal[k].sign).join(" · ");
    el.innerHTML=`<section class="p-panel"><h2>Compatibility · all twelve signs</h2><p class="muted">${label} is ${esc(sun)}. These are nuanced Sun-sign starting points, not a relationship verdict or full synastry. A complete comparison needs both birth charts and should consider Moon, Venus, Mars, Ascendant, houses and inter-chart aspects.</p><p><b>Your relationship signatures:</b> ${esc(anchors||"Moon, Venus, Mars and Ascendant placements are not all available.")}. Moon describes emotional comfort, Venus affection and values, Mars desire and conflict style, and the rising sign your approach to the world.</p>${Object.entries(COMPAT_GUIDE).map(([sign,txt])=>`<details class="astro-detail"><summary><b>${esc(sign)}</b></summary><p>${esc(txt)}</p><p><b>Important:</b> consent, safety, shared values, communication and observed behavior matter more than a chart pairing.</p></details>`).join("")}</section>`;
  }


  function reduceNumber(n) { n=Math.abs(Math.trunc(n)); while(n>9&&n!==11&&n!==22&&n!==33)n=String(n).split("").reduce((a,b)=>a+Number(b),0); return n; }
  function personalCycleHTML(birthDate,date) {
    if(!birthDate||!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return '<section class="astro-study-block"><h3>Numerology connection</h3><p>Add your birth date to calculate your Life Path and daily number themes.</p></section>';
    const [y,m,d]=birthDate.split("-").map(Number),[ty,tm,td]=date.split("-").map(Number),sum=n=>String(n).split("").reduce((a,b)=>a+Number(b),0);
    const life=reduceNumber(reduceNumber(m)+reduceNumber(d)+reduceNumber(sum(y))),year=reduceNumber(reduceNumber(m)+reduceNumber(d)+reduceNumber(sum(ty))),month=reduceNumber(year+reduceNumber(tm)),day=reduceNumber(month+reduceNumber(td));
    const meaning={1:"initiative and self-direction",2:"cooperation and patience",3:"expression and creativity",4:"structure and steady effort",5:"change and flexibility",6:"care and responsibility",7:"study and reflection",8:"stewardship and achievement",9:"compassion and completion",11:"inspiration and sensitivity",22:"building a practical vision",33:"service and teaching"};
    return '<section class="astro-study-block"><h3>Astrology + numerology reflection cards</h3><p>Planet positions are calculated astronomical data; number meanings are a separate numerology tradition. Use both as reflection prompts, not predictions.</p><div class="astro-number-grid">'+[['Life Path',life],['Personal Year',year],['Personal Month',month],['Personal Day',day]].map(x=>'<div class="astro-number"><b>'+x[0]+' · '+x[1]+'</b><span>'+meaning[x[1]]+'</span></div>').join("")+'</div><p><b>Journal prompt:</b> Where did today’s themes show up in an actual choice, conversation or routine? What else could explain what happened?</p></section>';
  }

  function nav(el) {
    let n = $("#astroNav");
    if (!n) { n = document.createElement("div"); n.id = "astroNav"; n.className = "p-subnav seg"; n.setAttribute("role", "group"); n.setAttribute("aria-label", "Horoscope sections"); el.parentElement.insertBefore(n, el); }
    n.innerHTML = [["today", "Today"], ["chart", "My birth chart"], ["learn", "Learning library"], ["compat", "Compatibility"]].map(([k, l]) => `<button class="seg-btn ${V.view === k ? "active" : ""}" data-av="${k}">${l}</button>`).join("");
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
      ${personalCycleHTML(V.sample ? null : V.birthDate,h.date)}
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
      ${chartGuideHTML(h)}
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
    if (window.AstroLearningUI && ["learn","chart","compat"].includes(V.view)) return window.AstroLearningUI.render(el, V.view, V.h);
    if (V.view === "learn") return LU().home(el, "sky", { title: "Astrology Learning Library" });
    if (V.view === "compat") return compatibility(el);
    if (!V.h) { el.innerHTML = `<p class="muted">Working out the chart…</p>`; return; }
    if (V.view === "chart") return chart(el);
    today(el);
  }
  async function render(el, { load, name = "", date, birthDate = null, fullName = "", entries = [] }) {
    V.name = name; V.birthDate = birthDate; V.fullName = fullName; V.entries = entries;
    try { V.h = await load(); V.sample = false; }
    catch (e) { V.h = sampleH(date); V.sample = !!V.h; if (!V.h) { el.innerHTML = `<p class="muted">Today's horoscope isn't available right now (${esc(e.message)}).</p>`; return; } }
    draw(el);
  }
  window.AstroUI = { render, draw, V, JORDAN };
})();
