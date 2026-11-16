/**
 * v10.1 — the words the Development check page adds around production's own
 * (the guide). Production strings stay in lib/i18n.
 */
export const SCREENING_V10_COPY: Readonly<Record<"en" | "he", { onThisPage: string; checkSub: string }>> = {
  en: { onThisPage: "On this page", checkSub: "Under 4 minutes" },
  he: { onThisPage: "בעמוד הזה", checkSub: "פחות מ־4 דקות" },
};
