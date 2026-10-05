/* ════════════════════════════════════════════════════════════════════════════
   B-GROWTH-11 — the milestone catalogue in both languages, keyed by stable id.

   Keys: `ms.item.<id>.title|desc|looks` for every catalogue row (CDC
   `cdc-{m}m-{n}`, ASHA `asha-*`, Arbor `m-*`), `ms.band.<months>` for the
   13 age bands, `ms.ageGroup.<slug>` for the non-band age labels.

   EN is DERIVED from lib/milestoneData.ts (the catalogue is the source of
   truth; the dictionary can never drift from it). HE is written here.

   ⚠ REVIEW STATE: the Hebrew below is an AI FIRST PASS shipped under Guy's G8;
   native review is pending (GD-6). The registry flag is
   `MILESTONE_HE_REVIEW = "ai-first-pass"` in lib/milestoneData.ts and the
   Science page prints `ms.heReview.note`.

   Register: spoken Israeli Hebrew a parent of a toddler uses; the parent is
   addressed in the plural ("אתם"), the child with the app's slash forms
   ("מצביע/ה") or a gender-neutral phrasing. Observable behaviour only; no
   verdict or norm words (lib/milestoneI18n.test.ts scans them).
   Never consumed directly by a component: render through `milestoneText`,
   `milestoneAgeGroupText` and `milestoneBandLabel` in lib/milestoneData.ts.
   ════════════════════════════════════════════════════════════════════════════ */
import {
  ALL_MILESTONES,
  CUSTOM_MILESTONE_DESC,
  MILESTONE_AGE_BANDS,
  MILESTONE_AGE_GROUP_KEYS,
  milestoneBandKey,
  milestoneTextKey,
} from "../milestoneData";

/** HE per catalogue id: [title, description, what it looks like]. */
export const HE_MILESTONE_TEXT: Readonly<Record<string, readonly [string, string, string]>> = {
  // ─────────────────────────────── 2 months ───────────────────────────────
  "cdc-2m-1": ["נרגע/ת כשמנחמים", "נרגע/ת כשמדברים אליו/ה או מרימים על הידיים.", "כשיש אי-שקט או בכי, הקול שלכם או הרמה על הידיים מרגיעים."],
  "cdc-2m-2": ["מחייך/ת לאנשים", "מסתכל/ת על הפנים שלכם ושמח/ה לראות אתכם כשאתם ניגשים.", "חיוך אמיתי שמופנה ישר אליכם — לא רק רפלקס."],
  "cdc-2m-3": ["משמיע/ה קולות שהם לא בכי", "מגרגר/ת ומשמיע/ה צלילים כמו 'אוו' ו'אהה'.", "צלילים רכים ברגעים של רוגע, במיוחד כשאתם עונים."],
  "cdc-2m-4": ["מגיב/ה לרעשים חזקים", "נבהל/ת, ממצמץ/ת או משתתק/ת לשמע רעש חזק ופתאומי.", "טריקה או קול רם מקבלים תגובה ברורה — קפיצה קטנה או עצירה."],
  "cdc-2m-5": ["עוקב/ת אחריכם במבט", "עוקב/ת במבט כשאתם מסתובבים בחדר.", "העיניים הולכות אחריכם כשאתם חוצים את החדר, מתקרבים ומתרחקים."],
  "cdc-2m-6": ["מסתכל/ת על צעצוע", "מסתכל/ת כמה שניות על צעצוע שאתם מחזיקים.", "המבט נשאר על רעשן או על הפנים שלכם כמה שניות."],
  "cdc-2m-7": ["מרים/ה ראש בשכיבה על הבטן", "בשכיבה על הבטן, מרים/ה את הראש.", "בזמן שכיבה על הבטן הראש מתרומם ונשאר למעלה לרגע."],
  "cdc-2m-8": ["מזיז/ה ידיים ורגליים", "מזיז/ה את שתי הידיים ואת שתי הרגליים.", "מתנועע/ת ובועט/ת עם שני צדי הגוף, לא רק עם צד אחד."],

  // ─────────────────────────────── 4 months ───────────────────────────────
  "cdc-4m-1": ["מחייך/ת כדי למשוך תשומת לב", "מחייך/ת ביוזמה כדי שתתקרבו.", "חיוך מכוון שנועד למשוך אתכם, ואחריו מבט שמחכה לתגובה שלכם."],
  "cdc-4m-2": ["מצחקק/ת", "מצחקק/ת (עוד לא צחוק מלא) כשאתם מנסים להצחיק.", "צחקוקים קצרים ושמחים בזמן קוקו או דגדוגים."],
  "cdc-4m-3": ["'שיחה' של צלילים הלוך ושוב", "עונה בצלילים כשאתם מדברים — מעין 'שיחה'.", "אתם אומרים משהו, מגיע גרגור, אתם עונים — תורות של צלילים."],
  "cdc-4m-4": ["מפנה את הראש לכיוון קולות", "מפנה את הראש לכיוון הקול שלכם.", "שומע/ת אתכם מהצד השני של החדר ומסתובב/ת לחפש אתכם."],
  "cdc-4m-5": ["מסתכל/ת על הידיים", "מסתכל/ת בעניין על הידיים של עצמו/ה.", "בוחן/ת את האצבעות כאילו היו צעצוע חדש ומרתק."],
  "cdc-4m-6": ["מושיט/ה יד לצעצועים", "כשרעב/ה, פותח/ת את הפה למראה השד או הבקבוק; מושיט/ה יד לעבר צעצוע.", "רואה צעצוע תלוי ומניף/ה יד כדי להכות בו או לתפוס אותו."],
  "cdc-4m-7": ["מחזיק/ה ראש יציב", "מחזיק/ה את הראש יציב בלי תמיכה כשאתם מחזיקים אותו/ה.", "כשמחזיקים זקוף, הראש נשאר ישר ולא מתנדנד."],
  "cdc-4m-8": ["מביא/ה ידיים לפה", "מביא/ה ידיים לפה; נשען/ת על המרפקים בשכיבה על הבטן.", "הידיים מגיעות לפה בכוונה; על הבטן, נשען/ת על האמות."],

  // ─────────────────────────────── 6 months ───────────────────────────────
  "cdc-6m-1": ["מכיר/ה אנשים קרובים", "מזהה אנשים מוכרים; מתבייש/ת או נלחץ/ת מול זרים.", "קורן/ת אליכם ואל סבתא, אבל בוחן/ת בזהירות פנים לא מוכרות."],
  "cdc-6m-2": ["אוהב/ת להסתכל במראה", "אוהב/ת לראות את עצמו/ה במראה.", "מתקרב/ת ומושיט/ה יד אל ה'תינוק' שבמראה."],
  "cdc-6m-3": ["משמיע/ה צלילים בתורות", "משמיע/ה צלילים איתכם בתורות.", "אתם משמיעים צליל, ומגיעה תשובה בצליל — הלוך ושוב."],
  "cdc-6m-4": ["עושה 'פררר' עם השפתיים", "מוציא/ה לשון ונושף/ת — 'פררר'.", "הרעש המתיז של השפתיים והלשון, שוב ושוב בשביל הכיף."],
  "cdc-6m-5": ["מכניס/ה דברים לפה כדי להכיר אותם", "מכניס/ה דברים לפה כדי לחקור אותם.", "הכול הולך לפה — ככה 'בודקים' דברים."],
  "cdc-6m-6": ["מושיט/ה יד ותופס/ת צעצוע", "מושיט/ה יד כדי לתפוס צעצוע שמעניין אותו/ה.", "רואה צעצוע רחוק, נמתח/ת ונשען/ת קדימה כדי להגיע אליו."],
  "cdc-6m-7": ["מתהפך/ת", "מתהפך/ת מהבטן לגב.", "מתגלגל/ת מהבטן אל הגב, ולפעמים מופתע/ת מזה בעצמו/ה."],
  "cdc-6m-8": ["נשען/ת על הידיים בישיבה", "מתרומם/ת על ידיים ישרות; נשען/ת על הידיים כדי לשבת.", "נשען/ת קדימה על שתי הידיים כדי להישאר בישיבה."],

  // ─────────────────────────────── 9 months ───────────────────────────────
  "cdc-9m-1": ["מראה כמה הבעות פנים", "מראה כמה הבעות — שמחה, עצב, כעס, הפתעה.", "רואים על הפנים בבירור שמחה, כעס או בהלה, לפי הרגע."],
  "cdc-9m-2": ["מגיב/ה כשאתם יוצאים", "מחפש/ת אתכם, ואולי נצמד/ת או נסער/ת כשאתם מתרחקים (מודעות לזרים ולפרידה).", "שם/ה לב שאתם יוצאים מהחדר, ומוחה או מחפש/ת אתכם."],
  "cdc-9m-3": ["משחק/ת קוקו", "מחייך/ת או צוחק/ת במשחקי הלוך ושוב כמו קוקו.", "מחכה ל'קוקו!' ומצחקק/ת עוד לפני שהוא מגיע."],
  "cdc-9m-4": ["ממלמל/ת רצפים של הברות", "משמיע/ה צלילים שונים כמו 'מה-מה-מה' ו'בה-בה-בה'.", "שרשראות ארוכות של מלמול שמתחילות להישמע כמו דיבור."],
  "cdc-9m-5": ["מרים/ה ידיים כדי שירימו", "מרים/ה ידיים כדי שירימו אותו/ה.", "מושיט/ה את שתי הידיים אליכם — בקשה ברורה ל'הופה'."],
  "cdc-9m-6": ["מחפש/ת חפץ שנעלם", "מחפש/ת חפץ שנפל ונעלם מהעין (כמו כפית או צעצוע).", "עוקב/ת אחרי צעצוע שנפל ומתכופף/ת לחפש אותו."],
  "cdc-9m-7": ["מקיש/ה שני חפצים זה בזה", "דופק/ת שני דברים זה בזה.", "מקיש/ה שתי קוביות או כוסות זו בזו ושמח/ה מהרעש."],
  "cdc-9m-8": ["יושב/ת בלי תמיכה", "מגיע/ה לישיבה לבד ויושב/ת בלי תמיכה.", "נשאר/ת בישיבה זקופה, והידיים פנויות למשחק."],
  "cdc-9m-9": ["מעביר/ה חפצים מיד ליד", "מעביר/ה דברים מיד אחת לשנייה; גורף/ת אוכל עם האצבעות.", "מעביר/ה צעצוע בין הידיים וגורף/ת אליו/ה פירורים קטנים."],
};

/** HE per band threshold (months). */
const HE_BANDS: Readonly<Record<number, string>> = {
  2: "חודשיים",
  4: "4 חודשים",
  6: "6 חודשים",
  9: "9 חודשים",
  12: "שנה",
  15: "15 חודשים",
  18: "שנה וחצי",
  24: "שנתיים",
  30: "שנתיים וחצי",
  36: "3 שנים",
  48: "4 שנים",
  60: "5 שנים",
  72: "6 שנים ומעלה",
};

/** HE for the non-band age labels (Arbor's own items). */
const HE_AGE_GROUPS: Readonly<Record<string, string>> = {
  "ms.ageGroup.4-5": "4–5 שנים",
  "ms.ageGroup.5-6": "5–6 שנים",
};

const FIELDS = ["title", "desc", "looks"] as const;

function buildEn(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of ALL_MILESTONES) {
    out[milestoneTextKey(m.id, "title")] = m.title;
    out[milestoneTextKey(m.id, "desc")] = m.description;
    out[milestoneTextKey(m.id, "looks")] = m.skillLooksLike ?? m.description;
  }
  for (const b of MILESTONE_AGE_BANDS) out[milestoneBandKey(b.months)] = b.label;
  for (const [label, key] of MILESTONE_AGE_GROUP_KEYS) if (!(key in out)) out[key] = label;
  out["ms.customDesc"] = CUSTOM_MILESTONE_DESC;
  out["ms.heReview.note"] = "The Hebrew milestone wording is an AI-assisted first draft, awaiting review by a native Hebrew-speaking child-development professional.";
  return out;
}

function buildHe(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, row] of Object.entries(HE_MILESTONE_TEXT)) {
    FIELDS.forEach((field, i) => { out[milestoneTextKey(id, field)] = row[i]; });
  }
  for (const [months, label] of Object.entries(HE_BANDS)) out[milestoneBandKey(Number(months))] = label;
  Object.assign(out, HE_AGE_GROUPS);
  out["ms.customDesc"] = "אבן דרך שהוספתם בעצמכם.";
  out["ms.heReview.note"] = "הנוסח העברי של אבני הדרך הוא טיוטה ראשונה שנכתבה בעזרת בינה מלאכותית, וממתינה לבדיקה של איש/אשת מקצוע בהתפתחות הילד שעברית היא שפת האם שלהם.";
  return out;
}

export const en: Record<string, string> = buildEn();
export const he: Record<string, string> = buildHe();
