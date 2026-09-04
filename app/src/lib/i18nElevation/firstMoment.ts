/* ════════════════════════════════════════════════════════════════════════════
   ENG-L0 — the day-0 chain: first moment → first keepsake → tonight's story.

   Copy for the three-step walk that lib/firstMomentChain.ts resolves and
   components/overview/LifecycleMomentCard.tsx draws inside the existing
   "first-moment" lifecycle slot. The card's eyebrow/title/body stay in
   i18nElevation/lifecycle.ts (elev.lifecycle.first.*) — only the step labels,
   the keepsake and the story CTA live here.

   PARENT REGISTER, both languages. Hebrew is hand-written Israeli-parent
   Hebrew in the same calm tone as i18nElevation/lifecycle.ts, not a
   transliteration of the English. Nothing here is kid-facing.

   CLINICAL FIREWALL: the only number is "{count} of {total}" — how many of the
   three steps THE PARENT has taken. There is no score, no percentage, no
   verdict and nothing about the child. `elev.d0.share.caption` deliberately
   says "kept with Arbor", never "made by Arbor": the words on that card are
   the parent's own (see the ENG-16 note in lib/shareCaption.ts — the artifact
   fallback `share.caption.story` would have claimed Arbor made them).
   ════════════════════════════════════════════════════════════════════════════ */

export const en: Record<string, string> = {
  "elev.d0.aria": "Your first day with Arbor",
  // A count of the parent's own steps — never a ratio, never a ring.
  "elev.d0.progress": "{count} of {total}",
  "elev.d0.step.moment": "First moment kept",
  "elev.d0.step.keepsake": "Make a card to keep",
  "elev.d0.step.story": "Read it back tonight",
  "elev.d0.step.done": "done",
  "elev.d0.keepsake.cta": "Make the card",
  "elev.d0.keepsake.title": "{name}'s first moment",
  "elev.d0.share.caption": "{name}'s first moment, kept with Arbor. {url}",
  "elev.d0.story.cta": "Open tonight's story",
};

export const he: Record<string, string> = {
  "elev.d0.aria": "היום הראשון שלכם עם ארבור",
  "elev.d0.progress": "{count} מתוך {total}",
  "elev.d0.step.moment": "הרגע הראשון נשמר",
  "elev.d0.step.keepsake": "ליצור כרטיס לשמור",
  "elev.d0.step.story": "לקרוא אותו הערב",
  "elev.d0.step.done": "בוצע",
  "elev.d0.keepsake.cta": "ליצור את הכרטיס",
  "elev.d0.keepsake.title": "הרגע הראשון של {name}",
  "elev.d0.share.caption": "הרגע הראשון של {name}, נשמר עם ארבור. {url}",
  "elev.d0.story.cta": "לפתוח את הסיפור של הערב",
};
