import type { CoachResponse } from "../contracts/coach.js";
import type { DomainId } from "../lib/domains/registry.js";

export type MemoryStatus = "pending" | "approved" | "rejected" | "deleted" | "expired";

export type MemoryLedgerEvent = {
  eventId: string;
  memoryId: string;
  familyId: string;
  childId: string;
  eventType: "proposed" | "approved" | "rejected" | "deleted" | "edited" | "expired";
  status: MemoryStatus;
  fact: string;
  source: string;
  retention: string;
  createdAt: string;
  actor: "system" | "parent";
  prompt?: string;
  frameRouting?: CoachResponse["frameRouting"];
  /**
   * B-GROWTH-29 (spine §3, §4.3): the registry domains of the answer this fact
   * was proposed from (`lib/domains/registry.ts` DomainId), set server-side at
   * proposal time and carried unchanged through approve / edit / expire.
   * Absent on facts proposed before the tag existed (no backfill) and on
   * proposals with no answer contract. Exported and erased with the event.
   */
  domains?: DomainId[];
  /**
   * B-AI-07: the fact's topic — the first domain of the coach's behaviour /
   * domain keyword table (knowledge/retrievalKeys.ts) the fact names. Set at
   * proposal time, carried through every transition; absent when no keyword
   * matches. Groups the review queue; exported and erased with the event.
   */
  topicKey?: string;
  /** B-AI-07: why a `rejected` event was appended by the system — "duplicate"
   *  for the one-off queue cleanup (scripts/memory-dedupe-report.mjs --apply). */
  reason?: "duplicate";
};

export type MemoryReviewItem = Omit<MemoryLedgerEvent, "eventId" | "eventType" | "actor"> & {
  latestEventId: string;
};

export type MemoryStore = {
  listEvents(childId?: string): Promise<MemoryLedgerEvent[]>;
  appendEvent(event: MemoryLedgerEvent): Promise<void>;
  /** OWN-1: resolve (creating on first touch) the family owned by the
   *  AUTHENTICATED uid. The ONLY legitimate source of a familyId for
   *  ownership-bearing writes — client-supplied familyIds are never trusted.
   *  Optional — single-tenant (local) stores omit it. */
  ensureFamilyForUser?(uid: string): Promise<{ familyId: string }>;
  ensureFamilyChild?(input: {
    familyId: string;
    childId: string;
    userId: string;
    childProfile?: Record<string, unknown>;
  }): Promise<void>;
  /** GDPR erasure: permanently delete every memory event (and the child doc) for a child. Returns the number of events removed. */
  eraseChild(childId: string): Promise<number>;
  /** Authorization: does `uid` belong to the family that owns `childId`? Optional —
   *  single-tenant (local) stores omit it, and the ownership middleware then no-ops. */
  ownsChild?(uid: string, childId: string): Promise<boolean>;
};
