/* i18nElevation/celebrate — E7 celebration-moment strings (parent-side milestone
 * celebration card, rendered by ui/CelebrationMoment.tsx).
 *
 * CLINICAL FIREWALL: factual, positive-only noticing — never a %, score,
 * verdict, trend delta, or deficit framing. KID DARK-PATTERN BAN: no streaks,
 * countdowns, or urgency; one calm sentence, one-shot. Hebrew = calm
 * Israeli-parent transcreation, outcome language, no AI/tech framing;
 * flagged for arbor-localization native review. */

export const en: Record<string, string> = {
  // ── E7 · Celebration moment (Today, parent-side)
  "elev.celebrate.title": "{name} did something new",
  "elev.celebrate.titleGeneric": "Something new to celebrate",
  "elev.celebrate.sub": "A new milestone you noticed — the moment is kept.",
  // Builder G — KID-10: the bedtime ritual leaves one parent-written line.
  "elev.bedtime.goodnight.moment": "Read tonight's story together",
  "elev.bedtime.goodnight.moment.titled": "Read tonight's story together — {title}",
  "elev.bedtime.goodnight.saved": "Kept in tonight's journal.",
  // B-PLAY-14: keep what the child answered to a goodnight question; a failed
  // generation is said inline with Retry.
  "elev.bedtime.keep.label": "Keep what {name} said",
  "elev.bedtime.keep.cta": "Keep",
  "elev.bedtime.keep.done": "Kept in the journal.",
  "elev.bedtime.keep.line": "{question} {name} said: {answer}",
  "elev.bedtime.generate.failed": "The story could not be made just now. Your moments are still here.",
  "elev.stories.tonight.mode.label": "Tonight's story",
  "elev.stories.tonight.mode.today": "From today",
  "elev.stories.tonight.mode.hero": "A hero adventure",
  // B-PLAY-16: why tonight's story — from the family's own record.
  "elev.stories.tonight.reason.aim.courage": "A courage story — your family chose courage",
  "elev.stories.tonight.reason.aim.responsibility": "A responsibility story — your family chose responsibility",
  "elev.stories.tonight.reason.aim.resilience": "A resilience story — your family chose resilience",
  "elev.stories.tonight.reason.aim.empathy": "A kindness story — your family chose kindness",
  "elev.stories.tonight.reason.aim.wisdom": "A wisdom story — your family chose wisdom",
  "elev.stories.tonight.reason.aim.truth": "A truth story — your family chose honesty",
  "elev.stories.tonight.reason.unread": "One {name} hasn't heard yet",
};

export const he: Record<string, string> = {
  "elev.celebrate.title": "משהו חדש אצל {name}",
  "elev.celebrate.titleGeneric": "משהו חדש ששווה לחגוג",
  "elev.celebrate.sub": "אבן דרך חדשה ששמתם לב אליה — הרגע נשמר.",
  // Builder G — KID-10: the bedtime ritual leaves one parent-written line.
  "elev.bedtime.goodnight.moment": "קראנו יחד את סיפור הלילה",
  "elev.bedtime.goodnight.moment.titled": "קראנו יחד את סיפור הלילה — {title}",
  "elev.bedtime.goodnight.saved": "נשמר ביומן של הערב.",
  "elev.bedtime.keep.label": "לשמור את מה ש{name} אמר/ה",
  "elev.bedtime.keep.cta": "לשמור",
  "elev.bedtime.keep.done": "נשמר ביומן.",
  "elev.bedtime.keep.line": "{question} {name} ענה/תה: {answer}",
  "elev.bedtime.generate.failed": "לא הצלחנו ליצור את הסיפור כרגע. הרגעים שלכם עדיין כאן.",
  "elev.stories.tonight.mode.label": "הסיפור של הלילה",
  "elev.stories.tonight.mode.today": "מהיום שלנו",
  "elev.stories.tonight.mode.hero": "הרפתקת גיבורים",
  "elev.stories.tonight.reason.aim.courage": "סיפור על אומץ — המשפחה שלכם בחרה באומץ",
  "elev.stories.tonight.reason.aim.responsibility": "סיפור על אחריות — המשפחה שלכם בחרה באחריות",
  "elev.stories.tonight.reason.aim.resilience": "סיפור על חוסן — המשפחה שלכם בחרה בחוסן",
  "elev.stories.tonight.reason.aim.empathy": "סיפור על טוב לב — המשפחה שלכם בחרה בטוב לב",
  "elev.stories.tonight.reason.aim.wisdom": "סיפור על חוכמה — המשפחה שלכם בחרה בחוכמה",
  "elev.stories.tonight.reason.aim.truth": "סיפור על אמת — המשפחה שלכם בחרה ביושר",
  "elev.stories.tonight.reason.unread": "סיפור ש{name} עוד לא שמע/ה",
};
