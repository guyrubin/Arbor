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
  "elev.yourData.exportLimits": "Includes private book files in portable JSON: up to 256 files, 8 MiB each, 32 MiB total. Sign in and stay online. Keep the download private; its receipt lists any missing data.",
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
  "elev.yourData.exportLimits": "כולל קובצי ספר פרטיים ב־JSON נייד: עד 256 קבצים, עד 8 MiB לקובץ ועד 32 MiB בסך הכול. יש להתחבר לחשבון ולהישאר מחוברים לרשת. שמרו את ההורדה באופן פרטי; הדוח מפרט נתונים חסרים.",
  "elev.yourData.exportComplete": "הייצוא הוכן. ההורדה כוללת דוח שלמות וקובצי ספר פרטיים.",
  "elev.yourData.exportPartial": "הוכן ייצוא חלקי. חלק מהנתונים או מקובצי הספר לא נכללו. בדקו את הדוח בהורדה ונסו שוב כשאתם מחוברים לחשבון ולרשת. קבצים שחורגים מהמגבלות שצוינו יישארו מחוץ לייצוא.",
  "elev.yourData.link": "ייצוא או מחיקה של הנתונים של {name}",
};
