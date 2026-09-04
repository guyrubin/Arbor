/* ════════════════════════════════════════════════════════════════════════════
   useLifecycleMoment — the wiring between the pure spine (lib/lifecycle.ts),
   the device ledger (lib/lifecycleState.ts) and Today.

   ENG-09: `onboardingCompletedAt` finally has a reader. It lives on the child
   profile, which is server state, so lifecycle DAY is the same on every device
   the parent signs in on.

   ONE MOMENT PER OPEN, and each occurrence appears once:

     · ANNOUNCEMENTS (welcome back, birthday, a new age band, the first-week
       keepsake, the first captured moment, day one) are marked seen the first
       time they render. They said their piece; they do not follow the parent
       around.
     · The ENG-L2 ASK is different — it is a question, not an announcement, so
       it stays until the parent answers it or waves it away. Answering writes
       `interests[]` to the profile (server state), which suppresses the ask on
       every device, permanently.

   THE LEDGER IS FROZEN FOR THE MOUNT. This is the subtle part. If the seen-set
   fed to the resolver were live, marking a moment seen would immediately make
   the resolver yield the NEXT moment down the priority list, which the same
   effect would mark seen, and so on — one open would silently burn every
   lifecycle moment the parent had waiting. So the ledger is read ONCE per child
   per mount and held; writes go to storage for the NEXT open only, and what
   hides the card now is local `settled` state.

   NO NOTIFICATION IS IMPLIED OR SENT. There is no push, no email and no local
   notification in this app; everything here is surfaced in-app on the next
   open. Nothing in this hook schedules, sends, or claims to have sent.

   CLINICAL FIREWALL: the hook passes COUNTS (captured moments, this week's
   captures, milestones noticed) and the child's age. It derives no score, no
   percentage, and no period-vs-period comparison.
   ════════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { ageMonthsFromProfile, ageYearsFromProfile } from "../../lib/childAge";
import { bandForAge } from "../../playbank/content";
import { sanitizeInterestToken } from "../../playbank/select";
import { track } from "../../lib/analytics";
import {
  resolveLifecycle,
  type LifecycleMoment,
  type LifecycleMomentKind,
  type LifecycleStage,
} from "../../lib/lifecycle";
import {
  markLifecycleSeen,
  readLifecycleLedger,
  recordLifecycleBand,
  type LifecycleLedger,
} from "../../lib/lifecycleState";

const DAY_MS = 86_400_000;

/**
 * Kinds that persist until the parent acts on them. Everything else is an
 * announcement and retires itself after one render.
 *
 * ENG-L0 puts "first-moment" here. It is no longer an announcement: it carries
 * the day-0 chain (moment → keepsake → tonight's story, lib/firstMomentChain),
 * and a three-step walk that retires after ONE render is not resumable — a
 * parent who captured a moment and closed the app would have lost the rest of
 * the loop with no way back to it. It still leaves for good the moment they
 * finish it or wave it away (LifecycleMomentCard calls onDismiss on both), so
 * nothing here re-asks a parent who is done.
 */
export const LIFECYCLE_STICKY_KINDS: ReadonlySet<LifecycleMomentKind> = new Set<LifecycleMomentKind>([
  "interest-ask",
  "first-moment",
]);

export interface LifecycleMomentState {
  /** The one moment to render, or null when Today has nothing lifecycle-shaped to say. */
  moment: LifecycleMoment | null;
  /** Days since onboarding completed; null on accounts that predate the anchor. */
  day: number | null;
  stage: LifecycleStage;
  /** Retire this occurrence for good (the parent acted on it, or waved it away). */
  dismiss: () => void;
  /** ENG-L2: write the parent's answer to `interests[]` on the child profile. */
  saveInterests: (values: readonly string[]) => Promise<void>;
}

export function useLifecycleMoment(input: {
  /** From OverviewTab's single useLastVisit mount — never mounted twice (it writes). */
  previousVisitAt: string | null;
  /** Explicit clock, for tests. */
  now?: number;
}): LifecycleMomentState {
  const { childProfile, behaviorLogs, playLogs, checkedMilestones, updateChild } = useArbor();
  const childId = childProfile.id;

  // ── The frozen ledger (see the header note on the cascade this prevents). ──
  const ledgerRef = useRef<{ id: string; value: LifecycleLedger } | null>(null);
  if (ledgerRef.current?.id !== childId) {
    ledgerRef.current = { id: childId, value: readLifecycleLedger(childId) };
  }
  const ledger = ledgerRef.current.value;

  // The parent has finished with this open's moment: nothing else surfaces
  // until Today is mounted again. Reset when the active child changes.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
  }, [childId]);

  const now = input.now ?? Date.now();
  // Bucket the clock to the day so a re-render a second later cannot re-run
  // the resolver against a different `now`.
  const dayBucket = Math.floor(now / DAY_MS);

  const band = bandForAge(ageYearsFromProfile(childProfile));

  const counts = useMemo(() => {
    const cutoff = now - 7 * DAY_MS;
    const inWeek = (ts: string) => new Date(ts).getTime() >= cutoff;
    return {
      total: behaviorLogs.length + playLogs.length,
      week:
        behaviorLogs.filter((l) => inWeek(l.timestamp)).length +
        playLogs.filter((p) => inWeek(p.timestamp)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [behaviorLogs, playLogs, dayBucket]);

  const state = useMemo(
    () =>
      resolveLifecycle({
        onboardingCompletedAt: childProfile.onboardingCompletedAt,
        previousVisitAt: input.previousVisitAt,
        birthDate: childProfile.birthDate,
        ageMonths: ageMonthsFromProfile(childProfile, new Date(now)),
        band,
        recordedBand: ledger.band,
        interestCount: childProfile.interests?.length ?? 0,
        totalMoments: counts.total,
        weekMoments: counts.week,
        noticedMilestones: checkedMilestones,
        seen: ledger.seen,
        now,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childProfile, input.previousVisitAt, band, ledger, counts, checkedMilestones, dayBucket],
  );

  const moment = settled ? null : state.moment;
  const momentKey = moment?.key ?? null;
  const momentKind = moment?.kind ?? null;

  // Remember the band AFTER resolving, so this open's own band can never be
  // mistaken for a change on this open — and the NEXT change is detectable.
  useEffect(() => {
    if (!childId || !band) return;
    recordLifecycleBand(childId, band);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, band]);

  // Announcements retire on first render; the ENG-L2 ask waits for an answer.
  // The write lands in storage for the NEXT open — the frozen ledger above is
  // what stops it re-entering this render pass.
  useEffect(() => {
    if (!momentKey || !momentKind) return;
    track("lifecycle_moment_shown", { kind: momentKind, day: state.day, stage: state.stage });
    if (!LIFECYCLE_STICKY_KINDS.has(momentKind)) markLifecycleSeen(childId, momentKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentKey]);

  const dismiss = useCallback(() => {
    if (!momentKey) return;
    if (momentKind) track("lifecycle_moment_action", { kind: momentKind });
    markLifecycleSeen(childId, momentKey);
    setSettled(true);
  }, [childId, momentKey, momentKind]);

  const saveInterests = useCallback(
    async (values: readonly string[]) => {
      const cleaned = Array.from(
        new Set(values.map((v) => sanitizeInterestToken(v)).filter((v) => v.length > 0)),
      ).slice(0, 8);
      if (cleaned.length === 0) return;
      await updateChild(childId, {
        interests: cleaned,
        interestsUpdatedAt: new Date(now).toISOString(),
      });
      track("lifecycle_interest_saved", { count: cleaned.length });
      if (momentKey) markLifecycleSeen(childId, momentKey);
      setSettled(true);
    },
    [childId, updateChild, now, momentKey],
  );

  return { moment, day: state.day, stage: state.stage, dismiss, saveInterests };
}
