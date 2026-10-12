/* i18nElevation/careNetwork — the Care Network strings Appointments renders.
 *
 * B-CAREPRO-19 (G3): the professional directory (#/find-pro,
 * FindProfessional.tsx) is retired to Consult until one real, vetted record
 * exists. Its filter, search, consult-request and empty-state strings left
 * with it. What remains is what #/appointments still reads: the header
 * eyebrow, the Add button and the two visit-mode labels.
 *
 * Hebrew = warm Israeli-parent register, plain, never clinical; flagged for
 * arbor-localization native review.
 */

export const en: Record<string, string> = {
  "elev.careNet.eyebrow": "Care Network",
  "elev.careNet.appt.add": "Add appointment",
  "elev.careNet.mode.inPerson": "In person",
  "elev.careNet.mode.online": "Online",
  // B-CAREPRO-31 (G14): the appointment form + the per-visit Prepare door.
  "elev.careNet.appt.profession.label": "Who is the visit with?",
  "elev.careNet.appt.profession.choose": "Choose…",
  "elev.careNet.appt.profession.pediatrician": "Pediatrician",
  "elev.careNet.appt.profession.slp": "Speech therapist",
  "elev.careNet.appt.profession.ot": "Occupational therapist",
  "elev.careNet.appt.profession.pt": "Physiotherapist",
  "elev.careNet.appt.profession.psychologist": "Psychologist",
  "elev.careNet.appt.profession.teacher": "Teacher / kindergarten",
  "elev.careNet.appt.profession.other": "Another professional",
  "elev.careNet.appt.professional": "Professional",
  "elev.careNet.appt.name.label": "Their name (optional)",
  "elev.careNet.appt.mode.label": "How you meet",
  "elev.careNet.appt.prepare": "Prepare",
  "elev.careNet.appt.prepare.aria": "Prepare for the visit with {who}",
  "elev.careNet.appt.prepare.reason": "Visit with {profession} on {date}",
};

export const he: Record<string, string> = {
  "elev.careNet.eyebrow": "רשת הטיפול",
  "elev.careNet.appt.add": "הוספת תור",
  "elev.careNet.mode.inPerson": "פנים אל פנים",
  "elev.careNet.mode.online": "אונליין",
  "elev.careNet.appt.profession.label": "אצל מי הביקור?",
  "elev.careNet.appt.profession.choose": "בחרו…",
  "elev.careNet.appt.profession.pediatrician": "רופא/ת ילדים",
  "elev.careNet.appt.profession.slp": "קלינאי/ת תקשורת",
  "elev.careNet.appt.profession.ot": "מרפא/ה בעיסוק",
  "elev.careNet.appt.profession.pt": "פיזיותרפיסט/ית",
  "elev.careNet.appt.profession.psychologist": "פסיכולוג/ית",
  "elev.careNet.appt.profession.teacher": "גננת / מורה",
  "elev.careNet.appt.profession.other": "איש/אשת מקצוע אחר/ת",
  "elev.careNet.appt.professional": "איש/אשת מקצוע",
  "elev.careNet.appt.name.label": "השם (לא חובה)",
  "elev.careNet.appt.mode.label": "איך נפגשים",
  "elev.careNet.appt.prepare": "להתכונן",
  "elev.careNet.appt.prepare.aria": "להתכונן לביקור אצל {who}",
  "elev.careNet.appt.prepare.reason": "ביקור אצל {profession} בתאריך {date}",
};
