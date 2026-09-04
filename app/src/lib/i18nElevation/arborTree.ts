/* i18nElevation/arborTree — GP-30 strings: the tree of what the parent has
 * noticed (components/growth/ArborTreeCard).
 *
 * CLINICAL FIREWALL, copy side. Every line here attributes to the PARENT —
 * "moments you've noticed", "everything you've marked" — and never to the
 * child. There is no "{name}'s growth", no possessive on the child at all, and
 * no name interpolation in this module, because the moment the tree becomes
 * the child's tree it becomes a picture of the child's development, which is
 * the one thing it must never be.
 *
 * There is also no denominator, no share, no band, no level and no schedule
 * word: the empty state says a leaf appears when the parent marks something,
 * and says plainly that there is nothing to fill in — an empty tree is a new
 * record, never a deficit.
 *
 * Hebrew = hand-written calm Israeli-parent register (plural second person,
 * the convention the Growth surfaces already use), flagged for
 * arbor-localization native review. Never machine-translated. */

export const en: Record<string, string> = {
  "elev.arborTree.eyebrow": "Your noticing",
  "elev.arborTree.title": "One leaf for every moment you've noticed",

  // Counts only — no denominator exists to put beside these.
  "elev.arborTree.count.one": "1 moment noticed so far",
  "elev.arborTree.count.many": "{n} moments noticed so far",
  // Says out loud that this number is NOT the age-window number the record
  // card shows, so two honest numbers on one hub never read as a contradiction.
  "elev.arborTree.basis": "Everything you've marked, from the very first — not only this age window.",

  // Day 0. Warm, and carrying no numeral at all.
  "elev.arborTree.empty.title": "No leaves yet",
  "elev.arborTree.empty.body":
    "The first one appears the moment you mark something you've seen. There is no schedule here and nothing to fill in.",
  "elev.arborTree.empty.cta": "Open the milestones map",

  // Shown only once the drawing has stopped adding marks.
  "elev.arborTree.cap": "The drawing settles at {n} leaves. The number above is the true one.",

  // The text equivalent of the picture, for anyone who never sees it.
  "elev.arborTree.aria.empty": "A drawing of a tree, with no leaves yet.",
  "elev.arborTree.aria.one": "A drawing of a tree. One leaf, for the 1 moment you have noticed so far.",
  "elev.arborTree.aria.many": "A drawing of a tree, standing for the {n} moments you have noticed so far.",

  "elev.arborTree.why":
    "Counted from the milestones you have marked as noticed, across the whole record. Nothing here is scored, ranked or compared.",
};

export const he: Record<string, string> = {
  "elev.arborTree.eyebrow": "מה שראיתם",
  "elev.arborTree.title": "עלה אחד לכל רגע שראיתם",

  "elev.arborTree.count.one": "רגע אחד שראיתם עד עכשיו",
  "elev.arborTree.count.many": "{n} רגעים שראיתם עד עכשיו",
  "elev.arborTree.basis": "כל מה שסימנתם, מההתחלה — לא רק בטווח הגיל הנוכחי.",

  "elev.arborTree.empty.title": "עדיין אין עלים",
  "elev.arborTree.empty.body":
    "הראשון יופיע ברגע שתסמנו משהו שראיתם. אין כאן לוח זמנים ואין שום דבר שצריך למלא.",
  "elev.arborTree.empty.cta": "לפתוח את מפת אבני הדרך",

  "elev.arborTree.cap": "הציור נעצר על {n} עלים. המספר שלמעלה הוא המספר המלא.",

  "elev.arborTree.aria.empty": "ציור של עץ, עדיין בלי עלים.",
  "elev.arborTree.aria.one": "ציור של עץ. עלה אחד, לרגע האחד שראיתם עד עכשיו.",
  "elev.arborTree.aria.many": "ציור של עץ שמייצג {n} רגעים שראיתם עד עכשיו.",

  "elev.arborTree.why":
    "נספר מתוך אבני הדרך שסימנתם שראיתם, על פני כל התיעוד. שום דבר כאן לא מקבל ציון, לא מדורג ולא מושווה.",
};
