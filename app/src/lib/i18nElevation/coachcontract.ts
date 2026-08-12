/* i18nElevation/coachcontract — masterplan 1.3: the Ask-Arbor data-contract
 * panel (TrustPanel on CoachTab) + the weekly-context consent toggle.
 *
 * These strings state EXACTLY what a coach request sends: the parent's
 * message · the child profile · approved memory facts (count) · this
 * conversation's recent turns · and, ONLY when the parent turns the toggle
 * on, this week's moment COUNTS (numbers/categories — never note text).
 *
 * Key decisions vs the pre-authored dead keys:
 *  - coach.contract.context/contextBody are SUPERSEDED by elev.coachcontract.*
 *    — their copy ("uses profile, moments, milestones … when available")
 *    claims unconditional moments/milestones access, which is exactly what
 *    the consent toggle makes conditional. Keeping them would state the wrong
 *    contract.
 *  - coach.contract.memoryBody IS reused (still accurate: durable facts wait
 *    for parent approval) as a "stores" bullet, via t() — it is already
 *    registered in i18n.ts.
 *  - airail.b.* engine-disclosure keys describe answer qualities, not the
 *    request payload — not stretched to cover this panel.
 *
 * Register: parent, calm, plural Israeli-parent address; no AI/tech jargon.
 * NOTE: this module is intentionally NOT registered in i18nElevation/index.ts
 * (that file is owned by a parallel stream); CoachTab consumes it directly via
 * `coachContractText`. When the index owner adds the two registration lines,
 * these keys also become resolvable through t() with zero changes here. */

export const en: Record<string, string> = {
  "elev.coachcontract.title": "What the coach sees",
  "elev.coachcontract.titleHint": "Sent with each question",

  // ── What Arbor uses (sent with every question)
  "elev.coachcontract.uses.message": "Your question, exactly as you wrote it",
  "elev.coachcontract.uses.profile": "{name}'s profile — age and focus areas",
  "elev.coachcontract.uses.memory": "Memory facts you approved ({count} used in the last answer)",
  "elev.coachcontract.uses.memoryNone": "Memory facts — only ones you approved",
  "elev.coachcontract.uses.turns": "The recent turns of this conversation, so the coach can follow the thread",
  "elev.coachcontract.uses.weekly": "This week's moment counts — numbers and categories only, never your written notes",

  // ── What Arbor stores
  "elev.coachcontract.stores.thread": "This conversation is saved so you can come back to it",

  // ── What you control
  "elev.coachcontract.controls.memory": "You approve or remove memory facts any time in Profile › Child Memory",
  "elev.coachcontract.controls.weekly": "Turn weekly context off any time — it stops with your next question",

  // ── The consent toggle (default OFF, per child)
  "elev.coachcontract.toggle": "Let the coach see this week's moments",
  "elev.coachcontract.toggleHint":
    'Off by default. When on, the coach sees counts only — for example "4 moments this week, 2 milestones observed" — never your notes.',
};

export const he: Record<string, string> = {
  "elev.coachcontract.title": "מה המאמן רואה",
  "elev.coachcontract.titleHint": "נשלח עם כל שאלה",

  "elev.coachcontract.uses.message": "השאלה שלכם, בדיוק כפי שכתבתם אותה",
  "elev.coachcontract.uses.profile": "הפרופיל של {name} — גיל ותחומי התמקדות",
  "elev.coachcontract.uses.memory": "עובדות זיכרון שאישרתם ({count} שימשו בתשובה האחרונה)",
  "elev.coachcontract.uses.memoryNone": "עובדות זיכרון — רק מה שאישרתם",
  "elev.coachcontract.uses.turns": "החילופים האחרונים בשיחה הזו, כדי שהמאמן יעקוב אחרי ההקשר",
  "elev.coachcontract.uses.weekly": "סיכום מספרי של הרגעים מהשבוע — מספרים וקטגוריות בלבד, אף פעם לא ההערות שכתבתם",

  "elev.coachcontract.stores.thread": "השיחה הזו נשמרת כדי שתוכלו לחזור אליה",

  "elev.coachcontract.controls.memory": "אתם מאשרים או מסירים עובדות זיכרון בכל רגע בפרופיל › זיכרון הילד",
  "elev.coachcontract.controls.weekly": "אפשר לכבות את ההקשר השבועי בכל רגע — הוא נעצר כבר מהשאלה הבאה",

  "elev.coachcontract.toggle": "לאפשר למאמן לראות את הרגעים מהשבוע",
  "elev.coachcontract.toggleHint":
    'כבוי כברירת מחדל. כשהוא פועל, המאמן רואה מספרים בלבד — למשל "4 רגעים השבוע, 2 אבני דרך שנצפו" — אף פעם לא את ההערות שלכם.',
};

/**
 * Direct lookup + {param} interpolation, mirroring lib/i18n.ts `t` semantics
 * (missing HE key falls back to EN; unknown key returns the key itself so a
 * regression is visible, never blank). Exists ONLY because this module is not
 * yet registered in i18nElevation/index.ts — see the header note.
 */
export const coachContractText = (
  lang: "en" | "he",
  key: string,
  params?: Record<string, string | number>,
): string => {
  let text = (lang === "he" ? he[key] : undefined) ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
};
