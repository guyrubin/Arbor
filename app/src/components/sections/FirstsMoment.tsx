import React, { useCallback, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { ShareButton } from "../ui/ShareButton";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { PASTEL } from "../../lib/tokens";
import type { ShareCardOpts } from "../../lib/shareCard";
import {
  EMPTY_FIRSTS_STATE,
  detectFirsts,
  firstCopyKeys,
  firstsStorageKey,
  mergeFirsts,
  pickFirst,
  type FirstsState,
} from "../../lib/firsts";

/**
 * FirstsMoment — ENG-13: the week-1 celebration that was structurally
 * impossible.
 *
 * growth/prideMoment.ts returns [] when there is no prior snapshot, and its
 * milestone thresholds start at 5, so ui/CelebrationMoment was unreachable
 * until week 2. This card fires at ONE: the first moment kept, the first
 * milestone noticed, the first story made, and the first week (7 days, with
 * moments on ≥3 DISTINCT days — cumulative, never a streak).
 *
 * The detector is pure and tested (lib/firsts.ts). This component is glue: it
 * reads the counts, loads the persisted "already celebrated" set, shows at
 * most ONE card, and writes the kind back on dismiss so it can never happen
 * twice.
 *
 * CLINICAL FIREWALL: a factual noticing plus a count. No score, no %, no
 * verdict, no "keep it up", no chain that can be broken. No confetti either —
 * this is a calm card, so the celebration caps have nothing to cap.
 */
function loadState(childId: string): FirstsState {
  try {
    const raw = localStorage.getItem(firstsStorageKey(childId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed?.seen)) {
      return { seen: parsed.seen.filter((x: unknown): x is string => typeof x === "string") };
    }
  } catch {
    /* corrupt or unavailable storage — fall through to the empty default */
  }
  return EMPTY_FIRSTS_STATE;
}

/** Distinct "YYYY-MM-DD" keys that carry at least one moment. */
function momentDaysOf(logs: ReadonlyArray<{ timestamp?: string }>): string[] {
  const days = new Set<string>();
  for (const log of logs) {
    const key = (log.timestamp || "").slice(0, 10);
    if (key.length === 10) days.add(key);
  }
  return [...days];
}

const DAY_MS = 86_400_000;

export default function FirstsMoment() {
  const { childProfile, behaviorLogs, milestones, currentStory } = useArbor();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  const childId = childProfile?.id;
  const firstName = (childProfile?.name || "").split(" ")[0];

  const momentDays = useMemo(() => momentDaysOf(behaviorLogs ?? []), [behaviorLogs]);

  const daysSinceStart = useMemo(() => {
    // The family's start: their explicit onboarding stamp, else their earliest
    // kept moment. Never Date-of-install guesswork.
    const stamps = [
      (childProfile as { onboardingCompletedAt?: string } | undefined)?.onboardingCompletedAt,
      ...momentDays.slice().sort(),
    ].filter((s): s is string => !!s);
    if (!stamps.length) return 0;
    const startMs = Date.parse(stamps[0]);
    if (!Number.isFinite(startMs)) return 0;
    return Math.max(0, Math.floor((Date.now() - startMs) / DAY_MS));
  }, [childProfile, momentDays]);

  const first = useMemo(() => {
    if (!childId) return null;
    return pickFirst(
      detectFirsts(
        {
          momentCount: behaviorLogs?.length ?? 0,
          milestoneCount: (milestones ?? []).filter((m) => m.checked).length,
          storyCount: currentStory ? 1 : 0,
          momentDays,
          daysSinceStart,
        },
        loadState(childId),
      ),
    );
  }, [childId, behaviorLogs, milestones, currentStory, momentDays, daysSinceStart]);

  const dismiss = useCallback(() => {
    if (childId && first) {
      try {
        localStorage.setItem(firstsStorageKey(childId), JSON.stringify(mergeFirsts(loadState(childId), [first])));
      } catch {
        /* storage unavailable — worst case the card shows once more */
      }
    }
    setDismissed(true);
  }, [childId, first]);

  if (!first || dismissed) return null;

  const keys = firstCopyKeys(first.kind);
  const title = t(keys.title, { name: firstName, count: first.count });
  const sub = t(keys.sub, { name: firstName, count: first.count });
  const p = PASTEL.mint;

  return (
    <section
      role="status"
      data-testid="firsts-moment"
      className="relative overflow-hidden rounded-[22px] p-5 text-start"
      style={{ background: p.soft, border: "1px solid var(--arbor-rule)" }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("elev.firsts.dismiss")}
        className="absolute grid place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ insetInlineEnd: 4, top: 4, width: 44, height: 44, color: p.ink }}
      >
        <Icon name="close" size={18} />
      </button>

      <div className="pe-11">
        <p
          className="text-[15px] font-extrabold leading-tight"
          dir="auto"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {title}
        </p>
        <p className="text-[12.5px] mt-0.5" dir="auto" style={{ color: p.ink }}>
          {sub}
        </p>
      </div>

      {/* ONE parent-mediated keepsake, through the EXISTING share pipeline. */}
      <div className="mt-3">
        <ShareButton
          artifact="growth_card"
          surface="firsts"
          childName={firstName}
          label={t("elev.firsts.share")}
          getCardOpts={(): ShareCardOpts => ({ name: firstName, headline: title, sub })}
          variant="ghost"
        />
      </div>
    </section>
  );
}
