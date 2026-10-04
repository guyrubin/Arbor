/* i18nElevation/yourData — B-CAREPRO-35: Settings › Your data, the ONE home
 * for data rights (export a child, delete a child with its receipt, delete the
 * account). Sharing, the profile drawer and The Science link here with
 * "elev.yourData.link". The delete flow itself reuses the sec.sharing.delete.*
 * / sec.sharing.receipt.* keys it carried on Sharing (both locales exist).
 */
export const en: Record<string, string> = {
  "elev.yourData.row.title": "Your data",
  "elev.yourData.row.sub": "Export or delete a child's data, or delete your account.",
  "elev.yourData.row.open": "Open",
  "elev.yourData.sub": "Everything Arbor keeps about {name}: download it, or delete it for good.",
  "elev.yourData.export": "Export {name}'s data (JSON)",
  "elev.yourData.exportFailed": "The export didn't finish. Please try again.",
  "elev.yourData.link": "Export or delete {name}'s data",
};

export const he: Record<string, string> = {
  "elev.yourData.row.title": "הנתונים שלכם",
  "elev.yourData.row.sub": "ייצוא או מחיקה של הנתונים של ילד, או מחיקת החשבון.",
  "elev.yourData.row.open": "לפתוח",
  "elev.yourData.sub": "כל מה שארבור שומר על {name}: אפשר להוריד, או למחוק לצמיתות.",
  "elev.yourData.export": "ייצוא הנתונים של {name} (JSON)",
  "elev.yourData.exportFailed": "הייצוא לא הסתיים. נסו שוב.",
  "elev.yourData.link": "ייצוא או מחיקה של הנתונים של {name}",
};
