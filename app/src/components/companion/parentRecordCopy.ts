/** Scoped EN/HE copy for the record and its navigation, independent of legacy hub labels. */
export const PARENT_RECORD_COPY = {
  en: {
    records: "Records", toolsAndSupport: "Tools and support",
    profile: "Profile", profileDetail: "Details, interests and family context",
    memory: "Saved notes", memoryDetail: "Review what Arbor remembers",
    suggestedFocus: "Something to watch for", chosenFocus: "What you chose to watch for", reviewObservation: "Review observation",
    watchCleared: "Your watch choice was cleared.", undo: "Undo",
    storySummary: "Story summary", reviewMemory: "Review saved notes",
  },
  he: {
    records: "תיעוד", toolsAndSupport: "כלים ותמיכה",
    profile: "פרופיל", profileDetail: "פרטים, תחומי עניין והקשר משפחתי",
    memory: "הערות שמורות", memoryDetail: "לעבור על מה שארבור זוכר",
    suggestedFocus: "משהו לשים לב אליו", chosenFocus: "מה שבחרתם לשים לב אליו", reviewObservation: "לעדכן תצפית",
    watchCleared: "הבחירה שלכם במה לשים לב אליו נוקתה.", undo: "לבטל",
    storySummary: "תקציר הסיפור", reviewMemory: "לעבור על ההערות השמורות",
  },
} as const;
