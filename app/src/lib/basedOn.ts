/**
 * What a parent-facing answer may say it was based on.
 *
 * The server already chooses approved facts in `selectApprovedFacts`
 * (memory/memoryService). This is the browser twin: same filters, same
 * ranking, same character budget. A node test pins the two together, because
 * memoryService pulls in node:crypto and cannot ship in the client bundle.
 *
 * Names render only when the local selection is the same LENGTH as the count
 * the server reported for that call. A drifted ledger stays unnamed rather
 * than claiming the wrong facts. Profile lines name allow-listed field names,
 * never their values.
 */
import { retentionToMs } from "./memoryExpiry";
import { disclosedProfileFields, type DisclosedProfileField } from "./coachDisclosure";
import type { MemoryReviewItem } from "../types";

/** Mirrors memoryService APPROVED_FACT_* caps. Pinned by basedOn.test.ts. */
export const PROMPT_FACT_CHAR_CAP = 2400;
export const PROMPT_FACT_ITEM_CAP = 600;
/** /todays-focus passes maxFacts: 5 and no query. */
export const FOCUS_MAX_FACTS = 5;
/** Default MEMORY_PROMPT_MAX_FACTS (config/env.ts). Pinned by basedOn.test.ts. */
export const TALK_MAX_FACTS = 40;

const FACT_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "what", "when", "how", "can", "you", "your", "our", "his", "her",
  "she", "him", "they", "them", "are", "was", "has", "have", "about", "from", "into", "does", "not", "but", "any",
  "all", "out", "get", "got", "should", "would", "could", "she's", "he's", "it's", "i'm", "we're",
]);

const factTokens = (text: string): Set<string> => {
  const out = new Set<string>();
  for (const raw of String(text || "").toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []) {
    const token = raw.replace(/^'+|'+$/g, "");
    if (token.length >= 3 && !FACT_STOPWORDS.has(token)) out.add(token);
  }
  return out;
};

const recencyWeight = (createdAtMs: number, now: number): number =>
  0.5 * Math.pow(0.5, Math.max(0, now - createdAtMs) / (21 * 86_400_000));

const memoryExpired = (item: { retention?: string; createdAt: string }, now: number): boolean => {
  const ms = retentionToMs(item.retention);
  if (!Number.isFinite(ms)) return false;
  return now - new Date(item.createdAt).getTime() > ms;
};

/** Same contract as selectApprovedFacts. Newest-first input order is preserved when the query is empty. */
export function selectPromptFacts(
  items: readonly MemoryReviewItem[],
  opts: { query?: string; maxFacts: number; now?: number },
): MemoryReviewItem[] {
  const now = opts.now ?? Date.now();
  const eligible = items.filter((item) => {
    const createdAt = Date.parse(item.createdAt);
    return item.status === "approved" && Number.isFinite(createdAt) && createdAt <= now && !memoryExpired(item, now);
  });
  const query = factTokens(opts.query ?? "");
  const ordered = query.size === 0
    ? eligible
    : eligible
      .map((item, index) => {
        let overlap = 0;
        for (const token of factTokens(item.fact)) if (query.has(token)) overlap += 1;
        return { item, index, score: overlap + recencyWeight(Date.parse(item.createdAt), now) };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.item);
  const picked: MemoryReviewItem[] = [];
  let chars = 0;
  for (const item of ordered) {
    const fact = item.fact.trim().slice(0, PROMPT_FACT_ITEM_CAP);
    if (!fact || chars + fact.length + (picked.length ? 1 : 0) > PROMPT_FACT_CHAR_CAP) continue;
    picked.push({ ...item, fact });
    chars += fact.length + (picked.length > 1 ? 1 : 0);
    if (picked.length >= opts.maxFacts) break;
  }
  return picked;
}

export interface BasedOnFact {
  memoryId: string;
  fact: string;
}

export interface BasedOnLines {
  facts: BasedOnFact[];
  fields: DisclosedProfileField[];
}

/**
 * Facts are named only when this ledger would send exactly as many as the
 * server said it sent. Field names are the allow-list that promptProfile emits.
 */
export function basedOnLines(input: {
  items: readonly MemoryReviewItem[];
  profile: unknown;
  query?: string;
  maxFacts: number;
  reportedFactCount?: number;
  now?: number;
}): BasedOnLines {
  const nowDate = typeof input.now === "number" ? new Date(input.now) : undefined;
  const fields = disclosedProfileFields(input.profile, nowDate);
  const selected = selectPromptFacts(input.items, { query: input.query, maxFacts: input.maxFacts, now: input.now });
  const facts = typeof input.reportedFactCount === "number" && selected.length === input.reportedFactCount
    ? selected.map((item) => ({ memoryId: item.memoryId, fact: item.fact }))
    : [];
  return { facts, fields };
}
