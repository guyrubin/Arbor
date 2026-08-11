export type EscalationCategory =
  | "self_harm"
  | "abuse_or_unsafe_home"
  | "medical_urgent"
  | "developmental_regression"
  | "caregiver_distress";

export type EscalationMatch = {
  category: EscalationCategory;
  label: string;
  resources: string;
};

// Universal first instruction. Always lead with emergency services; named
// national lines follow. 112 is the emergency number across the EU (NL, BE) and
// reaches emergency services from mobiles in Israel; findahelpline.com is a
// reliable international directory when a local number isn't listed here.
const EMERGENCY = "If anyone is in immediate danger, call emergency services now: **112** (EU / NL / BE / mobile in Israel) or **911** (US). In Israel, ambulance (Magen David Adom) is **101**, police **100**.";
const FIND_LOCAL = "Find a local helpline: https://findahelpline.com";

export const escalationCategories: {
  category: EscalationCategory;
  label: string;
  resources: string;
  patterns: RegExp[];
}[] = [
  {
    category: "self_harm",
    label: "self-harm or suicide language",
    resources: [
      EMERGENCY,
      "- 🇮🇱 Israel — ERAN emotional first aid: **1201** (24/7)",
      "- 🇳🇱 Netherlands — 113 Suicide Prevention: **0800-0113** (free) or **113**",
      "- 🇧🇪 Belgium — Zelfmoordlijn: **1813** · Centre de Prévention du Suicide: **0800 32 123**",
      "- 🇺🇸 US & Canada — 988 Suicide & Crisis Lifeline: **988**",
      FIND_LOCAL,
    ].join("\n"),
    patterns: [
      // EVAL-3 (capture-extract-v1 escalation-bait): "he wants to hurt himself"
      // is self-harm language a parent reports verbatim — the reflexive-pronoun
      // frame must trip the screen even without the words "die"/"suicide".
      /suicid|self[-\s]?harm|kill (himself|herself|myself)|want(s|ed)? to (die|hurt (himself|herself|myself|themselves))/i,
      /להתאבד|אובדני|אובדנית|לפגוע בעצמי|לפגוע בעצמו|לפגוע בעצמה|רוצה למות/i,
      /zelfmoord|zelf[-\s]?doden|sui[cï]cid|mezelf (pijn|iets aandoen)|wil (niet meer leven|dood)/i
    ]
  },
  {
    category: "abuse_or_unsafe_home",
    label: "abuse, violence, neglect, or unsafe home concern",
    resources: [
      "If a child is in immediate danger, call **112** (EU / mobile in Israel), **100** (Israel police) or **911** (US) now.",
      "- 🇮🇱 Israel — Police child protection: **100** · online child protection (Lametayel/105): **105**",
      "- 🇳🇱 Netherlands — Veilig Thuis (abuse & domestic violence): **0800-2000** (free, 24/7)",
      "- 🇧🇪 Belgium — **1712** (violence & abuse, NL) · SOS Enfants (FR)",
      "- 🇺🇸 US — Childhelp National Child Abuse Hotline: **1-800-422-4453**",
      FIND_LOCAL,
    ].join("\n"),
    patterns: [
      /abuse|assault|violence|unsafe at home|neglect|molest|sexual abuse|hurting (him|her|my child)/i,
      /התעללות|תקיפה|אלימות|לא בטוח בבית|לא בטוחה בבית|הזנחה|פוגעים בו|פוגעים בה|מכה אותו|מכה אותה/i,
      /misbruik|mishandel|geweld|onveilig thuis|verwaarloz|seksueel misbruik|slaat (hem|haar|mijn kind)/i
    ]
  },
  {
    category: "medical_urgent",
    label: "urgent medical symptom",
    resources: [
      "Call emergency services now: **112** (EU / mobile in Israel), **101** (Israel ambulance / MDA) or **911** (US).",
      "- 🇳🇱 Netherlands — Emergency **112**; for non-life-threatening, the out-of-hours GP (huisartsenpost).",
      "- 🇧🇪 Belgium — Emergency **112**; Poison Control (Antigifcentrum): **070 245 245**.",
      "- For a suspected poisoning, contact your local poison-control centre immediately.",
      FIND_LOCAL,
    ].join("\n"),
    patterns: [
      /can't breathe|cannot breathe|blue lips|seizure|unconscious|head injury|fever.*(baby|infant|newborn)|dehydration|poison|overdose/i,
      /לא נושם|לא נושמת|קוצר נשימה|שפתיים כחולות|פרכוס|מחוסר הכרה|איבד הכרה|איבדה הכרה|פגיעת ראש|חום.*(תינוק|תינוקת|יילוד|יילודה)|התייבשות|רעל|מנת יתר/i,
      /ademt niet|geen adem|blauwe lippen|stuip|toeval|bewusteloos|hoofdletsel|uitdroging|vergiftig|overdosis/i
    ]
  },
  {
    category: "developmental_regression",
    label: "sudden developmental regression",
    resources: [
      "Contact your pediatrician or child-health service promptly for an in-person developmental assessment.",
      "- 🇮🇱 Israel — Tipat Halav family health centre, or your pediatrician.",
      "- 🇳🇱 Netherlands — Consultatiebureau / your huisarts.",
      "- 🇧🇪 Belgium — Kind & Gezin (NL) / ONE (FR), or your pediatrician.",
      FIND_LOCAL,
    ].join("\n"),
    patterns: [
      /sudden regression|lost speech|stopped walking|developmental regression|lost skills|no longer speaks/i,
      /רגרסיה|איבד דיבור|איבדה דיבור|הפסיק לדבר|הפסיקה לדבר|הפסיק ללכת|הפסיקה ללכת|איבוד כישורים/i,
      /plotselinge achteruitgang|verloor (spraak|vaardigheden)|praat niet meer|stopte met (lopen|praten)/i
    ]
  },
  {
    category: "caregiver_distress",
    label: "caregiver distress or risk of caregiver harm",
    resources: [
      "You matter too. If you feel you might harm yourself or your child, call **112** / **911** now, or step away to a safe space and call someone you trust.",
      "- 🇮🇱 Israel — ERAN emotional first aid: **1201**",
      "- 🇳🇱 Netherlands — 113 Suicide Prevention: **0800-0113**",
      "- 🇧🇪 Belgium — Zelfmoordlijn: **1813**",
      "- 🇺🇸 US — 988 Suicide & Crisis Lifeline",
      FIND_LOCAL,
    ].join("\n"),
    patterns: [
      /i('m| am) overwhelmed|i can'?t do this anymore|i cannot do this anymore|i hit (him|her|my child)|i slapped|thinking of hurting|afraid i will hurt|going to hurt/i,
      /אני מוצף|אני מוצפת|אני לא יכול יותר|אני לא יכולה יותר|הרבצתי לו|הרבצתי לה|פגעתי בו|פגעתי בה|מפחד לפגוע|מפחדת לפגוע/i,
      /ik ben overweldigd|ik kan dit niet meer|ik sloeg|ik heb (hem|haar) geslagen|bang dat ik .{0,20}pijn doe/i
    ]
  }
];

/**
 * VC-8 (crisis output category): resolve the full escalation record for a
 * category so a crisis verdict from the OUTPUT screen can route to the SAME
 * resources surface the input screen shows (renderEscalationMarkdown verbatim —
 * the CRITICAL_HELPLINE_LITERALS tripwire covers it). Falls back to
 * caregiver_distress when the category is unknown/missing: its resources cover
 * both self-directed and child-directed harm, so a crisis stop can never
 * arrive on screen without renderable crisis help.
 */
export const escalationMatchForCategory = (category?: string | null): EscalationMatch => {
  const record =
    escalationCategories.find((c) => c.category === category) ??
    escalationCategories.find((c) => c.category === "caregiver_distress")!;
  return { category: record.category, label: record.label, resources: record.resources };
};

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
        resources: category.resources
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

### Get help now
${match.resources}`;

/* CI-05 — escalation currency hook (fail-loud on stale crisis numbers).
 *
 * The helpline literals above are life-safety-critical and drift over time
 * (numbers and services change). This declares WHEN they were last verified
 * against the live national registries and lets a periodic arbor-safety check
 * FAIL LOUD when that review is overdue — so a stale crisis number can never sit
 * silently in prod. The verification itself is a human action (open each
 * national registry and confirm the number); this module only tracks the review
 * date + the staleness tripwire and does NOT call registries at runtime. The
 * real-time fail-loud belongs in the scheduled arbor-safety job (it passes the
 * real `now`); the unit suite below verifies the mechanism deterministically. */

/** ISO date the crisis numbers above were last verified against live national
 * registries. Update this (and the numbers) on each arbor-safety re-review. */
export const HELPLINES_REVIEWED_ON = "2026-06-21";

/** Re-review cadence — crisis numbers must be re-verified at least this often. */
export const HELPLINE_REVIEW_INTERVAL_DAYS = 180;

/** Literals that must always be present in the escalation copy — a completeness
 * tripwire so an edit can't silently drop a crisis number. */
export const CRITICAL_HELPLINE_LITERALS = ["112", "988", "0800-0113", "101", "911"] as const;

export type HelplineReviewStatus = { reviewedOn: string; daysSince: number; stale: boolean };

/** Pure: is the crisis-number review overdue as of `nowMs`? Fail-loud callers
 * (the periodic arbor-safety check) treat `stale: true` as a hard failure. */
export function helplineReviewStatus(
  nowMs: number,
  reviewedOn: string = HELPLINES_REVIEWED_ON,
  intervalDays: number = HELPLINE_REVIEW_INTERVAL_DAYS,
): HelplineReviewStatus {
  const daysSince = Math.floor((nowMs - Date.parse(reviewedOn)) / 86_400_000);
  return { reviewedOn, daysSince, stale: daysSince > intervalDays };
}

/** Every critical literal still present in the live escalation copy? `false`
 * means a crisis number was dropped — the second fail-loud tripwire. */
export function escalationLiteralsIntact(): boolean {
  const all = escalationCategories.map((c) => c.resources).join("\n") + EMERGENCY;
  return CRITICAL_HELPLINE_LITERALS.every((lit) => all.includes(lit));
}

/* W0.2 — structured crisis-helpline directory (ADDITIVE ONLY).
 *
 * The markdown `resources` blocks above are the coach-side escalation copy and
 * stay untouched. The Safety screen needs the SAME numbers in a renderable
 * shape so each one can be a real `tel:` link. This directory mirrors those
 * numbers; a unit tripwire (SafetyTab.safety.test.ts) asserts every `number`
 * below still appears verbatim in the markdown above, so the two shapes cannot
 * silently drift apart. Update both together on each HELPLINES_REVIEWED_ON
 * re-review. */

export type HelplineRegion = "il" | "eu" | "nl" | "be" | "us";

export type HelplineEntry = {
  /** Stable id — also the i18n label suffix (`elev.safety.helpline.<id>`). */
  id: string;
  region: HelplineRegion;
  /** Display number, verbatim as it appears in the escalation markdown. */
  number: string;
  /** Dialable `tel:` target (digits and `+` only). */
  tel: string;
};

export const HELPLINE_DIRECTORY: readonly HelplineEntry[] = [
  { id: "il_eran",   region: "il", number: "1201",      tel: "1201" },
  { id: "il_mda",    region: "il", number: "101",       tel: "101" },
  { id: "il_police", region: "il", number: "100",       tel: "100" },
  { id: "eu_112",    region: "eu", number: "112",       tel: "112" },
  { id: "nl_113",    region: "nl", number: "0800-0113", tel: "08000113" },
  { id: "be_1813",   region: "be", number: "1813",      tel: "1813" },
  { id: "be_1712",   region: "be", number: "1712",      tel: "1712" },
  { id: "us_988",    region: "us", number: "988",       tel: "988" },
  { id: "us_911",    region: "us", number: "911",       tel: "911" },
];

/** International helpline directory — the FIND_LOCAL fallback, linkable. */
export const FIND_A_HELPLINE_URL = "https://findahelpline.com";
