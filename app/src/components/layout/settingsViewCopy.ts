/**
 * Surface-owned copy for the Settings sheet (design v10.1). Production strings
 * stay in lib/i18n.ts; this holds only the line the v10 composition adds under
 * the title. Both parent languages travel together (no inline he/en ternaries).
 */
export const SETTINGS_COPY = {
  en: { lead: "How Arbor works with you, the lock, your subscription, your data and your account." },
  he: { lead: "איך ארבור עובד איתכם, הנעילה, המנוי, הנתונים שלכם והחשבון." },
} as const;

export const settingsCopy = (lang: string) => (lang === "he" ? SETTINGS_COPY.he : SETTINGS_COPY.en);
