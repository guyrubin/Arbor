import React, { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import {
  GOAL_SCALE_VALUES,
  MAX_FAMILY_GOALS,
  activeGoals,
  archiveGoal,
  editGoal,
  goalParentLine,
  setGoal,
  type FamilyGoal,
  type GoalScaleKey,
} from "../../lib/goals";

/**
 * B-PROG-07 UI — "Three things you hope for" on the program page. Up to three
 * active goals in the family's OWN words, each with the family's own five
 * words for how it could go (the −2..+2 shape, never shown as numbers). A goal
 * row shows the words and the family's own word for the last time it was
 * marked (lib/goals goalParentLine) — NEVER a number on this surface; the
 * number lives only in the professional's packet, labelled "family-set scale"
 * (consult/packet.ts residue, REJECTIONS P6-PRACTICE). The weekly mark is
 * Tonight's question on a program week's last day (components/loop residue).
 * Set · edit · put aside; nothing here is AI.
 */

/** Dictionary suffix per scale step (keys carry no digits or signs). */
const STEP_KEY: Record<GoalScaleKey, string> = { "-2": "m2", "-1": "m1", "0": "z", "1": "p1", "2": "p2" };
const KEYS = GOAL_SCALE_VALUES.map((v) => String(v) as GoalScaleKey);
const emptyScale = (): Record<GoalScaleKey, string> => ({ "-2": "", "-1": "", "0": "", "1": "", "2": "" });

export interface FamilyGoalsProps {
  goals: readonly FamilyGoal[];
  /** The active program (goals set here carry it). */
  programId?: string;
  onSave: (goal: FamilyGoal) => void;
  /** A line handed over from elsewhere (the coach's "Make it one of your hopes") opens the form with it. */
  prefill?: string | null;
  now?: () => Date;
}

const FIELD: React.CSSProperties = { border: "1px solid var(--arbor-rule-strong)", borderRadius: "var(--r)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" };
const QUIET: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };
const SAVE: React.CSSProperties = { background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" };

function GoalForm({
  initialText,
  initialScale,
  onSubmit,
  onCancel,
  idBase,
}: {
  initialText: string;
  initialScale: Record<GoalScaleKey, string>;
  onSubmit: (text: string, scale: Record<GoalScaleKey, string>) => "ok" | "empty_text" | "incomplete_scale" | "too_many";
  onCancel: () => void;
  idBase: string;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState(initialText);
  const [scale, setScale] = useState(initialScale);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      data-testid="goal-form"
      className="mt-2 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const r = onSubmit(text, scale);
        setError(r === "ok" ? null : r);
      }}
    >
      <label htmlFor={`${idBase}-text`} className="t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.program.goals.text")}</label>
      <input id={`${idBase}-text`} data-testid="goal-text" type="text" dir="auto" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} className="min-h-11 px-3 t-base" style={FIELD} />
      <p className="mt-1 t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.goals.scale")}</p>
      {KEYS.map((k) => (
        <div key={k} className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-${STEP_KEY[k]}`} className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t(`elev.program.goals.step.${STEP_KEY[k]}`)}</label>
          <input
            id={`${idBase}-${STEP_KEY[k]}`}
            data-testid="goal-step"
            data-step={STEP_KEY[k]}
            type="text"
            dir="auto"
            maxLength={80}
            value={scale[k]}
            onChange={(e) => setScale((s) => ({ ...s, [k]: e.target.value }))}
            className="min-h-11 px-3 t-sm"
            style={FIELD}
          />
        </div>
      ))}
      {error && <p role="status" data-testid="goal-error" className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t(`elev.program.goals.error.${error === "too_many" ? "full" : error === "empty_text" ? "text" : "scale"}`)}</p>}
      <div className="flex gap-2">
        <button type="submit" data-testid="goal-save" className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-bold" style={SAVE}>{t("elev.program.goals.save")}</button>
        <button type="button" data-testid="goal-cancel" onClick={onCancel} className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-bold" style={QUIET}>{t("elev.program.goals.cancel")}</button>
      </div>
    </form>
  );
}

export default function FamilyGoals({ goals, programId, onSave, prefill, now = () => new Date() }: FamilyGoalsProps) {
  const { t } = useLanguage();
  const active = activeGoals(goals);
  const [adding, setAdding] = useState<string | null>(prefill ? prefill : null);
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => { if (prefill) setAdding(prefill); }, [prefill]);
  const full = active.length >= MAX_FAMILY_GOALS;

  return (
    <div data-testid="family-goals" className="mt-4">
      <h3 className="t-sm font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.goals.title")}</h3>
      <p className="mt-1 t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.goals.lede")}</p>
      <ul className="mt-2">
        {active.map((g) => {
          const line = goalParentLine(g);
          return (
            <li key={g.id} data-testid="family-goal" data-goal-id={g.id} className="border-t py-3 first:border-t-0" style={{ borderColor: "var(--arbor-rule)" }}>
              {editing === g.id ? (
                <GoalForm
                  idBase={`goal-${g.id}`}
                  initialText={g.text}
                  initialScale={{ ...g.scale }}
                  onCancel={() => setEditing(null)}
                  onSubmit={(text, scale) => {
                    const next = editGoal(g, { text, scale }, now());
                    if (next === g) return text.trim() ? "incomplete_scale" : "empty_text";
                    onSave(next);
                    setEditing(null);
                    return "ok";
                  }}
                />
              ) : (
                <>
                  <p data-testid="family-goal-words" className="leading-snug" style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--t-lg)", color: "var(--arbor-ink)" }}>
                    {"“"}<bdi dir="auto">{line.text}</bdi>{"”"}
                  </p>
                  <p data-testid="family-goal-last" className="mt-0.5 t-sm" style={{ color: "var(--arbor-muted)" }}>
                    {line.word ? <>{t("elev.program.goals.last")}{" "}<bdi dir="auto">{line.word}</bdi></> : t("elev.program.goals.notMarked")}
                  </p>
                  <div className="mt-1 flex gap-3">
                    <button type="button" data-testid="family-goal-edit" onClick={() => setEditing(g.id)} className="inline-flex min-h-11 items-center t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>
                      {t("elev.program.goals.edit")}
                    </button>
                    <button type="button" data-testid="family-goal-archive" onClick={() => onSave(archiveGoal(g, now()))} className="inline-flex min-h-11 items-center t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>
                      {t("elev.program.goals.archive")}
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {adding !== null && !full ? (
        <GoalForm
          idBase="goal-new"
          initialText={adding}
          initialScale={emptyScale()}
          onCancel={() => setAdding(null)}
          onSubmit={(text, scale) => {
            const r = setGoal(goals, { text, scale, ...(programId ? { programId } : {}) }, now());
            if ("reason" in r) return r.reason;
            onSave(r.goal);
            setAdding(null);
            return "ok";
          }}
        />
      ) : full ? (
        <p data-testid="family-goals-full" className="mt-2 t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.goals.full")}</p>
      ) : (
        <button type="button" data-testid="family-goal-add" onClick={() => setAdding("")} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 t-sm font-bold" style={QUIET}>
          <Icon name="add" size={18} aria-hidden />
          {t("elev.program.goals.add")}
        </button>
      )}
    </div>
  );
}
