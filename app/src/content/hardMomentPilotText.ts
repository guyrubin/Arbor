import type { ContentLocale } from "./governance";

const text = {
  en: {
    status: "Pilot guide",
    explanation: "Practical ideas to try gently. These pilot guides have not had individual clinical review. Adapt them to your child; pause if a step adds distress.",
    sayThisNote: "Use words that fit your family. Only promise a return time you can keep.",
    ageLabel: "Written for ages",
    years: "years",
    sources: "Sources behind this guide",
    // No standalone safety banner: the immediate-danger sentence already opens
    // every card's escalation band (see the card() factory), and a second copy
    // that no surface renders would read as shipped protection that is not.
    unavailable: "This guide is no longer available for this child. Choose another moment.",
  },
  he: {
    status: "מדריך בפיילוט",
    explanation: "רעיונות מעשיים שאפשר לנסות בעדינות. מדריכי הפיילוט לא עברו בדיקה קלינית פרטנית. התאימו אותם לילד או לילדה; אם צעד מגביר מצוקה, עצרו.",
    sayThisNote: "בחרו מילים שמתאימות למשפחה. הבטיחו זמן חזרה רק אם תוכלו לעמוד בו.",
    ageLabel: "נכתב לגילי",
    years: "שנים",
    sources: "מקורות למדריך",
    unavailable: "המדריך הזה כבר לא זמין לילד או לילדה. אפשר לבחור רגע אחר.",
  },
} as const;

export function hardMomentPilotText(locale: ContentLocale) {
  return text[locale];
}

/**
 * B-PROG-15 — a draft program's pilot line: the guide's sentence, said of a
 * program. Shown by the program page while the program's reviewStatus is
 * "draft" and gone once the clinical reviewer signs (lib/programPage
 * programPilotLine), through the same PilotNote the guides use.
 */
const programText = {
  one: {
    en: {
      status: "Pilot program",
      explanation: "Practical ideas to try gently. This pilot program has not yet had clinical review. Adapt it to your child; pause if a step adds distress.",
    },
    he: {
      status: "תוכנית בפיילוט",
      explanation: "רעיונות מעשיים שאפשר לנסות בעדינות. תוכנית הפיילוט הזאת עדיין לא עברה בדיקה קלינית. התאימו אותה לילד או לילדה; אם צעד מגביר מצוקה, עצרו.",
    },
  },
  // The chooser page sits above more than one draft program.
  many: {
    en: {
      status: "Pilot programs",
      explanation: "Practical ideas to try gently. These pilot programs have not yet had clinical review. Adapt them to your child; pause if a step adds distress.",
    },
    he: {
      status: "תוכניות בפיילוט",
      explanation: "רעיונות מעשיים שאפשר לנסות בעדינות. תוכניות הפיילוט האלה עדיין לא עברו בדיקה קלינית. התאימו אותן לילד או לילדה; אם צעד מגביר מצוקה, עצרו.",
    },
  },
} as const;

export function programPilotText(locale: ContentLocale, count: "one" | "many" = "one") {
  return programText[count][locale];
}
