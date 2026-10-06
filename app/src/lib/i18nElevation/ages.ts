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
 *   · practice.* / together.* / tonight.* — B-PLAY-24, the parent-side age
 *     gate: under three, three "together" cards, the Kid Mode door hidden
 *     behind "From 3, {name} can play on her own", Tonight = her question.
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

  "elev.ages.practice.fromThree": "From 3, {name} can play on their own",
  "elev.ages.practice.fromThree.girl": "From 3, {name} can play on her own",
  "elev.ages.practice.fromThree.boy": "From 3, {name} can play on his own",
  "elev.ages.together.title": "Together today",
  "elev.ages.together.sub": "Games you play with {name} — no screen needed.",
  "elev.ages.together.did": "We did this",
  "elev.ages.together.kept": "Kept in the journal",
  "elev.ages.together.copy-faces.title": "Copy-me faces",
  "elev.ages.together.copy-faces.do": "Make a big surprised face, then wait. Copy whatever face comes back.",
  "elev.ages.together.copy-faces.say": "Oh! Surprised! Now your turn.",
  "elev.ages.together.copy-faces.moment": "Played copy-me faces together",
  "elev.ages.together.roll-ball.title": "Roll the ball",
  "elev.ages.together.roll-ball.do": "Sit facing each other, legs apart, and roll a soft ball back and forth.",
  "elev.ages.together.roll-ball.say": "Ready… roll! Your turn.",
  "elev.ages.together.roll-ball.moment": "Rolled the ball back and forth together",
  "elev.ages.together.same-bedtime.title": "The same bedtime",
  "elev.ages.together.same-bedtime.do": "Bath, pyjamas, one book, lights low — in the same order every night.",
  "elev.ages.together.same-bedtime.say": "Bath, pyjamas, book, sleep.",
  "elev.ages.together.same-bedtime.moment": "Kept the same bedtime routine",
  "elev.ages.tonight.question": "What was the best part of {name}'s day?",
  "elev.ages.tonight.sub": "Say it together at bedtime, then keep one line.",
  "elev.ages.tonight.write": "Keep tonight's line",
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

  "elev.ages.practice.fromThree": "מגיל 3 אפשר לשחק כאן לבד",
  "elev.ages.practice.fromThree.girl": "מגיל 3, {name} תוכל לשחק כאן לבד",
  "elev.ages.practice.fromThree.boy": "מגיל 3, {name} יוכל לשחק כאן לבד",
  "elev.ages.together.title": "יחד היום",
  "elev.ages.together.sub": "משחקים שמשחקים יחד עם {name} — בלי מסך.",
  "elev.ages.together.did": "עשינו את זה",
  "elev.ages.together.kept": "נשמר ביומן",
  "elev.ages.together.copy-faces.title": "פרצופים של חיקוי",
  "elev.ages.together.copy-faces.do": "עשו פרצוף מופתע גדול וחכו. חקו כל פרצוף שחוזר אליכם.",
  "elev.ages.together.copy-faces.say": "או! הפתעה! עכשיו תורך.",
  "elev.ages.together.copy-faces.moment": "שיחקנו יחד בפרצופים של חיקוי",
  "elev.ages.together.roll-ball.title": "לגלגל כדור",
  "elev.ages.together.roll-ball.do": "שבו זה מול זה ברגליים פשוקות וגלגלו כדור רך הלוך ושוב.",
  "elev.ages.together.roll-ball.say": "מוכנים… מגלגלים! תורך.",
  "elev.ages.together.roll-ball.moment": "גלגלנו כדור הלוך ושוב יחד",
  "elev.ages.together.same-bedtime.title": "אותה שגרת שינה",
  "elev.ages.together.same-bedtime.do": "אמבטיה, פיג׳מה, ספר אחד, אור עמום — באותו סדר בכל ערב.",
  "elev.ages.together.same-bedtime.say": "אמבטיה, פיג׳מה, ספר, שינה.",
  "elev.ages.together.same-bedtime.moment": "שמרנו על אותה שגרת שינה",
  "elev.ages.tonight.question": "מה היה הרגע הכי טוב ביום של {name}?",
  "elev.ages.tonight.sub": "אמרו את זה יחד לפני השינה, ושמרו שורה אחת.",
  "elev.ages.tonight.write": "לשמור את השורה של הערב",
};
