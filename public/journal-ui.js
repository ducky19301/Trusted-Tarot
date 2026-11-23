/* Trusted Tarot journal sync + compact reading tools */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function mount(day, api, refresh) {
    const page = document.querySelector("#jPage");
    if (!page || !day || page.querySelector("[data-journal-sync]")) return;
    const wrap = document.createElement("section");
    wrap.className = "journal-sync";
    wrap.dataset.journalSync = "1";
    wrap.innerHTML = `
      <details class="js-section" open>
        <summary><span>✎ Personal journal</span><small>Synced to your account</small></summary>
        <div class="js-content">
          <textarea data-journal-text maxlength="12000" rows="4" placeholder="What happened? What did you notice, feel, decide, or learn?"></textarea>
          <div class="js-actions"><span class="js-status" aria-live="polite">Saved entries sync across your signed-in devices.</span><button class="btn btn-gold btn-sm" type="button" data-journal-save>Save entry</button></div>
        </div>
      </details>
      <details class="js-section">
        <summary><span>✦ Complete Astro tie-ins</span><small>Personal chart + transits + cards</small></summary>
        <div class="js-content"><p>Calculate the sky for this reading date, connect it to your saved birth chart, and add a reflection note to each card. This is symbolic reflection, not prediction.</p><button class="btn btn-ghost btn-sm" type="button" data-astro-build>Generate tie-ins for this day</button><span class="js-status" data-astro-status aria-live="polite"></span></div>
      </details>
      <details class="js-section">
        <summary><span>Reading notes & context</span><small>Intentions, spread, and original notes</small></summary>
        <div class="js-content"><p class="js-notes"></p></div>
      </details>`;
    page.appendChild(wrap);
    const field=wrap.querySelector("[data-journal-text]"), status=wrap.querySelector(".js-status");
    field.value=day.journal || "";
    const note=wrap.querySelector(".js-notes"); note.textContent=day.notes || "No additional reading notes yet.";
    wrap.querySelector("[data-journal-save]").addEventListener("click", async () => {
      const btn=wrap.querySelector("[data-journal-save]"); btn.disabled=true; status.textContent="Saving to your account…";
      try { await api("/api/entries/"+encodeURIComponent(day.date)+"/journal",{date:day.date,journal:field.value}); status.textContent="Saved and synced."; day.journal=field.value; }
      catch(e){ status.textContent="Not saved: "+e.message; }
      finally { btn.disabled=false; }
    });
    wrap.querySelector("[data-astro-build]").addEventListener("click", async (e) => {
      const btn=e.currentTarget, st=wrap.querySelector("[data-astro-status]"); btn.disabled=true; st.textContent="Calculating your chart and matching the reading…";
      try { const result=await api("/api/entries/"+encodeURIComponent(day.date)+"/astro/auto",{date:day.date}); st.textContent="Astro tie-ins saved to this journal entry."; await refresh(); }
      catch(err){ st.textContent="Could not complete tie-ins: "+err.message; }
      finally { btn.disabled=false; }
    });
  }
  window.JournalSyncUI={mount};
})();
