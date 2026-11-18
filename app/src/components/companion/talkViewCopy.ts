/**
 * Surface-owned copy for the expanded Talk with Arbor view (design v10.3,
 * N-Talk boards): the reading guide and the palette key. Both parent languages
 * travel together (no inline he/en ternaries); Arbor never says "I".
 */
export const TALK_COPY = {
  en: {
    guideLabel: "How to read this answer",
    stops: ["Your question", "What Arbor used", "Arbor's answer", "Steps"],
    stopSubs: ["what you asked", "where it came from", "a draft you decide", "keep one, then use it"],
    keyLabel: "Key",
    keys: { question: "Your question", source: "Source", draft: "Arbor draft", kept: "Step kept", suggested: "Step suggested", plan: "In a plan" },
    /** Starters from the parent's own records (N-Talk, empty state). */
    starterKept: "You kept this",
    starterHard: "A hard moment",
    starterNote: "You wrote this",
    starterElse: "Something else",
    starterElseSub: "In your own words",
    startersLabel: "Start from something you logged, or ask in your own words.",
    /** "What Arbor used" (read-only): what this answer was built from. */
    usedTitle: "What Arbor used",
    usedGuides: (n: number) => (n === 1 ? "1 guide" : `${n} guides`),
    usedNotes: (n: number) => (n === 1 ? "1 remembered note" : `${n} remembered notes`),
    usedNotesSub: "Memory you approved, sent with this question",
    usedProgram: (name: string, week: number) => `${name} · week ${week}`,
  },
  he: {
    guideLabel: "איך קוראים את התשובה",
    stops: ["השאלה שלכם", "על מה ארבור נשענה", "התשובה של ארבור", "צעדים"],
    stopSubs: ["מה ששאלתם", "מאיפה זה הגיע", "טיוטה שאתם מחליטים עליה", "בוחרים אחד, ואז משתמשים בו"],
    keyLabel: "מקרא",
    keys: { question: "השאלה שלכם", source: "מקור", draft: "טיוטה של ארבור", kept: "צעד ששמרתם", suggested: "צעד מוצע", plan: "בתוכנית" },
    starterKept: "שמרתם את זה",
    starterHard: "רגע קשה",
    starterNote: "כתבתם את זה",
    starterElse: "משהו אחר",
    starterElseSub: "במילים שלכם",
    startersLabel: "מתחילים ממשהו שרשמתם, או שואלים במילים שלכם.",
    usedTitle: "על מה ארבור נשענה",
    usedGuides: (n: number) => (n === 1 ? "מדריך אחד" : `${n} מדריכים`),
    usedNotes: (n: number) => (n === 1 ? "זיכרון אחד" : `${n} זיכרונות`),
    usedNotesSub: "זיכרון שאישרתם, נשלח עם השאלה הזו",
    usedProgram: (name: string, week: number) => `${name} · שבוע ${week}`,
  },
} as const;

export type TalkCopy = (typeof TALK_COPY)["en"];
export const talkCopy = (lang: string): TalkCopy => (lang === "he" ? TALK_COPY.he : TALK_COPY.en) as TalkCopy;
