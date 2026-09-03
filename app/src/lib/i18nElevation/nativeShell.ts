/* i18nElevation/nativeShell — Wave S+L lane N: the native shell (MOB-06/28).
 *
 * Every key is namespaced "elev.nativeshell.*" (base dictionaries win on merge).
 * Two strings only: the export hand-off failure toast (the report egress now
 * rides the share sheet, never a pop-up) and the bottom-sheet drag handle's
 * accessible name.
 */

export const en: Record<string, string> = {
  // MOB-06 / LC-10 — report egress failed on every channel (share sheet, web share, download)
  "elev.nativeshell.export.fail": "Couldn't hand the report off. Try again, or export from a computer.",
  // MOB-28 — bottom-sheet drag handle (aria-label)
  "elev.nativeshell.sheet.handle": "Drag down or tap to close",
};

export const he: Record<string, string> = {
  "elev.nativeshell.export.fail": "לא הצלחנו להעביר את הדוח. נסו שוב, או ייצאו מהמחשב.",
  "elev.nativeshell.sheet.handle": "גררו למטה או הקישו כדי לסגור",
};
