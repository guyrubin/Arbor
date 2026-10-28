/**
 * build-plan-landing — BD-54 / B-BOOK-76: one intent landing page per Tier-1
 * Everyday-plan pattern and language, rendered at build time from the pattern
 * definitions into dist/marketing/plans/<pattern>-<lang>.html.
 *
 * DARK by construction: `noindex, nofollow`, no canonical, not in the sitemap,
 * `robots.txt` disallows the folder, and nothing links to them. A page stays
 * dark until the licensed reviewer signs its pattern per language (B-GA-37)
 * AND BD-01 opens the market; flipping it public is a separate, reviewed
 * change (the robots meta, the sitemap, the links), never this script.
 *
 * Copy: the pattern's own parent words (the 2am phrasing), the win the child
 * can say, the three default steps as the grown-ups do them, the red lines as
 * "when to talk to your doctor instead", the sources — in the positioning
 * lexicon (developmentally informed parent practice; never a treatment, never
 * a diagnosis noun). The CTA forwards incoming utm and ref params to the app
 *  (incoming wins) so a practitioner link keeps its source (BD-54).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { authoredPatterns } from "../src/lib/library/plans/planBooks";
import type { PatternDef } from "../src/lib/library/plans/patterns";
import type { BookLang } from "../src/lib/library/types";

const esc = (t: string) => t.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#39;");

const COPY = {
  en: {
    eyebrow: "An Everyday plan from Arbor",
    lede: "A short first-person picture book your child reads with their own hero, built from three small steps you choose. Developmentally informed parent practice, not medical care, from sources you can read.",
    steps: "The three steps, as the grown-ups do them",
    stepsNote: "You choose each step from a sourced menu, set the minutes and the time of day, and read every word before it becomes your child's plan.",
    watch: "When to talk to your family's doctor instead",
    watchNote: "The plan asks these first. One of them is a reason to pause the plan and talk to your doctor; Arbor offers no plan then.",
    sources: "Where the steps come from",
    cta: "Start with Arbor",
    ctaNote: "Free for 14 days. You choose what is saved and shared; nothing here grades your child.",
    review: "This pattern is in review: a licensed reviewer reads every line in each language before a family outside the review can compose it.",
    footer: "Arbor supports developmentally informed parent practice. It gives no medical advice and never grades a child.",
    privacy: "Privacy", terms: "Terms", support: "Support",
  },
  he: {
    eyebrow: "תוכנית יום-יום מ-Arbor",
    lede: "ספר מצויר קצר בגוף ראשון שהילד או הילדה קוראים עם הגיבור שלהם, בנוי משלושה שלבים קטנים שאתם בוחרים. פרקטיקה הורית מבוססת התפתחות, לא ייעוץ רפואי, ממקורות שאפשר לקרוא.",
    steps: "שלושת השלבים, כמו שהמבוגרים עושים אותם",
    stepsNote: "אתם בוחרים כל שלב מתפריט עם מקורות, קובעים את הדקות ואת שעת היום, וקוראים כל מילה לפני שהיא הופכת לתוכנית של הילד.",
    watch: "מתי לדבר עם רופא/ת המשפחה במקום",
    watchNote: "התוכנית שואלת את זה קודם. סימן אחד הוא סיבה לעצור את התוכנית ולדבר עם הרופא; Arbor לא מציעה תוכנית אז.",
    sources: "מאיפה השלבים מגיעים",
    cta: "להתחיל עם Arbor",
    ctaNote: "חינם ל-14 יום. אתם בוחרים מה נשמר ומה משותף; שום דבר כאן לא מדרג את הילד.",
    review: "התבנית הזאת בבדיקה: בודק/ת מורשה קורא/ת כל שורה בכל שפה לפני שמשפחה מחוץ לבדיקה יכולה להרכיב אותה.",
    footer: "Arbor תומכת בפרקטיקה הורית מבוססת התפתחות. היא לא נותנת ייעוץ רפואי ולא מדרגת ילדים.",
    privacy: "פרטיות", terms: "תנאים", support: "תמיכה",
  },
} as const;

export const PLAN_LANDING_DIR = "marketing/plans";
export const planLandingPath = (pattern: string, lang: BookLang) => `${PLAN_LANDING_DIR}/${pattern}-${lang}.html`;

/** The CTA default tag; incoming utm and ref params win (forwarded by the inline script). */
const defaultUtm = (pattern: string) => `utm_source=landing&utm_medium=organic&utm_campaign=everyday_plans&utm_content=plan_${pattern.replace(/-/g, "_")}`;

export function renderPlanLanding(def: PatternDef, lang: BookLang): string {
  const c = COPY[lang];
  const dir = lang === "he" ? "rtl" : "ltr";
  const title = `${def.parentWords[lang]} — ${def.title[lang]} | Arbor`;
  const minutes = def.menu.find((m) => m.id === def.defaultSteps[0])?.defaultMinutes ?? 5;
  const time = lang === "he" ? "בערב" : "in the evening";
  const steps = def.defaultSteps.map((id) => def.menu.find((m) => m.id === id)!).map((m) => m.parentLine[lang].replace(/\{minutes\}/g, String(minutes)).replace(/\{time\}/g, time));
  const list = (items: readonly string[], ordered: boolean) => `<${ordered ? "ol" : "ul"}>${items.map((t) => `<li>${esc(t)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
  const sources = def.sources.map((s) => (s.url ? `<a href="${esc(s.url)}" rel="noopener nofollow">${esc(s.label[lang])}</a>` : esc(s.label[lang])));
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(def.parent.knows[lang])}" />
<meta name="robots" content="noindex, nofollow, noarchive" />
<meta name="theme-color" content="#ffffff" />
<link rel="icon" href="/brand/arbor-mark-transparent.png" />
<style>body{margin:0;font-family:Manrope,system-ui,sans-serif;background:#f7fbfd;color:#071a35;line-height:1.7}main{width:min(88%,860px);margin:auto;padding:72px 0 48px}a{color:#075ca8}header{border-bottom:1px solid #b8d3df;padding-bottom:28px;margin-bottom:32px}.eyebrow{font-weight:800;color:#007d77;font-size:.9rem}h1{font-size:clamp(2rem,4.6vw,3.6rem);line-height:1.05;margin:.4rem 0 .8rem}h2{font-size:clamp(1.4rem,2.8vw,2rem);line-height:1.15;margin:2rem 0 .6rem}p,li{font-size:1.06rem;color:#314257}.lede{font-size:1.22rem;color:#23364d}.box{background:#fff;border:1px solid #c6dce6;border-radius:18px;padding:22px 24px;margin:18px 0}.note{font-size:.95rem;color:#51607a}.cta{display:inline-block;background:#075ca8;color:#fff;border-radius:999px;padding:14px 26px;font-weight:800;text-decoration:none;margin-top:10px}.review{border-inline-start:3px solid #007d77;padding-inline-start:14px;color:#23364d}footer{border-top:1px solid #b8d3df;margin-top:40px;padding-top:18px;font-size:.9rem;color:#51607a}footer a{margin-inline-end:14px}ol,ul{padding-inline-start:22px}</style>
</head>
<body>
<main>
<header>
<p class="eyebrow">${esc(c.eyebrow)}</p>
<h1>${esc(def.parentWords[lang])}</h1>
<p class="lede">${esc(def.title[lang])} — ${esc(def.coverLine[lang])}</p>
<p class="lede">${esc(c.lede)}</p>
</header>
<section class="box"><h2>${esc(c.steps)}</h2>${list(steps, true)}<p class="note">${esc(c.stepsNote)}</p></section>
<section><h2>${esc(def.parent.knows[lang].split(/[.!?]/)[0])}.</h2><p>${esc(def.parent.whyNow[lang])}</p><p>${esc(def.parent.together[lang])}</p></section>
<section class="box"><h2>${esc(c.watch)}</h2>${list(def.watchFor.map((w) => w.text[lang]), false)}<p class="note">${esc(c.watchNote)}</p></section>
<section><h2>${esc(c.sources)}</h2><ul>${sources.map((s) => `<li>${s}</li>`).join("")}</ul><p class="note">${esc(def.parent.sourceNote[lang])}</p></section>
<section><p class="review">${esc(c.review)}</p></section>
<section><a class="cta" data-cta="app" href="/?${defaultUtm(def.id)}">${esc(c.cta)}</a><p class="note">${esc(c.ctaNote)}</p></section>
</main>
<footer><a href="/privacy">${esc(c.privacy)}</a><a href="/terms">${esc(c.terms)}</a><a href="/support">${esc(c.support)}</a><p>${esc(c.footer)}</p></footer>
<script>
(function(){try{var inc=new URLSearchParams(location.search);var keys=["utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref"];var any=keys.some(function(k){return inc.has(k)});if(!any)return;document.querySelectorAll('a[data-cta="app"]').forEach(function(a){var u=new URL(a.getAttribute("href"),location.origin);keys.forEach(function(k){if(inc.has(k))u.searchParams.set(k,inc.get(k))});a.setAttribute("href",u.pathname+u.search)})}catch(e){}})();
</script>
</body>
</html>
`;
}

/** Write every authored pattern in both languages under dist; returns the paths written. */
export function buildPlanLandingPages(dist: string): string[] {
  const out: string[] = [];
  for (const def of authoredPatterns()) {
    for (const lang of ["en", "he"] as const) {
      const rel = planLandingPath(def.id, lang);
      const target = join(dist, rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, renderPlanLanding(def, lang));
      out.push(rel);
    }
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
  console.log(`[plan-landing] ${buildPlanLandingPages(dist).length} dark intent pages written.`);
}
