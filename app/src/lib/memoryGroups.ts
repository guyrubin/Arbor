/**
 * B-CAREPRO-25 · CN-006 (page half) — the pending memory queue as one group
 * per topic, so 103 proposals read as a handful of decisions instead of a
 * 21,751 px wall.
 *
 * Topic = the registry domain (lib/domains/registry) the fact is about:
 *   1. the fact's own `domains` (B-GROWTH-29 stamps them on newer proposals);
 *   2. else the bilingual keyword table the coach retrieval already uses
 *      (knowledge/retrievalKeys `domainsFromQuestion` → developmental id →
 *      registry domain) — the same table B-AI-07's server `topicKey` reads;
 *   3. else "other".
 * So there are at most nine groups (eight domains + other), whatever the
 * queue length. B-AI-07 (server near-duplicate merge, lane X) shrinks the
 * queue itself; this module only arranges what the server returns.
 *
 * G6 (= G-16): grouping yes, BULK APPROVE NO. A group offers Approve on its
 * newest fact only; "Dismiss all" writes ONE reject event per fact through the
 * existing per-fact transition (`dismissGroup`), never a batch write.
 *
 * Pure: no React, no fetch. Labels are built by the caller with `domainName`.
 */
import type { MemoryReviewItem } from "../types";
import { DOMAIN_IDS, isDomainId, toDomains, type DomainId } from "./domains/registry";
import { domainsFromQuestion } from "../knowledge/retrievalKeys";

export type MemoryTopic = DomainId | "other";

export interface PendingMemoryGroup {
  topic: MemoryTopic;
  /** Newest first — `items[0]` is the fact the group shows. */
  items: MemoryReviewItem[];
}

const ts = (m: MemoryReviewItem) => {
  const n = Date.parse(m.createdAt);
  return Number.isFinite(n) ? n : 0;
};

/** The topic one pending fact belongs to. */
export function memoryTopicOf(m: Pick<MemoryReviewItem, "fact" | "domains">): MemoryTopic {
  const own = (m.domains ?? []).find(isDomainId);
  if (own) return own;
  for (const dev of domainsFromQuestion(m.fact ?? "")) {
    const d = toDomains("developmental", dev)[0];
    if (d) return d;
  }
  return "other";
}

/**
 * Group the pending queue by topic. Groups are ordered by their newest fact
 * (most recent first); "other" keeps that rule too. Items inside a group are
 * newest first. Every input item lands in exactly one group.
 */
export function groupPendingMemory(items: readonly MemoryReviewItem[]): PendingMemoryGroup[] {
  const byTopic = new Map<MemoryTopic, MemoryReviewItem[]>();
  for (const m of items) {
    const topic = memoryTopicOf(m);
    const list = byTopic.get(topic);
    if (list) list.push(m);
    else byTopic.set(topic, [m]);
  }
  const groups = [...byTopic.entries()].map(([topic, list]) => ({
    topic,
    items: [...list].sort((a, b) => ts(b) - ts(a)),
  }));
  const order = (t: MemoryTopic) => (t === "other" ? DOMAIN_IDS.length : DOMAIN_IDS.indexOf(t));
  return groups.sort((a, b) => ts(b.items[0]) - ts(a.items[0]) || order(a.topic) - order(b.topic));
}

/**
 * "Dismiss all" — one reject transition per fact, in order, each awaited (the
 * ledger records one event per fact; a failure on one does not skip the rest).
 * Returns how many transitions were requested.
 */
export async function dismissGroup(
  group: PendingMemoryGroup,
  decide: (memoryId: string, status: "rejected") => Promise<unknown> | unknown,
): Promise<number> {
  let n = 0;
  for (const m of group.items) {
    try {
      await decide(m.memoryId, "rejected");
    } catch {
      /* the per-fact seam reports its own failure; keep going */
    }
    n += 1;
  }
  return n;
}
