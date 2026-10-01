import { randomUUID } from "crypto";
import type { CoachResponse } from "../contracts/coach.js";
import type { MemoryLedgerEvent, MemoryReviewItem, MemoryStatus, MemoryStore } from "./types.js";
import { DOMAIN_IDS, toDomains, type DomainId } from "../lib/domains/registry.js";

/**
 * B-GROWTH-29 — an answer contract's `domains` (framework ids, model output)
 * → registry DomainIds, through the one registry. Unknown ids drop out; the
 * result is distinct and in registry order. Empty → undefined (no tag).
 */
export const memoryDomainsFrom = (answerDomains?: readonly string[] | null): DomainId[] | undefined => {
  const seen = new Set<DomainId>();
  for (const id of answerDomains ?? []) for (const d of toDomains("developmental", String(id))) seen.add(d);
  const out = DOMAIN_IDS.filter((d) => seen.has(d));
  return out.length ? out : undefined;
};

/** Spread helper: `domains` only when there is a tag (keeps untagged events byte-identical). */
const withDomains = (domains?: DomainId[]) => (domains && domains.length ? { domains: [...domains] } : {});

export const toChildId = (childProfile: any) => {
  if (childProfile?.id) return String(childProfile.id);
  if (childProfile?.name) return String(childProfile.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return "default-child";
};

export const toFamilyId = (childProfile: any) => {
  if (childProfile?.familyId) return String(childProfile.familyId);
  return "default-family";
};

export const foldMemoryEvents = (events: MemoryLedgerEvent[], childId?: string): MemoryReviewItem[] => {
  const latest = new Map<string, MemoryReviewItem>();

  for (const event of events) {
    if (childId && event.childId !== childId) continue;
    latest.set(event.memoryId, {
      memoryId: event.memoryId,
      familyId: event.familyId,
      childId: event.childId,
      status: event.status,
      fact: event.fact,
      source: event.source,
      retention: event.retention,
      createdAt: event.createdAt,
      prompt: event.prompt,
      frameRouting: event.frameRouting,
      ...withDomains(event.domains),
      latestEventId: event.eventId
    });
  }

  return [...latest.values()]
    .filter((item) => item.status !== "deleted" && item.status !== "expired")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

// SAFE-3 / G10 + SPC2: enforce memory time-boxing. The model-generated
// `retention` string is parsed to a TTL; approved memory past its retention is
// treated as expired and is NOT fed back to the AI. Only an EXPLICIT permanent
// retention never expires; missing/unparseable retention falls back to the
// app's stated default (the propose flow's "3 months") so child data cannot
// outlive its retention promise just because the wording didn't parse.
const DAY_MS = 86_400_000;

/** SPC2: the app-wide default retention window — the same default the propose
 *  flow stamps on facts proposed without one (see POST /memory/:childId/propose). */
export const DEFAULT_MEMORY_RETENTION = "3 months";

const parseRetentionMs = (retention: string): number | null => {
  const r = retention.toLowerCase();
  if (/permanent|indefinite|ongoing|long[-\s]?term/.test(r)) return Infinity;
  const m = r.match(/(\d+)\s*(day|week|month|year)/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const per = unit === "day" ? DAY_MS : unit === "week" ? 7 * DAY_MS : unit === "month" ? 30 * DAY_MS : 365 * DAY_MS;
    return n * per;
  }
  if (/session|today|24\s*h/.test(r)) return DAY_MS;
  return null;
};

const DEFAULT_RETENTION_MS = parseRetentionMs(DEFAULT_MEMORY_RETENTION) as number;

export const retentionToMs = (retention?: string): number => {
  if (!retention) return DEFAULT_RETENTION_MS;
  return parseRetentionMs(retention) ?? DEFAULT_RETENTION_MS;
};

export const isMemoryExpired = (item: { retention?: string; createdAt: string }, now: number = Date.now()): boolean => {
  const ms = retentionToMs(item.retention);
  if (!isFinite(ms)) return false;
  return now - new Date(item.createdAt).getTime() > ms;
};

/**
 * SPC2 enforce-on-read: drop APPROVED facts older than their retention window
 * from every read surface (coach prompts + the parent-visible list), and
 * tombstone each one through the existing ledger transition machinery — an
 * append-only "expired" event, actor "system" — never a delete. There is no
 * background scheduler; the read paths ARE the enforcement point, so a failed
 * tombstone write must never fail the read (the item is still filtered out).
 */
export const enforceMemoryRetention = async (
  store: MemoryStore,
  items: MemoryReviewItem[],
  now: number = Date.now()
): Promise<MemoryReviewItem[]> => {
  const expired = items.filter((item) => item.status === "approved" && isMemoryExpired(item, now));
  for (const item of expired) {
    try {
      await store.appendEvent({
        eventId: randomUUID(),
        memoryId: item.memoryId,
        familyId: item.familyId,
        childId: item.childId,
        eventType: "expired",
        status: "expired",
        fact: item.fact,
        source: item.source,
        retention: item.retention,
        createdAt: new Date(now).toISOString(),
        actor: "system",
        prompt: item.prompt,
        frameRouting: item.frameRouting,
        ...withDomains(item.domains)
      });
    } catch {
      // Best-effort tombstone: the filter below still excludes the fact.
    }
  }
  return items.filter((item) => !(item.status === "approved" && isMemoryExpired(item, now)));
};

/**
 * ASK-6: the approved-memory prompt context PLUS the integer count of facts
 * actually injected. The count (and ONLY the count — never fact content) is
 * surfaced to the parent as `approvedMemoryFactsUsed` so "uses the memory you
 * approved" becomes visible per-answer instead of a static claim.
 */
export const getApprovedMemoryContextDetail = async (
  store: MemoryStore,
  childId: string,
  maxFacts = 40
): Promise<{ context: string; factsUsed: number }> => {
  const events = await store.listEvents(childId);
  // foldMemoryEvents returns newest-first, so the slice keeps the most recent facts —
  // bounding prompt token growth as a child's memory ledger accumulates over time.
  // SPC2: enforceMemoryRetention both excludes retention-expired facts from the
  // prompt AND tombstones them in the ledger, so this read is the enforcement point.
  const live = await enforceMemoryRetention(store, foldMemoryEvents(events, childId));
  const approved = live.filter((item) => item.status === "approved" && !isMemoryExpired(item));
  const windowed = approved.slice(0, Math.max(1, maxFacts));
  const lines = windowed.map((item) => `- ${item.fact} (${item.source}; retention: ${item.retention})`);
  if (approved.length > windowed.length) {
    lines.push(`- (+${approved.length - windowed.length} older facts retained but omitted from this prompt for brevity)`);
  }
  return { context: lines.join("\n"), factsUsed: windowed.length };
};

/* ── B-AI-01 bounded fact selector (companion plan §4: no vector store) ──── */

/** The prompt budget shared by every companion consumer (was spokenContext.ts). */
export const APPROVED_FACT_CHAR_CAP = 2400;
export const APPROVED_FACT_ITEM_CHAR_CAP = 600;

const FACT_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "what", "when", "how", "can", "you", "your", "our", "his", "her",
  "she", "him", "they", "them", "are", "was", "has", "have", "about", "from", "into", "does", "not", "but", "any",
  "all", "out", "get", "got", "should", "would", "could", "she's", "he's", "it's", "i'm", "we're",
]);

/** Lower-cased word tokens (Latin + Hebrew + digits), ≥3 chars, minus stopwords. */
export const factTokens = (text: string): Set<string> => {
  const out = new Set<string>();
  for (const raw of String(text || "").toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []) {
    const token = raw.replace(/^'+|'+$/g, "");
    if (token.length >= 3 && !FACT_STOPWORDS.has(token)) out.add(token);
  }
  return out;
};

/** Recency weight in (0, 0.5]: half-life ≈ 21 days. Overlap (integers) dominates. */
const recencyWeight = (createdAtMs: number, now: number): number =>
  0.5 * Math.pow(0.5, Math.max(0, now - createdAtMs) / (21 * 86_400_000));

/**
 * B-AI-01 — the ONE approved-fact selector. Filters (approved, dated, not in
 * the future, not retention-expired — pending/rejected/deleted never pass),
 * ranks by keyword overlap with `query` plus recency decay, and fills a
 * 2,400-char budget (per fact ≤600 chars) up to `maxFacts`.
 *
 * With NO query tokens the input order (foldMemoryEvents: newest first) is
 * kept exactly — the spoken transports (`/voice`, `/live/token`) select this
 * way, so their prompts stay byte-identical to the pre-B-AI-01 assembler.
 */
export const selectApprovedFacts = (
  items: readonly MemoryReviewItem[],
  opts: { query?: string; maxFacts: number; now?: number },
): MemoryReviewItem[] => {
  const now = opts.now ?? Date.now();
  const eligible = items.filter((item) => {
    const createdAt = Date.parse(item.createdAt);
    return item.status === "approved" && Number.isFinite(createdAt) && createdAt <= now && !isMemoryExpired(item, now);
  });
  const query = factTokens(opts.query ?? "");
  const ordered =
    query.size === 0
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
    const fact = item.fact.trim().slice(0, APPROVED_FACT_ITEM_CHAR_CAP);
    if (!fact || chars + fact.length + (picked.length ? 1 : 0) > APPROVED_FACT_CHAR_CAP) continue;
    picked.push({ ...item, fact });
    chars += fact.length + (picked.length > 1 ? 1 : 0);
    if (picked.length >= opts.maxFacts) break;
  }
  return picked;
};

export const getApprovedMemoryContext = async (store: MemoryStore, childId: string, maxFacts = 40) =>
  (await getApprovedMemoryContextDetail(store, childId, maxFacts)).context;

export const appendMemoryProposals = async (
  store: MemoryStore,
  childId: string,
  proposals: CoachResponse["memoryProposals"],
  context: {
    familyId: string;
    prompt: string;
    frameRouting: CoachResponse["frameRouting"];
    /** B-GROWTH-29: the answer contract's `domains` (framework ids). */
    answerDomains?: readonly string[] | null;
  }
) => {
  if (proposals.length === 0) return foldMemoryEvents(await store.listEvents(childId), childId);

  const current = foldMemoryEvents(await store.listEvents(childId), childId);
  const now = new Date().toISOString();
  const domains = memoryDomainsFrom(context.answerDomains);

  for (const proposal of proposals) {
    const duplicate = current.find(
      (item) =>
        item.fact.trim().toLowerCase() === proposal.fact.trim().toLowerCase() &&
        item.status !== "rejected"
    );
    if (duplicate) continue;

    await store.appendEvent({
      eventId: randomUUID(),
      memoryId: randomUUID(),
      familyId: context.familyId,
      childId,
      eventType: "proposed",
      status: "pending",
      fact: proposal.fact,
      source: proposal.source,
      retention: proposal.retention,
      createdAt: now,
      actor: "system",
      prompt: context.prompt,
      frameRouting: context.frameRouting,
      ...withDomains(domains)
    });
  }

  return foldMemoryEvents(await store.listEvents(childId), childId);
};

export const transitionMemory = async (
  store: MemoryStore,
  memoryId: string,
  status: MemoryStatus,
  edits: Partial<Pick<MemoryLedgerEvent, "fact" | "retention" | "source">> = {}
) => {
  const events = await store.listEvents();
  const current = foldMemoryEvents(events).find((item) => item.memoryId === memoryId);
  if (!current) return null;

  const eventTypeByStatus: Record<MemoryStatus, MemoryLedgerEvent["eventType"]> = {
    pending: "edited",
    approved: "approved",
    rejected: "rejected",
    deleted: "deleted",
    expired: "expired"
  };

  await store.appendEvent({
    eventId: randomUUID(),
    memoryId,
    familyId: current.familyId,
    childId: current.childId,
    eventType: eventTypeByStatus[status],
    status,
    fact: edits.fact ?? current.fact,
    source: edits.source ?? current.source,
    retention: edits.retention ?? current.retention,
    createdAt: new Date().toISOString(),
    actor: "parent",
    prompt: current.prompt,
    frameRouting: current.frameRouting,
    // B-GROWTH-29: the tag survives approve / edit / reject / delete
    ...withDomains(current.domains)
  });

  const nextEvents = await store.listEvents(current.childId);
  return {
    item: foldMemoryEvents(nextEvents).find((item) => item.memoryId === memoryId),
    items: foldMemoryEvents(nextEvents, current.childId)
  };
};
