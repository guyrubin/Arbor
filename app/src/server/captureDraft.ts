/**
 * B-AI-15 — /api/extract-log returns ONE log per capture and stays neutral
 * about the parent, whatever the model drafted.
 *
 * The prompt (ai/prompts.ts extract_log 1.2.0) asks for one moment in the
 * parent's own words; this is the deterministic floor under it:
 *  - an array (or a { logs: [...] } wrapper) collapses to its FIRST log —
 *    the parent's capture is one moment, the draft is one object;
 *  - every free-text field (trigger, response, notes) loses any sentence that
 *    describes, grades or comforts the PARENT ("I'm the worst mother", "the
 *    overwhelmed mom", "אני האמא הכי גרועה") — the fields describe the
 *    child's moment, never the grown-up (clinical firewall, law 1);
 *  - a Hebrew capture is a Hebrew session even when the client did not say so
 *    (`captureLanguage`), so Hebrew in → Hebrew out.
 */

export const HEBREW_TEXT = /[֐-׿]/;

/** Hebrew in → Hebrew out: the explicit session language, or the capture's own script. */
export function captureLanguage(language: unknown, message: string): "he" | "en" {
  return language === "he" || HEBREW_TEXT.test(message) ? "he" : "en";
}

const PARENT_REF_EN = String.raw`(?:parent|mother|mom|mum|mommy|father|dad|daddy|caregiver|I|I'm|I’m|myself|you|you're|you’re)`;
const PARENT_ADJ_EN = String.raw`(?:worst|terrible|awful|horrible|bad|useless|failing|failed|failure|guilty|ashamed|overwhelmed|exhausted|burnt out|burned out|at (?:her|his|my|their) wits'? end|lost it|lost (?:my|her|his|their) (?:temper|cool|patience)|did (?:a )?(?:great|good|well)|great job|well done|handled (?:it )?(?:well|badly|poorly))`;
/** "I'm the worst mother", "Mom lost her temper", "I completely lost it". */
const REF_THEN_ADJ_EN = new RegExp(String.raw`\b${PARENT_REF_EN}\b(?:\W+\w+){0,2}?\W+${PARENT_ADJ_EN}\b`, "i");
/** "the overwhelmed mother", "a frustrated parent". */
const ADJ_THEN_REF_EN = new RegExp(String.raw`\b${PARENT_ADJ_EN}\W+(?:\w+\W+)?(?:parent|mother|mom|mum|father|dad|caregiver)\b`, "i");

const PARENT_REF_HE = "(?:אמא|האמא|אבא|האבא|הורה|ההורה|האם|האב|אני|הרגשתי|הייתי)";
const PARENT_ADJ_HE = "(?:גרועה|גרוע|נוראית|נוראי|איומה|איום|אשמה|אשם|מותשת|מותש|כושלת|כושל|נכשלתי|איבדתי)";
const REF_THEN_ADJ_HE = new RegExp(`${PARENT_REF_HE}(?:\\s+\\S+){0,3}?\\s+${PARENT_ADJ_HE}`, "u");
const ADJ_THEN_REF_HE = new RegExp(`${PARENT_ADJ_HE}\\s+(?:\\S+\\s+)?${PARENT_REF_HE}`, "u");

/** True when a sentence describes, grades or comforts the parent. */
export function judgesParent(sentence: string): boolean {
  return (
    REF_THEN_ADJ_EN.test(sentence) ||
    ADJ_THEN_REF_EN.test(sentence) ||
    REF_THEN_ADJ_HE.test(sentence) ||
    ADJ_THEN_REF_HE.test(sentence)
  );
}

/** Drop every sentence that judges the parent; keep the rest byte-identical. */
export function withoutParentJudgment(text: string): string {
  const sentences = text.match(/[^.!?。\n]+[.!?。]*\s*/g);
  if (!sentences) return text;
  const kept = sentences.filter((s) => !judgesParent(s));
  if (kept.length === sentences.length) return text;
  return kept.join("").trim();
}

const FREE_TEXT_FIELDS = ["trigger", "response", "notes"] as const;

/** One log, neutral about the parent. Non-object drafts pass through for the schema to reject. */
export function normalizeCaptureDraft(raw: unknown): unknown {
  let draft = raw;
  if (Array.isArray(draft)) draft = draft[0];
  else if (draft && typeof draft === "object" && Array.isArray((draft as { logs?: unknown }).logs)) {
    draft = (draft as { logs: unknown[] }).logs[0];
  }
  if (!draft || typeof draft !== "object") return draft ?? {};
  const out: Record<string, unknown> = { ...(draft as Record<string, unknown>) };
  for (const field of FREE_TEXT_FIELDS) {
    const value = out[field];
    if (typeof value === "string") out[field] = withoutParentJudgment(value);
  }
  return out;
}
