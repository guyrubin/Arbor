import { sanitizeRecentTurns } from "../ai/chatContext.js";
import { promptProfile } from "../ai/prompts.js";
import type { SpokenContext } from "../ai/spokenContext.js";
import { enforceMemoryRetention, foldMemoryEvents, isMemoryExpired } from "../memory/memoryService.js";
import type { MemoryStore } from "../memory/types.js";
import { createRedaction } from "./redaction.js";

const EMPTY = (): SpokenContext => ({ profile: null, approvedMemory: "", approvedMemoryFactsUsed: 0, recentTurns: [] });
const MEMORY_CHAR_CAP = 2400;
const MEMORY_FACT_CHAR_CAP = 600;

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
 */
export const assembleSpokenContext = async (input: {
  memoryStore: MemoryStore;
  childProfile?: unknown;
  recentTurns?: unknown;
  contextChildId?: unknown;
  privateMode?: unknown;
  canReadMemory: boolean;
  maxMemoryFacts?: number;
}): Promise<SpokenContext> => {
  if (input.privateMode === true || !input.canReadMemory) return EMPTY();
  const childId = spokenChildId(input.childProfile);
  const context = EMPTY();
  context.profile = promptProfile(input.childProfile);
  // The explicit binding guards stale history when the selected child changes.
  // Legacy clients without a binding still receive profile + approved memory.
  if (childId && input.contextChildId === childId) context.recentTurns = sanitizeRecentTurns(input.recentTurns);
  if (!childId) return context;

  // Memory is optional grounding: a failed read must not stop the voice loop
  // or fall back to a stale/unchecked fact. Continue with this thread only.
  let current;
  try {
    const events = await input.memoryStore.listEvents(childId);
    current = await enforceMemoryRetention(input.memoryStore, foldMemoryEvents(events, childId));
  } catch {
    return context;
  }
  const cap = Math.min(8, Math.max(1, input.maxMemoryFacts ?? 8));
  const facts: string[] = [];
  let chars = 0;
  for (const item of current) {
    const createdAt = Date.parse(item.createdAt);
    if (item.status !== "approved" || !Number.isFinite(createdAt) || createdAt > Date.now() || isMemoryExpired(item)) continue;
    const fact = item.fact.trim().slice(0, MEMORY_FACT_CHAR_CAP);
    if (!fact || chars + fact.length + (facts.length ? 1 : 0) > MEMORY_CHAR_CAP) continue;
    facts.push(fact);
    chars += fact.length + (facts.length > 1 ? 1 : 0);
    if (facts.length >= cap) break;
  }
  context.approvedMemory = facts.join("\n");
  context.approvedMemoryFactsUsed = facts.length;
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
  };
};
