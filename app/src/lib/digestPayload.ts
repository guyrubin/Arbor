/**
 * B-AI-16 (VETO-FIRST privacy) — what one log and one milestone may carry
 * into /api/digest (and the two digest-email routes beside it).
 *
 * The Weekly page tells the parent no moment text goes to the model. The
 * digest used to post full BehaviorLog rows — `trigger`, `notes`, `response`,
 * `resolutionNotes`, `sourceExcerpt`, even `photoAttachment` — so that
 * sentence was untrue. The digest reads counts, types, contexts and outcomes
 * only: these are exactly the fields computeWeeklyDigestStats (server/digest.ts)
 * reads, and nothing else.
 *
 * One allow-list, used by the client builder (lib/api.ts) AND the server
 * routes (routes/api.ts), so an older client that still posts full rows
 * cannot get free text past the route. Same shape as lib/analyzeLogPayload.ts
 * (B-AI-13). Pure: no imports beyond types, safe for both bundles.
 */

export type DigestLogInput = {
  timestamp: string;
  behaviorType: string;
  context?: string;
  resolved?: boolean;
};

export type DigestMilestoneInput = { checked: boolean };

/** The only keys a log carries into the digest. */
export const DIGEST_LOG_FIELDS = ["timestamp", "behaviorType", "context", "resolved"] as const;
/** The only key a milestone carries into the digest (done / not done). */
export const DIGEST_MILESTONE_FIELDS = ["checked"] as const;

export function toDigestLogInput(log: unknown): DigestLogInput {
  const src = (log && typeof log === "object" ? log : {}) as Record<string, unknown>;
  const out: DigestLogInput = {
    timestamp: typeof src.timestamp === "string" ? src.timestamp : "",
    behaviorType: typeof src.behaviorType === "string" ? src.behaviorType : "",
  };
  if (typeof src.context === "string") out.context = src.context;
  if (typeof src.resolved === "boolean") out.resolved = src.resolved;
  return out;
}

export function toDigestLogInputs(logs: unknown): DigestLogInput[] {
  return Array.isArray(logs) ? logs.map(toDigestLogInput) : [];
}

export function toDigestMilestoneInputs(milestones: unknown): DigestMilestoneInput[] {
  if (!Array.isArray(milestones)) return [];
  return milestones.map((m) => ({ checked: Boolean(m && typeof m === "object" && (m as { checked?: unknown }).checked === true) }));
}
