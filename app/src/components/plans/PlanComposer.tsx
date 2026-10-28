/**
 * PlanComposer — B-BOOK-77: the parent composes the plan in minutes (standard
 * §6; design of record: mockups/everyday-plans-composer.html, token-true, the
 * 7 Oct design ruling). Parent register only: tokens, logical properties,
 * EN + HE; the child never sees this surface.
 *
 *   door → red lines (FIRST; one ticked sign → the care line and NO plan) →
 *   the three steps (swappable in their sourced menu; minutes 3–10; the time
 *   of day; an optional own-words step phrased by the server, shown as
 *   AI-phrased and approved as the exact line, B-GA-11) → the box and the
 *   duration → the whole book in the reader → "This is {name}'s plan" (the
 *   explicit tap) → done.
 *
 * The flow is lib/plans/composer (pure); this file renders a stage and talks
 * to the server (lib/plans/planApi) for the phrasing and the composition.
 * The returned document is persisted by the caller through the `books`
 * collection seam; nothing is written before the approval.
 */
import React, { useEffect, useMemo, useReducer, useState } from "react";
import { Icon } from "../ui/Icon";
import { BookReader } from "../library/BookReader";
import { useLanguage } from "../../context/LanguageContext";
import { composeRequestOf, composerProblems, composerReducer, compositionOf, initialComposer, redLinesOf, slotMenu, type ComposerState } from "../../lib/plans/composer";
import { composePlan, phraseOwnStep, PlanApiError } from "../../lib/plans/planApi";
import { planString } from "../../lib/plans/planStrings";
import { trackPlanApproved } from "../../lib/kpiEvents";
import { composePlanBook, fillStepLine, OWN_STEP, PLAN_TIMES, type OwnStepOrigin, type PlanTime } from "../../lib/library/plans/composePlanBook";
import type { PatternDef } from "../../lib/library/plans/patterns";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import type { BookLang, BookReaderChild } from "../../lib/library/types";
import { heGender } from "../../lib/library/bookText";

const CARD: React.CSSProperties = { background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-lg)", boxShadow: "var(--arbor-shadow-card)" };
const PRIMARY: React.CSSProperties = { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }; // solid accent: the gradient is each surface's one primaryMove (primaryMove.gradient.test)
const QUIET: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };
const FIELD: React.CSSProperties = { border: "1px solid var(--arbor-rule-strong)", borderRadius: "var(--r)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" };
const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 t-base font-semibold focus:outline-none focus-visible:ring-2";

export interface PlanComposerProps {
  def: PatternDef;
  child: BookReaderChild;
  /** Persist the approved document (the `books` collection seam). */
  onSaved: (doc: PlanBookDoc) => Promise<void> | void;
  onClose: () => void;
  /** The Safety & escalation door (the care stage's one link). */
  onSafety?: () => void;
  /** B-BOOK-79 door (b): the parent-only printed copy, offered once the plan is saved. */
  onPrint?: (doc: PlanBookDoc) => void;
  /** Test seam. */
  initialState?: ComposerState;
}

export default function PlanComposer({ def, child, onSaved, onClose, onSafety, onPrint, initialState }: PlanComposerProps) {
  const { uiLang } = useLanguage();
  const lang: BookLang = uiLang === "he" ? "he" : "en";
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const name = child.name?.split(" ")[0] || (lang === "he" ? "הילד" : "your child");
  const [state, dispatch] = useReducer((st: ComposerState, a: Parameters<typeof composerReducer>[2]) => composerReducer(def, st, a), initialState ?? initialComposer(def, lang));
  const problems = composerProblems(def, state);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedDoc, setSavedDoc] = useState<PlanBookDoc | null>(null);
  const title = def.title[lang];
  const dir = lang === "he" ? "rtl" : "ltr";

  const approve = async () => {
    if (saving || problems.length) return;
    setSaving(true);
    setSaveError(false);
    try {
      const { doc } = await composePlan(child.id, composeRequestOf(state));
      await onSaved(doc);
      setSavedDoc(doc);
      // BD-54: the first useful action — ids only (pattern, language, own-step origin).
      trackPlanApproved({ pattern: def.id, lang, ownStep: state.ownStep ? (state.ownStep.origin ?? "parent") : "none" });
      dispatch({ type: "approved" });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[720px] flex-col gap-4" dir={dir} data-plan-composer={def.id} data-stage={state.stage}>
      <header className="flex items-center justify-between gap-2">
        <button type="button" className="-ms-1 inline-flex min-h-11 items-center gap-1 px-1 t-sm font-bold" style={{ color: "var(--arbor-muted)" }} onClick={() => (state.stage === "door" || state.stage === "approved" ? onClose() : dispatch({ type: "back" }))} data-plan-back="">
          <Icon name="arrow_back" size={18} className="rtl:-scale-x-100" />
          {s("back")}
        </button>
        <p className="arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>{s("stage.door.kicker")}</p>
      </header>

      {state.stage === "door" && (
        <section style={CARD} className="p-5" data-plan-stage="door">
          <h1 className="arbor-type-title" style={{ color: "var(--arbor-ink)" }}>{title}</h1>
          <p className="mt-1 t-sm" style={{ color: "var(--arbor-muted)" }}>{def.parentWords[lang]}</p>
          <p className="mt-3 t-base leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{s("stage.door.body", { name })}</p>
          <div className="mt-4"><button type="button" className={BTN} style={PRIMARY} data-plan-start="" onClick={() => dispatch({ type: "open" })}>{s("stage.door.start")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button></div>
        </section>
      )}

      {state.stage === "redLines" && (
        <section style={CARD} className="p-5" data-plan-stage="redLines">
          <h2 className="arbor-type-title" style={{ color: "var(--arbor-ink)" }}>{s("stage.redLines.title")}</h2>
          <p className="mt-1 t-base" style={{ color: "var(--arbor-muted)" }}>{s("stage.redLines.body")}</p>
          <ul className="mt-3 flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {def.watchFor.map((w) => {
              const on = state.ticked.includes(w.id);
              return (
                <li key={w.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl p-3" style={{ background: on ? "var(--arbor-paper-deep)" : "transparent" }}>
                    <input type="checkbox" className="mt-1 h-5 w-5" checked={on} data-plan-redline={w.id} onChange={(e) => dispatch({ type: "tick", id: w.id, on: e.target.checked })} />
                    <span className="t-base" style={{ color: "var(--arbor-ink)" }}>{w.text[lang]}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={BTN} style={PRIMARY} data-plan-redlines-next="" onClick={() => dispatch({ type: "redLinesDone" })}>{state.ticked.length ? s("stage.redLines.next") : s("stage.redLines.none")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
          </div>
        </section>
      )}

      {state.stage === "care" && (() => {
        const out = redLinesOf(def, state);
        const careLine = out.offer === "care" ? out.careLine[lang] : "";
        return (
          <section style={CARD} className="p-5" data-plan-stage="care" data-plan-care="">
            <h2 className="arbor-type-title" style={{ color: "var(--arbor-ink)" }}>{s("stage.care.title")}</h2>
            <p className="mt-2 t-base leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{s("stage.care.body")}</p>
            <blockquote className="arbor-accent-rule mt-3 ps-3 t-base" style={{ borderInlineStart: "2px solid var(--arbor-ink)", color: "var(--arbor-ink)" }} data-plan-care-line="">{careLine}</blockquote>
            <div className="mt-4 flex flex-wrap gap-2">
              {onSafety && <button type="button" className={BTN} style={QUIET} onClick={onSafety}><Icon name="health_and_safety" size={18} />{s("stage.care.safety")}</button>}
              <button type="button" className={BTN} style={QUIET} onClick={() => dispatch({ type: "back" })}>{s("stage.care.back")}</button>
            </div>
          </section>
        );
      })()}

      {state.stage === "steps" && <StepsStage def={def} lang={lang} childName={name} state={state} dispatch={dispatch} problems={problems.length} />}

      {state.stage === "the-box" && (
        <section style={CARD} className="p-5" data-plan-stage="the-box">
          <h2 className="arbor-type-title" style={{ color: "var(--arbor-ink)" }}>{s("stage.box.title")}</h2>
          <p className="mt-1 t-base" style={{ color: "var(--arbor-muted)" }}>{s("stage.box.body")}</p>
          <ul className="mt-3 flex flex-wrap gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {def.boxItems.map((b) => {
              const on = state.boxItemIds.includes(b.id);
              return (
                <li key={b.id}>
                  <button type="button" className={`${BTN} px-4`} style={on ? { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" } : QUIET} aria-pressed={on} data-plan-box={b.id} onClick={() => dispatch({ type: "the-box", itemId: b.id, on: !on })}>
                    {b.glyph && <Icon name={b.glyph} size={18} />}{b.label[lang]}
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="mt-4 flex items-center gap-3 t-base" style={{ color: "var(--arbor-ink)" }}>
            <span className="font-semibold">{s("stage.box.duration")}</span>
            <select className="min-h-11 px-3" style={FIELD} value={state.durationDays} data-plan-duration="" onChange={(e) => dispatch({ type: "duration", durationDays: Number(e.target.value) })}>
              {[14, 21, 28].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <div className="mt-4"><button type="button" className={BTN} style={PRIMARY} data-plan-box-next="" onClick={() => dispatch({ type: "boxDone" })}>{s("stage.box.next")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button></div>
        </section>
      )}

      {state.stage === "preview" && (
        <section className="flex flex-col gap-3" data-plan-stage="preview">
          <div style={CARD} className="p-5">
            <h2 className="arbor-type-title" style={{ color: "var(--arbor-ink)" }}>{s("stage.preview.title", { name })}</h2>
            <p className="mt-1 t-base" style={{ color: "var(--arbor-muted)" }}>{s("stage.preview.body", { name })}</p>
          </div>
          <PreviewBook def={def} state={state} child={child} lang={lang} />
          <div style={CARD} className="p-5">
            {saveError && <p role="alert" className="mb-2 t-sm" style={{ color: "var(--arbor-ink)" }}>{s("stage.preview.error")}</p>}
            <button type="button" className={`${BTN} w-full`} style={PRIMARY} disabled={saving || problems.length > 0} data-plan-approve="" data-primary-move="approve-plan" onClick={() => void approve()}>
              <Icon name="check" size={18} />{saving ? s("stage.preview.saving") : s("stage.preview.approve", { name })}
            </button>
          </div>
        </section>
      )}

      {state.stage === "approved" && (
        <section style={CARD} className="p-5" data-plan-stage="approved">
          <h2 className="arbor-type-title" style={{ color: "var(--arbor-ink)" }}>{s("stage.approved.title", { name })}</h2>
          <p className="mt-2 t-base leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{s("stage.approved.body", { name, days: state.durationDays })}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={BTN} style={PRIMARY} data-plan-done="" onClick={onClose}>{s("stage.approved.done")}</button>
            {onPrint && savedDoc && <button type="button" className={BTN} style={QUIET} data-plan-print="" onClick={() => onPrint(savedDoc)}><Icon name="description" size={18} />{s("stage.approved.print", { name })}</button>}
          </div>
        </section>
      )}
    </div>
  );
}

function StepsStage({ def, lang, childName, state, dispatch, problems }: { def: PatternDef; lang: BookLang; childName: string; state: ComposerState; dispatch: React.Dispatch<Parameters<typeof composerReducer>[2]>; problems: number }) {
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const [ownSlot, setOwnSlot] = useState<1 | 2 | 3>(2);
  const [ownText, setOwnText] = useState("");
  // B-BOOK-79 door (a): whose step — the parent's own words, or a step relayed from the professional who works with the child.
  const [ownOrigin, setOwnOrigin] = useState<OwnStepOrigin>("parent");
  const [phrasing, setPhrasing] = useState(false);
  const [refused, setRefused] = useState(false);
  const phrase = async () => {
    if (phrasing || ownText.trim().length < 3) return;
    setPhrasing(true);
    setRefused(false);
    try {
      const { step } = await phraseOwnStep({ pattern: def.id, slot: ownSlot, lang, text: ownText.trim(), origin: ownOrigin });
      dispatch({ type: "ownStepPhrased", step });
    } catch (e) {
      setRefused(!(e instanceof PlanApiError) || e.status !== 401);
    } finally {
      setPhrasing(false);
    }
  };
  return (
    <section style={CARD} className="p-5" data-plan-stage="steps">
      <h2 className="arbor-type-title" style={{ color: "var(--arbor-ink)" }}>{s("stage.steps.title")}</h2>
      <p className="mt-1 t-base" style={{ color: "var(--arbor-muted)" }}>{s("stage.steps.body")}</p>
      <ol className="mt-3 flex flex-col gap-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {([1, 2, 3] as const).map((slot) => {
          const menuId = state.stepMenuIds[slot - 1];
          const isOwn = menuId === OWN_STEP;
          const item = def.menu.find((m) => m.id === menuId);
          const text = isOwn && state.ownStep ? state.ownStep.text : item ? fillStepLine(item.text, state) : null;
          const menu = slotMenu(def, slot);
          return (
            <li key={slot} className="rounded-xl p-4" style={{ background: "var(--arbor-paper-deep)" }} data-plan-step={slot} data-plan-step-own={isOwn ? "" : undefined}>
              <p className="arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>{s("stage.steps.step", { n: slot })}</p>
              {text && <p className="mt-1 t-base leading-relaxed" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }} dir="auto" data-plan-step-text="">{lang === "he" ? text.he[heGender(undefined)] : text.en}</p>}
              {isOwn && state.ownStep && (
                <div className="mt-2 flex flex-col gap-2" data-plan-own-pending={state.ownStep.approvedAt ? undefined : ""}>
                  <p className="t-sm" style={{ color: "var(--arbor-muted)" }} data-plan-own-origin={state.ownStep.origin ?? "parent"}><Icon name="auto_awesome" size={16} /> {state.ownStep.origin === "practitioner" ? s("stage.steps.practitionerLabel", { name: childName }) : s("stage.steps.ownLabel")}</p>
                  <div className="flex flex-wrap gap-2">
                    {!state.ownStep.approvedAt && <button type="button" className={BTN} style={PRIMARY} data-plan-own-approve="" onClick={() => dispatch({ type: "ownStepApproved", at: new Date().toISOString() })}><Icon name="check" size={18} />{s("stage.steps.ownApprove")}</button>}
                    <button type="button" className={BTN} style={QUIET} data-plan-own-drop="" onClick={() => dispatch({ type: "ownStepDropped" })}>{s("stage.steps.ownDrop")}</button>
                  </div>
                </div>
              )}
              {!isOwn && menu.length > 1 && (
                <label className="mt-2 flex flex-wrap items-center gap-2 t-sm" style={{ color: "var(--arbor-ink)" }}>
                  <span className="font-semibold">{s("stage.steps.swap")}</span>
                  <select className="min-h-11 max-w-full px-3" style={FIELD} value={menuId} data-plan-swap={slot} onChange={(e) => dispatch({ type: "swap", slot, menuId: e.target.value })}>
                    {menu.map((m) => <option key={m.id} value={m.id}>{m.parentLine[lang].slice(0, 80)}</option>)}
                  </select>
                </label>
              )}
              {slot === 1 && item?.defaultMinutes != null && (
                <div className="mt-2 flex flex-wrap gap-3 t-sm" style={{ color: "var(--arbor-ink)" }}>
                  <label className="flex items-center gap-2"><span className="font-semibold">{s("stage.steps.minutes")}</span>
                    <select className="min-h-11 px-3" style={FIELD} value={state.minutes} data-plan-minutes="" onChange={(e) => dispatch({ type: "minutes", minutes: Number(e.target.value) })}>
                      {Array.from({ length: def.minutesRange[1] - def.minutesRange[0] + 1 }, (_, i) => def.minutesRange[0] + i).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2"><span className="font-semibold">{s("stage.steps.time")}</span>
                    <select className="min-h-11 px-3" style={FIELD} value={state.time} data-plan-time="" onChange={(e) => dispatch({ type: "time", time: e.target.value as PlanTime })}>
                      {PLAN_TIMES.map((t) => <option key={t} value={t}>{s(`time.${t}` as Parameters<typeof planString>[0])}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!state.ownStep && (
        <div className="mt-4 rounded-xl p-4" style={{ border: "1px dashed var(--arbor-rule-strong)" }} data-plan-own="">
          <p className="t-base font-semibold" style={{ color: "var(--arbor-ink)" }}>{s("stage.steps.own")}</p>
          <p className="mt-1 t-sm" style={{ color: "var(--arbor-muted)" }}>{s("stage.steps.ownHint")}</p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={s("stage.steps.origin")} data-plan-own-origin-choice="">
            {(["parent", "practitioner"] as const).map((o) => (
              <button key={o} type="button" role="radio" aria-checked={ownOrigin === o} className={`${BTN} px-4`} style={ownOrigin === o ? { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" } : QUIET} data-plan-own-origin-pick={o} onClick={() => setOwnOrigin(o)}>
                {o === "practitioner" ? s("stage.steps.origin.practitioner", { name: childName }) : s("stage.steps.origin.parent")}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <select className="min-h-11 px-3" style={FIELD} value={ownSlot} data-plan-own-slot="" onChange={(e) => setOwnSlot(Number(e.target.value) as 1 | 2 | 3)}>
              {([1, 2, 3] as const).map((n) => <option key={n} value={n}>{s("stage.steps.step", { n })}</option>)}
            </select>
            <textarea className="min-h-11 flex-1 p-3 t-base" style={FIELD} rows={2} maxLength={240} value={ownText} data-plan-own-text="" dir="auto" onChange={(e) => setOwnText(e.target.value)} />
          </div>
          {refused && <p role="alert" className="mt-2 t-sm" style={{ color: "var(--arbor-ink)" }}>{s("stage.steps.ownRefused")}</p>}
          <div className="mt-2"><button type="button" className={BTN} style={QUIET} disabled={phrasing || ownText.trim().length < 3} data-plan-own-phrase="" onClick={() => void phrase()}><Icon name="auto_awesome" size={18} />{phrasing ? s("stage.steps.ownPhrasing") : s("stage.steps.ownPhrase")}</button></div>
        </div>
      )}
      <div className="mt-4"><button type="button" className={BTN} style={PRIMARY} disabled={problems > 0} data-plan-steps-next="" onClick={() => dispatch({ type: "stepsDone" })}>{s("stage.steps.next")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button></div>
    </section>
  );
}

/** The whole book, as the child will read it (the reader with the composed
 *  book, placeholder plates in DEV; no narration probe; nothing recorded). */
function PreviewBook({ def, state, child, lang }: { def: PatternDef; state: ComposerState; child: BookReaderChild; lang: BookLang }) {
  const book = useMemo(() => composePlanBook(def, { ...compositionOf(state, `${def.id}.preview`), approvedAt: "preview", approvedBy: "preview" }), [def, state]);
  const [opening, setOpening] = useState(0);
  useEffect(() => setOpening((n) => n + 1), [book]);
  return (
    <div style={{ position: "relative", minHeight: 560, borderRadius: "var(--r-xl)", overflow: "hidden" }} data-plan-preview="">
      <BookReader key={opening} book={book} lang={lang} child={child} onClose={() => setOpening((n) => n + 1)} narration="off" initialBox={{ width: 390, height: 560 }} />
    </div>
  );
}
