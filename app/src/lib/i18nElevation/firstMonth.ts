/* ════════════════════════════════════════════════════════════════════════════
   ENG-L4 — the first-month keepsake (day 30).

   Copy for the count lines and the keepsake share that
   components/overview/LifecycleMomentCard.tsx draws inside the "first-month"
   lifecycle slot, off the window lib/firstMonthKeepsake.ts derives. The card's
   eyebrow/title/body stay in i18nElevation/lifecycle.ts
   (elev.lifecycle.month.*), exactly as ENG-L0's step copy sits here while its
   chrome stays there.

   HONEST AT ZERO. `elev.l4.quiet` is the line a parent sees when they kept
   nothing in thirty days. It is neither a congratulation nor a correction: it
   says what is true (the month was theirs, the record is open) and asks for
   nothing. A parent who logged almost nothing must not be told they did a lot,
   and must not be told they did too little.

   CLINICAL FIREWALL. The only numbers are two counts of what the PARENT did —
   things kept, days written on. No percentage, no score, no verdict, no
   comparison with other families, no month-on-month delta, and nothing that
   is a statement about the child.

   NOT A PROGRESS CLAIM. `elev.l4.share.caption` says "kept with Arbor", never
   "{name}'s progress this month" — that is the growth_card artifact fallback
   the ENG-16 note in lib/shareCaption.ts exists to stop, and a first month is
   an elapsed month, not a month of measured progress.

   PARENT REGISTER, both languages. Hebrew is hand-written Israeli-parent
   Hebrew in the same calm tone as i18nElevation/lifecycle.ts. Nothing here is
   kid-facing.
   ════════════════════════════════════════════════════════════════════════════ */

export const en: Record<string, string> = {
  "elev.l4.aria": "{name}'s first month with Arbor",
  // Counts of what the parent did, inside a window that cannot grow.
  "elev.l4.moments.one": "One moment, kept.",
  "elev.l4.moments.many": "{n} moments, kept.",
  "elev.l4.days.one": "On one day, you wrote something down.",
  "elev.l4.days.many": "On {n} days, you wrote something down.",
  // The zero case. Warm, true, and asking for nothing.
  "elev.l4.quiet": "This first month was yours to live, not to write down. Anything you keep from here joins the same record.",
  "elev.l4.keepsake.cta": "Make a card to keep",
  "elev.l4.keepsake.title": "{name}'s first month",
  "elev.l4.share.caption": "{name}'s first month, kept with Arbor. {url}",
};

export const he: Record<string, string> = {
  "elev.l4.aria": "החודש הראשון של {name} עם ארבור",
  "elev.l4.moments.one": "רגע אחד, שמור.",
  "elev.l4.moments.many": "{n} רגעים, שמורים.",
  "elev.l4.days.one": "ביום אחד רשמתם משהו.",
  "elev.l4.days.many": "ב־{n} ימים רשמתם משהו.",
  "elev.l4.quiet": "החודש הראשון הזה היה שלכם לחיות אותו, לא לכתוב אותו. כל מה שתשמרו מכאן מצטרף לאותו תיעוד.",
  "elev.l4.keepsake.cta": "ליצור כרטיס לשמור",
  "elev.l4.keepsake.title": "החודש הראשון של {name}",
  "elev.l4.share.caption": "החודש הראשון של {name}, נשמר עם ארבור. {url}",
};
