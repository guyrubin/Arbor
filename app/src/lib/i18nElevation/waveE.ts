/* i18nElevation/waveE — Wave E measurement + compounding-value copy.
 *
 * Covers ENG-13 (the week-1 "firsts"), ENG-14 ("Arbor knows {n} things" and
 * the month keepsake) and ENG-16 (the honest single-activity share caption).
 *
 * CLINICAL FIREWALL — every line here is about a COUNT of things the PARENT
 * noticed and Arbor kept. Not one string may become a score, a percentage, a
 * ring, a target, a delta, a comparison with another month or another child,
 * or a word that implies the family is behind. There is no denominator in this
 * file and none may be added: "Arbor knows 7 things" is a fact, "7 of 20" is a
 * verdict.
 *
 * KID DARK-PATTERN BAN — no streaks, no chains, no "in a row", no "don't break
 * it", no countdowns, no urgency. The first-week line counts DISTINCT days
 * cumulatively (lib/firsts.ts), which is why it can be said warmly to a parent
 * who captured on Monday, Thursday and Sunday.
 *
 * Hebrew = calm Israeli-parent transcreation, outcome language, no AI or tech
 * framing; flagged for arbor-localization native review.
 */

export const en: Record<string, string> = {
  // ── ENG-13 · The week-1 firsts (lib/firsts.ts kinds) ─────────────────────
  "elev.firsts.first_moment.title": "The first moment is kept",
  "elev.firsts.first_moment.sub": "One moment about {name}, saved. This is where the record starts.",
  "elev.firsts.first_milestone.title": "You noticed something new",
  "elev.firsts.first_milestone.sub": "The first milestone you marked for {name} is part of the record now.",
  "elev.firsts.first_story.title": "{name} has a story",
  "elev.firsts.first_story.sub": "The first one you made together is saved and yours to keep.",
  "elev.firsts.first_week.title": "{name}'s first week",
  "elev.firsts.first_week.sub": "Moments kept on {count} days this week — all of them yours.",
  "elev.firsts.share": "Keep this card",
  "elev.firsts.dismiss": "Close",

  // ── ENG-14(a) · What Arbor knows — a COUNT, never a score ────────────────
  "elev.knows.title": "Arbor knows {count} things about {name}",
  "elev.knows.titleOne": "Arbor knows one thing about {name}",
  "elev.knows.sub": "Everything here came from you, and every piece of it can be removed.",
  "elev.knows.empty.title": "Arbor knows nothing about {name} yet",
  "elev.knows.empty.sub": "Whatever you tell Arbor stays here, and stays yours.",
  "elev.knows.part.profile": "From the profile",
  "elev.knows.part.moments": "Moments kept",
  "elev.knows.part.milestones": "Milestones you noticed",
  "elev.knows.part.memories": "Memories you approved",

  // ── ENG-14(b) · The month keepsake ───────────────────────────────────────
  "elev.keepsake.month.title": "{name}'s {month}",
  "elev.keepsake.month.sub": "The month, as you kept it.",
  "elev.keepsake.month.card.moments": "{count} moments kept",
  "elev.keepsake.month.card.milestones": "{count} milestones you noticed",
  "elev.keepsake.month.card.stories": "{count} stories made",
  "elev.keepsake.month.card.quote": "In your words",
  "elev.keepsake.month.share": "Keep this month",
  "elev.keepsake.month.dismiss": "Close",

  // ── ENG-16 · The honest single-activity caption (lib/shareCaption.ts) ────
  "elev.share.caption.play": "{name} played today — one small thing that worked. {url}",
  "elev.share.caption.journal": "A moment with {name} that I kept. {url}",
  "elev.share.cta.play": "Share this moment",

  // ── ENG-16 · Keepsakes that had no share affordance ──────────────────────
  "elev.keepsake.story.share": "Keep this story",
  "elev.keepsake.journal.share": "Keep as a card",
};

export const he: Record<string, string> = {
  // ── ENG-13 · The week-1 firsts ───────────────────────────────────────────
  "elev.firsts.first_moment.title": "הרגע הראשון נשמר",
  "elev.firsts.first_moment.sub": "רגע אחד על {name} נשמר. מכאן מתחיל התיעוד.",
  "elev.firsts.first_milestone.title": "שמתם לב למשהו חדש",
  "elev.firsts.first_milestone.sub": "אבן הדרך הראשונה שסימנתם עבור {name} נמצאת בתיעוד.",
  "elev.firsts.first_story.title": "יש ל{name} סיפור",
  "elev.firsts.first_story.sub": "הסיפור הראשון שיצרתם יחד שמור, והוא שלכם.",
  "elev.firsts.first_week.title": "השבוע הראשון של {name}",
  "elev.firsts.first_week.sub": "רגעים נשמרו ב-{count} ימים השבוע — כולם שלכם.",
  "elev.firsts.share": "שמרו את הכרטיס",
  "elev.firsts.dismiss": "סגירה",

  // ── ENG-14(a) · What Arbor knows ─────────────────────────────────────────
  "elev.knows.title": "ארבור יודעת {count} דברים על {name}",
  "elev.knows.titleOne": "ארבור יודעת דבר אחד על {name}",
  "elev.knows.sub": "כל מה שכאן הגיע מכם, וכל פריט אפשר להסיר.",
  "elev.knows.empty.title": "ארבור עדיין לא יודעת דבר על {name}",
  "elev.knows.empty.sub": "מה שתספרו לארבור נשאר כאן, ונשאר שלכם.",
  "elev.knows.part.profile": "מתוך הפרופיל",
  "elev.knows.part.moments": "רגעים שנשמרו",
  "elev.knows.part.milestones": "אבני דרך ששמתם לב אליהן",
  "elev.knows.part.memories": "זיכרונות שאישרתם",

  // ── ENG-14(b) · The month keepsake ───────────────────────────────────────
  "elev.keepsake.month.title": "{month} של {name}",
  "elev.keepsake.month.sub": "החודש, כפי ששמרתם אותו.",
  "elev.keepsake.month.card.moments": "{count} רגעים שנשמרו",
  "elev.keepsake.month.card.milestones": "{count} אבני דרך ששמתם לב אליהן",
  "elev.keepsake.month.card.stories": "{count} סיפורים שנוצרו",
  "elev.keepsake.month.card.quote": "במילים שלכם",
  "elev.keepsake.month.share": "שמרו את החודש",
  "elev.keepsake.month.dismiss": "סגירה",

  // ── ENG-16 · The honest single-activity caption ──────────────────────────
  "elev.share.caption.play": "{name} שיחק/ה היום — דבר קטן אחד שעבד. {url}",
  "elev.share.caption.journal": "רגע עם {name} ששמרתי. {url}",
  "elev.share.cta.play": "שתפו את הרגע",

  // ── ENG-16 · Keepsakes that had no share affordance ──────────────────────
  "elev.keepsake.story.share": "שמרו את הסיפור",
  "elev.keepsake.journal.share": "שמרו ככרטיס",
};
