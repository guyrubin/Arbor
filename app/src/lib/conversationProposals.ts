import type { BehaviorLog, Milestone } from "../types";

export type ConversationProposalTarget = "observation" | "milestone" | "journal" | "report_fact";
export type ConversationProposalStatus = "draft" | "confirmed" | "discarded" | "committed" | "undone";

export type ConversationProposal = {
  id: string;
  sessionId: string;
  turnId: string;
  childId: string;
  target: ConversationProposalTarget;
  summary: string;
  sourceExcerpt: string;
  sourceLanguage: "en" | "he";
  confidence: number;
  occurredAt?: string;
  milestoneId?: string;
  milestoneStatus?: "yes" | "not_sure" | "not_yet";
  conflict?: { code: "duplicate" | "milestone_change" | "missing_milestone"; existing: string };
  status: ConversationProposalStatus;
  createdAt: string;
  committedAt?: string;
  commitRef?: { collection: "behaviorLogs" | "milestones" | "conversationChanges"; id: string };
  previousValue?: unknown;
};

export type ConversationChangeRecord = ConversationProposal & {
  id: string;
  status: "committed" | "undone";
  confirmedBy: "parent";
  confirmedAt: string;
  providerCanWrite: false;
};

const clampConfidence = (value: unknown) => {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, n));
};

/** Provider output is untrusted. This is the single client normalization seam. */
export function normalizeConversationProposals(
  raw: unknown,
  context: { sessionId: string; turnId: string; childId: string; language: "en" | "he"; now?: string },
): ConversationProposal[] {
  if (!Array.isArray(raw)) return [];
  const now = context.now ?? new Date().toISOString();
  return raw.slice(0, 8).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const target = value.target;
    if (target !== "observation" && target !== "milestone" && target !== "journal" && target !== "report_fact") return [];
    const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 600) : "";
    const sourceExcerpt = typeof value.sourceExcerpt === "string" ? value.sourceExcerpt.trim().slice(0, 400) : "";
    if (!summary || !sourceExcerpt) return [];
    const milestoneStatus = value.milestoneStatus;
    return [{
      id: `${context.turnId}-${index}`,
      sessionId: context.sessionId,
      turnId: context.turnId,
      childId: context.childId,
      target,
      summary,
      sourceExcerpt,
      sourceLanguage: context.language,
      confidence: clampConfidence(value.confidence),
      occurredAt: typeof value.occurredAt === "string" && !Number.isNaN(Date.parse(value.occurredAt)) ? value.occurredAt : undefined,
      milestoneId: typeof value.milestoneId === "string" ? value.milestoneId : undefined,
      milestoneStatus: milestoneStatus === "yes" || milestoneStatus === "not_sure" || milestoneStatus === "not_yet" ? milestoneStatus : undefined,
      status: "draft" as const,
      createdAt: now,
    }];
  });
}

const normalized = (text: string) => text.trim().toLocaleLowerCase();

/** Deterministic conflicts are computed from canonical records, never trusted to the model. */
export function attachProposalConflicts(
  proposals: ConversationProposal[],
  state: { behaviorLogs: BehaviorLog[]; milestones: Milestone[]; committedChanges?: ConversationChangeRecord[] },
): ConversationProposal[] {
  return proposals.map((proposal) => {
    if (proposal.target === "milestone") {
      const milestone = state.milestones.find((item) => item.id === proposal.milestoneId);
      if (!milestone) return { ...proposal, conflict: { code: "missing_milestone", existing: "No matching milestone was found." } };
      const current = milestone.observationStatus ?? (milestone.checked ? "yes" : "not_yet");
      if (proposal.milestoneStatus && current !== proposal.milestoneStatus) {
        return { ...proposal, conflict: { code: "milestone_change", existing: current } };
      }
      return proposal;
    }
    const text = normalized(proposal.summary);
    const duplicateLog = state.behaviorLogs.some((log) => normalized(`${log.trigger} ${log.response} ${log.notes ?? ""}`).includes(text));
    const duplicateChange = state.committedChanges?.some((item) => item.status === "committed" && normalized(item.summary) === text);
    return duplicateLog || duplicateChange
      ? { ...proposal, conflict: { code: "duplicate", existing: proposal.summary } }
      : proposal;
  });
}

export function proposalConfidenceLabel(confidence: number): "clear" | "check" | "uncertain" {
  if (confidence >= 0.85) return "clear";
  if (confidence >= 0.6) return "check";
  return "uncertain";
}
