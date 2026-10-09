import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import "./parentBreathPacer.css";

/**
 * B-ASKJB-40 — "Steady yourself first": an optional breathing pacer for the
 * PARENT at the top of the hard-moment sheet. Three slow breaths (in 4 s, out
 * 6 s — a long exhale, never a breath hold), about 30 seconds.
 *
 * Rules: optional and collapsed by default; skippable at every moment; never a
 * gate before the guides (the chips stay below, reachable); nothing recorded,
 * no request, no sound; reduced motion shows the words only (no scaling); the
 * copy states no physiological effect. Rhythm and copy go to the clinical
 * reviewer with the hard-moment cards (GA B-GA-02).
 */
export const BREATH_IN_MS = 4000;
export const BREATH_OUT_MS = 6000;
export const BREATH_CYCLES = 3;

type Phase = "in" | "out" | "done";

/** Pure: the phase sequence the pacer walks, for the guard test. */
export function breathSchedule(cycles: number = BREATH_CYCLES): { phase: Exclude<Phase, "done">; ms: number }[] {
  return Array.from({ length: cycles }, () => [
    { phase: "in" as const, ms: BREATH_IN_MS },
    { phase: "out" as const, ms: BREATH_OUT_MS },
  ]).flat();
}

export function ParentBreathPacer({ t }: { t: (key: string) => string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  // The circle mounts small and grows on the first inhale (one frame later).
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);
  const schedule = breathSchedule();
  const phase: Phase = step >= schedule.length ? "done" : schedule[step].phase;

  useEffect(() => {
    if (!open) { setArmed(false); return; }
    const arm = window.setTimeout(() => setArmed(true), 50);
    return () => window.clearTimeout(arm);
  }, [open]);

  useEffect(() => {
    if (!open || phase === "done") return;
    timer.current = window.setTimeout(() => setStep((s) => s + 1), schedule[step].ms);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [open, step, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { if (timer.current) window.clearTimeout(timer.current); setOpen(false); setStep(0); };

  if (!open) {
    return (
      <button
        type="button"
        data-testid="breath-pacer-open"
        onClick={() => { setStep(0); setOpen(true); }}
        className="flex w-full min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-start transition focus:outline-none focus-visible:ring-2"
        style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
      >
        <Icon name="air" size={20} style={{ color: "var(--arbor-clay)" }} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{t("hm.now.breathe.open")}</span>
          <span className="block text-xs" style={{ color: "var(--arbor-muted)" }}>{t("hm.now.breathe.sub")}</span>
        </span>
      </button>
    );
  }

  const scale = !armed ? 0.62 : phase === "in" ? 1 : 0.62;
  const ms = phase === "in" ? BREATH_IN_MS : BREATH_OUT_MS;
  return (
    <div data-testid="breath-pacer" className="flex flex-col items-center gap-3 rounded-xl px-4 py-5" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
      <div aria-hidden="true" className="relative grid place-items-center" style={{ width: 132, height: 132 }}>
        <span
          className="arbor-breath-circle absolute inset-0 rounded-full"
          style={{
            background: "var(--arbor-clay-dim)",
            boxShadow: "inset 0 0 0 2px var(--arbor-clay)",
            transform: `scale(${phase === "done" ? 0.62 : scale})`,
            transition: `transform ${ms}ms ease-in-out`,
          }}
        />
      </div>
      <p aria-live="polite" className="text-base font-semibold" style={{ color: "var(--arbor-ink)" }}>
        {phase === "in" ? t("hm.now.breathe.in") : phase === "out" ? t("hm.now.breathe.out") : t("hm.now.breathe.done")}
      </p>
      <button
        type="button"
        data-testid="breath-pacer-skip"
        onClick={close}
        className="inline-flex min-h-11 items-center px-3 text-sm font-bold focus:outline-none focus-visible:ring-2"
        style={{ color: "var(--arbor-clay-deep)" }}
      >
        {phase === "done" ? t("hm.now.breathe.close") : t("hm.now.breathe.skip")}
      </button>
    </div>
  );
}

export default ParentBreathPacer;
