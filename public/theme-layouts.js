/* Presentation-only theme composition.
   Feature nodes, IDs, event handlers, storage and routes stay shared. */
(() => {
  "use strict";
  const root = document.documentElement;
  const themes = ["celestial", "editorial", "cosmic"];
  const maps = {
    today: {
      ".recap-line": "daily-context",
      ".reading-import": "import-tools",
      "#todaySaved": "saved-reading",
      "#todayDraw": "reading-workspace"
    },
    journal: {
      "#recapBox": "journal-summary",
      "#gapBox": "journal-insight",
      ".journal-bar": "journal-date-nav",
      ".book": "journal-pages",
      "#panel-journal > p.center": "journal-export"
    },
    guests: {
      ".intro": "screen-intro",
      ".guests-layout": "guest-workspace"
    },
    cards: {
      ".library-bar": "library-tools",
      "#cardGrid": "card-collection"
    },
    practice: {
      ".p-subnav": "learning-nav",
      "#practiceRoot": "learning-content"
    },
    astro: {
      ".intro": "screen-intro",
      "#astroToday": "astro-feature",
      "#astroPending": "astro-pending",
      "#astroList": "astro-library"
    },
    compat: { "#compatBody": "compatibility-content" },
    friends: { "#friendsBody": "community-content" },
    meditate: {
      ".meditate-bar": "meditation-controls",
      ".med-frame": "meditation-stage",
      ".hint": "meditation-caption"
    }
  };
  const today = {
    ".back-saved": "return-link",
    "#moonBanner": "lunar-context",
    ".controls": "draw-options",
    "#digitalControls": "draw-actions",
    "#physicalControls": "physical-entry",
    "#photoBox": "photo-entry",
    "#todayHint": "reading-prompt",
    "#stage": "card-stage",
    "#quick": "quick-meaning",
    "#saveBox": "save-actions",
    "#readMore": "expanded-interpretation"
  };
  const dynamic = {
    guests: {
      ".people": "guest-list",
      ".profile": "guest-profile",
      ".person": "guest-person",
      ".profile-head": "guest-profile-heading",
      ".g-reading": "guest-reading",
      ".g-insights": "guest-insights",
      ".g-share": "guest-sharing"
    },
    cards: {
      "#cardGrid .card": "library-card",
      "#cardGrid .entry-card": "library-card"
    },
    journal: {
      ".recap": "journal-recap",
      ".recap-main": "journal-recap-main",
      ".recap-streak": "journal-streak",
      ".recap-tip": "journal-prompt",
      ".page-date": "journal-page-date",
      ".page-sub": "journal-page-subtitle",
      ".j-share": "journal-share"
    },
    practice: {
      ".fp": "practice-card-picker",
      ".fp-grid": "practice-picker-grid",
      ".lesson": "practice-lesson",
      ".learn-card": "practice-learning-card",
      ".ln-card": "practice-learning-card"
    },
    astro: {
      ".astro-card": "astro-insight-card",
      ".astro-day": "astro-day-card",
      ".astro-card-ties": "astro-tarot-tie",
      ".astro-journal-summary": "astro-journal-link"
    },
    compat: {
      ".cx-hero": "compatibility-hero",
      ".cx-wheel": "compatibility-wheel",
      ".cx-steps": "compatibility-steps",
      ".cx-story": "compatibility-story",
      ".cx-heat-wrap": "compatibility-aspects",
      ".cx-item": "compatibility-detail",
      ".cx-acts": "compatibility-actions",
      ".cx-srcs": "compatibility-sources",
      ".cx-astro": "compatibility-chart"
    },
    friends: {
      ".fr-me": "friend-identity",
      ".fr-add, .fr-link": "friend-actions",
      ".fr-row": "friend-list",
      ".feed-item": "friend-feed",
      ".g-cards": "friend-reading-cards",
      ".fr-h": "friend-section-heading",
      ".fr-invite": "friend-invite"
    }
  };
  function mark(panel, map) {
    for (const [selector, role] of Object.entries(map || {})) {
      panel.querySelectorAll(selector).forEach((el) => {
        if (el.dataset.layoutPart !== role) el.dataset.layoutPart = role;
      });
    }
  }
  function markPanel(name) {
    const panel = document.getElementById("panel-" + name);
    if (!panel) return;
    panel.dataset.screenComposition = name + "-" + root.dataset.screenLayout;
    panel.dataset.layoutTheme = root.dataset.screenLayout;
    mark(panel, maps[name]);
    mark(panel, dynamic[name]);
    if (name === "today") {
      const draw = panel.querySelector("#todayDraw");
      if (draw) mark(draw, today);
    }
  }
  function apply() {
    const theme = themes.includes(root.dataset.designTheme) ? root.dataset.designTheme : "celestial";
    root.dataset.screenLayout = theme;
    root.dataset.designTheme = theme;
    Object.keys(maps).forEach(markPanel);
  }
  apply();
  const themeObserver = new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === "data-design-theme")) apply();
  });
  themeObserver.observe(root, { attributes: true, attributeFilter: ["data-design-theme"] });
  Object.keys(maps).forEach((name) => {
    const panel = document.getElementById("panel-" + name);
    if (!panel) return;
    new MutationObserver(() => {
      mark(panel, dynamic[name]);
      if (name === "today") {
        const draw = panel.querySelector("#todayDraw");
        if (draw) mark(draw, today);
      }
    }).observe(panel, { childList: true, subtree: true });
  });
  window.TAROT_THEME_LAYOUTS = { apply, refresh: apply, themes: themes.slice() };
})();