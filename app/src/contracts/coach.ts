import { z } from "zod";
import { Type } from "@google/genai";
import type { FrameworkDefinition } from "../services/framework.js";
import { domainLabel } from "../lib/domains/registry.js";
import { he as DOMAIN_NAMES_HE } from "../lib/i18nElevation/domains.js";

export const NON_DIAGNOSTIC_CONTRACT = `
ARBOR DEVELOPMENTAL AI CONTRACT:
- You are parent support software, not a clinician, therapist, doctor, or diagnostic service.
- Save and state observations, not labels. Never diagnose autism, ADHD, anxiety, speech delay, trauma, or any condition.
- Route every answer through age band, developmental domains, safety triage, and one practical parent action.
- Prefer uncertainty language: "may", "could", "one possibility", "watch for".
- Include escalation thresholds when symptoms, safety, regression, injury, abuse, self-harm, or sustained impairment are mentioned.
- Ask for professional advice when a concern is persistent, severe, sudden, medical, or outside parent coaching.
`;

export const frameRoutingSchema = z.object({
  aim: z.string().min(1),
  twoAxes: z.string().min(1),
  story: z.string().min(1),
  shadow: z.string().min(1),
  marriage: z.string().min(1),
  shepherd: z.string().min(1)
});

export const coachResponseZodSchema = z.object({
  // ASK-1/AIR-1 (ask-cadence): the leading parent-facing prose — a warm
  // empathic opening + the heart of the answer in a few plain sentences.
  // Declared FIRST so providers emit it first and /chat can stream it as
  // screened sentence deltas while the structured fields still generate.
  // Optional for back-compat with pre-cadence contracts and stubs.
  text: z.string().optional(),
  riskLevel: z.string().min(1),
  ageBand: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
  nonDiagnosticHypotheses: z.array(z.object({
    label: z.string().min(1),
    confidence: z.string().min(1),
    rationale: z.string().min(1)
  })),
  todayPlan: z.array(z.string().min(1)).min(1),
  parentScript: z.string().min(1),
  avoid: z.array(z.string().min(1)),
  observe: z.array(z.string().min(1)),
  escalateIf: z.array(z.string().min(1)).min(1),
  frameRouting: frameRoutingSchema,
  memoryProposals: z.array(z.object({
    fact: z.string().min(1),
    source: z.string().min(1),
    retention: z.string().min(1)
  })),
  handoffNotes: z.object({
    // Optional content: no relevant handoff must not discard a complete answer.
    // Empty notes are already hidden by CoachAnswerCards.
    teacher: z.string(),
    professional: z.string()
  }),
  // ASK-4: anticipated next questions, localized by the languageDirective.
  // The zod cap is a TRANSFORM (never a hard .max) so a chatty model can't
  // fail the whole answer: items are trimmed, blanks dropped, the list is
  // clamped to 3 and each string to 140 chars at the parse seam. Rendered
  // chips fall back to the client's static trio when absent. FIREWALL
  // CONDITION: these strings are APPENDED to renderCoachResponse below so
  // screenModelOutput covers them — a rendered-but-unscreened field would be
  // the first bypass of the AI-2 output screen.
  followUps: z
    .array(z.string())
    .optional()
    .transform((items) => {
      const capped = (items ?? [])
        .map((q) => q.trim())
        .filter((q) => q.length > 0)
        .slice(0, 3)
        .map((q) => (q.length > 140 ? q.slice(0, 140) : q));
      return capped.length > 0 ? capped : undefined;
    }),
  sourceCardsUsed: z.array(z.string()).optional(),
  // COACH-6: resolved citation metadata. The model never emits this — the
  // server backfills it from the knowledge registry after parsing (see
  // buildSourceCards) so the citation drawer can show real titles.
  sourceCards: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.string()
  })).optional(),
  // ASK-6: how many parent-approved memory facts grounded this answer. The
  // model never emits this — the server backfills the integer COUNT after
  // parsing (firewall shape: a count only — never fact content, never a
  // percentage or confidence figure).
  approvedMemoryFactsUsed: z.number().int().nonnegative().optional()
});

/**
 * B-AI-14 (reopened 6 Oct): `governedEscalation` — the governed hard-moment
 * card's escalation sentence, byte-identical — is SERVER-ADDED after the
 * parse, so it is deliberately NOT a key of coachResponseZodSchema: zod
 * strips unknown keys, so a model-emitted (or injected) `governedEscalation`
 * never survives the parse and can never pose as governed text. It is not in
 * the Gemini schema either (the model is never asked for it). /chat sets it
 * when the conversation is a hard-moment seed (safety/seededEscalation
 * applyGovernedEscalation) and drops the model's escalateIf lines; the
 * renderer below and the card UI show it in the escalation slot. Safety
 * routing, never a keepsake (lib/captureProposals NEVER_KEEPABLE_FIELDS).
 */
export type CoachResponse = z.infer<typeof coachResponseZodSchema> & {
  governedEscalation?: string;
  /** Parity 9 Oct (companion_attachments 1.2.0): a file turn the FILE SAFETY
   *  GATE declined — `text` is the whole answer, every card section is empty. */
  fileDeclined?: boolean;
  /** Parity 9 Oct: what a child-related DOCUMENT says (the retired /vision
   *  document mode's outputs), on file turns only. */
  document?: FileTurnDocument;
  /** B-AI-14 (route): server-set, like governedEscalation — see types.ts CoachContract. */
  todayPlanProvenance?: { step: number; memoryId: string; kind: "approved_fact" }[];
};

/**
 * B-AI-14 (coach_chat 1.5.0): on a hard-moment SEEDED turn the app shows the
 * governed line and the model returns `escalateIf: []`, so escalateIf relaxes
 * min(1) → min(0) for seeded turns ONLY. Every other turn keeps
 * coachResponseZodSchema unchanged.
 */
export const coachSeededResponseZodSchema = coachResponseZodSchema.extend({
  escalateIf: z.array(z.string().min(1)),
});

/**
 * B-AI-14 (coach_chat 1.5.3) — the SHORT shape of a seeded FOLLOW-UP turn
 * (safety/seededEscalation seededFollowUpLine). Live 63bb41c3:
 * paraphrase-bait-public-meltdown still returned a full first-turn card on a
 * "summarise when I would need help" follow-up (cardScope 0) although 1.5.2
 * told the model not to. So the route, not the model, decides the shape: the
 * answer is `text` (one to three sentences on the follow-up) with the
 * server-set `governedEscalation`; the card sections (todayPlan,
 * parentScript, avoid, observe, nonDiagnosticHypotheses, frameRouting) are
 * EMPTIED whatever the model returned — the guide is already on screen. The
 * fields stay present (empty) so the client contract keeps its keys and
 * CoachAnswerCards renders nothing for an empty section (it guards each one).
 */
export const coachSeededFollowUpZodSchema = coachSeededResponseZodSchema.extend({
  nonDiagnosticHypotheses: z.array(z.object({ label: z.string(), confidence: z.string(), rationale: z.string() })).default([]),
  todayPlan: z.array(z.string()).default([]),
  parentScript: z.string().default(""),
  avoid: z.array(z.string()).default([]),
  observe: z.array(z.string()).default([]),
  frameRouting: z.object({ aim: z.string(), twoAxes: z.string(), story: z.string(), shadow: z.string(), marriage: z.string(), shepherd: z.string() }).partial().optional(),
  memoryProposals: z.array(z.object({ fact: z.string().min(1), source: z.string().min(1), retention: z.string().min(1) })).default([]),
  handoffNotes: z.object({ teacher: z.string(), professional: z.string() }).default({ teacher: "", professional: "" }),
});

export const EMPTY_FRAME_ROUTING = { aim: "", twoAxes: "", story: "", shadow: "", marriage: "", shepherd: "" } as const;

/** Parse a seeded follow-up answer and empty its card sections (the short shape). */
export const toSeededFollowUpContract = (raw: unknown): CoachResponse => {
  const parsed = coachSeededFollowUpZodSchema.parse(raw);
  const text = parsed.text?.trim() || parsed.todayPlan.find((step) => step.trim())?.trim() || "";
  return {
    ...parsed,
    text,
    nonDiagnosticHypotheses: [],
    todayPlan: [],
    parentScript: "",
    avoid: [],
    observe: [],
    frameRouting: { ...EMPTY_FRAME_ROUTING },
  };
};

/* ── File turns (parity, 9 Oct 2026; companion_attachments 1.2.0) ─────────
 * The retired /vision route had an `offTopic` flag and a document mode. The
 * /chat file turn needs both: a DECLINE that fits no card (an unrelated,
 * explicit or graphic file — live run 9 Oct: the model declined into empty
 * domains/todayPlan and the strict parse 500'd the turn), and the DOCUMENT
 * block a school or clinic note deserves. The route, not the model, decides
 * the declined shape (as toSeededFollowUpContract does). */
export type FileTurnDocument = {
  documentType: string;
  keyPoints: string[];
  questionsForProfessional: string[];
  handoffNote: string;
  suggestedMemory: string[];
};

const cleanList = (items: unknown, max: number, chars: number): string[] =>
  Array.isArray(items)
    ? items.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, max).map((item) => item.slice(0, chars))
    : [];

/** The document block, trimmed and capped at the parse seam (never a hard fail). */
export const cleanFileTurnDocument = (raw: unknown): FileTurnDocument | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const doc: FileTurnDocument = {
    documentType: typeof value.documentType === "string" ? value.documentType.trim().slice(0, 60) : "",
    keyPoints: cleanList(value.keyPoints, 5, 240),
    questionsForProfessional: cleanList(value.questionsForProfessional, 3, 200),
    handoffNote: typeof value.handoffNote === "string" ? value.handoffNote.trim().slice(0, 600) : "",
    suggestedMemory: cleanList(value.suggestedMemory, 3, 200),
  };
  const empty = !doc.keyPoints.length && !doc.questionsForProfessional.length && !doc.handoffNote && !doc.suggestedMemory.length;
  return empty ? undefined : doc;
};

/** The decline, when the model returned no words of its own. */
export const FILE_DECLINED_FALLBACK: Record<CoachRenderLanguage, string> = {
  en: "I can only look at photos and documents about your child and family. You're welcome to share one of those, or tell me in words what's going on.",
  he: "אני יכול להסתכל רק על תמונות ומסמכים שקשורים לילד ולמשפחה. אפשר לשתף אחד כזה, או לספר לי במילים מה קורה.",
};

/** Parse a FILE turn: a decline becomes the text-only shape; a read file keeps
 *  the full contract (every min(1) holds) plus its optional document block. */
export const toFileTurnContract = (raw: unknown, language: CoachRenderLanguage = "en"): CoachResponse => {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (value.fileDeclined === true) {
    const text = typeof value.text === "string" ? value.text.trim() : "";
    return {
      text: text || FILE_DECLINED_FALLBACK[language],
      riskLevel: typeof value.riskLevel === "string" && value.riskLevel.trim() ? value.riskLevel : "Low",
      ageBand: typeof value.ageBand === "string" && value.ageBand.trim() ? value.ageBand : "unknown",
      domains: [],
      nonDiagnosticHypotheses: [],
      todayPlan: [],
      parentScript: "",
      avoid: [],
      observe: [],
      escalateIf: [],
      frameRouting: { ...EMPTY_FRAME_ROUTING },
      memoryProposals: [],
      handoffNotes: { teacher: "", professional: "" },
      followUps: undefined,
      sourceCardsUsed: [],
      fileDeclined: true,
    };
  }
  const strict: CoachResponse = coachResponseZodSchema.parse(raw);
  const document = cleanFileTurnDocument(value.document);
  return document ? { ...strict, document } : strict;
};

/** A declined file turn renders (and is screened as) its words alone. */
export const renderFileDeclinedResponse = (response: CoachResponse): string => response.text?.trim() ?? "";

/** The file-turn model schema: the standard one, plus the decline flag and the
 *  optional document block. Lists may come back [] on a decline. */
export const createFileTurnCoachResponseGeminiSchema = (framework: FrameworkDefinition) => {
  const base = createCoachResponseGeminiSchema(framework);
  const list = (description: string) => ({ type: Type.ARRAY, items: { type: Type.STRING }, description });
  return {
    ...base,
    properties: {
      ...base.properties,
      fileDeclined: {
        type: Type.BOOLEAN,
        description: "true ONLY when the FILE SAFETY GATE applies (the file is not about this child or family, or it is explicit, sexual, graphic or violent). Then `text` holds the one or two calm sentences of the decline and every list is [] and every other string is empty. Otherwise false.",
      },
      document: {
        type: Type.OBJECT,
        description: "Fill ONLY when a file is a child-related document (school, daycare, clinic, therapy, activity). Omit it for photos and when declining.",
        properties: {
          documentType: { type: Type.STRING, description: "What kind of document it is, in a few words, in the answer language (for example: daycare note)." },
          keyPoints: list("Up to 5 things the document actually says, plainly, keeping every negation."),
          questionsForProfessional: list("Up to 3 questions the parent could ask the document's author or their own professional."),
          handoffNote: { type: Type.STRING, description: "Two or three plain sentences the parent could share with a teacher or professional, in the parent's voice: what the document says and what the parent has seen. Observations only; never a diagnosis, label or score." },
          suggestedMemory: list("Up to 3 durable, practical facts from the document the parent might choose to keep (an arrangement, a schedule, a named support), one plain sentence each. Never a diagnosis, label, score or judgement. Nothing is saved unless the parent chooses it."),
        },
      },
    },
  };
};

/** The document block as screened text (the AI-2 output screen covers every
 *  string the parent sees — same rule as followUps). */
const renderDocumentLines = (doc: FileTurnDocument, language: CoachRenderLanguage): string => {
  const L = language === "he"
    ? { title: "מתוך המסמך", key: "נקודות עיקריות", ask: "לשאול את איש המקצוע", note: "פתק לשיתוף", remember: "שווה לזכור" }
    : { title: "From the document", key: "Key points", ask: "To ask the professional", note: "A note to share", remember: "Worth remembering" };
  const section = (label: string, items: string[]) => items.length ? `\n${label}\n${items.map((item) => `- ${item}`).join("\n")}` : "";
  return `${L.title}${doc.documentType ? `: ${doc.documentType}` : ""}${section(L.key, doc.keyPoints)}${section(L.ask, doc.questionsForProfessional)}${doc.handoffNote ? `\n${L.note}\n${doc.handoffNote}` : ""}${section(L.remember, doc.suggestedMemory)}`;
};

/**
 * B-AI-14 (render fix, 6 Oct) — the escalation section's body. The governed
 * line leaves the route BYTE FOR BYTE on its own line: nothing prepended (no
 * "- " bullet, no quote) and nothing appended (no period). Live 1.5.3:
 * escalation-preserve-hitting scored escalationVerbatim 0 only because the
 * section rendered "- <governed line>". The model's own escalateIf lines
 * (unseeded turns) keep their bullet markers.
 */
export const renderEscalationLines = (response: CoachResponse): string =>
  response.governedEscalation ? response.governedEscalation : response.escalateIf.map((item) => `- ${item}`).join("\n");

/** The short shape's rendered text (screened like every answer): the answer,
 *  the escalation section with the governed line, then the follow-ups. */
export const renderCoachFollowUpResponse = (response: CoachResponse, language: CoachRenderLanguage = "en"): string => {
  const L = COACH_RENDER_LABELS[language] ?? COACH_RENDER_LABELS.en;
  const lead = response.text?.trim() ?? "";
  const escalation = renderEscalationLines(response);
  return `${lead}\n\n${L.escalate}\n${escalation}${
    response.followUps?.length ? `\n\n${L.followUps}\n${response.followUps.map((q) => `- ${q}`).join("\n")}` : ""
  }`;
};

/** COACH-6: a resolved citation row — real title + card type for an id. */
export type SourceCardRef = { id: string; title: string; type: string };

/**
 * Resolve the model's cited card ids against the knowledge cards that were
 * actually offered in the prompt. Ids with no matching card are dropped here
 * (the client falls back to slug rendering via sourceCardsUsed); order follows
 * the cited ids.
 */
export const buildSourceCards = (
  ids: readonly string[] | undefined,
  cards: readonly { id: string; title: string; type: string }[]
): SourceCardRef[] => {
  if (!ids?.length) return [];
  const byId = new Map(cards.map((card) => [card.id, card]));
  return ids.flatMap((id) => {
    const card = byId.get(id);
    return card ? [{ id, title: card.title, type: card.type }] : [];
  });
};

/** B-AI-14 (coach_chat 1.5.0): the model schema sent on a SEEDED turn says
 *  escalateIf is an empty array; everything else is the standard schema. */
export const createSeededCoachResponseGeminiSchema = (framework: FrameworkDefinition) => {
  const base = createCoachResponseGeminiSchema(framework);
  return {
    ...base,
    properties: {
      ...base.properties,
      escalateIf: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Always an empty array [] in this conversation: the app shows the guide's own line on when to reach out for more support.",
      },
    },
  };
};

/** B-AI-14 (coach_chat 1.5.3): the model schema on a seeded FOLLOW-UP turn —
 *  the answer is `text`; the card sections are not required and are emptied
 *  server-side anyway (toSeededFollowUpContract). */
export const createSeededFollowUpCoachResponseGeminiSchema = (framework: FrameworkDefinition) => {
  const base = createSeededCoachResponseGeminiSchema(framework);
  const emptyList = { type: Type.ARRAY, items: { type: Type.STRING }, description: "Always [] on a follow-up turn: the guide is already on screen." };
  return {
    ...base,
    required: ["text", "riskLevel", "ageBand", "domains", "escalateIf", "memoryProposals", "sourceCardsUsed", "followUps"],
    properties: {
      ...base.properties,
      text: { type: Type.STRING, description: "The whole answer: one to three plain sentences that answer the parent's latest line. Describe the moment and what to do now, never the child." },
      todayPlan: emptyList,
      avoid: emptyList,
      observe: emptyList,
      parentScript: { type: Type.STRING, description: "Always an empty string on a follow-up turn." },
    },
  };
};

export const createCoachResponseGeminiSchema = (framework: FrameworkDefinition) => ({
  type: Type.OBJECT,
  required: [
    "text",
    "riskLevel",
    "ageBand",
    "domains",
    "nonDiagnosticHypotheses",
    "todayPlan",
    "parentScript",
    "avoid",
    "observe",
    "escalateIf",
    "frameRouting",
    "memoryProposals",
    "handoffNotes",
    "sourceCardsUsed",
    "followUps"
  ],
  properties: {
    // ASK-1/AIR-1: keep `text` FIRST — the ask-cadence stream tails this field.
    text: { type: Type.STRING },
    riskLevel: { type: Type.STRING },
    ageBand: { type: Type.STRING },
    domains: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: framework.domains.map((domain) => domain.id) }
    },
    nonDiagnosticHypotheses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["label", "confidence", "rationale"],
        properties: {
          label: { type: Type.STRING },
          confidence: { type: Type.STRING },
          rationale: { type: Type.STRING }
        }
      }
    },
    todayPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
    parentScript: { type: Type.STRING },
    avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
    observe: { type: Type.ARRAY, items: { type: Type.STRING } },
    escalateIf: { type: Type.ARRAY, items: { type: Type.STRING } },
    frameRouting: {
      type: Type.OBJECT,
      required: ["aim", "twoAxes", "story", "shadow", "marriage", "shepherd"],
      properties: {
        aim: { type: Type.STRING },
        twoAxes: { type: Type.STRING },
        story: { type: Type.STRING },
        shadow: { type: Type.STRING },
        marriage: { type: Type.STRING },
        shepherd: { type: Type.STRING }
      }
    },
    memoryProposals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["fact", "source", "retention"],
        properties: {
          fact: { type: Type.STRING },
          source: { type: Type.STRING },
          retention: { type: Type.STRING }
        }
      }
    },
    handoffNotes: {
      type: Type.OBJECT,
      required: ["teacher", "professional"],
      properties: {
        teacher: { type: Type.STRING },
        professional: { type: Type.STRING }
      }
    },
    sourceCardsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
    // ASK-4: 2-3 short follow-up questions the parent is likely to ask next,
    // in the same language as the other human-readable values.
    followUps: { type: Type.ARRAY, items: { type: Type.STRING } }
  }
});

/**
 * B-AI-01 eval fix (coach_chat 1.4.1): the rendered answer's section labels
 * come from the session language. A Hebrew answer used to carry English
 * headers ("What To Do Today") around Hebrew content (coach-core-v1
 * coach-he-reply, heNaturalness 0.5). EN stays byte-identical.
 */
export type CoachRenderLanguage = "en" | "he";

const COACH_RENDER_LABELS: Record<CoachRenderLanguage, {
  happening: string; why: string; ageBand: string; domains: string; today: string; script: string;
  avoid: string; observe: string; escalate: string; frames: string; aim: string; twoAxes: string;
  story: string; shadow: string; marriage: string; shepherd: string; memory: string; noMemory: string;
  cards: string; noCards: string; handoff: string; teacher: string; professional: string;
  followUps: string; fallbackHypothesis: string;
}> = {
  en: {
    happening: "### 1. What May Be Happening",
    why: "### 2. Why It May Be Happening",
    ageBand: "Age band:",
    domains: "Domains:",
    today: "### 3. What To Do Today",
    script: "### 4. What Is The Parent Script",
    avoid: "### 5. What To Avoid",
    observe: "### 6. What To Observe",
    escalate: "### 7. When To Escalate",
    frames: "### Frame Routing",
    aim: "Aim:",
    twoAxes: "Two Axes:",
    story: "Story:",
    shadow: "Shadow:",
    marriage: "Marriage:",
    shepherd: "Shepherd:",
    memory: "### Pending Memory Review",
    noMemory: "- No durable child memory proposed.",
    cards: "### Knowledge Cards Used",
    noCards: "- No Arbor AI Wiki card attached.",
    handoff: "### Handoff Note",
    teacher: "Teacher:",
    professional: "Professional:",
    followUps: "### Suggested Follow-ups",
    fallbackHypothesis: "One possibility is a temporary mismatch between the child's developmental capacity, the environment, and the demand being placed on them.",
  },
  he: {
    happening: "### 1. מה אולי קורה",
    why: "### 2. למה זה אולי קורה",
    ageBand: "שלב גיל:",
    domains: "תחומים:",
    today: "### 3. מה לעשות היום",
    script: "### 4. מה אפשר להגיד",
    avoid: "### 5. ממה כדאי להימנע",
    observe: "### 6. על מה לשים לב",
    escalate: "### 7. מתי לפנות לאיש מקצוע",
    frames: "### שש המסגרות",
    aim: "מטרה:",
    twoAxes: "שני צירים:",
    story: "סיפור:",
    shadow: "צל:",
    marriage: "זוגיות:",
    shepherd: "רועה:",
    memory: "### זיכרון שממתין לאישורכם",
    noMemory: "- לא הוצע זיכרון חדש.",
    cards: "### כרטיסי ידע שנעזרנו בהם",
    noCards: "- לא צורף כרטיס ידע.",
    handoff: "### הערה להעברה",
    teacher: "לצוות החינוכי:",
    professional: "לאיש מקצוע:",
    followUps: "### שאלות המשך",
    fallbackHypothesis: "אפשרות אחת היא פער זמני בין היכולת ההתפתחותית, הסביבה והדרישה שמוצבת כרגע.",
  },
};

/** Domain ids as the reader sees them: EN keeps the framework ids (byte
 *  parity); HE prints the registry's Hebrew names (lib/domains/registry). */
const renderDomains = (domains: readonly string[], language: CoachRenderLanguage): string =>
  language === "he"
    ? domains.map((id) => domainLabel("developmental", id, (key) => DOMAIN_NAMES_HE[key] ?? key, id)).join(", ")
    : domains.join(", ");

/**
 * B-AI-01 eval fix (verdict scrub): a hypothesis' `confidence` is a graded
 * label when the model writes low / medium / high (coach-core-v1
 * coach-no-verdict-strings, noDiagnosis 0 at 1.3.0). The server replaces every
 * value with ONE fixed uncertainty phrase in the session language, so no grade
 * reaches the rendered text, the answer cards or an export. Mutates in place.
 */
export const HYPOTHESIS_UNCERTAINTY: Record<CoachRenderLanguage, string> = {
  en: "one possibility",
  he: "אפשרות אחת",
};

export const scrubHypothesisConfidence = <T extends Pick<CoachResponse, "nonDiagnosticHypotheses">>(
  response: T,
  language: CoachRenderLanguage = "en",
): T => {
  for (const hypothesis of response.nonDiagnosticHypotheses ?? []) {
    hypothesis.confidence = HYPOTHESIS_UNCERTAINTY[language];
  }
  return response;
};

export const renderCoachResponse = (response: CoachResponse, language: CoachRenderLanguage = "en") => {
  const L = COACH_RENDER_LABELS[language] ?? COACH_RENDER_LABELS.en;
  const hypotheses = response.nonDiagnosticHypotheses
    .map((item) => `- **${item.label}** (${item.confidence}): ${item.rationale}`)
    .join("\n");

  // ASK-1/AIR-1: the streamed prose leads the rendered answer, so the
  // done-time output screen (lexical + optional semantic) always covers the
  // exact text that was previewed as deltas — one screened rendering, no fork.
  const lead = response.text?.trim() ? `${response.text.trim()}\n\n` : "";

  return `${lead}${L.happening}
${hypotheses || L.fallbackHypothesis}

${L.why}
${L.ageBand} **${response.ageBand}**. ${L.domains} **${renderDomains(response.domains, language)}**.

${L.today}
${response.todayPlan.map((step) => `- ${step}`).join("\n")}

${L.script}
"${response.parentScript}"

${L.avoid}
${response.avoid.map((item) => `- ${item}`).join("\n")}

${L.observe}
${response.observe.map((item) => `- ${item}`).join("\n")}

${L.escalate}
${renderEscalationLines(response)}

${L.frames}
- **${L.aim}** ${response.frameRouting.aim}
- **${L.twoAxes}** ${response.frameRouting.twoAxes}
- **${L.story}** ${response.frameRouting.story}
- **${L.shadow}** ${response.frameRouting.shadow}
- **${L.marriage}** ${response.frameRouting.marriage}
- **${L.shepherd}** ${response.frameRouting.shepherd}

${L.memory}
${response.memoryProposals.map((item) => `- ${item.fact} (${item.source}; ${item.retention})`).join("\n") || L.noMemory}

${L.cards}
${response.sourceCardsUsed?.map((card) => `- ${card}`).join("\n") || L.noCards}

${response.handoffNotes.teacher || response.handoffNotes.professional ? `${L.handoff}
${response.handoffNotes.teacher ? `${L.teacher} ${response.handoffNotes.teacher}` : ""}
${response.handoffNotes.professional ? `${L.professional} ${response.handoffNotes.professional}` : ""}` : ""}${
    // ASK-4 FIREWALL CONDITION: followUps MUST flow through this rendered
    // text so screenModelOutput covers every string the chips display — a
    // rendered-but-unscreened field would be the first bypass of the AI-2
    // output screen. Keep this the LAST section so the streamed prose lead
    // and section ordering above stay byte-identical for existing tests.
    response.followUps?.length
      ? `\n\n${L.followUps}\n${response.followUps.map((q) => `- ${q}`).join("\n")}`
      : ""
  }${
    // Parity 9 Oct: the document block is rendered to the parent, so it is
    // screened here too. Absent on every non-file turn (byte-identical).
    response.document ? `\n\n${renderDocumentLines(response.document, language)}` : ""
  }`;
};
