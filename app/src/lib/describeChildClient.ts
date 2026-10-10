/**
 * B-SHELL-39 — the network and write half of "Tell Arbor about {name}".
 *
 * `describeServices` builds the DescribeSession services both entries use:
 *  - draft: POST /api/describe-child (≤ 25 s; a timeout reads as a failure,
 *    and the caller takes its fallback — no retry loop);
 *  - commit: ONE child-doc patch (updateChild), then the context items as
 *    approved memory (propose → approve, the parent's Keep is the approval),
 *    then the confirmed catalogue milestones. A later step that fails puts
 *    the earlier ones back, so a Keep is all or nothing;
 *  - undo: the patch's previous values, the memory items forgotten, the
 *    milestones restored.
 * The raw description is never written anywhere (D2).
 */
import type { ChildProfile, Milestone } from "../types";
import { api, authHeaders } from "./api";
import { toParentWords } from "../server/parentWordsScrub";
import { primeNaturalAudio } from "./naturalVoice";
import { voiceState } from "./voice";
import type { DescribeCommitPlan, DescribeDraftInput, DescribeReceipt, DescribeRequest, DescribeServices } from "./describeChild";

export const DESCRIBE_CLIENT_TIMEOUT_MS = 25_000;
/** A parent's context line is kept for a year; they can change it in What Arbor knows. */
const DESCRIBE_MEMORY_RETENTION = "1 year";

/** The child the route may see: name (redacted server-side) and age inputs only. */
export function describeChildFor(child: Pick<ChildProfile, "id" | "name" | "birthDate" | "birthMonth" | "ageMonths" | "ageMonthsAsOf" | "preterm">): DescribeRequest["childProfile"] {
  return {
    id: child.id,
    name: child.name,
    ...(child.birthDate ? { birthDate: child.birthDate } : {}),
    ...(child.birthMonth ? { birthMonth: child.birthMonth } : {}),
    ...(typeof child.ageMonths === "number" ? { ageMonths: child.ageMonths } : {}),
    ...(child.ageMonthsAsOf ? { ageMonthsAsOf: child.ageMonthsAsOf } : {}),
    ...(child.preterm ? { preterm: child.preterm } : {}),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("describe-timeout")), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

/** Context items → approved memory: propose (pending), then approve — the
 *  parent's Keep IS the approval. Returns the memory ids written. */
export async function keepMemoryFacts(childId: string, facts: readonly string[]): Promise<string[]> {
  const ids: string[] = [];
  try {
    for (const fact of facts) {
      const res = await fetch(`/api/memory/${encodeURIComponent(childId)}/propose`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ fact, source: "describe", retention: DESCRIBE_MEMORY_RETENTION, prompt: "describe:keep", childId }),
      });
      if (!res.ok) throw new Error("Memory proposal failed");
      const { items } = (await res.json()) as { items?: { memoryId: string; fact: string; status?: string; source?: string }[] };
      // The server stores the plain-words wording; a fact it cannot word is not stored.
      const stored = toParentWords(fact);
      const item = [...(items ?? [])].reverse().find((entry) => entry.status !== "approved" && (entry.fact === fact || entry.fact === stored));
      if (!item) continue;
      const approve = await fetch(`/api/memory/${encodeURIComponent(item.memoryId)}`, {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ status: "approved" }),
      });
      if (!approve.ok) throw new Error("Memory approval failed");
      ids.push(item.memoryId);
    }
    return ids;
  } catch (error) {
    await forgetMemory(ids);
    throw error;
  }
}

/** Undo for kept context items. Best effort per item; never throws. */
export async function forgetMemory(ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    try {
      await fetch(`/api/memory/${encodeURIComponent(id)}`, { method: "PATCH", headers: await authHeaders(), body: JSON.stringify({ status: "deleted" }) });
    } catch { /* the parent can still forget it in What Arbor knows */ }
  }
}

export interface DescribeServiceDeps {
  /** The child doc at the moment of the call. */
  profile: () => ChildProfile | null;
  language: () => "en" | "he";
  updateChild: (id: string, patch: Partial<ChildProfile>) => Promise<boolean>;
  /** The later door: open catalogue milestones the parent's words may match. */
  milestoneCandidateIds?: () => string[];
  /** The later door: the ArborContext milestone write, and its byte-for-byte undo. */
  milestones?: {
    find: (id: string) => Milestone | undefined;
    observe: (id: string) => unknown;
    restore: (previous: Milestone) => void;
  };
  /** Refresh the memory ledger after a write (What Arbor knows). */
  onMemoryChanged?: () => void;
  now?: () => Date;
}

const hasPatch = (plan: DescribeCommitPlan) => Object.keys(plan.patch).length > 0;

export function describeServices(deps: DescribeServiceDeps): DescribeServices {
  return {
    now: deps.now,
    profile: deps.profile,
    draft: async ({ text, question, askedQuestions, keptItems }: DescribeDraftInput) => {
      const child = deps.profile();
      if (!child) throw new Error("No child");
      const ids = deps.milestoneCandidateIds?.() ?? [];
      return withTimeout(api.describeChild({
        text,
        childProfile: describeChildFor(child),
        language: deps.language(),
        keptItems: keptItems.map(({ id, kind, words }) => ({ id, kind, words })),
        ...(question ? { question } : {}),
        ...(askedQuestions.length ? { askedQuestions } : {}),
        ...(ids.length ? { milestoneCandidateIds: ids } : {}),
      }), DESCRIBE_CLIENT_TIMEOUT_MS);
    },
    commit: async (plan: DescribeCommitPlan): Promise<DescribeReceipt> => {
      const child = deps.profile();
      if (!child) throw new Error("No child");
      if (hasPatch(plan) && !(await deps.updateChild(child.id, plan.patch))) throw new Error("The profile was not saved");
      let memoryIds: string[] = [];
      try {
        if (plan.memoryFacts.length) {
          memoryIds = await keepMemoryFacts(child.id, plan.memoryFacts);
          deps.onMemoryChanged?.();
        }
      } catch (error) {
        if (hasPatch(plan)) await deps.updateChild(child.id, plan.previous);
        throw error;
      }
      const milestonesBefore: Milestone[] = [];
      if (deps.milestones) {
        for (const id of plan.milestoneIds) {
          const before = deps.milestones.find(id);
          if (!before) continue;
          milestonesBefore.push(before);
          await deps.milestones.observe(id);
        }
      }
      return { plan, memoryIds, milestonesBefore };
    },
    undo: async (receipt: DescribeReceipt) => {
      const child = deps.profile();
      if (!child) throw new Error("No child");
      if (hasPatch(receipt.plan) && !(await deps.updateChild(child.id, receipt.plan.previous))) throw new Error("The undo was not saved");
      if (receipt.memoryIds.length) { await forgetMemory(receipt.memoryIds); deps.onMemoryChanged?.(); }
      for (const before of receipt.milestonesBefore as Milestone[]) deps.milestones?.restore(before);
    },
  };
}

/** A primed voice for the next question (see primeNaturalAudio). */
export type QuestionVoice = ReturnType<typeof primeNaturalAudio>;

/**
 * Call INSIDE the tap that sends a MIC answer. Null when the EU neural voice
 * is not configured (the browser floor never speaks a describe question): the
 * question then shows as text only. A typed answer never primes a voice.
 */
export function primeQuestionVoice(): QuestionVoice | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (voiceState().engine !== "natural") return null;
  return primeNaturalAudio();
}
