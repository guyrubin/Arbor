/* i18nElevation/professions — B-LOOP-12: the NAMES of the professions that
 * own a developmental domain (lib/domains/registry.ts `professions`, output
 * metadata only — spine D2: professions are lenses).
 *
 * RENDERED ONLY in the professional view (components/journal/ProView.tsx)
 * and in Care (components/care|consult). Pinned by ProView.test.tsx: no
 * other component imports this module or spells an `elev.professions.` key.
 * A profession is shown so the parent can prepare, never as an assessment.
 * Hebrew uses the slash form for the professional (as Care already does). */

export const en: Record<string, string> = {
  "elev.professions.slp": "Speech-language therapist",
  "elev.professions.audiology": "Audiologist",
  "elev.professions.pt": "Physiotherapist",
  "elev.professions.ot": "Occupational therapist",
  "elev.professions.pediatrician": "Paediatrician",
  "elev.professions.dietitian": "Dietitian",
  "elev.professions.sleep_specialist": "Sleep specialist",
  "elev.professions.developmental_psychologist": "Developmental psychologist",
  "elev.professions.educational_psychologist": "Educational psychologist",
  "elev.professions.child_psychologist": "Child psychologist",
  "elev.professions.behavioral_therapist": "Behavioural therapist",
  "elev.professions.teacher": "Teacher",
  "elev.professions.social_worker": "Social worker",
  "elev.professions.parent_coach": "Parent coach",
  // the intake chips ("Prepare a packet for")
  "elev.professions.intake.slp": "Speech therapist",
  "elev.professions.intake.ot": "Occupational therapist",
  "elev.professions.intake.pt": "Physio",
  "elev.professions.intake.psychology": "Psychologist",
  "elev.professions.intake.pediatrician": "Paediatrician",
};

export const he: Record<string, string> = {
  "elev.professions.slp": "קלינאי/ת תקשורת",
  "elev.professions.audiology": "אודיולוג/ית",
  "elev.professions.pt": "פיזיותרפיסט/ית",
  "elev.professions.ot": "מרפא/ה בעיסוק",
  "elev.professions.pediatrician": "רופא/ת ילדים",
  "elev.professions.dietitian": "דיאטן/ית",
  "elev.professions.sleep_specialist": "יועץ/ת שינה",
  "elev.professions.developmental_psychologist": "פסיכולוג/ית התפתחותי/ת",
  "elev.professions.educational_psychologist": "פסיכולוג/ית חינוכי/ת",
  "elev.professions.child_psychologist": "פסיכולוג/ית ילדים",
  "elev.professions.behavioral_therapist": "מטפל/ת התנהגותי/ת",
  "elev.professions.teacher": "גננת או מורה",
  "elev.professions.social_worker": "עובד/ת סוציאלי/ת",
  "elev.professions.parent_coach": "מדריך/ת הורים",
  "elev.professions.intake.slp": "קלינאי/ת תקשורת",
  "elev.professions.intake.ot": "מרפא/ה בעיסוק",
  "elev.professions.intake.pt": "פיזיותרפיסט/ית",
  "elev.professions.intake.psychology": "פסיכולוג/ית",
  "elev.professions.intake.pediatrician": "רופא/ת ילדים",
};

/** The label key of a registry profession. */
export const professionLabelKey = (p: string): string => `elev.professions.${p}`;
/** The label key of an intake chip. */
export const intakeLabelKey = (p: string): string => `elev.professions.intake.${p}`;
