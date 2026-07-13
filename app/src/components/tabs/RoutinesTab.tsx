import React, { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CalendarCheck } from "lucide-react";
import { Icon } from "../ui/Icon";
import { HubHero } from "../ui/HubHero";
import { ProgressBar } from "../ui/kit";
import { PASTEL } from "../../lib/tokens";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useKidMode } from "../kidmode/KidModeContext";
import { ROUTINES, routineById, localized } from "../../lib/routines";

/* ════════════════════════════════════════════════════════════════════════════
   Ready-made Routines — a library of seven research-backed, parent-run daily
   routines. Pick one from the grid, run it with the child by toggling steps
   done; the board celebrates a fully-completed routine and drops a star.

   CLINICAL FIREWALL: routine progress is shown as a COUNT ("{done}/{total}")
   and bar-width ONLY — never a percentage number, never a score or verdict on
   the child. A routine is a family checklist, not an assessment.

   Tokens only: var(--arbor-*) tokens + the layout-kit PASTEL[tone] map. No raw
   hex. Icons via the shared <Icon/> (Material Symbols). RTL: logical props.
   Completed step keys persist per child in localStorage.
   ════════════════════════════════════════════════════════════════════════════ */

/** Persisted shape: routine id → array of completed step keys. */
type DoneMap = Record<string, string[]>;

const lsKey = (childId: string) => `arbor.routines.done.${childId}`;

function readDone(childId: string): DoneMap {
  try {
    const raw = localStorage.getItem(lsKey(childId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as DoneMap) : {};
  } catch {
    return {};
  }
}

/** A count-based, tone-colored toggle switch (parent marks a step done). */
function StepSwitch({ on, tone, label }: { on: boolean; tone: keyof typeof PASTEL; label: string }) {
  const p = PASTEL[tone];
  return (
    <span
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors"
      style={{ background: on ? p.ink : "var(--arbor-rule)" }}
    >
      <span
        className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5"
        style={{ marginInlineStart: 2, transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </span>
  );
}

export default function RoutinesTab() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  const { openKidMode } = useKidMode();

  const firstName = (childProfile.name || "your child").split(" ")[0];

  // Selected routine id — local state, default the first (morning) routine.
  const [selectedId, setSelectedId] = useState<string>(ROUTINES[0].id);

  // Completed step keys per child, persisted in localStorage (follows the
  // sessionLength pattern in OverviewTab).
  const [doneMap, setDoneMap] = useState<DoneMap>(() => readDone(childProfile.id));

  const persist = useCallback(
    (next: DoneMap) => {
      setDoneMap(next);
      try { localStorage.setItem(lsKey(childProfile.id), JSON.stringify(next)); } catch { /* ignore */ }
    },
    [childProfile.id]
  );

  const selected = routineById(selectedId);
  const selectedDone = doneMap[selected.id] ?? [];
  const doneCount = selected.steps.filter((s) => selectedDone.includes(s.key)).length;
  const total = selected.steps.length;
  const allDone = total > 0 && doneCount === total;

  const toggleStep = useCallback(
    (stepKey: string) => {
      const current = doneMap[selected.id] ?? [];
      const wasOn = current.includes(stepKey);
      const nextKeys = wasOn ? current.filter((k) => k !== stepKey) : [...current, stepKey];
      persist({ ...doneMap, [selected.id]: nextKeys });

      // Completion reward: fire the star toast only on the transition INTO
      // all-done (last step checked), never on toggling an already-complete
      // routine's steps off and on.
      const nowComplete = nextKeys.length === total && total > 0;
      if (!wasOn && nowComplete) {
        toast(t("routines.starEarned", { name: firstName }), "success");
      }
    },
    [doneMap, selected.id, total, persist, toast, t, firstName]
  );

  const resetRoutine = useCallback(() => {
    const next = { ...doneMap };
    delete next[selected.id];
    persist(next);
  }, [doneMap, selected.id, persist]);

  const assignRoutine = useCallback(() => {
    toast(t("routines.assigned", { name: firstName }), "success");
    // Kid Mode has a trivial entry — hand the routine off to the child's world.
    openKidMode();
  }, [toast, t, firstName, openKidMode]);

  // Per-tile completed counts for the library grid's progress bars.
  const tileDone = useCallback(
    (routineId: string) => {
      const r = routineById(routineId);
      const keys = doneMap[routineId] ?? [];
      return r.steps.filter((s) => keys.includes(s.key)).length;
    },
    [doneMap]
  );

  const heroSub = useMemo(() => t("routines.sub", { name: firstName }), [t, firstName]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5 max-w-[1080px]"
    >
      {/* Hub hero — names the surface + the job sentence. */}
      <HubHero
        tone="sky"
        icon={CalendarCheck}
        eyebrow={t("routines.eyebrow")}
        title={t("routines.title")}
        subtitle={heroSub}
        testId="routines-hub-hero"
      />

      {/* Library grid — 7 routine tiles (~4 cols desktop). Each: colored icon
          tile, title, a COUNT meta line, and a count-based progress bar. The
          selected tile gets a 2px tone-colored border. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {ROUTINES.map((r) => {
          const p = PASTEL[r.tone];
          const done = tileDone(r.id);
          const isSel = r.id === selected.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              aria-pressed={isSel}
              data-testid={`routine-tile-${r.id}`}
              className="flex flex-col items-start gap-3 rounded-2xl p-4 text-start transition active:scale-[0.98]"
              style={{
                background: "var(--arbor-paper-elevated)",
                border: isSel ? `2px solid ${p.ink}` : "2px solid var(--arbor-rule)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: p.soft, color: p.ink }}
              >
                <Icon name={r.ms} size={22} fill={1} />
              </span>
              <div className="min-w-0 w-full">
                <div className="text-[14px] font-extrabold leading-tight truncate" style={{ color: "var(--arbor-ink)" }}>
                  {localized(r.title, uiLang)}
                </div>
                <div className="mt-1 text-[11px] font-bold truncate" style={{ color: "var(--arbor-muted)" }}>
                  {t("routines.stepCount", { count: r.steps.length })} · {localized(r.time, uiLang)}
                </div>
              </div>
              {/* Count-based bar — width = done/total, no % number rendered. */}
              <div className="w-full">
                <ProgressBar value={done} total={r.steps.length} tone={r.tone} height={6} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected routine's board. */}
      <section
        className="rounded-[22px] p-5 md:p-6"
        style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--arbor-rule)" }}
      >
        {/* Header — icon + title + why line + a count "{done}/{total}". */}
        <div className="flex items-start gap-4">
          <span
            className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: PASTEL[selected.tone].soft, color: PASTEL[selected.tone].ink }}
          >
            <Icon name={selected.ms} size={24} fill={1} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {localized(selected.title, uiLang)}
              </h2>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: PASTEL[selected.tone].soft, color: PASTEL[selected.tone].ink }}
              >
                {localized(selected.domains, uiLang)}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              {localized(selected.why, uiLang).replace(/\{name\}/g, firstName)}
            </p>
          </div>
          {/* Count block — the ONLY progress readout (never a %). */}
          <div className="flex-shrink-0 text-center rounded-2xl px-3.5 py-2" style={{ background: "var(--arbor-paper-deep)" }}>
            <div className="text-[18px] font-extrabold leading-none tabular-nums" style={{ color: PASTEL[selected.tone].ink }}>
              {doneCount}/{total}
            </div>
            <div className="mt-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-faint)" }}>
              {t("routines.done")}
            </div>
          </div>
        </div>

        {/* Step rows — each toggles that step done. */}
        <div className="mt-5 flex flex-col gap-2.5">
          {selected.steps.map((step) => {
            const on = selectedDone.includes(step.key);
            const p = PASTEL[selected.tone];
            const label = localized(step.label, uiLang);
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => toggleStep(step.key)}
                aria-pressed={on}
                data-testid={`routine-step-${step.key}`}
                className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-start transition active:scale-[0.99]"
                style={{
                  background: on ? p.soft : "var(--arbor-paper-deep)",
                  border: "1px solid var(--arbor-rule)",
                  minHeight: 44,
                }}
              >
                <span
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors"
                  style={{ background: on ? p.ink : p.soft, color: on ? "var(--arbor-on-accent)" : p.ink }}
                >
                  <Icon name={step.ms} size={20} fill={on ? 1 : 0} />
                </span>
                <span
                  className="min-w-0 flex-1 text-[14px] font-bold transition-opacity"
                  style={{ color: "var(--arbor-ink)", opacity: on ? 0.65 : 1, textDecoration: on ? "line-through" : "none" }}
                >
                  {label}
                </span>
                <StepSwitch on={on} tone={selected.tone} label={label} />
              </button>
            );
          })}
        </div>

        {/* Celebration banner — shows only when ALL steps are done. */}
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{ background: PASTEL[selected.tone].soft }}
            >
              <Icon name="star" size={22} fill={1} style={{ color: PASTEL[selected.tone].ink }} />
              <span className="text-[13.5px] font-extrabold" style={{ color: PASTEL[selected.tone].ink }}>
                {t("routines.doneMsg", { name: firstName })}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer — feeds chip · Reset · Assign. */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}
          >
            <Icon name="insights" size={16} /> {t("routines.feeds")}
          </span>
          <button
            type="button"
            onClick={resetRoutine}
            data-testid="routines-reset"
            className="ms-auto inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-[13px] font-extrabold transition active:scale-[0.97]"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", minHeight: 44 }}
          >
            <Icon name="restart_alt" size={18} /> {t("routines.reset")}
          </button>
          <button
            type="button"
            onClick={assignRoutine}
            data-testid="routines-assign"
            className="inline-flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-[13px] font-extrabold transition active:scale-[0.97]"
            style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)", boxShadow: "var(--shadow-sm)", minHeight: 44 }}
          >
            <Icon name="child_care" size={18} /> {t("routines.assign", { name: firstName })}
          </button>
        </div>
      </section>
    </motion.div>
  );
}
