/* i18nElevation/ages — P2A AGES: each child gets the app for her own age.
 *
 *   · today.whyPrompt — the Today prompt's why-line names the child's OWN age
 *     (lib/age/format), never an age group ("for 5-year-olds" is gone).
 *
 * The only age statement a parent reads is the child's own age; content is
 * filtered by band silently (lib/age/forChild). Hebrew flagged for native review.
 */
export const en: Record<string, string> = {
  "elev.ages.today.whyPrompt": "A new question each day, picked for {name} at {age}",
};

export const he: Record<string, string> = {
  "elev.ages.today.whyPrompt": "שאלה חדשה בכל יום, שנבחרה בשביל {name} בגיל {age}",
};
