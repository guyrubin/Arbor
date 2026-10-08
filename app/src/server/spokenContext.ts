import { sanitizeRecentTurns } from "../ai/chatContext.js";
import type { SpokenContext } from "../ai/spokenContext.js";
import type { MemoryStore } from "../memory/types.js";
import { assembleCompanionContext, programPromptLine, todayPracticeLine, type CompanionLedgerSource } from "./companionContext.js";
import { createRedaction } from "./redaction.js";

const EMPTY = (): SpokenContext => ({ profile: null, approvedMemory: "", approvedMemoryFactsUsed: 0, recentTurns: [] });

/** Never derive a persistent child identity from a name or the default child. */
export const spokenChildId = (profile: unknown): string | null => {
  if (!profile || typeof profile !== "object") return null;
  const id = (profile as { id?: unknown }).id;
  return typeof id === "string" && id.trim() && id.length <= 200 ? id : null;
};

/**
 * No new consent or storage surface: memory already approved for this child,
 * selected profile fields, and settled text from the currently visible thread.
 * Weekly logs/notes are deliberately absent, including when supplied by a caller.
 *
 * B-AI-01: a thin projection of `assembleCompanionContext` (server/
 * companionContext.ts). The spoken transports pass NO query, so the selector
 * keeps the ledger's newest-first order and the `/voice` + `/live/token`
 * prompts stay byte-identical (pinned by spokenContext.test.ts).
 */
export const assembleSpokenContext = async (input: {
  memoryStore: MemoryStore;
  childProfile?: unknown;
  recentTurns?: unknown;
  contextChildId?: unknown;
  privateMode?: unknown;
  canReadMemory: boolean;
  maxMemoryFacts?: number;
  /** B-PROG-01: with the caller's ledger source + authenticated uid, the
   *  active program's one line joins the context (voice_reply 1.7.0 /
   *  live_session 1.5.0). Absent → no ledger read, no program line. */
  ledgerSource?: CompanionLedgerSource;
  uid?: string;
  /** B-LOOP-13: the client's raw journal request (sanitized by the context
   *  service); with the ledger's dose rows it yields today's practice line. */
  journal?: unknown;
  topicId?: unknown;
}): Promise<SpokenContext> => {
  if (input.privateMode === true || !input.canReadMemory) return EMPTY();
  const childId = spokenChildId(input.childProfile);
  const companion = await assembleCompanionContext({
    purpose: "voice",
    audience: "parent",
    childId,
    childProfile: input.childProfile,
    memoryStore: input.memoryStore,
    maxFacts: Math.min(8, Math.max(1, input.maxMemoryFacts ?? 8)),
    ...(input.ledgerSource && input.uid ? { ledgerSource: input.ledgerSource, uid: input.uid } : {}),
    ...(input.journal !== undefined ? { journal: input.journal } : {}),
    topicId: input.topicId,
  });
  const context = EMPTY();
  context.profile = companion.profile;
  // The explicit binding guards stale history when the selected child changes.
  // Legacy clients without a binding still receive profile + approved memory.
  if (childId && input.contextChildId === childId) context.recentTurns = sanitizeRecentTurns(input.recentTurns);
  context.approvedMemory = companion.approvedFacts.map((fact) => fact.text).join("\n");
  context.approvedMemoryFactsUsed = companion.approvedFacts.length;
  const program = programPromptLine(companion.program);
  if (program) context.program = program;
  const practice = todayPracticeLine(companion.journal);
  if (practice) context.todayPractice = practice;
  if (companion.familyTopic) context.familyTopic = companion.familyTopic;
  if (companion.familyTopicStatus) context.familyTopicStatus = companion.familyTopicStatus;
  if (companion.acceptedActions.length) context.acceptedActions = companion.acceptedActions;
  // Round 2 (continuity judge on 1.8.0): the night answers reach voice_reply
  // too — the client's rows when the server ledger holds none.
  const answers = companion.journal?.nightAnswers ?? [];
  if (answers.length) context.nightAnswers = answers.map((a) => ({ ...a }));
  return context;
};

/** Direct Live audio cannot restore a name alias: speak naturally without a name. */
export const liveContextWithoutNames = (context: SpokenContext, childName?: string): SpokenContext => {
  const privacy = createRedaction(childName);
  const clean = (text: string): string => {
    let out = privacy.redact(text);
    // The shared redactor's word-boundary matcher is Latin-oriented. Literal
    // replacement also removes Hebrew names before a Live context is pinned.
    const name = typeof childName === "string" ? childName.trim() : "";
    if (name.length >= 2) out = out.split(name).join("your child");
    return out.replace(/\[\s*child\s*\]/gi, "your child");
  };
  const { name: _name, ...profile } = context.profile ?? {};
  return {
    ...context,
    profile: context.profile ? JSON.parse(clean(JSON.stringify(profile))) : null,
    approvedMemory: clean(context.approvedMemory),
    recentTurns: context.recentTurns.map((turn) => ({ ...turn, text: clean(turn.text) })),
    ...(context.familyTopic ? { familyTopic: { ...context.familyTopic, title: clean(context.familyTopic.title) } } : {}),
    ...(context.acceptedActions ? { acceptedActions: context.acceptedActions.map((step) => ({ ...step, recommendation: clean(step.recommendation) })) } : {}),
  };
};
