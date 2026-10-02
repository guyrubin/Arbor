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
};

export const he: Record<string, string> = {
  "elev.careNet.eyebrow": "רשת הטיפול",
  "elev.careNet.appt.add": "הוספת תור",
  "elev.careNet.mode.inPerson": "פנים אל פנים",
  "elev.careNet.mode.online": "אונליין",
};
