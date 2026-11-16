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
  },
  he: {
    guideLabel: "איך קוראים את התשובה",
    stops: ["השאלה שלכם", "על מה ארבור נשענה", "התשובה של ארבור", "צעדים"],
    stopSubs: ["מה ששאלתם", "מאיפה זה הגיע", "טיוטה שאתם מחליטים עליה", "בוחרים אחד, ואז משתמשים בו"],
    keyLabel: "מקרא",
    keys: { question: "השאלה שלכם", source: "מקור", draft: "טיוטה של ארבור", kept: "צעד ששמרתם", suggested: "צעד מוצע", plan: "בתוכנית" },
  },
} as const;

export const talkCopy = (lang: string) => (lang === "he" ? TALK_COPY.he : TALK_COPY.en);
