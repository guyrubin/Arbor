/* i18nElevation/syncstatus — W0.5 (error ≠ empty) + W0.6 (offline is visible)
 * strings: the ONE global freshness banner + the topbar offline chip.
 *
 * Register: parent, calm, matter-of-fact — the child's saved story is safe and
 * still on screen; we only say the fresh copy couldn't arrive. Never alarmist,
 * never technical ("Firestore", "listener", "sync engine" are banned words).
 * Hebrew = transcreation in the calm Israeli-parent register (plural address,
 * outcome language, no AI/tech framing); flagged for arbor-localization
 * native review. */

export const en: Record<string, string> = {
  // ── Global banner (SyncStatusBanner, mounted once in Shell)
  "elev.sync.offline": "You're offline — showing saved data",
  "elev.sync.error": "Couldn't refresh some data — showing your last saved version",
  "elev.sync.retry": "Retry",
  "elev.sync.dismiss": "Hide this message",

  // ── Topbar offline chip
  "elev.sync.chip": "Offline",
  "elev.sync.chipAria": "You're offline — showing saved data",
};

export const he: Record<string, string> = {
  "elev.sync.offline": "אין חיבור לאינטרנט — מציגים את המידע השמור",
  "elev.sync.error": "לא הצלחנו לרענן חלק מהמידע — מציגים את הגרסה האחרונה שנשמרה",
  "elev.sync.retry": "לנסות שוב",
  "elev.sync.dismiss": "להסתיר את ההודעה",

  "elev.sync.chip": "לא מחוברים",
  "elev.sync.chipAria": "אין חיבור לאינטרנט — מציגים את המידע השמור",
};
