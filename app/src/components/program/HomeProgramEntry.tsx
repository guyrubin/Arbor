import React, { useReducer, useState } from "react";
import HomeProgramImport from "./HomeProgramImport";
import type { ProgramImportSource } from "../../lib/programImport";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { fmtDay } from "../../lib/formatDate";
import { SHELF_IDS, shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import type { FamilyGoal, GoalScaleKey } from "../../lib/goals";
import {
  HOME_EXERCISES_MAX,
  HOME_GOALS_MAX,
  HOME_PROFESSIONS,
  HOME_PROFESSION_SHELF,
  acceptProposedGoal,
  exerciseDoneToday,
  homeAdherence,
  homeProgramWeeks,
  startHomeProgram,
  type HomeProfession,
  type HomeProgramEnrolment,
} from "../../content/programs/homeProgram";
import { GoalForm } from "./FamilyGoals";
import { appointmentStartMs, appointmentStatus, type Appointment } from "../../lib/careTrack";
import { dayKey } from "../../lib/programs/enrolment";

/**
 * B-PROG-09 (assignment in) — "They gave us a home program", the after-visit
 * choice on Care › Consult ("What did they suggest?"). The parent writes the
 * professional's exercises and goals in their OWN words, picks a shelf per
 * exercise, then checks it: each proposed goal becomes one of the family's
 * hopes only when the parent accepts it in their words (with their own five
 * scale words) or it is left out. NOTHING is written before "Save the home
 * program": the state below lives in this component; `entryWrites` computes
 * the documents only on confirm, and the caller (ConsultTab) persists them.
 * Optional photo/PDF extraction is reviewed in HomeProgramImport; only the
 * parent's selected, editable text enters this form before final confirmation.
 *
 * `HomeProgramDays` is the family's own "done today" mark per exercise —
 * practice days as counts, never a rate (content/programs/homeProgram).
 */

const FIELD: React.CSSProperties = { border: "1px solid var(--arbor-rule-strong)", borderRadius: "var(--r)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" };
const QUIET: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };
const SAVE: React.CSSProperties = { background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" };
const EMPTY_SCALE = (): Record<GoalScaleKey, string> => ({ "-2": "", "-1": "", "0": "", "1": "", "2": "" });

export type GoalDecision = { text: string; scale: Record<GoalScaleKey, string> } | "left_out";

export interface HomeEntryState {
  source?: ProgramImportSource;
  importedStart?: number;
  step: "enter" | "review";
  profession: HomeProfession | null;
  exercises: Array<{ text: string; shelf: ShelfId }>;
  /** The professional's goals as the parent wrote them down. */
  goals: string[];
  /** Review: per goal index, the parent's acceptance in their words, or left out. */
  decisions: Record<number, GoalDecision>;
  /** Review: the goal whose acceptance form is open. */
  open: number | null;
  error: "no_exercises" | "undecided" | null;
}

export type HomeEntryAction =
  | { type: "importExercises"; texts: string[]; source: ProgramImportSource }
  | { type: "removeImport" }
  | { type: "profession"; profession: HomeProfession }
  | { type: "exerciseText"; i: number; text: string }
  | { type: "exerciseShelf"; i: number; shelf: ShelfId }
  | { type: "addExercise" }
  | { type: "goalText"; i: number; text: string }
  | { type: "addGoal" }
  | { type: "review" }
  | { type: "back" }
  | { type: "openGoal"; i: number | null }
  | { type: "accept"; i: number; text: string; scale: Record<GoalScaleKey, string> }
  | { type: "leaveOut"; i: number }
  | { type: "error"; error: HomeEntryState["error"] };

const shelfFor = (p: HomeProfession | null): ShelfId => (p ? HOME_PROFESSION_SHELF[p] : "words");
const filled = (s: HomeEntryState) => s.exercises.filter((e) => e.text.trim());
const goalsWritten = (s: HomeEntryState) => s.goals.map((g, i) => ({ g: g.trim(), i })).filter((x) => x.g);

export function initialEntryState(profession: HomeProfession | null): HomeEntryState {
  return { step: "enter", profession, exercises: [{ text: "", shelf: shelfFor(profession) }], goals: [], decisions: {}, open: null, error: null };
}

export function entryReducer(s: HomeEntryState, a: HomeEntryAction): HomeEntryState {
  switch (a.type) {
    case "importExercises": {
      const existing = filled(s);
      if (s.source || a.texts.length > HOME_EXERCISES_MAX - existing.length) return s;
      return { ...s, source: a.source, importedStart: existing.length, error: null, exercises: [...existing, ...a.texts.map(text => ({ text, shelf: shelfFor(s.profession) }))] };
    }
    case "removeImport": {
      const start = s.importedStart ?? s.exercises.length;
      const count = s.source?.quotations.length ?? 0;
      const exercises = s.exercises.filter((_, i) => i < start || i >= start + count);
      return { ...s, source: undefined, importedStart: undefined, exercises: exercises.length ? exercises : [{ text: "", shelf: shelfFor(s.profession) }] };
    }
    case "profession": {
      // an untouched default shelf follows the profession; a shelf the parent picked stays
      const before = shelfFor(s.profession);
      return { ...s, profession: a.profession, exercises: s.exercises.map((e) => (e.shelf === before && !e.text.trim() ? { ...e, shelf: shelfFor(a.profession) } : e)) };
    }
    case "exerciseText":
      return { ...s, error: null, exercises: s.exercises.map((e, i) => (i === a.i ? { ...e, text: a.text } : e)) };
    case "exerciseShelf":
      return { ...s, exercises: s.exercises.map((e, i) => (i === a.i ? { ...e, shelf: a.shelf } : e)) };
    case "addExercise":
      return s.exercises.length >= HOME_EXERCISES_MAX ? s : { ...s, exercises: [...s.exercises, { text: "", shelf: shelfFor(s.profession) }] };
    case "goalText":
      return { ...s, goals: s.goals.map((g, i) => (i === a.i ? a.text : g)) };
    case "addGoal":
      return s.goals.length >= HOME_GOALS_MAX ? s : { ...s, goals: [...s.goals, ""] };
    case "review":
      if (!s.profession || !filled(s).length) return { ...s, error: "no_exercises" };
      return { ...s, step: "review", error: null, open: null };
    case "back":
      return { ...s, step: "enter", error: null, open: null };
    case "openGoal":
      return { ...s, open: a.i };
    case "accept":
      return { ...s, open: null, error: null, decisions: { ...s.decisions, [a.i]: { text: a.text, scale: a.scale } } };
    case "leaveOut":
      return { ...s, open: null, error: null, decisions: { ...s.decisions, [a.i]: "left_out" } };
    case "error":
      return { ...s, error: a.error };
    default:
      return s;
  }
}

/** Every written goal has a decision (accepted in the parent's words, or left out). */
export const allGoalsDecided = (s: HomeEntryState): boolean => goalsWritten(s).every(({ i }) => s.decisions[i] !== undefined);

export interface EntryContext {
  intakeId?: string;
  rows: readonly unknown[];
  existingGoals: readonly FamilyGoal[];
  nextVisit: string | null;
  now: Date;
}

export type EntryWrites =
  | { ok: true; enrolment: HomeProgramEnrolment; superseded: HomeProgramEnrolment[]; goals: FamilyGoal[] }
  | { ok: false; reason: "no_exercises" | "undecided" | "empty_text" | "incomplete_scale" | "too_many" | "unknown_profession" };

/** The documents the confirm writes — computed ONLY on confirm (nothing writes itself). */
export function entryWrites(s: HomeEntryState, ctx: EntryContext): EntryWrites {
  if (!s.profession) return { ok: false, reason: "unknown_profession" };
  if (!allGoalsDecided(s)) return { ok: false, reason: "undecided" };
  const started = startHomeProgram(ctx.rows, { profession: s.profession, exercises: filled(s), goals: goalsWritten(s).map((x) => x.g), nextVisit: ctx.nextVisit }, ctx.now, ctx.intakeId);
  if ("reason" in started) return { ok: false, reason: started.reason };
  const goals: FamilyGoal[] = [];
  for (const { i } of goalsWritten(s)) {
    const d = s.decisions[i];
    if (!d || d === "left_out") continue;
    const r = acceptProposedGoal([...ctx.existingGoals, ...goals], d, s.profession, new Date(ctx.now.getTime() + goals.length));
    if ("reason" in r) return { ok: false, reason: r.reason };
    goals.push(r.goal);
  }
  const enrolment = s.source ? { ...started.enrolment, home: { ...started.enrolment.home, source: s.source } } : started.enrolment;
  return { ok: true, enrolment, superseded: started.superseded, goals };
}

/** The acceptance form's check before a goal is held (same limits as any family goal). */
export function checkAcceptance(s: HomeEntryState, i: number, text: string, scale: Record<GoalScaleKey, string>, ctx: EntryContext): "ok" | "empty_text" | "incomplete_scale" | "too_many" {
  if (!s.profession) return "empty_text";
  const held: FamilyGoal[] = [];
  for (const [k, d] of Object.entries(s.decisions)) {
    if (Number(k) === i || d === "left_out") continue;
    const r = acceptProposedGoal([...ctx.existingGoals, ...held], d, s.profession, ctx.now);
    if ("goal" in r) held.push(r.goal);
  }
  const r = acceptProposedGoal([...ctx.existingGoals, ...held], { text, scale }, s.profession, ctx.now);
  return "reason" in r ? r.reason : "ok";
}

/** The home-program profession of a visit (careTrack AppointmentProfession → consult intake profession); null = the parent picks. */
export function homeProfessionForAppointment(p: Appointment["profession"] | undefined): HomeProfession | null {
  if (p === "psychologist") return "psychology";
  return p === "slp" || p === "ot" || p === "pt" || p === "pediatrician" ? p : null;
}

/** The LOCAL day key of the next booked visit with the same professional (dated, upcoming, not done), or null. */
export function nextVisitDayFor(appts: readonly Appointment[], visit: Appointment, nowMs: number): string | null {
  const next = appts
    .filter((a) => a.id !== visit.id && appointmentStatus(a) !== "done" && (!visit.profession || a.profession === visit.profession))
    .map((a) => ({ a, at: appointmentStartMs(a) }))
    .filter((x): x is { a: Appointment; at: number } => x.at != null && x.at > nowMs)
    .sort((x, y) => x.at - y.at)[0];
  return next ? dayKey(new Date(next.at)) : null;
}

const lowerFor = (lang: string, x: string) => (lang === "en" ? x.toLowerCase() : x);

export interface HomeProgramEntryProps {
  childId?: string;
  /** The visit's profession when known; null = the parent picks. */
  profession: HomeProfession | null;
  /** LOCAL day key of the next booked visit, or null. */
  nextVisit: string | null;
  rows: readonly unknown[];
  existingGoals: readonly FamilyGoal[];
  onConfirm: (writes: Extract<EntryWrites, { ok: true }>) => void | Promise<void>;
  onCancel: () => void;
  now?: () => Date;
  /** Tests render a given step (the component holds its own state otherwise). */
  initialState?: HomeEntryState;
}

export default function HomeProgramEntry({ childId, profession, nextVisit, rows, existingGoals, onConfirm, onCancel, now = () => new Date(), initialState }: HomeProgramEntryProps) {
  const { t, uiLang } = useLanguage();
  const [s, dispatch] = useReducer(entryReducer, initialState ?? initialEntryState(profession));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // One identity and timestamp per intake: retries stay idempotent; a new
  // same-day intake preserves the earlier program and its source history.
  const [intake] = useState(() => ({ id: crypto.randomUUID(), at: now() }));
  const ctx = (): EntryContext => ({ rows, existingGoals, nextVisit, now: intake.at, intakeId: intake.id });
  const profLabel = (p: HomeProfession) => t(`elev.carehonesty.consult.audience.${p}`);
  const weeks = homeProgramWeeks(nextVisit, now());
  const decided = allGoalsDecided(s);

  const confirm = async () => {
    if (saving) return;
    const w = entryWrites(s, ctx());
    if ("reason" in w) {
      dispatch({ type: "error", error: w.reason === "undecided" ? "undecided" : w.reason === "no_exercises" ? "no_exercises" : null });
      return;
    }
    setSaving(true); setSaveError(false);
    try { await onConfirm(w); }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  };

  return (
    <section data-testid="home-program-entry" data-step={s.step} className="mt-3 flex flex-col gap-3">
      <h2 className="t-base font-bold" style={{ color: "var(--arbor-ink)" }}>{t(s.step === "enter" ? "elev.homeProgram.entry.title" : "elev.homeProgram.review.title")}</h2>
      {saving && <p role="status" className="text-sm">{t("elev.pilot.saving.and.waiting.for.sync.confirmation")}</p>}
      {saveError && <p role="alert" className="text-sm">{t("elev.pilot.the.save.did.not.finish.your.text.is.still.here.you.can.retry")}</p>}
      {childId && <HomeProgramImport key={childId} childId={childId} readOnly={s.step === "review"} remaining={HOME_EXERCISES_MAX - filled(s).length} onApply={(texts, source) => dispatch({ type: "importExercises", texts, source })} onReset={() => dispatch({ type: "removeImport" })} />}
      {s.step === "enter" ? (
        <>
          <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.homeProgram.entry.lede")}</p>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.homeProgram.entry.who")}</legend>
            <div className="flex flex-wrap gap-2">
              {HOME_PROFESSIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  data-testid="home-program-profession"
                  data-profession={p}
                  aria-pressed={s.profession === p}
                  onClick={() => dispatch({ type: "profession", profession: p })}
                  className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-semibold"
                  style={s.profession === p ? { background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" } : QUIET}
                >
                  {profLabel(p)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.homeProgram.entry.exercises")}</legend>
            {s.exercises.map((e, i) => (
              <div key={i} data-testid="home-ex" className="flex flex-col gap-1 border-t pt-2 first:border-t-0 first:pt-0" style={{ borderColor: "var(--arbor-rule)" }}>
                <label htmlFor={`home-ex-${i}`} className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.homeProgram.entry.exercise", { n: i + 1 })}</label>
                <textarea id={`home-ex-${i}`} data-testid="home-ex-text" dir="auto" rows={2} maxLength={200} value={e.text} onChange={(ev) => dispatch({ type: "exerciseText", i, text: ev.target.value })} className="px-3 py-2 t-base" style={FIELD} />
                <label htmlFor={`home-ex-shelf-${i}`} className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.homeProgram.entry.shelf")}</label>
                <select id={`home-ex-shelf-${i}`} data-testid="home-ex-shelf" value={e.shelf} onChange={(ev) => dispatch({ type: "exerciseShelf", i, shelf: ev.target.value as ShelfId })} className="min-h-11 px-3 t-sm" style={FIELD}>
                  {SHELF_IDS.map((id) => (
                    <option key={id} value={id}>{shelfLabel(id, t)}</option>
                  ))}
                </select>
              </div>
            ))}
            {s.exercises.length < HOME_EXERCISES_MAX && (
              <button type="button" data-testid="home-ex-add" onClick={() => dispatch({ type: "addExercise" })} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-4 t-sm font-semibold" style={QUIET}>
                <Icon name="add" size={18} aria-hidden />
                {t("elev.homeProgram.entry.addExercise")}
              </button>
            )}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.homeProgram.entry.goals")}</legend>
            {s.goals.map((g, i) => (
              <div key={i} className="flex flex-col gap-1">
                <label htmlFor={`home-goal-${i}`} className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.homeProgram.entry.goal", { n: i + 1 })}</label>
                <input id={`home-goal-${i}`} data-testid="home-goal-text" type="text" dir="auto" maxLength={200} value={g} onChange={(ev) => dispatch({ type: "goalText", i, text: ev.target.value })} className="min-h-11 px-3 t-base" style={FIELD} />
              </div>
            ))}
            {s.goals.length < HOME_GOALS_MAX && (
              <button type="button" data-testid="home-goal-add" onClick={() => dispatch({ type: "addGoal" })} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-4 t-sm font-semibold" style={QUIET}>
                <Icon name="add" size={18} aria-hidden />
                {t("elev.homeProgram.entry.addGoal")}
              </button>
            )}
          </fieldset>
          <p data-testid="home-program-weeks" className="t-sm" style={{ color: "var(--arbor-muted)" }}>
            {nextVisit ? t("elev.homeProgram.entry.until", { date: fmtDay(`${nextVisit}T12:00:00`, uiLang), n: weeks }) : t("elev.homeProgram.entry.noDate", { n: weeks })}
          </p>
          {s.error === "no_exercises" && <p role="status" data-testid="home-program-error" className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.homeProgram.error.noExercise")}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="home-program-next" onClick={() => dispatch({ type: "review" })} className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-bold" style={SAVE}>{t("elev.homeProgram.entry.review")}</button>
            <button type="button" data-testid="home-program-cancel" onClick={onCancel} className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-semibold" style={QUIET}>{t("elev.homeProgram.entry.cancel")}</button>
          </div>
        </>
      ) : (
        <>
          <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{s.profession ? t("elev.homeProgram.name", { profession: profLabel(s.profession) }) : null}</p>
          <ul data-testid="home-review-exercises">
            {filled(s).map((e, i) => (
              <li key={i} data-testid="home-review-exercise" data-shelf={e.shelf} className="border-t py-2 first:border-t-0" style={{ borderColor: "var(--arbor-rule)" }}>
                <p className="t-base" style={{ color: "var(--arbor-ink)" }}><bdi dir="auto">{e.text.trim()}</bdi></p>
                <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{shelfLabel(e.shelf, t)}</p>
              </li>
            ))}
          </ul>
          {goalsWritten(s).length > 0 && (
            <div data-testid="home-review-goals" className="flex flex-col gap-2">
              <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.homeProgram.review.goalsLede")}</p>
              {goalsWritten(s).map(({ g, i }) => {
                const d = s.decisions[i];
                return (
                  <div key={i} data-testid="home-review-goal" data-decided={d === undefined ? "no" : d === "left_out" ? "left_out" : "accepted"} className="border-t py-2" style={{ borderColor: "var(--arbor-rule)" }}>
                    <p className="t-base" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}>{"“"}<bdi dir="auto">{d && d !== "left_out" ? d.text : g}</bdi>{"”"}</p>
                    <p data-testid="home-goal-provenance" className="t-sm" style={{ color: "var(--arbor-muted)" }}>
                      {s.profession ? t("elev.homeProgram.goal.proposedBy", { profession: lowerFor(uiLang, profLabel(s.profession)) }) : null}
                      {d === "left_out" ? <> · {t("elev.homeProgram.review.leftOut")}</> : null}
                    </p>
                    {s.open === i ? (
                      <GoalForm
                        idBase={`home-goal-accept-${i}`}
                        initialText={d && d !== "left_out" ? d.text : g}
                        initialScale={d && d !== "left_out" ? { ...d.scale } : EMPTY_SCALE()}
                        onCancel={() => dispatch({ type: "openGoal", i: null })}
                        onSubmit={(text, scale) => {
                          const r = checkAcceptance(s, i, text, scale, ctx());
                          if (r === "ok") dispatch({ type: "accept", i, text, scale });
                          return r;
                        }}
                      />
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-3">
                        <button type="button" data-testid="home-goal-accept" onClick={() => dispatch({ type: "openGoal", i })} className="inline-flex min-h-11 items-center t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>
                          {t("elev.homeProgram.review.accept")}
                        </button>
                        <button type="button" data-testid="home-goal-leave" onClick={() => dispatch({ type: "leaveOut", i })} className="inline-flex min-h-11 items-center t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>
                          {t("elev.homeProgram.review.leaveOut")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {(s.error === "undecided" || !decided) && <p role="status" data-testid="home-program-undecided" className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.homeProgram.review.undecided")}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="home-program-save" disabled={!decided || saving} onClick={() => void confirm()} className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-bold disabled:cursor-not-allowed disabled:opacity-60" style={SAVE}>{t("elev.homeProgram.review.save")}</button>
            <button type="button" data-testid="home-program-back" disabled={saving} onClick={() => dispatch({ type: "back" })} className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-semibold" style={QUIET}>{t("elev.homeProgram.entry.back")}</button>
          </div>
        </>
      )}
    </section>
  );
}

/** The family's "done today" mark per exercise of an active home program — counts of days, never a rate. */
export function HomeProgramDays({ enrolment, onSave, now = () => new Date() }: { enrolment: HomeProgramEnrolment; onSave: (exerciseId: string) => void; now?: () => Date }) {
  const { t, uiLang } = useLanguage();
  const a = homeAdherence(enrolment, now());
  return (
    <section data-testid="home-program-days" data-program={enrolment.programId} className="mb-5 border-y py-4" style={{ borderColor: "var(--arbor-rule)" }}>
      <h2 className="t-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.homeProgram.name", { profession: t(`elev.carehonesty.consult.audience.${a.profession}`) })}</h2>
      <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.homeProgram.days.week", { n: a.week, total: a.weeks })}</p>
      {enrolment.home.source && <details className="my-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t("elev.pilot.reviewed.transcription.and.selected.quotes")}</summary>
        <p dir="auto" className="mb-2 break-words">{enrolment.home.source.name}</p>
        <p dir="auto" className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[var(--r)] p-3" style={QUIET}>{enrolment.home.source.sourceText}</p>
        <ul className="mt-3 list-disc ps-5">{enrolment.home.source.quotations.map((quote, i) => <li key={i} dir="auto" className="mb-2">{quote}</li>)}</ul>
      </details>}
      <ul className="mt-2">
        {a.exercises.map((e) => {
          const on = exerciseDoneToday(enrolment, e.id, now());
          return (
            <li key={e.id} data-testid="home-program-exercise" data-shelf={e.shelf} className="flex items-start justify-between gap-3 border-t py-2 first:border-t-0" style={{ borderColor: "var(--arbor-rule)" }}>
              <div className="min-w-0">
                <p className="t-base" style={{ color: "var(--arbor-ink)" }}><bdi dir="auto">{e.text}</bdi></p>
                <p data-testid="home-program-exercise-days" className="t-sm" style={{ color: "var(--arbor-muted)" }}>
                  {e.days === 0 ? t("elev.homeProgram.days.none") : e.days === 1 ? t("elev.homeProgram.days.one") : t("elev.homeProgram.days.count", { n: e.days })}
                </p>
              </div>
              <button
                type="button"
                data-testid="home-program-done"
                aria-pressed={on}
                onClick={() => onSave(e.id)}
                className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full px-4 t-sm font-semibold"
                style={on ? { background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" } : QUIET}
              >
                {on && <Icon name="check" size={16} aria-hidden />}
                {t("elev.homeProgram.days.done")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
