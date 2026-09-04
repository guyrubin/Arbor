/* ════════════════════════════════════════════════════════════════════════════
   firstMomentChain — ENG-L0: the day-0 loop "first moment → first keepsake →
   tonight's story".

   WHAT WAS MISSING
   ────────────────
   All three pieces already shipped, and none of them knew about the others:

     · capture   ArborContext.addMoment, reached from Today's QuickLogModal;
     · keepsake  ui/ShareButton → lib/share.shareCard → lib/shareCard renders a
                 real PNG on device (the same primitive the journal, the month
                 keepsake and the story cover already mount);
     · story     the bedtime-stories route, which seeds itself from the day's
                 own behaviorLogs.

   The lifecycle spine (lib/lifecycle.ts) already resolved a "first-moment"
   card the day the first capture landed, and its single CTA jumped STRAIGHT to
   the story. So the parent's first session ended with a generated-and-discarded
   story and nothing in their hands, and the keepsake — the one artefact they
   could actually keep — was never on the path at all.

   This module is the loop's memory. It is NOT a fourth feature: it owns only
   the question "which of the three steps has this parent done?", so the card
   can walk them through the pieces that already exist.

   RESUMABLE, AND NEVER A NAG
   ──────────────────────────
   A parent who captures one moment and closes the app must find the chain
   waiting, not be chased. Two rules carry that:

     · the chain PERSISTS. Step marks live in one device-local record, so the
       next open resumes exactly where they stopped. (The lifecycle card that
       renders this is moved into LIFECYCLE_STICKY_KINDS for the same reason —
       an announcement retires after one render, and a half-finished chain that
       retires after one render is not resumable.)
     · the chain is DISMISSIBLE and, once dismissed or completed, gone for
       good. There is no reminder, no badge, no second ask, and nothing here
       schedules or sends anything — this app has no push/email path and this
       module does not pretend otherwise.

   The first step is DERIVED, never stored: a parent has captured a moment iff
   a moment exists. Only the two steps with no cheap state signal are marked —
   a keepsake render leaves nothing behind on the device, and bedtime stories
   are generate-and-discard by design (lib/bedtimeStories.ts header), so there
   is no artefact either one could be read back from. This is the same
   click-completion convention FirstStepsRail already uses, and the marks say
   what the parent DID (asked for the keepsake, opened tonight's story), never
   that a file exists somewhere.

   DEVICE-LOCAL KEY. The record is minted through childLocalState.childScopedKey
   (`arbor.d0chain.<childId>`), so deleting the child sweeps it with everything
   else on the parent's own device. Never put the child id anywhere but its own
   dot-delimited segment — that leak has cost this repo four keys already.

   CLINICAL FIREWALL. The only number here is `doneCount` — how many of three
   steps THE PARENT has taken. It is a count of parent actions, not a fact about
   the child. There is deliberately no ratio, no percentage and no "progress"
   value: `total` exists so a caller can say "2 of 3", and a caller that divides
   them to draw a ring has left what this module permits.

   PURE + BEST-EFFORT: `resolveFirstMomentChain` has no I/O and no clock; the
   read/write helpers never throw, because a private window must never break a
   parent's first session.
   ════════════════════════════════════════════════════════════════════════════ */
import { childScopedKey } from "./childLocalState";

/** The three steps of the day-0 loop, in the order they are walked. */
export type FirstMomentStepId = "moment" | "keepsake" | "story";

export const FIRST_MOMENT_STEPS: readonly FirstMomentStepId[] = ["moment", "keepsake", "story"] as const;

/** The two steps a parent can mark. `moment` is absent on purpose — it is
 *  derived from the moments that exist and can never be asserted by a click. */
export type FirstMomentMarkableStep = "keepsake" | "story";

/** What one device remembers about this child's day-0 loop. */
export interface FirstMomentMarks {
  /** The parent asked for a keepsake of their first moment. */
  keepsake?: boolean;
  /** The parent opened tonight's story. */
  story?: boolean;
  /** The parent waved the whole chain away. It never comes back. */
  dismissed?: boolean;
}

/** `arbor.d0chain.<childId>` — swept by clearChildLocalState on child deletion. */
export function firstMomentChainKey(childId: string): string {
  return childScopedKey("d0chain", childId);
}

function storageOf(explicit?: Storage | null): Storage | null {
  if (explicit !== undefined) return explicit;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Read this child's marks. An unreadable or corrupt record reads as empty —
 *  the chain then simply offers from the top, which is never harmful. */
export function readFirstMomentChain(childId: string, explicit?: Storage | null): FirstMomentMarks {
  if (!childId) return {};
  try {
    const raw = storageOf(explicit)?.getItem(firstMomentChainKey(childId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const { keepsake, story, dismissed } = parsed as FirstMomentMarks;
    return {
      ...(keepsake === true ? { keepsake: true } : {}),
      ...(story === true ? { story: true } : {}),
      ...(dismissed === true ? { dismissed: true } : {}),
    };
  } catch {
    return {};
  }
}

function write(childId: string, next: FirstMomentMarks, explicit?: Storage | null): FirstMomentMarks {
  try {
    storageOf(explicit)?.setItem(firstMomentChainKey(childId), JSON.stringify(next));
  } catch {
    /* storage blocked — the session still holds together, the chain just
       offers from the top on the next open. Never break a first session. */
  }
  return next;
}

/** Record that the parent took one of the two markable steps. Returns the new
 *  marks so a caller can render without a second read. */
export function markFirstMomentStep(
  childId: string,
  step: FirstMomentMarkableStep,
  explicit?: Storage | null,
): FirstMomentMarks {
  if (!childId) return {};
  return write(childId, { ...readFirstMomentChain(childId, explicit), [step]: true }, explicit);
}

/** The parent waved the chain away. Nothing re-offers it. */
export function dismissFirstMomentChain(childId: string, explicit?: Storage | null): FirstMomentMarks {
  if (!childId) return {};
  return write(childId, { ...readFirstMomentChain(childId, explicit), dismissed: true }, explicit);
}

export interface FirstMomentChain {
  done: Record<FirstMomentStepId, boolean>;
  /** How many of the three steps the PARENT has taken. A count, not a score. */
  doneCount: number;
  /** Always 3 — present so a caller can say "2 of 3" without a magic number. */
  total: number;
  /** The step to offer next, or null when there is nothing left to walk to. */
  next: FirstMomentStepId | null;
  /** All three steps taken. */
  complete: boolean;
  /** The chain still has something to offer and has not been waved away. */
  visible: boolean;
}

/**
 * Resolve the chain. Pure: the caller supplies the moment count (derived from
 * the logs it already holds) and the device marks.
 *
 * `moment` is never read from the marks. A stored "I captured something" that
 * disagrees with the actual moments would be the app telling a parent they did
 * something they did not do.
 */
export function resolveFirstMomentChain(input: {
  /** Moments + activities this child has, from the caller's own state. */
  momentCount: number;
  marks: FirstMomentMarks;
}): FirstMomentChain {
  const captured = input.momentCount > 0;
  const done: Record<FirstMomentStepId, boolean> = {
    moment: captured,
    // A keepsake or a story of a moment that does not exist is not a step the
    // parent took — a stale mark from a deleted moment cannot resurrect it.
    keepsake: captured && input.marks.keepsake === true,
    story: captured && input.marks.story === true,
  };
  const doneCount = FIRST_MOMENT_STEPS.filter((s) => done[s]).length;
  const complete = doneCount === FIRST_MOMENT_STEPS.length;
  return {
    done,
    doneCount,
    total: FIRST_MOMENT_STEPS.length,
    next: FIRST_MOMENT_STEPS.find((s) => !done[s]) ?? null,
    complete,
    visible: input.marks.dismissed !== true && !complete,
  };
}
