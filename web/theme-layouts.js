/* Presentation-only theme composition. Existing feature nodes, IDs, handlers and data remain shared. */
(() => {
 "use strict";
 const root=document.documentElement, themes=["celestial","editorial","cosmic"];
 const maps={
  today:{".recap-line":"daily-context",".reading-import":"import-tools","#todaySaved":"saved-reading","#todayDraw":"reading-workspace"},
  journal:{"#recapBox":"journal-summary","#gapBox":"journal-insight",".journal-bar":"journal-date-nav",".book":"journal-pages",".center":"journal-export"},
  guests:{".intro":"screen-intro",".guests-layout":"guest-workspace"},
  cards:{".library-bar":"library-tools","#cardGrid":"card-collection"},
  practice:{".p-subnav":"learning-nav","#practiceRoot":"learning-content"},
  astro:{".intro":"screen-intro","#astroToday":"astro-feature","#astroPending":"astro-pending","#astroList":"astro-library"},
  compat:{"#compatBody":"compatibility-content"},friends:{"#friendsBody":"community-content"},
  meditate:{".meditate-bar":"meditation-controls",".med-frame":"meditation-stage",".hint":"meditation-caption"}
 };
 const today={".back-saved":"return-link","#moonBanner":"lunar-context",".controls":"draw-options","#digitalControls":"draw-actions","#physicalControls":"physical-entry","#photoBox":"photo-entry","#todayHint":"reading-prompt","#stage":"card-stage","#quick":"quick-meaning","#saveBox":"save-actions","#readMore":"expanded-interpretation"};
 function mark(panel,map){for(const [sel,role] of Object.entries(map)){const el=panel.querySelector(sel);if(el)el.dataset.layoutPart=role;}}
 function apply(){
  const theme=themes.includes(root.dataset.designTheme)?root.dataset.designTheme:"celestial";
  root.dataset.screenLayout=theme;
  for(const [name,map] of Object.entries(maps)){
   const panel=document.getElementById("panel-"+name);if(!panel)continue;
   panel.dataset.screenComposition=name+"-"+theme;panel.dataset.layoutTheme=theme;mark(panel,map);
   if(name==="today"){const draw=panel.querySelector("#todayDraw");if(draw)mark(draw,today);}
  }
 }
 apply();
 new MutationObserver(rs=>{if(rs.some(r=>r.attributeName==="data-design-theme"))apply();})
  .observe(root,{attributes:true,attributeFilter:["data-design-theme"]});
 window.TAROT_THEME_LAYOUTS={apply,themes:themes.slice()};
})();