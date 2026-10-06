/* i18nElevation/ages — P2A AGES: each child gets the app for her own age.
 *
 *   · today.whyPrompt — the Today prompt's why-line names the child's OWN age
 *     (lib/age/format), never an age group ("for 5-year-olds" is gone).
 *   · starter.*       — B-TODAY-35, Today's band starters for 12–36 months
 *     (lib/today/starters): same bedtime · first words · tiny tastes · the
 *     next routine check-up. A title about the child carries .girl / .boy
 *     variants in both locales (lib/today/fromRecord genderedKey); the
 *     neutral key is "they" in EN and impersonal in HE.
 *   · shell.showing   — B-SHELL-38, the sidebar caption under the identity
 *     line: "Showing Leni's app · 22 months" (HE "של" forms by gender).
 *
 * The only age statement a parent reads is the child's own age; content is
 * filtered by band silently (lib/age/forChild). Never a milestone count,
 * never "behind". Hebrew flagged for native review.
 */
export const en: Record<string, string> = {
  "elev.ages.today.whyPrompt": "A new question each day, picked for {name} at {age}",

  "elev.ages.starter.aria": "Something for today",
  "elev.ages.starter.bedtime.title": "Same bedtime, every night",
  "elev.ages.starter.bedtime.body": "The same short routine every night helps young children fall asleep sooner and wake less — trials showed this in toddlers.",
  "elev.ages.starter.bedtime.action": "Open the four-step routine",
  "elev.ages.starter.words.title": "What did they say today?",
  "elev.ages.starter.words.title.girl": "What did she say today?",
  "elev.ages.starter.words.title.boy": "What did he say today?",
  "elev.ages.starter.words.body": "Write the words just as they came out. One word is plenty.",
  "elev.ages.starter.words.action": "Write the words",
  "elev.ages.starter.tastes.title": "One tiny taste today",
  "elev.ages.starter.tastes.body": "Put one new food beside a familiar one. No pressure to taste it — seeing it counts.",
  "elev.ages.starter.tastes.action": "Note what happened",
  "elev.ages.starter.checkup.title": "{name}'s check-up at {age} is coming",
  "elev.ages.starter.checkup.body": "Here's what they'll ask, so you can bring your notes.",
  "elev.ages.starter.checkup.action": "See what they'll ask",

  "elev.ages.shell.showing": "Showing {name}'s app · {age}",
  "elev.ages.shell.showing.girl": "Showing {name}'s app · {age}",
  "elev.ages.shell.showing.boy": "Showing {name}'s app · {age}",
};

export const he: Record<string, string> = {
  "elev.ages.today.whyPrompt": "שאלה חדשה בכל יום, שנבחרה בשביל {name} בגיל {age}",

  "elev.ages.starter.aria": "משהו להיום",
  "elev.ages.starter.bedtime.title": "אותה שגרת שינה, כל ערב",
  "elev.ages.starter.bedtime.body": "אותה שגרה קצרה בכל ערב עוזרת לילדים צעירים להירדם מהר יותר ולהתעורר פחות — כך הראו מחקרים בפעוטות.",
  "elev.ages.starter.bedtime.action": "לפתוח את השגרה בארבעה צעדים",
  "elev.ages.starter.words.title": "אילו מילים נשמעו היום?",
  "elev.ages.starter.words.title.girl": "מה היא אמרה היום?",
  "elev.ages.starter.words.title.boy": "מה הוא אמר היום?",
  "elev.ages.starter.words.body": "כתבו את המילים בדיוק כמו שנאמרו. מילה אחת זה מספיק.",
  "elev.ages.starter.words.action": "לכתוב את המילים",
  "elev.ages.starter.tastes.title": "טעימה קטנה אחת היום",
  "elev.ages.starter.tastes.body": "שימו מאכל חדש אחד ליד מאכל מוכר. בלי לחץ לטעום — גם לראות זה נחשב.",
  "elev.ages.starter.tastes.action": "לרשום מה קרה",
  "elev.ages.starter.checkup.title": "הבדיקה של {name} בגיל {age} מתקרבת",
  "elev.ages.starter.checkup.body": "הנה מה ישאלו שם, כדי שתוכלו להביא את הרשימות שלכם.",
  "elev.ages.starter.checkup.action": "לראות מה ישאלו",

  "elev.ages.shell.showing": "מוצגת האפליקציה של {name} · {age}",
  "elev.ages.shell.showing.girl": "מוצגת האפליקציה שלה, של {name} · {age}",
  "elev.ages.shell.showing.boy": "מוצגת האפליקציה שלו, של {name} · {age}",
};
