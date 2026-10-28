import type { BehaviorLog } from "../types";

/**
 * AI-CAP-8 — the ONE shared behavior-type taxonomy.
 *
 * Before this module the canonical six types lived as duplicated <option>
 * literals in BehaviorsTab and QuickLogModal while /api/extract-log emitted a
 * free 2-4 word label ("Morning refusal", "Screen shutoff meltdown"). The
 * free label matched no <option>, so the select rendered with no visible
 * selection, and free labels fragmented the 30-day type counts and the type
 * filter into singleton buckets.
 *
 * Decision (documented, pick-ONE): the canonical six REMAIN the stored
 * vocabulary. Every extraction result is mapped onto the canonical set via
 * mapLabelToType; when the model's free label doesn't fit, the label is
 * preserved verbatim in `notes` (never dropped) and the type falls back to
 * DEFAULT_BEHAVIOR_TYPE so the select always shows a valid selection.
 *
 * The labels are observational ("Transition Refusal"), never clinical — no
 * firewall surface here; counts only get MORE honest (firewall ruling PASS).
 *
 * Shared by: BehaviorsTab + QuickLogModal (selects, display), CoachTab
 * (extraction handoff), and routes/api.ts (/extract-log prompt hint). Keep
 * this module framework-free — it is imported server-side.
 */

export type CanonicalBehaviorType =
  | "Transition Refusal"
  | "Sensory Overload"
  | "Screentime Dispute"
  | "Sibling Conflict"
  | "Food Refusal"
  | "Sleep Meltdown"
  | "Moment";

/**
 * TJB-01: the neutral, non-incident type. "She said 'butterfly' for the first
 * time" is a moment, not a challenge — it has no trigger/response pair to
 * invent and no intensity to grade. Stored with intensity 1 / duration 0 so
 * it never feeds the friction rhythm (predict.ts counts intensity ≥ 4 only)
 * and `buildTimeline`'s kind:"moment" row covers it like any other entry.
 */
export const MOMENT_BEHAVIOR_TYPE: CanonicalBehaviorType = "Moment";

/** The canonical types, each with its full (beh.type.*) and short (ql.type.*)
 *  i18n label keys — both selects render from THIS list, no duplicated
 *  option literals anywhere else. The neutral Moment renders first: it is the
 *  default shape of the Journal's "catch the moment" promise. */
export const BEHAVIOR_TYPES: {
  value: CanonicalBehaviorType;
  labelKey: string;
  shortLabelKey: string;
}[] = [
  { value: "Moment", labelKey: "beh.type.moment", shortLabelKey: "ql.type.moment" },
  { value: "Transition Refusal", labelKey: "beh.type.transition", shortLabelKey: "ql.type.transition" },
  { value: "Sensory Overload", labelKey: "beh.type.sensory", shortLabelKey: "ql.type.sensory" },
  { value: "Screentime Dispute", labelKey: "beh.type.screen", shortLabelKey: "ql.type.screen" },
  { value: "Sibling Conflict", labelKey: "beh.type.sibling", shortLabelKey: "ql.type.sibling" },
  { value: "Food Refusal", labelKey: "beh.type.food", shortLabelKey: "ql.type.food" },
  { value: "Sleep Meltdown", labelKey: "beh.type.sleep", shortLabelKey: "ql.type.sleep" },
];

export const CANONICAL_BEHAVIOR_TYPES: CanonicalBehaviorType[] = BEHAVIOR_TYPES.map((b) => b.value);

/** The incident-shaped types: the ONLY ones whose write requires a parent
 *  `response`. Everything else (Moment, legacy free labels) saves on the
 *  trigger text alone. Exported as a Set so call sites test membership, never
 *  re-list the names. */
export const INCIDENT_TYPES: ReadonlySet<string> = new Set<string>(
  CANONICAL_BEHAVIOR_TYPES.filter((t) => t !== MOMENT_BEHAVIOR_TYPE),
);

export const isIncidentType = (behaviorType: string): boolean => INCIDENT_TYPES.has(behaviorType);

/**
 * B-TODAY-01 — does an extraction made from the ONE-field moment form earn the
 * incident review? Only when the model's label really named an incident type.
 * An unmatched free label ("First word") falls back to DEFAULT_BEHAVIOR_TYPE
 * with `typeMatched: false`, and a "Moment" label is not an incident — both
 * keep the parent's words in the moment field (saved via momentLogFields:
 * behaviorType "Moment", no intensity — B-DATA-09). Never a joyful line filed as a
 * Transition Refusal at 3/5.
 */
export const extractionOpensIncidentReview = (n: { typeMatched: boolean; behaviorType: string }): boolean =>
  n.typeMatched && isIncidentType(n.behaviorType);

/** Minimal draft shape every capture surface holds before a write. */
export type BehaviorLogDraft = {
  behaviorType: string;
  trigger: string;
  response?: string;
};

/**
 * ONE validation rule for every write path (handleAddLog, QuickLogModal,
 * BehaviorsTab submit/confirm): the trigger — "what happened" — is always
 * required; the response — "what you tried" — only when the type is an
 * incident. Returns the i18n key of the calm error to toast, or null when the
 * draft may be written. Pure, so it is unit-tested directly (TJB-01 guard).
 */
export function validateLogDraft(d: BehaviorLogDraft): "beh.toast.fillTrigger" | "beh.toast.fillBoth" | null {
  const trigger = String(d.trigger ?? "").trim();
  const response = String(d.response ?? "").trim();
  if (!trigger) return isIncidentType(d.behaviorType) ? "beh.toast.fillBoth" : "beh.toast.fillTrigger";
  if (isIncidentType(d.behaviorType) && !response) return "beh.toast.fillBoth";
  return null;
}

/** Field defaults for a plain moment saved from ONE text field.
 *  B-DATA-09: a moment has no severity — it stores no intensity at all. */
export const momentLogFields = (text: string, context: string = "Home") => ({
  behaviorType: MOMENT_BEHAVIOR_TYPE,
  durationMinutes: 0,
  trigger: text.trim(),
  response: undefined as string | undefined,
  context,
});

/** A keep marker is valid only on a plain Moment, never on a problem. */
export function keptMomentFields(behaviorType: string, kept?: "said" | "by_herself" | "first") {
  return !isIncidentType(behaviorType) && behaviorType === MOMENT_BEHAVIOR_TYPE
    && (kept === "said" || kept === "by_herself" || kept === "first") ? { kept } : {};
}

/**
 * B-TODAY-19 — the ONE plain-moment record `addMoment` writes: the moment
 * fields, resolved, plus the optional in-doc photo and the answered prompt's
 * key. Optional keys are omitted, never `undefined` (Firestore rejects it).
 * Null when the moment has no words (validateLogDraft).
 */
export function buildMomentLog(
  text: string,
  context: string,
  opts: { photoAttachment?: string; promptKey?: string; kept?: "said" | "by_herself" | "first"; contentSource?: BehaviorLog["contentSource"] } = {},
  now: Date = new Date(),
) {
  const fields = momentLogFields(text, context);
  if (validateLogDraft(fields)) return null;
  return {
    id: `log-${now.getTime()}`,
    timestamp: now.toISOString(),
    behaviorType: fields.behaviorType,
    // B-DATA-09: no `intensity` key — a plain moment stores none.
    durationMinutes: fields.durationMinutes,
    trigger: fields.trigger,
    context: fields.context,
    resolved: true,
    ...keptMomentFields(fields.behaviorType, opts.kept),
    ...(opts.contentSource ? { contentSource: opts.contentSource } : {}),
    ...(opts.photoAttachment ? { photoAttachment: opts.photoAttachment } : {}),
    ...(opts.promptKey ? { promptKey: opts.promptKey } : {}),
  };
}

export const DEFAULT_BEHAVIOR_TYPE: CanonicalBehaviorType = "Transition Refusal";

/** Contexts accepted by the extraction schema — the client-side clamp mirror
 *  of the /extract-log enum. */
export const EXTRACT_CONTEXTS = ["Home", "School", "Transit", "Public"] as const;

/** Keyword heuristics (EN + HE) mapping a free extraction label onto the
 *  canonical set. Ordered most-specific-first so "Screen shutoff meltdown"
 *  lands on Screentime Dispute, not Sleep/Sensory. */
const TYPE_KEYWORDS: [CanonicalBehaviorType, RegExp][] = [
  ["Screentime Dispute", /screen|tablet|ipad|tv\b|phone|device|video|מסך|טאבלט|טלפון/i],
  ["Sibling Conflict", /sibling|brother|sister|אחים|אחות|בין אחים/i],
  ["Food Refusal", /food|eat|meal|dinner|lunch|breakfast|picky|snack|אוכל|אכיל|ארוחה/i],
  ["Sleep Meltdown", /sleep|bed|night|nap|wake|שינה|שנת|מיטה|לילה/i],
  ["Sensory Overload", /sensor|noise|loud|crowd|overload|overstim|חוש|רעש|עומס/i],
  ["Transition Refusal", /transition|refus|leav|morning|dress|depart|goodbye|drop-?off|cling|מעבר|סירוב|בוקר|יציאה/i],
];

/**
 * B-ASKJB-48 — the words that make a FREE extraction label read as an
 * incident. A context noun by itself ("Sister reading together", "Goodnight
 * routine", "Family dinner", "Played on the tablet", "First word this
 * morning") names where a moment happened, not a concern, so it never earns
 * the incident review on its own: the keyword map below only runs on a free
 * label that also carries one of these cues, or when the parent has already
 * declared a hard moment. A canonical label ("Sibling Conflict") is the
 * model choosing from the list and is never gated. Under-matching is the safe
 * direction here: a missed cue leaves the parent's words as a neutral moment
 * they can still mark as hard; an extra cue files a joyful line as an incident.
 * English on word boundaries; Hebrew as whole words with a glued particle
 * (`\b` cannot bound a Hebrew word), listing forms rather than open stems
 * where a stem is also an everyday word (ריבה is jam, בקשה a request).
 */
const INCIDENT_CUE_EN = new RegExp(
  [
    String.raw`\b(?:refus|resist|tantrum|conflict|disput|argu|standoff|stand-off|overload|overwhelm|overstimul|struggl|upset|distress|scream|yell|shout|avoid|difficult|troubl|anxi|disrupt|defian|frustrat|aggress|protest|clash|whin|fuss)\w*`,
    String.raw`\bmeltdown\w*|\bmelt(?:s|ed|ing)?\s+down\b`,
    String.raw`\b(?<!(?:pillow|play|tickle|water|snowball|nerf|pretend)\s)(?:fight\w*|fought|battle\w*)`,
    String.raw`\bproblem(?!-?\s?solv)\w*`,
    String.raw`\b(?:cr(?:y|ies|ied|ying)|angry|anger|rage|raging|panic\w*|hitting|hits|biting|bites|grabb\w*|picky)\b`,
    String.raw`\b(?:won|wouldn|didn|doesn|don)['’]?t\s+(?:want|let|stop|eat|sleep|go|leave)\b|\b(?:won|wouldn)['’]?t\b`,
  ].join("|"),
  "i",
);
const HE_PARTICLE = "(?:[ובהלמשכ]|וה|וב|ול|ומ|וש|כש)?";
const INCIDENT_CUE_HE = new RegExp(
  String.raw`(?<!\p{L})${HE_PARTICLE}(?:` +
    [
      String.raw`סירוב\p{L}*`, String.raw`סירב\p{L}*`, String.raw`מסרב\p{L}*`, "סרב",
      "ריב", "ריבים", String.raw`מריב\p{L}*`,
      String.raw`ו?ויכוח\p{L}*`, String.raw`התווכח\p{L}*`, String.raw`מתווכח\p{L}*`,
      "קושי", "קשיים",
      "בכי", "בכה", "בכתה", "בכו", "בוכה", "בוכים", "בוכות",
      String.raw`צעק\p{L}*`, String.raw`צועק\p{L}*`, String.raw`צרח\p{L}*`, String.raw`צורח\p{L}*`,
      String.raw`התפרצ\p{L}*`, String.raw`התקף\p{L}*`, "עומס", "חרדה", "חרדות", String.raw`מאבק\p{L}*`,
      "זעם", String.raw`כעס\p{L}*`, String.raw`כועס\p{L}*`, "תסכול", String.raw`מתוסכל\p{L}*`,
      String.raw`התנגד\p{L}*`, String.raw`מתנגד\p{L}*`, "הימנעות", String.raw`נמנע\p{L}*`,
      String.raw`הרביצ\p{L}*`, "הרביץ", String.raw`מרביצ\p{L}*`, "מכות", String.raw`נשיכ\p{L}*`, "נשך", "נשכה",
    ].join("|") +
    String.raw`)(?!\p{L})|(?<!\p{L})ו?לא\s+(?:רוצה|רצה|רצתה|רצו|מוכן|מוכנה|הסכים|הסכימה|מסכים|מסכימה)(?!\p{L})`,
  "u",
);

/** B-ASKJB-48: true when a free extraction label names a concern, not only a context. */
export const hasIncidentCue = (label: string): boolean => INCIDENT_CUE_EN.test(label) || INCIDENT_CUE_HE.test(label);

/** Map a (possibly free) extraction label onto the canonical set.
 *  `matched: false` means the label didn't fit — the caller preserves it in
 *  notes and the type is the documented fallback. This is the LEGACY reader
 *  (behaviorTypeLabel localizes stored free labels through it, so a saved
 *  record reads as it always did); new extraction goes through
 *  `mapExtractedLabelToType`, which adds the B-ASKJB-48 incident-cue gate. */
export function mapLabelToType(label: string): { type: CanonicalBehaviorType; matched: boolean } {
  const raw = String(label ?? "").trim();
  if (!raw) return { type: DEFAULT_BEHAVIOR_TYPE, matched: false };
  const exact = BEHAVIOR_TYPES.find((b) => b.value.toLowerCase() === raw.toLowerCase());
  if (exact) return { type: exact.value, matched: true };
  for (const [type, re] of TYPE_KEYWORDS) {
    if (re.test(raw)) return { type, matched: true };
  }
  return { type: DEFAULT_BEHAVIOR_TYPE, matched: false };
}

/**
 * B-ASKJB-48 — the mapping every NEW extraction result goes through. An exact
 * canonical label always matches (including "Moment", which is not an
 * incident). A free label maps through the keyword table only when it carries
 * an incident cue, or when the parent already declared a hard moment
 * (`incidentDeclared`: the parent's own toggle is the cue, and the keyword
 * then only picks which incident type). Otherwise it is unmatched, and
 * `normalizeExtractedLog` keeps it as the neutral Moment.
 */
export function mapExtractedLabelToType(
  label: string,
  opts: { incidentDeclared?: boolean } = {},
): { type: CanonicalBehaviorType; matched: boolean } {
  const raw = String(label ?? "").trim();
  if (!raw) return { type: MOMENT_BEHAVIOR_TYPE, matched: false };
  const exact = BEHAVIOR_TYPES.find((b) => b.value.toLowerCase() === raw.toLowerCase());
  if (exact) return { type: exact.value, matched: true };
  if (!opts.incidentDeclared && !hasIncidentCue(raw)) return { type: MOMENT_BEHAVIOR_TYPE, matched: false };
  const mapped = mapLabelToType(raw);
  return mapped.matched ? mapped : { type: MOMENT_BEHAVIOR_TYPE, matched: false };
}

/** B-DATA-09: an explicit numeric intensity clamps to 1–5; a missing or
 *  non-numeric one stays undefined (no neutral value is invented). */
export function clampIntensity(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(5, Math.max(1, n));
}

/** Raw /extract-log response shape (all fields untrusted until clamped). */
export type ExtractedLogDraft = {
  behaviorType?: unknown;
  intensity?: unknown;
  durationMinutes?: unknown;
  context?: unknown;
  trigger?: unknown;
  response?: unknown;
  notes?: unknown;
};

export type NormalizedExtractedLog = {
  /** B-ASKJB-48: the neutral "Moment" whenever the label did not match. */
  behaviorType: CanonicalBehaviorType;
  /** false ⇒ the model's free label didn't fit the canonical set (it is
   *  preserved in `notes`). */
  typeMatched: boolean;
  /** The model's original label, verbatim. */
  freeLabel: string;
  /** B-DATA-09: undefined when the model gave no usable number — never an
   *  invented neutral 3; an explicit value is clamped to 1–5. */
  intensity: number | undefined;
  durationMinutes: number;
  context: (typeof EXTRACT_CONTEXTS)[number];
  trigger: string;
  response: string;
  notes: string;
};

/**
 * Validate/clamp EVERY extraction result before it touches a draft field —
 * the single normalization seam behind voice, typed, and coach-handoff
 * capture (AI-CAP-8 acceptance: any extraction renders a valid visible
 * selection in both forms; free labels survive in notes).
 */
export function normalizeExtractedLog(
  d: ExtractedLogDraft,
  fallbackTrigger = "",
  opts: { incidentDeclared?: boolean } = {},
): NormalizedExtractedLog {
  const freeLabel = String(d?.behaviorType ?? "").trim();
  // B-ASKJB-48: an unmatched label is the neutral Moment, never a default
  // incident type; the parent can still mark the moment as hard themselves.
  const { type, matched } = mapExtractedLabelToType(freeLabel, opts);
  const baseNotes = String(d?.notes ?? "").trim();
  // Preserve an unmatched free label in notes — never silently dropped.
  const notes = matched || !freeLabel ? baseNotes : baseNotes ? `${baseNotes} · ${freeLabel}` : freeLabel;
  const ctx = String(d?.context ?? "");
  return {
    behaviorType: type,
    typeMatched: matched,
    freeLabel,
    intensity: clampIntensity(d?.intensity),
    durationMinutes: Math.max(1, Math.round(Number(d?.durationMinutes)) || 10),
    context: (EXTRACT_CONTEXTS as readonly string[]).includes(ctx) ? (ctx as (typeof EXTRACT_CONTEXTS)[number]) : "Home",
    trigger: String(d?.trigger ?? "").trim() || fallbackTrigger,
    response: String(d?.response ?? "").trim(),
    notes,
  };
}

const PROPOSAL_TYPE_KEYS: Readonly<Record<string, string>> = {
  "Journal moment": "beh.type.proposal.journal",
  Observation: "beh.type.proposal.observation",
  "Report fact": "beh.type.proposal.report",
};

/**
 * Localized display label for a stored behaviorType.
 *
 * Canonical types render their i18n label (HE labels in an HE UI). OBJ-JOURNAL-01:
 * a LEGACY free label used to fall straight through, so "Sensory Meltdown" and
 * "Sibling Dispute" — both present in seeded ledgers — printed raw English on a
 * Hebrew screen, and the same log read one way on Behaviors and another on the
 * Journal. A free label is now run through `mapLabelToType`, the same keyword
 * map every extraction already uses, so a recognisable one gets its localized
 * label; only a genuinely unmappable label ("Old Free Label") still renders
 * verbatim, because blanking a parent's own words is worse than English.
 */
export function behaviorTypeLabel(
  type: string,
  t: (key: string) => string,
  variant: "full" | "short" = "short",
): string {
  const raw = String(type ?? "").trim();
  if (!raw) return raw;
  const keyOf = (b: (typeof BEHAVIOR_TYPES)[number]) => (variant === "short" ? b.shortLabelKey : b.labelKey);
  const entry = BEHAVIOR_TYPES.find((b) => b.value === raw);
  if (entry) return t(keyOf(entry));
  // Rows a parent accepted from a conversation proposal (ArborContext) carry
  // these app-written types; they are Arbor's words, so they always localize.
  if (Object.hasOwn(PROPOSAL_TYPE_KEYS, raw)) return t(PROPOSAL_TYPE_KEYS[raw]);
  const { type: mapped, matched } = mapLabelToType(raw);
  if (!matched) return raw;
  const legacy = BEHAVIOR_TYPES.find((b) => b.value === mapped);
  return legacy ? t(keyOf(legacy)) : raw;
}
