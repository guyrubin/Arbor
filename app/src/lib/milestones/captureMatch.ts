/**
 * B-LOOP-06 — the client half of "a moment becomes milestone evidence".
 *
 *  · `milestoneCandidateIds` — the child's OPEN catalogue milestones in the
 *    age window (current band + one earlier, never ahead), current band
 *    first, ≤ 24. The server re-validates every id; this list only narrows.
 *  · `milestoneMatchAllowed` — when a saved moment may ask at all: a plain
 *    moment the parent wrote (never a hard moment / incident, never a log
 *    flagged private, never a photo-only caption, never a log the parent
 *    already answered "Not this" for).
 *  · `requestMilestoneProposal` — one extract call with the candidates, the
 *    validated match turned into ONE proposal row (lib/captureProposals).
 *    Any failure — escalation, network, no match — is simply no row.
 */
import type { BehaviorLog, ChildProfile, Milestone } from "../../types";
import { isCatalogueMilestone, selectNextMilestones } from "../milestoneData";
import { milestoneProposalFrom, type MilestoneCaptureProposal } from "../captureProposals";
import { isMilestoneProposalDeclined, type LedgerStorage } from "./proposalLedger";

export const MAX_CANDIDATE_IDS = 24;
/** Shorter than this, a moment carries too little to map ("ok", "cute"). */
export const MIN_MATCH_CHARS = 8;

export function milestoneCandidateIds(milestones: Milestone[], comparisonMonths: number | null): string[] {
  if (comparisonMonths === null || !Number.isFinite(comparisonMonths)) return [];
  return selectNextMilestones(milestones, comparisonMonths, MAX_CANDIDATE_IDS * 2)
    .filter((m) => isCatalogueMilestone(m))
    .slice(0, MAX_CANDIDATE_IDS)
    .map((m) => m.id);
}

export function milestoneMatchAllowed(
  log: Pick<BehaviorLog, "id" | "trigger"> & { private?: boolean },
  opts: { childId: string; hard: boolean; photoOnly?: boolean; storage?: LedgerStorage | null },
): boolean {
  if (opts.hard || opts.photoOnly || log.private) return false;
  if ((log.trigger ?? "").trim().length < MIN_MATCH_CHARS) return false;
  return !isMilestoneProposalDeclined(opts.childId, log.id, opts.storage);
}

/** The extract seam, as this module needs it (lib/api `api.extractLog`). */
export type ExtractWithCandidates = (payload: {
  message: string;
  childProfile: ChildProfile;
  language?: "en" | "he";
  milestoneCandidateIds?: string[];
}) => Promise<{ milestoneMatch?: { shelf?: unknown; milestoneId?: unknown; confidence?: unknown } | null }>;

export async function requestMilestoneProposal(args: {
  extract: ExtractWithCandidates;
  log: Pick<BehaviorLog, "id" | "trigger">;
  childProfile: ChildProfile;
  language: "en" | "he";
  candidateIds: string[];
}): Promise<MilestoneCaptureProposal | null> {
  if (args.candidateIds.length === 0) return null;
  try {
    const res = await args.extract({
      message: args.log.trigger,
      childProfile: args.childProfile,
      language: args.language,
      milestoneCandidateIds: args.candidateIds,
    });
    return milestoneProposalFrom(res?.milestoneMatch ?? null, args.log.id, new Set(args.candidateIds));
  } catch {
    return null;
  }
}
