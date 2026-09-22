/* ════════════════════════════════════════════════════════════════════════════
   heroCreate — M4 (kids gauntlet, 22 Sep 2026): every string on the HERO
   CREATION step, in both languages.

   Two surfaces share this namespace because they are one journey:
     1. AvatarCreator (components/profile/AvatarCreator.tsx) — the character
        picker, style picker, descriptor fields and the photo path. Its strings
        were English literals (Astra secondary finding), so a Hebrew family met
        English exactly where the child's own character is chosen.
     2. The one parent-side step before Kid Mode
        (components/kidmode/HeroFirstStep.tsx) — same wording family as the
        ComicsTab / HeroJourneyTab `hero-first-gate`, never a third phrasing.

   Register: PARENT. Calm, no verdicts, no clinical vocabulary. Interpolated
   names ride through translate(), which bidi-isolates them (lib/i18n.ts).
   ════════════════════════════════════════════════════════════════════════════ */

export const en: Record<string, string> = {
  // ── Creator shell ─────────────────────────────────────────────────────────
  "elev.hero.creator.title": "Create {name}'s hero",
  "elev.hero.creator.current": "Current hero — it stays saved until you choose Use.",

  // ── Character picker (radiogroup) ─────────────────────────────────────────
  "elev.hero.character.legend": "Character",
  "elev.hero.character.group": "Character idea",
  "elev.hero.character.princess": "Princess",
  "elev.hero.character.superhero": "Superhero",
  "elev.hero.character.explorer": "Explorer",
  "elev.hero.character.custom": "My own idea",
  "elev.hero.character.none": "No character — surprise us",
  "elev.hero.character.customLabel": "My character idea",
  "elev.hero.character.customPlaceholder": "A baker, stargazer, animal friend…",

  // ── Mode + style ──────────────────────────────────────────────────────────
  "elev.hero.mode.group": "How to start",
  "elev.hero.mode.describe": "Describe",
  "elev.hero.mode.photo": "From a photo",
  "elev.hero.style.legend": "Style",
  "elev.hero.style.comichero": "Comic hero",
  "elev.hero.style.storybook": "Storybook",
  "elev.hero.style.soft3d": "Soft 3D",
  "elev.hero.style.watercolor": "Watercolor",
  "elev.hero.style.flat": "Flat & cute",

  // ── Describe fields ───────────────────────────────────────────────────────
  "elev.hero.field.hair": "Hair",
  "elev.hero.field.hair.ph": "e.g. short curly brown",
  "elev.hero.field.skin": "Skin tone",
  "elev.hero.field.skin.ph": "e.g. warm tan",
  "elev.hero.field.eyes": "Eyes",
  "elev.hero.field.eyes.ph": "e.g. big brown",
  "elev.hero.field.vibe": "Personality",
  "elev.hero.field.vibe.ph": "e.g. curious and cheerful",

  // ── Photo path ────────────────────────────────────────────────────────────
  "elev.hero.photo.choose": "Choose a photo",
  "elev.hero.photo.change": "Choose a different photo",
  "elev.hero.photo.alt": "The photo you chose",
  "elev.hero.photo.unreadable": "We couldn't read that image — try another one.",

  // ── Result + actions ──────────────────────────────────────────────────────
  "elev.hero.preview.say": "Here's a character. Use it, or create another.",
  "elev.hero.cta.create": "Create hero",
  "elev.hero.cta.again": "Try again",
  "elev.hero.cta.creating": "Creating…",
  "elev.hero.cta.use": "Use this hero",

  // ── The one parent-side step before Kid Mode ──────────────────────────────
  "elev.hero.step.title": "First, create {name}'s hero",
  "elev.hero.step.body": "Worlds, stories and comics are drawn around {name}'s illustrated character — never around a real photo.",
  "elev.hero.step.create": "Create {name}'s hero",
  "elev.hero.step.continue": "Continue with Sprout",

  // ── Write honesty ─────────────────────────────────────────────────────────
  "elev.hero.save.failed": "We couldn't save that hero. Check your connection and try again.",
  "elev.hero.saveProfile.failed": "We couldn't save those changes. Check your connection and try again.",
};

export const he: Record<string, string> = {
  "elev.hero.creator.title": "צרו את הגיבור של {name}",
  "elev.hero.creator.current": "הדמות הנוכחית נשמרת עד שתבחרו להשתמש בחדשה.",

  "elev.hero.character.legend": "דמות",
  "elev.hero.character.group": "רעיון לדמות",
  "elev.hero.character.princess": "נסיכה",
  "elev.hero.character.superhero": "גיבור על",
  "elev.hero.character.explorer": "חוקר",
  "elev.hero.character.custom": "רעיון משלי",
  "elev.hero.character.none": "בלי דמות — הפתיעו אותנו",
  "elev.hero.character.customLabel": "הרעיון שלי לדמות",
  "elev.hero.character.customPlaceholder": "אופה, צופה כוכבים, חבר של חיות…",

  "elev.hero.mode.group": "איך מתחילים",
  "elev.hero.mode.describe": "בתיאור",
  "elev.hero.mode.photo": "מתמונה",
  "elev.hero.style.legend": "סגנון",
  "elev.hero.style.comichero": "גיבור קומיקס",
  "elev.hero.style.storybook": "ספר סיפורים",
  "elev.hero.style.soft3d": "תלת-ממד רך",
  "elev.hero.style.watercolor": "צבעי מים",
  "elev.hero.style.flat": "שטוח וחמוד",

  "elev.hero.field.hair": "שיער",
  "elev.hero.field.hair.ph": "למשל תלתלים חומים קצרים",
  "elev.hero.field.skin": "גוון עור",
  "elev.hero.field.skin.ph": "למשל שזוף חמים",
  "elev.hero.field.eyes": "עיניים",
  "elev.hero.field.eyes.ph": "למשל חומות גדולות",
  "elev.hero.field.vibe": "אופי",
  "elev.hero.field.vibe.ph": "למשל סקרן ועליז",

  "elev.hero.photo.choose": "בחרו תמונה",
  "elev.hero.photo.change": "בחרו תמונה אחרת",
  "elev.hero.photo.alt": "התמונה שבחרתם",
  "elev.hero.photo.unreadable": "לא הצלחנו לקרוא את התמונה — נסו אחרת.",

  "elev.hero.preview.say": "הנה דמות. אפשר להשתמש בה או ליצור אחרת.",
  "elev.hero.cta.create": "צרו גיבור",
  "elev.hero.cta.again": "נסו שוב",
  "elev.hero.cta.creating": "יוצרים…",
  "elev.hero.cta.use": "השתמשו בדמות הזו",

  "elev.hero.step.title": "קודם כול, צרו את הגיבור של {name}",
  "elev.hero.step.body": "העולמות, הסיפורים והקומיקס מצוירים סביב הדמות המאוירת של {name} — לא סביב תמונה אמיתית.",
  "elev.hero.step.create": "צרו את הגיבור של {name}",
  "elev.hero.step.continue": "המשיכו עם ספראוט",

  "elev.hero.save.failed": "לא הצלחנו לשמור את הגיבור. בדקו את החיבור ונסו שוב.",
  "elev.hero.saveProfile.failed": "לא הצלחנו לשמור את השינויים. בדקו את החיבור ונסו שוב.",
};
