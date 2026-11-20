/* Import prior readings from text, JSON, PDF or image into the dated journal. */
(() => {
  "use strict";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const $=(s,r=document)=>r.querySelector(s);
  const pdfLib=()=>new Promise((resolve,reject)=>{
    if(window.pdfjsLib)return resolve(window.pdfjsLib);
    const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>window.pdfjsLib?resolve(window.pdfjsLib):reject(new Error("PDF reader did not load."));
    s.onerror=()=>reject(new Error("PDF reading needs an internet connection. You can paste the PDF text instead."));
    document.head.appendChild(s);
  });
  async function textFromPDF(file){
    const pdf=await pdfLib();pdf.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const doc=await pdf.getDocument({data:await file.arrayBuffer()}).promise;let out=[];
    for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),tc=await page.getTextContent();out.push(tc.items.map(x=>x.str).join(" "))}
    return out.join("\n\n");
  }
  function parseJSON(raw){
    const obj=JSON.parse(raw),date=obj.date||obj.readingDate||obj.created_at&&String(obj.created_at).slice(0,10);
    const cards=Array.isArray(obj)?obj:(obj.cards||obj.reading&&obj.reading.cards||[]);
    const note=obj.notes||obj.note||obj.overall||obj.reading&&obj.reading.overall||"";
    return {date,cards,note,spread:obj.spread||obj.spreadName||"Imported past reading"};
  }
  function detectCards(text,manual){
    const S=window.TarotApp&&window.TarotApp.S,known=S&&S.cards||[],source=String(text||"")+"\n"+String(manual||"");
    const found=[];
    for(const card of known){
      const re=new RegExp("(^|[^A-Za-z])"+card.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"([^A-Za-z]|$)","i");
      if(re.test(source)){
        const line=source.split(/\r?\n/).find(x=>re.test(x))||"";
        const reversed=/\breversed\b|\brx\b|upside down/i.test(line);
        found.push({name:card.name,orientation:reversed?"reversed":"upright",source:"physical deck"});
      }
    }
    return found.slice(0,12);
  }
  function dateValue(v){const m=String(v||"").match(/^(\d{4}-\d{2}-\d{2})/);return m?m[1]:new Date().toISOString().slice(0,10)}
  function mount(){
    const root=$("#panel-today");if(!root||$("#readingImport"))return;
    const box=document.createElement("details");box.id="readingImport";box.className="p-panel reading-import";
    box.innerHTML=`<summary><b>＋ Import a past reading</b><span class="muted">Photos · PDFs · text · JSON</span></summary>
      <p>Bring an older reading into its original journal date. The app will connect the saved entry to your Astro history and journal view. Review detected cards before saving.</p>
      <label class="label" for="riDate">Original reading date</label><input id="riDate" type="date" />
      <label class="label" for="riFile">Choose a file</label><input id="riFile" type="file" accept=".txt,.md,.json,.pdf,image/*" />
      <label class="label" for="riText">Paste reading text or notes</label><textarea id="riText" rows="5" placeholder="Paste your reading, card names, positions, interpretation or notes…"></textarea>
      <label class="label" for="riCards">Card names (optional, one per line)</label><textarea id="riCards" rows="3" placeholder="The Fool upright\nThe Moon reversed"></textarea>
      <label class="label" for="riNotes">Additional journal notes (optional)</label><textarea id="riNotes" rows="3" placeholder="What you remember, the question, spread, or context…"></textarea>
      <div id="riPreview" class="muted small" aria-live="polite">No file selected yet.</div>
      <div class="actions"><button type="button" class="btn btn-gold" id="riSave">Review and import</button></div>
      <p id="riStatus" class="status" role="status" aria-live="polite"></p>`;
    const anchor=$("#todayRecap");anchor.insertAdjacentElement("afterend",box);
    $("#riDate").value=dateValue();
    let imageData=null,imageName="";
    $("#riFile").addEventListener("change",async e=>{
      const f=e.target.files&&e.target.files[0];imageData=null;imageName=f?f.name:"";
      if(!f){$("#riPreview").textContent="No file selected.";return}
      try{
        if(f.type.startsWith("image/")){imageData=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});$("#riPreview").textContent="Image ready. Add card names if known; otherwise it will enter the photo-identification queue."}
        else if(f.type==="application/pdf"||f.name.toLowerCase().endsWith(".pdf")){$("#riPreview").textContent="Extracting PDF text…";$("#riText").value=await textFromPDF(f);$("#riPreview").textContent="PDF text extracted. Check the text and add or correct card names."}
        else {const raw=await f.text();if(f.name.toLowerCase().endsWith(".json")){const j=parseJSON(raw);if(j.date)$("#riDate").value=dateValue(j.date);$("#riText").value=raw;$("#riNotes").value=j.note||"";$("#riCards").value=(j.cards||[]).map(c=>typeof c==="string"?c:c.name+" "+(c.orientation||"")).join("\n")}else $("#riText").value=raw;$("#riPreview").textContent="File loaded. Review the text and date before importing."}
      }catch(err){$("#riPreview").textContent=err.message}
    });
    $("#riSave").addEventListener("click",async()=>{
      const status=$("#riStatus"),btn=$("#riSave"),text=$("#riText").value.trim(),manual=$("#riCards").value.trim(),notes=$("#riNotes").value.trim(),date=dateValue($("#riDate").value);
      const app=window.TarotApp;if(!app||!app.api){status.textContent="The app is still loading. Try again in a moment.";return}
      const parsed=detectCards(text,manual);
      const names=manual.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
      const cards=parsed.length?parsed:names.slice(0,12).map(name=>({name:name.replace(/\s+(upright|reversed)$/i,""),orientation:/reversed/i.test(name)?"reversed":"upright",source:"physical deck"}));
      if(!imageData&&!text&&!cards.length){status.textContent="Choose a file, paste the reading, or enter card names.";return}
      btn.disabled=true;status.textContent="Saving…";
      try{
        if(imageData){
          const out=await app.api("/api/photos",{date,photos:[{data:imageData}],cards,note:[notes,text].filter(Boolean).join("\n\n")});
          status.textContent="Image uploaded to your reading review queue. Open Journal and find “Waiting for TaroBot” to review the photo and identify or confirm its cards.";
        }else{
          if(!cards.length)throw new Error("No known tarot cards were found. Add the card names in the Card names field, then import again.");
          const note=[notes,text?("Imported reading ("+imageName+"):\n"+text):"", "Imported from a past reading."].filter(Boolean).join("\n\n").slice(0,3900);
          const result=await app.api("/api/entries",{date,cards,spread:"Imported past reading",note});
          await app.api("/api/entries");
          status.textContent=(result.added&&result.added.length?"Imported "+result.added.length+" card(s) into ":"Saved to ")+date+". Open Journal to review the dated entry; Astro can use the reading history.";
          if(app.S){app.S.entries=await app.api("/api/entries");if(typeof app.showTab==="function"){}}
        }
        $("#riText").value="";$("#riCards").value="";$("#riNotes").value="";$("#riFile").value="";imageData=null;imageName="";
        document.dispatchEvent(new CustomEvent("tarot:reading-imported",{detail:{date}}));
      }catch(err){status.textContent="Import not completed: "+err.message;status.classList.add("err")}
      finally{btn.disabled=false}
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>document.addEventListener("tarot:ready",mount));
  else document.addEventListener("tarot:ready",mount);
})();