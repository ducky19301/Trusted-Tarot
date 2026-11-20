/* Full astrology study curriculum UI; all lesson text and quizzes live in astro-curriculum.js. */
(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const KEY="tt.astro.curriculum.progress.v1";
  const state={topic:null,lesson:null,q:0,answers:[],score:0};
  const data=()=>window.ASTRO_CURRICULUM;
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{"done":{},"scores":{}}')}catch(_){return{done:{},scores:{}}}};
  const save=p=>{try{localStorage.setItem(KEY,JSON.stringify(p))}catch(_){}};
  function render(el,view,h){
    if(view==="learn") return library(el);
    if(view==="chart") return chart(el,h);
    if(view==="compat") return compatibility(el,h);
  }
  function library(el){
    const C=data(),p=load();
    if(state.topic!==null){
      const t=C.topics.find(x=>x.id===state.topic);
      if(!t){state.topic=null;return library(el)}
      if(state.lesson!==null){
        const l=t.lessons[state.lesson]; if(!l){state.lesson=null;return library(el)}
        const q=l.quiz[state.q],answered=state.answers[state.q]!==undefined;
        el.innerHTML=`<section class="p-panel astro-curriculum"><button class="link-btn" id="acBack">‹ ${esc(t.title)}</button>
          <p class="label">LESSON ${state.lesson+1} OF ${t.lessons.length} · ${esc(t.title)}</p><h2>${esc(l.title)}</h2>
          ${l.body.map((x,i)=>`<p>${esc(x)}</p>`).join("")}
          <div class="notes"><b>Worked example</b><p>${esc(l.example)}</p></div>
          <h3>Knowledge check</h3><p class="muted small">Answer each question. Each answer includes an explanation.</p>
          ${q?`<div class="p-panel"><p><b>Question ${state.q+1} of ${l.quiz.length}</b></p><p>${esc(q[0])}</p>
            <div class="ac-options">${q[1].map((x,i)=>`<button class="btn btn-ghost ac-choice" data-choice="${i}" ${answered?"disabled":""}>${esc(x)}</button>`).join("")}</div>
            ${answered?`<p class="status ${state.answers[state.q]===q[2]?"":"err"}">${state.answers[state.q]===q[2]?"Correct.":"Not quite."} ${esc(q[3])}</p><button class="btn btn-gold" id="acNext">${state.q+1===l.quiz.length?"See results":"Next question"}</button>`:""}
          </div>`:`<div class="notes"><h3>Quiz results</h3><p><b>${state.score} / ${l.quiz.length}</b></p><p>${state.score===l.quiz.length?"Excellent. Every answer was correct.":state.score>=Math.ceil(l.quiz.length*.7)?"Good work. Review any missed explanations.":"Revisit the lesson and try again."}</p>
            <button class="btn btn-gold" id="acComplete">Mark lesson complete</button><button class="btn btn-ghost" id="acRetry">Retake quiz</button></div>`}
          <p class="muted small">Astrology is presented as a historical and symbolic interpretive tradition, not a scientifically established personality test or predictive method.</p></section>`;
        $("#acBack",el).onclick=()=>{state.lesson=null;state.q=0;state.answers=[];state.score=0;library(el)};
        $$("[data-choice]",el).forEach(b=>b.onclick=()=>{const n=+b.dataset.choice;state.answers[state.q]=n;if(n===q[2])state.score++;library(el)});
        const next=$("#acNext",el);if(next)next.onclick=()=>{state.q++;library(el)};
        const retry=$("#acRetry",el);if(retry)retry.onclick=()=>{state.q=0;state.answers=[];state.score=0;library(el)};
        const complete=$("#acComplete",el);if(complete)complete.onclick=()=>{const p=load(),k=t.id+"/"+l.title;p.done[k]=true;p.scores[k]=Math.max(p.scores[k]||0,state.score);save(p);state.lesson=null;state.q=0;state.answers=[];state.score=0;library(el)};
        return;
      }
      el.innerHTML=`<section class="p-panel astro-curriculum"><button class="link-btn" id="acAll">‹ All topics</button><h2>${esc(t.title)}</h2><p>${esc(t.summary)}</p><div class="ln-secs">
        ${t.lessons.map((l,i)=>{const k=t.id+"/"+l.title;return `<button class="ln-sec ${p.done[k]?"done":""}" data-lesson="${i}"><b>${esc(l.title)}</b><small>${l.body.length} complete sections · ${l.quiz.length} quiz questions · ${p.done[k]?"completed ✓":"not completed"}</small></button>`;}).join("")}</div></section>`;
      $("#acAll",el).onclick=()=>{state.topic=null;library(el)};
      $$("[data-lesson]",el).forEach(b=>b.onclick=()=>{state.lesson=+b.dataset.lesson;state.q=0;state.answers=[];state.score=0;library(el)});
      return;
    }
    const total=C.topics.reduce((n,t)=>n+t.lessons.length,0),done=Object.keys(p.done).filter(k=>p.done[k]).length;
    el.innerHTML=`<section class="p-panel astro-curriculum"><h2>Astrology learning library</h2><p>Complete, written learning paths across ${C.topics.length} topics and ${total} lessons. Each lesson includes detailed explanations, an applied example and a knowledge check with answer explanations.</p>
      <p><b>${done} of ${total} lessons completed</b></p><div class="ln-bar"><i style="width:${Math.round(done/total*100)}%"></i></div><div class="ln-secs">
      ${C.topics.map(t=>{const n=t.lessons.filter(l=>p.done[t.id+"/"+l.title]).length;return `<button class="ln-sec" data-topic="${t.id}"><b>${esc(t.title)}</b><small>${esc(t.summary)}</small><small>${n}/${t.lessons.length} lessons complete</small></button>`;}).join("")}</div>
      <p class="muted small">Progress is saved on this device. The lessons distinguish astronomical calculations, historical traditions and modern interpretation.</p></section>`;
    $$("[data-topic]",el).forEach(b=>b.onclick=()=>{state.topic=b.dataset.topic;library(el)});
  }
  const PLANETS=data().planets,SIGNS=data().signs,HOUSES=data().houses;
  function chart(el,h){
    if(!h||!h.natal){el.innerHTML='<p class="muted">Birth chart data is not available yet.</p>';return}
    const rows=Object.entries(h.natal),major=data().aspects;
    const aspects=[];
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const [a,x]=rows[i],[b,y]=rows[j];if(!Number.isFinite(+x.lon)||!Number.isFinite(+y.lon))continue;
      const sep=Math.abs((((+x.lon-+y.lon)+540)%360)-180);
      for(const [name,angle] of [["Conjunction",0],["Sextile",60],["Square",90],["Trine",120],["Opposition",180]]){const orb=Math.abs(sep-angle);if(orb<=6)aspects.push({a,b,name,orb:+orb.toFixed(2)})}
    }
    aspects.sort((a,b)=>a.orb-b.orb);
    const cards=rows.map(([key,x])=>{
      const p=PLANETS[key],s=SIGNS[x.sign],house=x.house?HOUSES[x.house]:null;
      const angle=key==="ASC"||key==="MC";
      const desc=p|| (key==="ASC"?["the eastern horizon, approach and presentation","self-awareness and a clear presence","over-adapting to others' expectations","What first impression do I want to make?"]:key==="MC"?["public direction, vocation and visibility","meaningful contribution","living only for approval or status","What kind of contribution feels worthwhile?"]:null);
      if(!desc)return "";
      return `<details class="astro-detail"><summary><b>${esc(key==="ASC"?"Ascendant":key==="MC"?"Midheaven":key)} in ${esc(x.sign)}</b><span>${esc(x.pos||"")}${x.house?" · House "+x.house:""}</span></summary>
        <p><b>Meaning:</b> ${esc(desc[0])}.</p><p><b>Sign style:</b> ${esc(s[1])}. <b>Possible stress expression:</b> ${esc(s[2])}.</p>
        ${house?`<p><b>Life area:</b> ${esc(house[0])}. ${esc(house[1])}</p>`:""}
        <p><b>Mature expression:</b> ${esc(desc[1])}.</p><p><b>Watch for:</b> ${esc(desc[2])}.</p><p><b>Reflection:</b> ${esc(desc[3])}</p></details>`;
    }).join("");
    const life=[["Personality and identity","Begin with Sun, Moon, Ascendant and chart ruler. Combine conscious direction, emotional needs and outward approach; no single placement describes the whole person."],["Everyday life","Read Mercury, Mars, Moon and the sixth house for communication, energy, emotional rhythms and routines. Turn symbolism into habits you can observe."],["What others may see","Read the Ascendant, first-house planets and planets close to the ASC or MC. This is a presentation theme, not a claim about what everyone thinks of you."],["Private self","Read the Moon, fourth house, IC and their rulers for privacy, roots and emotional replenishment. Do not assume a particular family history."],["Love and intimacy","Read Venus, Mars, Moon, fifth and seventh houses, Descendant and rulers. Consider affection, desire, safety, boundaries and repair."],["Work, money and purpose","Read the MC and tenth house for public direction, sixth for routines, second for personal resources and eighth for shared resources."],["Maturity and downfalls","For each placement, distinguish a strength from a possible overuse. A chart does not prove trauma, illness or an unavoidable flaw."],["Happiness and fulfillment","Explore the fifth, ninth and eleventh houses, Venus, Jupiter and the Sun for joy, creativity, meaning and community. Test each idea against lived experience."]];
    el.innerHTML=`<section class="p-panel"><h2>Your birth chart, explained</h2><p class="muted">Big three: Sun ${esc(h.big_three.Sun)}, Moon ${esc(h.big_three.Moon)}${h.big_three.Ascendant?", "+esc(h.big_three.Ascendant)+" rising":""}. Placements are computed; interpretations are symbolic prompts, not fixed facts.</p>
      <table class="hs-table"><thead><tr><th>Point</th><th>Position</th><th>House</th></tr></thead><tbody>${rows.map(([k,x])=>`<tr><td>${esc(k)}</td><td>${esc(x.pos)}</td><td>${x.house||"—"}</td></tr>`).join("")}</tbody></table>
      ${h.note?`<p class="hint">${esc(h.note)}</p>`:""}<h3>Specific explanations for your placements</h3>${cards}<h3>Major natal aspects</h3><p>Calculated from the natal longitudes using major aspects within a 6° orb. Other astrologers may use different orb rules.</p><ul>${aspects.slice(0,30).map(a=>`<li><b>${esc(a.a)} ${a.name} ${esc(a.b)}</b> · ${a.orb}° orb.</li>`).join("")||"<li>No major aspects within this guide's orb.</li>"}</ul>
      <h3>Major life categories</h3>${life.map(([t,b])=>`<details class="astro-detail"><summary><b>${esc(t)}</b></summary><p>${esc(b)}</p></details>`).join("")}</section>`;
  }
  function compatibility(el,h){
    const C=data(),user=h&&h.big_three?h.big_three.Sun:"";
    el.innerHTML=`<section class="p-panel"><h2>Compatibility by sign</h2><p>Sign descriptions are starting points, not verdicts. A complete comparison needs both people's birth charts, including Moon, Mercury, Venus, Mars, angles and cross-chart aspects. Real relationship health depends on behavior, consent, honesty, accountability and repair.</p>${user?`<p class="hint">Your Sun sign is ${esc(user)}. This is only one factor in your chart.</p>`:""}
      ${Object.entries(C.signs).map(([sign,v])=>`<details class="astro-detail"><summary><b>${sign}</b> · ${v[0]}</summary><p><b>Strengths:</b> ${esc(v[1])}</p><p><b>Stress pattern:</b> ${esc(v[2])}</p><p><b>How to love well:</b> Ask what affection, reassurance and independence mean to this individual. Offer clear communication, consistency and room for difference.</p><p><b>Best dynamic:</b> A relationship where both people appreciate these strengths and discuss differences respectfully.</p><p><b>Hardest dynamic:</b> One where stress patterns become excuses for control, avoidance or disrespect.</p><p><b>Maturity:</b> Accountability, consent, repair and respect matter more than a sign match.</p></details>`).join("")}</section>`;
  }
  window.AstroLearningUI={render};
})();