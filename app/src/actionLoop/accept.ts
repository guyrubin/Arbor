import { planAcceptedAction, todayActionId, type ActionCapacity, type ActionLoopEntry, type PlanStepRef } from "./model";

/** The shared acceptance seam, including pre-shell onboarding. The caller owns
 * its child-scoped collection; no active-profile lookup can redirect a write.
 * An explicit request key makes interrupted onboarding completion retryable. */
export async function acceptTodayAction(input: {
  childId: string;
  items: readonly ActionLoopEntry[];
  upsert: (item: ActionLoopEntry) => Promise<void>;
  recommendation: string;
  capacity: ActionCapacity;
  source: ActionLoopEntry["source"];
  planStep?: PlanStepRef;
  topicId?: string;
  acceptanceKey?: string;
  /** First-run replay may be an optimistic cached snapshot. Establish a
   * confirmed, idempotent write barrier before allowing profile completion. */
  confirmExisting?: boolean;
  now?: Date;
}): Promise<ActionLoopEntry> {
  if (!input.childId || !input.recommendation.trim()) throw new Error("A child and a step are required");
  const previous = input.acceptanceKey && input.items.find(row => row.acceptanceKey === input.acceptanceKey
    && row.id.startsWith(`today.${input.childId}.`) && row.status === "accepted" && !row.outcome);
  if (previous) {
    if (input.confirmExisting) await input.upsert(previous);
    return previous;
  }
  const now = input.now ?? new Date();
  const { entry, superseded } = planAcceptedAction(input.items, input, todayActionId(input.childId, now), now);
  const item = { ...entry, ...(input.topicId ? { topicId: input.topicId } : {}), ...(input.acceptanceKey ? { acceptanceKey: input.acceptanceKey } : {}) };
  for (const old of superseded) await input.upsert(old);
  await input.upsert(item);
  return item;
}
