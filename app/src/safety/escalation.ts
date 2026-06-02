export type EscalationCategory =
  | "self_harm"
  | "abuse_or_unsafe_home"
  | "medical_urgent"
  | "developmental_regression"
  | "caregiver_distress";

export type EscalationMatch = {
  category: EscalationCategory;
  label: string;
};

export type CrisisLocale = "nl" | "il" | "intl";

export type CrisisContact = { name: string; contact: string; note?: string };

export const escalationCategories: {
  category: EscalationCategory;
  label: string;
  patterns: RegExp[];
}[] = [
  {
    category: "self_harm",
    label: "self-harm or suicide language",
    patterns: [
      /suicid|self[-\s]?harm|kill (himself|herself|myself)|want(s)? to die/i,
      /להתאבד|אובדני|אובדנית|לפגוע בעצמי|לפגוע בעצמו|לפגוע בעצמה|רוצה למות/i
    ]
  },
  {
    category: "abuse_or_unsafe_home",
    label: "abuse, violence, neglect, or unsafe home concern",
    patterns: [
      /abuse|assault|violence|unsafe at home|neglect|molest|sexual abuse|hurting (him|her|my child)/i,
      /התעללות|תקיפה|אלימות|לא בטוח בבית|לא בטוחה בבית|הזנחה|פוגעים בו|פוגעים בה|מכה אותו|מכה אותה/i
    ]
  },
  {
    category: "medical_urgent",
    label: "urgent medical symptom",
    patterns: [
      /can't breathe|cannot breathe|blue lips|seizure|unconscious|head injury|fever.*(baby|infant|newborn)|dehydration|poison|overdose/i,
      /לא נושם|לא נושמת|קוצר נשימה|שפתיים כחולות|פרכוס|מחוסר הכרה|איבד הכרה|איבדה הכרה|פגיעת ראש|חום.*(תינוק|תינוקת|יילוד|יילודה)|התייבשות|רעל|מנת יתר/i
    ]
  },
  {
    category: "developmental_regression",
    label: "sudden developmental regression",
    patterns: [
      /sudden regression|lost speech|stopped walking|developmental regression|lost skills|no longer speaks/i,
      /רגרסיה|איבד דיבור|איבדה דיבור|הפסיק לדבר|הפסיקה לדבר|הפסיק ללכת|הפסיקה ללכת|איבוד כישורים/i
    ]
  },
  {
    category: "caregiver_distress",
    label: "caregiver distress or risk of caregiver harm",
    patterns: [
      /i('m| am) overwhelmed|i can'?t do this anymore|i cannot do this anymore|i hit (him|her|my child)|i slapped|thinking of hurting|afraid i will hurt|going to hurt/i,
      /אני מוצף|אני מוצפת|אני לא יכול יותר|אני לא יכולה יותר|הרבצתי לו|הרבצתי לה|פגעתי בו|פגעתי בה|מפחד לפגוע|מפחדת לפגוע/i
    ]
  }
];

/** Universal emergency line shown for every escalation, per locale. */
export const EMERGENCY_LINE: Record<CrisisLocale, string> = {
  nl: "If there is immediate danger, call **112** (emergency) now.",
  il: "If there is immediate danger, call **101** (ambulance / Magen David Adom) or **100** (police) now.",
  intl: "If there is immediate danger, call your local emergency number now (112 in the EU, 911 in the US)."
};

/**
 * Real, localized crisis resources. These replace the previous placeholder
 * strings — at the single highest-stakes moment, the product must give the
 * parent something genuinely actionable.
 */
export const CRISIS_RESOURCES: Record<EscalationCategory, Record<CrisisLocale, CrisisContact[]>> = {
  self_harm: {
    nl: [
      { name: "113 Zelfmoordpreventie", contact: "0800-0113 (free, 24/7) or chat at 113.nl" },
      { name: "Emergency services", contact: "112" }
    ],
    il: [
      { name: "ERAN emotional first aid (עזרה ראשונה נפשית ער\"ן)", contact: "1201 (24/7)" },
      { name: "Emergency", contact: "Magen David Adom 101 / Police 100" }
    ],
    intl: [
      { name: "Crisis line", contact: "US: call or text 988 · find a local line at findahelpline.com" },
      { name: "Emergency services", contact: "112 (EU) / 911 (US)" }
    ]
  },
  abuse_or_unsafe_home: {
    nl: [
      { name: "Veilig Thuis (abuse & domestic violence)", contact: "0800-2000 (free, 24/7)" },
      { name: "De Kindertelefoon (child helpline)", contact: "0800-0432 (free)" },
      { name: "Emergency / immediate danger", contact: "112" }
    ],
    il: [
      { name: "Ministry of Welfare emergency line (קו חירום לרווחה)", contact: "118" },
      { name: "Child online protection hotline (מוקד 105)", contact: "105" },
      { name: "Emergency / immediate danger", contact: "Police 100" }
    ],
    intl: [
      { name: "Child protection / emergency services", contact: "112 (EU) / 911 (US)" }
    ]
  },
  medical_urgent: {
    nl: [
      { name: "Emergency services", contact: "112" },
      { name: "Huisartsenpost (after-hours GP)", contact: "Call your local huisartsenpost" },
      { name: "Poison information", contact: "Via your GP or 112" }
    ],
    il: [
      { name: "Magen David Adom (ambulance)", contact: "101" },
      { name: "Poison Information Center (מרכז מידע רעלים)", contact: "04-7771900" }
    ],
    intl: [
      { name: "Emergency services", contact: "112 (EU) / 911 (US)" },
      { name: "Poison control", contact: "Your local poison control center" }
    ]
  },
  developmental_regression: {
    nl: [
      { name: "Jeugdgezondheidszorg / consultatiebureau (JGZ)", contact: "Contact your local JGZ for a prompt check" },
      { name: "Huisarts (GP)", contact: "Request an early appointment" }
    ],
    il: [
      { name: "Tipat Halav (well-baby clinic, טיפת חלב)", contact: "Contact your local clinic" },
      { name: "Pediatrician", contact: "Request an early developmental assessment" }
    ],
    intl: [
      { name: "Pediatrician / child-health service", contact: "Request a prompt developmental assessment" }
    ]
  },
  caregiver_distress: {
    nl: [
      { name: "113 Zelfmoordpreventie (if you fear losing control)", contact: "0800-0113 (24/7)" },
      { name: "Veilig Thuis", contact: "0800-2000 (free, 24/7)" },
      { name: "Emergency / immediate danger", contact: "112" }
    ],
    il: [
      { name: "ERAN emotional first aid (ער\"ן)", contact: "1201 (24/7)" },
      { name: "Ministry of Welfare line", contact: "118" },
      { name: "Emergency / immediate danger", contact: "101 / 100" }
    ],
    intl: [
      { name: "Crisis line", contact: "US: call or text 988 · findahelpline.com" },
      { name: "Emergency services", contact: "112 (EU) / 911 (US)" }
    ]
  }
};

/** Resolve which locale's crisis resources to show from a child profile or language hint. */
export const resolveCrisisLocale = (input: unknown): CrisisLocale => {
  const collect = (value: any): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join(" ");
    if (typeof value === "object") {
      return [value.language, value.locale, ...(Array.isArray(value.languages) ? value.languages : [])]
        .filter(Boolean)
        .join(" ");
    }
    return "";
  };
  const hint = collect(input).toLowerCase();
  if (/\b(nl|dutch|nederlands|netherlands|holland)\b/.test(hint)) return "nl";
  if (/(he|hebrew|ivrit|israel|עברית|iw)/.test(hint)) return "il";
  return "intl";
};

/**
 * K-01 — Softer, semantic-ish patterns the explicit regex misses: indirection,
 * paraphrase, and coded language ("wants to disappear", "can't cope"). These do
 * NOT hard-block the AI answer, but they flag the interaction for human review
 * and append a supportive safety note. A child can signal distress without ever
 * saying the word "suicide"; this is the layer that catches that.
 */
export const elevatedConcernPatterns: {
  category: EscalationCategory;
  label: string;
  patterns: RegExp[];
}[] = [
  {
    category: "self_harm",
    label: "possible hopelessness or self-harm signal",
    patterns: [
      /wants? to disappear|doesn'?t want to be here|better off without (me|him|her)|no reason to (live|go on)|hates? (himself|herself|themselves)|hurt(ing)? (himself|herself|themselves)/i,
      /רוצה להיעלם|לא רוצה להיות פה|עדיף בלי|אין סיבה|שונא את עצמו|שונאת את עצמה/i
    ]
  },
  {
    category: "caregiver_distress",
    label: "possible caregiver burnout or loss of control",
    patterns: [
      /at my breaking point|losing my temper|scared of what i('| wi)ll do|can'?t cope|end of my rope|so angry i could/i,
      /על סף|מאבד שליטה|מאבדת שליטה|פוחד ממה שאעשה|פוחדת ממה שאעשה|לא מסוגל להתמודד|לא מסוגלת להתמודד/i
    ]
  },
  {
    category: "abuse_or_unsafe_home",
    label: "possible unsafe-home signal",
    patterns: [
      /afraid of (his|her|their) (dad|father|mom|mother|parent)|scared to go home|someone touches? (him|her|them)|locked (in|out)/i,
      /מפחד מ|מפחדת מ|פוחד לחזור הביתה|פוחדת לחזור הביתה|מישהו נוגע/i
    ]
  }
];

const URGENT_RISK = /\b(urgent|emergency|crisis|high)\b/i;

/** K-01 — Treat the model's own conservative risk rating as a safety signal. */
export const isModelFlaggedUrgent = (riskLevel: unknown): boolean =>
  typeof riskLevel === "string" && URGENT_RISK.test(riskLevel);

const extractSafetyText = (fields: Record<string, unknown>) =>
  Object.entries(fields)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

/** Returns an elevated-concern match (soft gate) or null. */
export const screenForElevatedConcern = (fields: Record<string, unknown>): EscalationMatch | null => {
  const text = extractSafetyText(fields);
  if (!text) return null;
  for (const entry of elevatedConcernPatterns) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      return { category: entry.category, label: entry.label };
    }
  }
  return null;
};

/** A gentle, locale-aware safety note appended to answers flagged for review. */
export const renderSafetyFooter = (match: EscalationMatch, locale: CrisisLocale = "intl") => {
  const resources = CRISIS_RESOURCES[match.category][locale]
    .map((r) => `- **${r.name}:** ${r.contact}`)
    .join("\n");
  return `### A note on safety
Something here reads as **${match.label}**. Arbor is not a crisis service. If this is serious or you are unsure, please reach a person who can help — you do not have to carry this alone.

${EMERGENCY_LINE[locale]}

**Who to contact**
${resources}`;
};

export const screenForImmediateEscalation = (fields: Record<string, unknown>): EscalationMatch | null => {
  const text = extractSafetyText(fields);
  if (!text) return null;

  for (const category of escalationCategories) {
    if (category.patterns.some((pattern) => pattern.test(text))) {
      return { category: category.category, label: category.label };
    }
  }

  return null;
};

export const renderEscalationMarkdown = (match: EscalationMatch, locale: CrisisLocale = "intl") => {
  const resources = CRISIS_RESOURCES[match.category][locale]
    .map((r) => `- **${r.name}:** ${r.contact}${r.note ? ` — ${r.note}` : ""}`)
    .join("\n");

  return `### 1. What May Be Happening
This may involve **${match.label}**, which is outside the safe scope of an AI parenting coach.

### 2. Why It May Be Happening
Some situations need real-time assessment from a qualified person because timing, physical safety, and local context matter.

### 3. What To Do Today
Pause the Arbor plan and contact the right support now. ${EMERGENCY_LINE[locale]}

### 4. What Is The Parent Script
"I am going to get another adult to help us right now. You are not in trouble."

### 5. What To Avoid
Do not wait for an AI answer if there is danger, injury, abuse, severe illness, self-harm language, caregiver loss of control, or sudden loss of skills.

### 6. What To Observe
Write down what happened, when it started, duration, physical symptoms, safety risks, and who is currently with the child.

### 7. When To Escalate
Escalate now. Category: **${match.category}**.

### Who To Contact
${resources}`;
};
