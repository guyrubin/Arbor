export type EscalationCategory =
  | "self_harm"
  | "abuse_or_unsafe_home"
  | "medical_urgent"
  | "developmental_regression"
  | "caregiver_distress";

export type EscalationMatch = {
  category: EscalationCategory;
  label: string;
  resourcePlaceholder: string;
};

const escalationCategories: {
  category: EscalationCategory;
  label: string;
  resourcePlaceholder: string;
  patterns: RegExp[];
}[] = [
  {
    category: "self_harm",
    label: "self-harm or suicide language",
    resourcePlaceholder: "Local resource placeholder: add country-specific child/adolescent crisis line and emergency number.",
    patterns: [
      /suicid|self[-\s]?harm|kill (himself|herself|myself)|want(s)? to die/i,
      /להתאבד|אובדני|אובדנית|לפגוע בעצמי|לפגוע בעצמו|לפגוע בעצמה|רוצה למות/i
    ]
  },
  {
    category: "abuse_or_unsafe_home",
    label: "abuse, violence, neglect, or unsafe home concern",
    resourcePlaceholder: "Local resource placeholder: add country-specific child protection, domestic violence, and emergency contacts.",
    patterns: [
      /abuse|assault|violence|unsafe at home|neglect|molest|sexual abuse|hurting (him|her|my child)/i,
      /התעללות|תקיפה|אלימות|לא בטוח בבית|לא בטוחה בבית|הזנחה|פוגעים בו|פוגעים בה|מכה אותו|מכה אותה/i
    ]
  },
  {
    category: "medical_urgent",
    label: "urgent medical symptom",
    resourcePlaceholder: "Local resource placeholder: add local pediatric urgent-care line, nurse line, poison control, and emergency number.",
    patterns: [
      /can't breathe|cannot breathe|blue lips|seizure|unconscious|head injury|fever.*(baby|infant|newborn)|dehydration|poison|overdose/i,
      /לא נושם|לא נושמת|קוצר נשימה|שפתיים כחולות|פרכוס|מחוסר הכרה|איבד הכרה|איבדה הכרה|פגיעת ראש|חום.*(תינוק|תינוקת|יילוד|יילודה)|התייבשות|רעל|מנת יתר/i
    ]
  },
  {
    category: "developmental_regression",
    label: "sudden developmental regression",
    resourcePlaceholder: "Local resource placeholder: add pediatrician, youth health clinic, and developmental screening referral contacts.",
    patterns: [
      /sudden regression|lost speech|stopped walking|developmental regression|lost skills|no longer speaks/i,
      /רגרסיה|איבד דיבור|איבדה דיבור|הפסיק לדבר|הפסיקה לדבר|הפסיק ללכת|הפסיקה ללכת|איבוד כישורים/i
    ]
  },
  {
    category: "caregiver_distress",
    label: "caregiver distress or risk of caregiver harm",
    resourcePlaceholder: "Local resource placeholder: add parent crisis support, family doctor, emergency mental-health line, and trusted backup-care contact.",
    patterns: [
      /i('m| am) overwhelmed|i can'?t do this anymore|i cannot do this anymore|i hit (him|her|my child)|i slapped|thinking of hurting|afraid i will hurt|going to hurt/i,
      /אני מוצף|אני מוצפת|אני לא יכול יותר|אני לא יכולה יותר|הרבצתי לו|הרבצתי לה|פגעתי בו|פגעתי בה|מפחד לפגוע|מפחדת לפגוע/i
    ]
  }
];

const extractSafetyText = (fields: Record<string, unknown>) =>
  Object.entries(fields)
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

export const screenForImmediateEscalation = (fields: Record<string, unknown>): EscalationMatch | null => {
  const text = extractSafetyText(fields);
  if (!text) return null;

  for (const category of escalationCategories) {
    if (category.patterns.some((pattern) => pattern.test(text))) {
      return {
        category: category.category,
        label: category.label,
        resourcePlaceholder: category.resourcePlaceholder
      };
    }
  }

  return null;
};

export const renderEscalationMarkdown = (match: EscalationMatch) => `### 1. What May Be Happening
This may involve **${match.label}**, which is outside the safe scope of an AI parenting coach.

### 2. Why It May Be Happening
Some situations need real-time assessment from a qualified person because timing, physical safety, and local context matter.

### 3. What To Do Today
Pause the Arbor plan and contact the right local support now. If there is immediate danger, use local emergency services.

### 4. What Is The Parent Script
"I am going to get another adult to help us right now. You are not in trouble."

### 5. What To Avoid
Do not wait for an AI answer if there is danger, injury, abuse, severe illness, self-harm language, caregiver loss of control, or sudden loss of skills.

### 6. What To Observe
Write down what happened, when it started, duration, physical symptoms, safety risks, and who is currently with the child.

### 7. When To Escalate
Escalate now. Category: **${match.category}**.

### Local Resource Placeholder
${match.resourcePlaceholder}`;
