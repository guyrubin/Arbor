import type { ContentLocale } from "./governance";

const text = {
  en: {
    status: "Pilot guide",
    explanation: "Practical ideas to try gently. These pilot guides have not had individual clinical review. Adapt them to your child; pause if a step adds distress.",
    sayThisNote: "Use words that fit your family. Only promise a return time you can keep.",
    ageLabel: "Written for ages",
    years: "years",
    sources: "Sources behind this guide",
    safety: "If anyone is in immediate danger, seek local emergency help. This guide is for everyday parenting support.",
    unavailable: "This guide is no longer available for this child. Choose another moment.",
  },
  he: {
    status: "מדריך בפיילוט",
    explanation: "רעיונות מעשיים שאפשר לנסות בעדינות. מדריכי הפיילוט לא עברו בדיקה קלינית פרטנית. התאימו אותם לילד או לילדה; אם צעד מגביר מצוקה, עצרו.",
    sayThisNote: "בחרו מילים שמתאימות למשפחה. הבטיחו זמן חזרה רק אם תוכלו לעמוד בו.",
    ageLabel: "נכתב לגילי",
    years: "שנים",
    sources: "מקורות למדריך",
    safety: "אם מישהו בסכנה מיידית, פנו לעזרת חירום מקומית. המדריך נועד לתמיכה בהורות היומיומית.",
    unavailable: "המדריך הזה כבר לא זמין לילד או לילדה. אפשר לבחור רגע אחר.",
  },
} as const;

export function hardMomentPilotText(locale: ContentLocale) {
  return text[locale];
}
