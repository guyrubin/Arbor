import React, { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";

/**
 * RhythmProgressLine — ENG-18: cold-start honesty as a motivator.
 *
 * ONE line under the capture bar while the rhythm read is not yet dependable:
 * "{n} more days of moments and Arbor can read {name}'s rhythm" — the same
 * `daysNeeded` count rhythm/predict already computes (the Huckleberry
 * sleep-prediction mechanic, counts only). The moment confidence reaches
 * medium it flips ONCE to "Arbor now reads {name}'s rhythm" and then retires
 * (a per-child, per-device marker — nothing about the child is written).
 *
 * A LINE, not a module (Rule A: it counts against no budget slot).
 * CLINICAL FIREWALL: a day count — never a percentage, never "accuracy".
 */

export const RHYTHM_READ_KEY = (childId: string) => `arbor.rhythm.read.${childId}`;

/** Pure: which line (if any) to show. Exported for the unit test. */
export function rhythmProgressState(input: {
  confidence: "none" | "low" | "medium" | "high" | string;
  daysNeeded: number;
  alreadyFlipped: boolean;
}): { kind: "progress"; n: number } | { kind: "flip" } | null {
  const dependable = input.confidence === "medium" || input.confidence === "high";
  if (dependable) return input.alreadyFlipped ? null : { kind: "flip" };
  if (input.daysNeeded > 0) return { kind: "progress", n: input.daysNeeded };
  return null;
}

export default function RhythmProgressLine({
  childId,
  childName,
  confidence,
  daysNeeded,
}: {
  childId: string;
  childName: string;
  confidence: "none" | "low" | "medium" | "high" | string;
  daysNeeded: number;
}) {
  const { t } = useLanguage();
  const [flipped, setFlipped] = useState<boolean>(() => {
    try { return window.localStorage.getItem(RHYTHM_READ_KEY(childId)) === "1"; } catch { return false; }
  });
  const state = rhythmProgressState({ confidence, daysNeeded, alreadyFlipped: flipped });

  // The flip line shows once: mark it on first render so the next open
  // (or the next child switch back) never repeats it.
  useEffect(() => {
    if (state?.kind !== "flip") return;
    try { window.localStorage.setItem(RHYTHM_READ_KEY(childId), "1"); } catch { /* best effort */ }
    // Keep it on screen for this visit; the marker only affects future mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.kind, childId]);

  // Child switch re-reads the marker.
  useEffect(() => {
    try { setFlipped(window.localStorage.getItem(RHYTHM_READ_KEY(childId)) === "1"); } catch { setFlipped(false); }
  }, [childId]);

  if (!state) return null;
  return (
    <p
      className="flex items-center gap-1.5 px-1 text-[12px] font-bold"
      style={{ color: state.kind === "flip" ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}
      data-testid={state.kind === "flip" ? "today-rhythm-read" : "today-rhythm-progress"}
      dir="auto"
    >
      <Icon name={state.kind === "flip" ? "auto_awesome" : "hourglass_top"} size={14} fill={state.kind === "flip" ? 1 : 0} />
      {state.kind === "flip"
        ? t("today.rhythm.read", { name: childName })
        : state.n === 1
          ? t("today.rhythm.progress.one", { name: childName })
          : t("today.rhythm.progress.many", { name: childName, n: state.n })}
    </p>
  );
}
