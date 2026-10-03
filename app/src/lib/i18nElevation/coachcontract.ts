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
 * NOTE: the module IS registered in i18nElevation/index.ts (so every key here
 * is in the clinical-firewall dictionary scan); CoachTab still reads it through
 * `coachContractText` below, which is a direct lookup with identical semantics
 * to t(). Keep both working. */

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

  // AI-02 / B-ASKJB-01 — the SPOKEN contract, stated from what the server
  // actually assembles (server/spokenContext.ts `assembleSpokenContext`): the
  // profile allow-list, this child's approved unexpired memory facts (up to
  // MEMORY_PROMPT_MAX_FACTS) and this conversation's recent turns. Weekly
  // moment counts never travel with voice. Live HD pins the same context into
  // its token with names stripped (`liveContextWithoutNames`). Since PR 109
  // the spoken path is grounded; the old "sends less than typing" line was
  // false. A change to the server assembly moves this copy with it.
  "elev.coachcontract.uses.spoken": "Speaking sends your words, the profile, memory facts you approved and this conversation's recent turns — never this week's moment counts",
  "elev.coachcontract.uses.spokenLive": "Live voice is a direct audio call with the model: it carries your words, the profile, memory facts you approved and this conversation's recent turns, without names — never this week's moment counts. {residency}",
  // B-ASKJB-02 — the residency clause, filled into {residency}. Live's token
  // is minted on Google's global endpoint, not the EU region (dated
  // exception; lib/liveResidency.ts resolves the date). The undated form is
  // used only when no truthful date can be printed.
  "elev.coachcontract.uses.liveResidency": "Live runs on Google's global endpoint, not the EU region, until {date}.",
  "elev.coachcontract.uses.liveResidencyUndated": "Live runs on Google's global endpoint, not the EU region.",

  // ── What Arbor stores
  "elev.coachcontract.stores.thread": "This conversation is saved so you can come back to it",

  // ── What you control
  "elev.coachcontract.controls.memory": "You approve or remove memory facts any time in Profile › Child Memory",
  "elev.coachcontract.controls.weekly": "Turn weekly context off any time — it stops with your next question",

  // AI-10 — the in-product quality signal on a coach answer (thumbs).
  // Register: the parent is telling US whether OUR answer helped. Every string
  // keeps the subject on the answer; `note` says so outright, because a thumb
  // sitting under a card about a child must not be readable as a verdict on
  // the child. No score, no rating, no percentage, no grade — the parent has
  // exactly two answers and can take either one back.
  "elev.coachcontract.feedback.prompt": "Did this answer help?",
  "elev.coachcontract.feedback.up": "It helped",
  "elev.coachcontract.feedback.down": "It didn't help",
  "elev.coachcontract.feedback.thanks": "Thank you — this is how the answers get better.",
  "elev.coachcontract.feedback.undo": "Tap again to undo",
  "elev.coachcontract.feedback.note": "This is about the answer, never about your child.",

  // ── The consent toggle (B-ASKJB-07: default ON, per child, explicit off)
  "elev.coachcontract.toggle": "Let the coach see this week's moments",
  "elev.coachcontract.toggleHint":
    'On unless you turn it off. The coach sees counts and how your last step went — for example "4 moments this week, 2 milestones observed" — never your notes.',
  // ── B-ASKJB-07 · the one-time notice above the composer (per child)
  "elev.coachcontract.notice.body": "Arbor now uses this week's counts and how your last step went.",
  "elev.coachcontract.notice.change": "Change",
  "elev.coachcontract.notice.dismiss": "Got it",

  // ── Builder F · OBJ-ASK-03 (chrome half) · the lens picker rendered
  // "Lev Vygotsky (Next Best Challenge Engine)" in the Hebrew app. The
  // scholar's NAME is a proper name and stays Latin (isolate() handles the
  // bidi); the concept beside it is chrome and is transcreated. Keyed by the
  // scholar slug in initialData.ts so no content file has to change.
  "elev.coachcontract.lens.concept.vygotsky": "Next Best Challenge Engine",
  "elev.coachcontract.lens.concept.bowlby": "Attachment & Repair Coach",
  "elev.coachcontract.lens.concept.winnicott": "Good Enough Parent Guide",
  "elev.coachcontract.lens.concept.montessori": "Independence Planner",
  "elev.coachcontract.lens.concept.bronfenbrenner": "Child Ecosystem Builder",
  "elev.coachcontract.lens.concept.piaget": "Stage-Aware Expectations",
  "elev.coachcontract.lens.concept.erikson": "Developmental Arc",

  // ── Builder F · OBJ-ASK-01 · the composer's accessible name
  "elev.coachcontract.composer.aria": "Ask about your child",
  // B-ASKJB-10: the fast-start chip from the child's own recurring moment.
  "elev.coach.echo.chip": "{type} again — what now?",

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

  "elev.coachcontract.uses.spoken": "דיבור שולח את המילים שלכם, את הפרופיל, את עובדות הזיכרון שאישרתם ואת החילופים האחרונים בשיחה הזו — אף פעם לא את ספירת הרגעים של השבוע",
  "elev.coachcontract.uses.spokenLive": "שיחת קול חיה היא שיחת אודיו ישירה עם המודל: היא נושאת את המילים שלכם, את הפרופיל, את עובדות הזיכרון שאישרתם ואת החילופים האחרונים בשיחה הזו, ללא שמות — אף פעם לא את ספירת הרגעים של השבוע. {residency}",
  "elev.coachcontract.uses.liveResidency": "שיחת קול חיה פועלת על נקודת הקצה הגלובלית של Google, לא באזור האיחוד האירופי, עד {date}.",
  "elev.coachcontract.uses.liveResidencyUndated": "שיחת קול חיה פועלת על נקודת הקצה הגלובלית של Google, לא באזור האיחוד האירופי.",

  "elev.coachcontract.stores.thread": "השיחה הזו נשמרת כדי שתוכלו לחזור אליה",

  "elev.coachcontract.controls.memory": "אתם מאשרים או מסירים עובדות זיכרון בכל רגע בפרופיל › זיכרון הילד",
  "elev.coachcontract.controls.weekly": "אפשר לכבות את ההקשר השבועי בכל רגע — הוא נעצר כבר מהשאלה הבאה",

  // AI-10 — משוב על התשובה (לא על הילד). פנייה בלשון רבים, שקטה.
  "elev.coachcontract.feedback.prompt": "התשובה הזו עזרה לכם?",
  "elev.coachcontract.feedback.up": "עזרה",
  "elev.coachcontract.feedback.down": "לא עזרה",
  "elev.coachcontract.feedback.thanks": "תודה — ככה התשובות נעשות טובות יותר.",
  "elev.coachcontract.feedback.undo": "לחיצה נוספת מבטלת",
  "elev.coachcontract.feedback.note": "המשוב הוא על התשובה, אף פעם לא על הילד שלכם.",

  "elev.coachcontract.toggle": "לאפשר למאמן לראות את הרגעים מהשבוע",
  "elev.coachcontract.toggleHint":
    'פועל, אלא אם תכבו אותו. המאמן רואה מספרים ואיך עבר הצעד האחרון — למשל "4 רגעים השבוע, 2 אבני דרך שנצפו" — אף פעם לא את ההערות שלכם.',
  "elev.coachcontract.notice.body": "ארבור משתמש עכשיו במספרים מהשבוע ובאיך עבר הצעד האחרון שלכם.",
  "elev.coachcontract.notice.change": "לשנות",
  "elev.coachcontract.notice.dismiss": "הבנתי",

  // ── Builder F · OBJ-ASK-03 (chrome half) · lens concept labels
  "elev.coachcontract.lens.concept.vygotsky": "האתגר הבא בגובה העיניים",
  "elev.coachcontract.lens.concept.bowlby": "קשר ותיקון",
  "elev.coachcontract.lens.concept.winnicott": "הורות טובה דיה",
  "elev.coachcontract.lens.concept.montessori": "עצמאות בשלבים",
  "elev.coachcontract.lens.concept.bronfenbrenner": "הסביבה סביב הילד",
  "elev.coachcontract.lens.concept.piaget": "ציפיות לפי שלב",
  "elev.coachcontract.lens.concept.erikson": "הקשת ההתפתחותית",

  // ── Builder F · OBJ-ASK-01 · the composer's accessible name
  "elev.coachcontract.composer.aria": "לשאול על הילד שלכם",
  "elev.coach.echo.chip": "שוב {type} — מה עכשיו?",

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
