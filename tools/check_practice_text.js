// Style check for static/practice-data.js: same rules as the card-knowledge validator.
// Run: node tools/check_practice_text.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../static/practice-data.js"), "utf8");
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx);
const D = ctx.window.PRACTICE_DATA;
const texts = [];
(function walk(v, where) {
  if (typeof v === "string") texts.push([where, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + "[" + i + "]"));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) if (!["url", "id", "key"].includes(k)) walk(v[k], where + "." + k);
})(D, "D");
const banned = ["universe","energy","energies","journey","embrace","invitation","invites you","invite you","tapestry","delve","navigate","realm","resonate","unlock","empower","manifest","align","sacred","profound","transformative","liminal","lean into","hold space","trust the process","a reminder that","serves as","vibe","manifesting","energetic"];
const errs = [];
for (const [w, t] of texts) {
  const tl = t.toLowerCase();
  for (const b of banned) if (new RegExp("\\b" + b.replace(/ /g, "\\s+")).test(tl)) errs.push(`${w}: banned "${b}"`);
  if (/[\u2014\u2013!]/.test(t)) errs.push(`${w}: dash or exclamation`);
  if (/\s-\s|\s--\s/.test(t)) errs.push(`${w}: spaced hyphen`);
  const m = t.match(/\b\w+, not (?!only\b|yet\b)\w+/); if (m) errs.push(`${w}: X, not Y "${m[0]}"`);
  if (/\b(it'?s|this is|that'?s) not\b[^.]{1,40}[,;] (it'?s|but)/i.test(t)) errs.push(`${w}: it's not X, it's Y`);
  if (/A\. E\. [A-Z]/.test(t) && !/\bWaite\b/.test(t)) {}
}
// lesson word counts 150-350
for (const l of D.LESSONS) {
  const words = l.body.join(" ").split(/\s+/).length;
  if (words < 150 || words > 350) errs.push(`lesson ${l.id}: ${words} words (want 150-350)`);
  else console.log(`lesson ${l.id}: ${words} words`);
}
console.log("strings checked:", texts.length);
console.log(errs.length ? "FAIL\n" + errs.join("\n") : "PASS");
process.exit(errs.length ? 1 : 0);
