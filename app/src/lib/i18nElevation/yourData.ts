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
  "elev.yourData.exportLimits": "Includes your child's private book pictures and voices, up to a limit for very large libraries. Stay signed in and online until it finishes. Keep the file private; it lists anything it could not include.",
  "elev.yourData.exportComplete": "Export prepared. The download includes a completeness receipt and private book files.",
  "elev.yourData.exportPartial": "Partial export prepared. Some data or book files could not be included. Check the download's receipt, then try again when signed in and online. Files over the stated limits remain excluded.",
  "elev.yourData.link": "Export or delete {name}'s data",
};

export const he: Record<string, string> = {
  "elev.yourData.row.title": "הנתונים שלכם",
  "elev.yourData.row.sub": "ייצוא או מחיקה של הנתונים של ילד, או מחיקת החשבון.",
  "elev.yourData.row.open": "לפתוח",
  "elev.yourData.sub": "כל מה שארבור שומר על {name}: אפשר להוריד, או למחוק לצמיתות.",
  "elev.yourData.export": "ייצוא הנתונים של {name} (JSON)",
  "elev.yourData.exportFailed": "הייצוא לא הסתיים. נסו שוב.",
  "elev.yourData.exportLimits": "כולל את התמונות והקולות הפרטיים מהספרים של הילד/ה, עד גבול מסוים בספריות גדולות מאוד. הישארו מחוברים לחשבון ולרשת עד שההורדה מסתיימת. שמרו את הקובץ באופן פרטי; הוא מפרט כל מה שלא נכלל.",
  "elev.yourData.exportComplete": "הייצוא הוכן. ההורדה כוללת דוח שלמות וקובצי ספר פרטיים.",
  "elev.yourData.exportPartial": "הוכן ייצוא חלקי. חלק מהנתונים או מקובצי הספר לא נכללו. בדקו את הדוח בהורדה ונסו שוב כשאתם מחוברים לחשבון ולרשת. קבצים שחורגים מהמגבלות שצוינו יישארו מחוץ לייצוא.",
  "elev.yourData.link": "ייצוא או מחיקה של הנתונים של {name}",
};
