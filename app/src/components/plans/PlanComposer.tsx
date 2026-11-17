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
import { useAutoPaint } from "../../lib/plans/useAutoPaint";
import type { AutoPaintState } from "../../lib/plans/autoPaint";
import { trackPlanApproved } from "../../lib/kpiEvents";
import { composePlanBook, fillParentLine, fillStepLine, OWN_STEP, PLAN_TIMES, type OwnStepOrigin, type PlanTime } from "../../lib/library/plans/composePlanBook";
import type { PatternDef } from "../../lib/library/plans/patterns";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import type { BookLang, BookReaderChild } from "../../lib/library/types";
import { heGender } from "../../lib/library/bookText";
import { screenForImmediateEscalation } from "../../safety/escalation";
import { UrgentSupport } from "../safety/UrgentSupport";
import { DsRoot } from "../../design/primitives";
import { useComposition, type Composition } from "../../design/useComposition";
import { ChallengeBook } from "./v10/ChallengeBook";
import { mirrorPoints, Road, zigzagPoints } from "./v10/Road";
import { plansCopy } from "./v10/plansCopy";
import { fmtDayV10 } from "../../lib/formatDate";
import "./v10/plans.css";

/* v10.1 (boards CP-1 Recognise, CP-2 Agree, CP-3 Preview; O-ChallengePlans):
   the composer draws the canvas objects (cp-*) inside its own `.ds` root, so
   it reads the same wherever it is hosted. Restyle only: the reducer, the
   stages and every safety branch are unchanged, and the pattern's words,
   steps and red lines come from the registry as written (B-GA-37). */
const PRIMARY = "btn primary";
const QUIET = "btn ghost";

/** Which of the journey's five stops a composer stage belongs to. */
const STOP_OF: Record<ComposerState["stage"], 0 | 1 | 2> = { door: 0, redLines: 0, care: 0, steps: 1, "the-box": 1, preview: 2, approved: 2 };

/** The journey road, compact: Recognise · Agree · Preview · Try · Reflect, the current stop ringed. */
function JourneyStrip({ current, lang }: { current: 0 | 1 | 2; lang: BookLang }) {
  const c = plansCopy(lang);
  const names = [c.stopsShort.recognise, c.stopsShort.agree, c.stopsShort.preview, c.stopsShort.try, c.stopsShort.reflect];
  const pts = mirrorPoints(zigzagPoints(5, { low: 76, high: 24 }), lang === "he");
  return (
    <div style={{ padding: "6px 30px 0" }}>
      <div className="gfx cp-jr" style={{ marginBottom: 34, maxWidth: 560, marginInline: "auto" }} role="img" aria-label={`${c.journey}: ${names.join(", ")}. ${names[current]}.`}>
        <Road points={pts} width={640} height={84} strokeWidth={18} stretches={[0, current]} />
        {names.map((n, i) => (
          <React.Fragment key={i}>
            <i className={`at tok plan md${i === current ? " here" : i > current ? " open" : ""}`} style={{ left: `${pts[i].x}%`, top: `${pts[i].y}%` }} aria-hidden="true" />
            <span className={`jl${i === current ? " cur" : ""}`} style={{ left: `${pts[i].x}%`, top: "calc(100% + 6px)", fontSize: 12 }} aria-hidden="true">{n}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export interface PlanComposerProps {
  def: PatternDef;
  /** B-KID-168: `nameLatin` lets the English voice say the name in English letters. */
  child: BookReaderChild & { nameLatin?: string | null };
  /** Persist the approved document (the `books` collection seam). */
  onSaved: (doc: PlanBookDoc) => Promise<void> | void;
  onClose: () => void;
  /** The Safety & escalation door (the care stage's one link). */
  onSafety?: () => void;
  /** B-BOOK-79 door (b): the parent-only printed copy, offered once the plan is saved. */
  onPrint?: (doc: PlanBookDoc) => void;
  /** S1 4(b): the server's `admin` flag — an owner opening a pattern whose
   *  shared plates are not all painted starts the paint in the background
   *  (lib/plans/autoPaint). A family never passes true. */
  ownerPaint?: boolean;
  /** Test seam. */
  initialState?: ComposerState;
  /** Test seam: the progress line's initial state. */
  initialPaint?: AutoPaintState;
}

export default function PlanComposer({ def, child, onSaved, onClose, onSafety, onPrint, ownerPaint = false, initialState, initialPaint }: PlanComposerProps) {
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
  const paint = useAutoPaint(def.id, ownerPaint, initialPaint);

  const approve = async () => {
    if (saving || problems.length) return;
    setSaving(true);
    setSaveError(false);
    try {
      const { doc } = await composePlan(child.id, composeRequestOf(state));
      await onSaved(doc);
      setSavedDoc(doc);
      // PR C (Everyday Plans): the parent's approval is the explicit act that
      // starts the plan book's narration in the child's name (when the child's
      // plan sheet is complete). Parent side only; the approved document rides
      // along so the run does not wait for the collection to settle.
      void import("../kidmode/hero/buildPlanNarration")
        .then((m) => m.ensurePlanNarration(child, m.narrationFolder(doc.lang, child.gender), { planDoc: doc }))
        .catch(() => undefined);
      // BD-54: the first useful action — ids only (pattern, language, own-step origin).
      trackPlanApproved({ pattern: def.id, lang, ownStep: state.ownStep ? (state.ownStep.origin ?? "parent") : "none" });
      dispatch({ type: "approved" });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const c = plansCopy(lang);
  const composition = useComposition();
  const stop = STOP_OF[state.stage];
  const stopNames = [c.stops.recognise, c.stops.agree, c.stops.preview];
  return (
    <DsRoot composition={composition} className="ds-plans ds-plans-composer" dir={dir} data-plan-composer={def.id} data-stage={state.stage}>
      <div className="stack ds-col" style={{ gap: 14, maxWidth: composition === "desk" && state.stage !== "steps" ? 760 : undefined, marginInline: "auto", width: "100%" }}>
        <header className="line between" style={{ gap: 8, minHeight: 44 }}>
          <button type="button" className="ds-link" style={{ paddingInlineStart: 0 }} onClick={() => (state.stage === "door" || state.stage === "approved" ? onClose() : dispatch({ type: "back" }))} data-plan-back="">
            <Icon name="chevron_left" size={18} className="rtl:-scale-x-100" />
            {/* CP-1: where the link goes — the Challenge Plans list from the door, else the stage before. */}
            {state.stage === "door" || state.stage === "approved" ? s("section.title") : s("back")}
          </button>
          <span className="small">{c.stopOf(stop + 1, 5, stopNames[stop])}</span>
        </header>
        <JourneyStrip current={stop} lang={lang} />
        {/* S1 4(b): owner only — the shared plates paint themselves in the background; no button. */}
        {ownerPaint && paint.painting && (
          <p role="status" className="line small" style={{ gap: 8 }} data-plan-painting={paint.done}>
            <Icon name="brush" size={15} />{s("paint.progress", { done: paint.done, total: paint.total })}
          </p>
        )}

        {state.stage === "door" && (
          <section data-plan-stage="door" className="stack ds-col" style={{ gap: 14 }}>
            <div className="scene plan" style={{ padding: 18, gap: 14 }}>
              <i className="orb" aria-hidden="true" style={{ width: 240, height: 240, left: -150, bottom: -150, opacity: 0.55 }} />
              <i className="orb b" aria-hidden="true" style={{ width: 220, height: 220, right: -120, top: -130, opacity: 0.75 }} />
              <span className="kicker">{s("stage.door.kicker")}</span>
              <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 14, alignItems: "center" }}>
                <ChallengeBook title={title} width={92} label={c.book(title)} />
                <div className="stack ds-col" style={{ gap: 6 }}>
                  <h1 className="cp-h" dir="auto">{title}</h1>
                  <p className="cp-lede" dir="auto" style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontSize: 15 }}>{c.quoted(def.parentWords[lang])}</p>
                  <span className="line" style={{ gap: 6, flexWrap: "wrap" }}>
                    <span className="cp-st2">{s("chooser.age", { age: def.ageText })}</span>
                    <span className="cp-st2">{c.days(def.defaultDurationDays)}</span>
                  </span>
                </div>
              </div>
              <div className="cp-get">
                <span><i aria-hidden="true"><Icon name="flag" size={18} /></i>{c.get.steps}</span>
                <span><i aria-hidden="true"><Icon name="auto_stories" size={18} /></i>{c.get.book(name)}</span>
                <span><i aria-hidden="true"><Icon name="nightlight" size={18} /></i>{c.get.asApproved}</span>
              </div>
            </div>
            <p className="cp-lede" dir="auto">{s("stage.door.body", { name })}</p>
            <button type="button" className={`${PRIMARY} block`} style={{ minHeight: 52 }} data-plan-start="" onClick={() => dispatch({ type: "open" })}>{s("stage.door.start")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
          </section>
        )}

        {state.stage === "redLines" && (
          <section data-plan-stage="redLines" className="stack ds-col" style={{ gap: 14 }}>
            <div className="cp-card">
              <h1 className="cp-q">{s("stage.redLines.title")}</h1>
              <p className="cp-lede">{s("stage.redLines.body")}</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {def.watchFor.map((w) => {
                  const on = state.ticked.includes(w.id);
                  return (
                    <li key={w.id}>
                      <label className="cp-chk ds-plans-chk" data-on={on ? "" : undefined}>
                        <input type="checkbox" checked={on} data-plan-redline={w.id} onChange={(e) => dispatch({ type: "tick", id: w.id, on: e.target.checked })} />
                        <span dir="auto">{w.text[lang]}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <button type="button" className={`${PRIMARY} block`} style={{ minHeight: 52 }} data-plan-redlines-next="" onClick={() => dispatch({ type: "redLinesDone" })}>{state.ticked.length ? s("stage.redLines.next") : s("stage.redLines.none")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
            <p className="cp-lede line" style={{ gap: 8 }}><Icon name="health_and_safety" size={15} />{c.redLinesNote}</p>
          </section>
        )}

        {state.stage === "care" && (() => {
          const out = redLinesOf(def, state);
          const careLine = out.offer === "care" ? out.careLine[lang] : "";
          return (
            <section data-plan-stage="care" data-plan-care="" className="cp-card">
              <h1 className="cp-h">{s("stage.care.title")}</h1>
              <p className="cp-lede">{s("stage.care.body")}</p>
              <blockquote className="ds-said" style={{ margin: 0, paddingInlineStart: 12, borderInlineStart: "2px solid var(--ink)", color: "var(--ink)", fontSize: 17 }} data-plan-care-line="">{careLine}</blockquote>
              <div className="line" style={{ gap: 8, flexWrap: "wrap" }}>
                {onSafety && <button type="button" className={PRIMARY} onClick={onSafety}><Icon name="health_and_safety" size={18} />{s("stage.care.safety")}</button>}
                <button type="button" className={QUIET} style={{ background: "var(--card)" }} onClick={() => dispatch({ type: "back" })}>{s("stage.care.back")}</button>
              </div>
            </section>
          );
        })()}

        {state.stage === "steps" && <StepsStage def={def} lang={lang} childName={name} state={state} dispatch={dispatch} problems={problems.length} onSafety={onSafety} composition={composition} />}

        {state.stage === "the-box" && (
          <section data-plan-stage="the-box" className="stack ds-col" style={{ gap: 14 }}>
            <div className="cp-card">
              <h1 className="cp-q">{s("stage.box.title")}</h1>
              <p className="cp-lede">{s("stage.box.body")}</p>
              <ul className="line" style={{ gap: 8, flexWrap: "wrap", listStyle: "none", margin: 0, padding: 0 }}>
                {def.boxItems.map((b) => {
                  const on = state.boxItemIds.includes(b.id);
                  return (
                    <li key={b.id}>
                      <button type="button" className={on ? "cp-chip on ds-plans-chipbtn" : "cp-chip ds-plans-chipbtn"} aria-pressed={on} data-plan-box={b.id} onClick={() => dispatch({ type: "the-box", itemId: b.id, on: !on })}>
                        {b.glyph && <Icon name={b.glyph} size={15} />}{b.label[lang]}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="line between" style={{ gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label={s("stage.box.duration")} data-plan-duration="">
                <span style={{ fontSize: 14, fontWeight: 600 }}>{s("stage.box.duration")}</span>
                <span className="line" style={{ gap: 6 }}>
                  {[14, 21, 28].map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={state.durationDays === d} className={state.durationDays === d ? "cp-chip on ds-plans-chipbtn" : "cp-chip ds-plans-chipbtn"} data-plan-duration-pick={d} onClick={() => dispatch({ type: "duration", durationDays: d })}>{d}</button>
                  ))}
                </span>
              </div>
            </div>
            <button type="button" className={`${PRIMARY} block`} style={{ minHeight: 52 }} data-plan-box-next="" onClick={() => dispatch({ type: "boxDone" })}>{s("stage.box.next")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
            <p className="cp-lede">{c.notSaved}</p>
          </section>
        )}

        {state.stage === "preview" && (
          <section className="stack ds-col" style={{ gap: 14 }} data-plan-stage="preview">
            <div className="stack ds-col" style={{ gap: 6 }}>
              <div className="line between" style={{ gap: 8 }}>
                <h1 className="cp-h">{s("stage.preview.title", { name })}</h1>
                <span className="cp-st2 dr"><Icon name="edit" size={15} />{c.draft}</span>
              </div>
              <p className="cp-lede">{s("stage.preview.body", { name })}</p>
            </div>
            <PreviewBook def={def} state={state} child={child} lang={lang} />
            {saveError && <p role="alert" className="cp-lede" style={{ color: "var(--ink)" }}>{s("stage.preview.error")}</p>}
            <button type="button" className={`${PRIMARY} block`} style={{ minHeight: 52 }} disabled={saving || problems.length > 0} data-plan-approve="" data-primary-move="approve-plan" onClick={() => void approve()}>
              <Icon name="check" size={18} />{saving ? s("stage.preview.saving") : s("stage.preview.approve", { name })}
            </button>
            <p className="cp-lede">{c.nothingReaches(name)}</p>
          </section>
        )}

        {state.stage === "approved" && (
          <section className="cp-card" data-plan-stage="approved">
            <span className="cp-st2 ok" style={{ alignSelf: "flex-start" }}><Icon name="check" size={15} />{c.approvedOn(fmtDayV10(new Date(), lang))}</span>
            <h1 className="cp-h">{s("stage.approved.title", { name })}</h1>
            <p className="cp-lede">{s("stage.approved.body", { name, days: state.durationDays })}</p>
            <div className="line" style={{ gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={PRIMARY} data-plan-done="" onClick={onClose}>{s("stage.approved.done")}</button>
              {onPrint && savedDoc && <button type="button" className={QUIET} style={{ background: "var(--card)" }} data-plan-print="" onClick={() => onPrint(savedDoc)}><Icon name="description" size={18} />{s("stage.approved.print", { name })}</button>}
            </div>
          </section>
        )}
      </div>
    </DsRoot>
  );
}

function StepsStage({ def, lang, childName, state, dispatch, problems, onSafety, composition }: { def: PatternDef; lang: BookLang; childName: string; state: ComposerState; dispatch: React.Dispatch<Parameters<typeof composerReducer>[2]>; problems: number; onSafety?: () => void; composition: Composition }) {
  const c = plansCopy(lang);
  const desk = composition === "desk";
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const [ownSlot, setOwnSlot] = useState<1 | 2 | 3>(2);
  const [ownText, setOwnText] = useState("");
  // B-BOOK-79 door (a): whose step — the parent's own words, or a step relayed from the professional who works with the child.
  const [ownOrigin, setOwnOrigin] = useState<OwnStepOrigin>("parent");
  const [phrasing, setPhrasing] = useState(false);
  const [refused, setRefused] = useState(false);
  // B-GA-05 (28 Oct): crisis language in the parent's words never becomes a
  // plan step and never reads as "could not phrase". The same screen the server
  // runs fires here first (no request), and the server's 409 contract (lib/api
  // DUX-032) is honoured if it arrives anyway; the notice carries the one door
  // to Help and safety, where the helplines live.
  const [crisis, setCrisis] = useState(false);
  const phrase = async () => {
    if (phrasing || ownText.trim().length < 3) return;
    setRefused(false);
    if (screenForImmediateEscalation({ message: ownText.trim() })) { setCrisis(true); return; }
    setCrisis(false);
    setPhrasing(true);
    try {
      const { step } = await phraseOwnStep({ pattern: def.id, slot: ownSlot, lang, text: ownText.trim(), origin: ownOrigin });
      dispatch({ type: "ownStepPhrased", step });
    } catch (e) {
      if (e instanceof PlanApiError && e.status === 409) { setCrisis(true); return; }
      setRefused(!(e instanceof PlanApiError) || e.status !== 401);
    } finally {
      setPhrasing(false);
    }
  };
  const stepTime = (slot: 1 | 2 | 3) => {
    const item = def.menu.find((m) => m.id === state.stepMenuIds[slot - 1]);
    const t = slot === 1 && item?.defaultMinutes != null ? state.time : item?.defaultTime;
    return t ? s(`time.${t}` as Parameters<typeof planString>[0]) : "";
  };
  return (
    <section data-plan-stage="steps" className="stack ds-col" style={{ gap: 14 }}>
      <div className="stack ds-col" style={{ gap: 6 }}>
        <h1 className="cp-h">{s("stage.steps.title")}</h1>
        <p className="cp-lede">{s("stage.steps.body")}</p>
      </div>
      <ol className={desk ? "ds-plans-agree" : "stack ds-col"} style={{ gap: desk ? 16 : 12, listStyle: "none", margin: 0, padding: 0 }}>
        {([1, 2, 3] as const).map((slot) => {
          const menuId = state.stepMenuIds[slot - 1];
          const isOwn = menuId === OWN_STEP;
          const item = def.menu.find((m) => m.id === menuId);
          const text = isOwn && state.ownStep ? state.ownStep.text : item ? fillStepLine(item.text, state) : null;
          const youDo = isOwn && state.ownStep ? state.ownStep.sourceText : item ? fillParentLine(item.parentLine, state)[lang] : undefined;
          const menu = slotMenu(def, slot);
          return (
            <li key={slot} className={desk ? "cp-col" : "cp-card"} data-plan-step={slot} data-plan-step-own={isOwn ? "" : undefined}>
              <div className="line" style={{ gap: 12 }}>
                <span className="cp-n" aria-hidden="true"><b>{slot}</b><Icon name="check" size={18} /></span>
                {/* CP-2: the step and its time of day (the board's step names are not in the data). */}
                <span className="stack ds-col" style={{ gap: 0 }}>
                  <b style={{ fontSize: 15, fontWeight: 600 }}>{s("stage.steps.step", { n: slot })}</b>
                  {stepTime(slot) && <small style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{stepTime(slot)}</small>}
                </span>
              </div>
              {youDo && <div className="cp-pl" dir="auto"><small>{c.youDo}</small>{youDo}</div>}
              {/* CP-2: the first step's words open; the others fold to one line until tapped. */}
              {text && (slot === 1 || desk ? (
                <div className="cp-kid" dir="auto" data-plan-step-text=""><small>{c.hearsExactly(childName)}</small>{lang === "he" ? text.he[heGender(undefined)] : text.en}</div>
              ) : (
                <details className="cp-kidd group">
                  <summary className="cp-kids" dir="auto">
                    <small>{c.hears(childName)}</small>
                    <span className="cp-kidt">{lang === "he" ? text.he[heGender(undefined)] : text.en}</span>
                    <Icon name="expand_more" size={18} className="transition group-open:rotate-180" />
                  </summary>
                  <div className="cp-kid" dir="auto" data-plan-step-text="">{lang === "he" ? text.he[heGender(undefined)] : text.en}</div>
                </details>
              ))}
              {isOwn && state.ownStep && (
                <div className="cp-own" data-plan-own-pending={state.ownStep.approvedAt ? undefined : ""}>
                  <span className="by" data-plan-own-origin={state.ownStep.origin ?? "parent"}><Icon name="edit" size={15} /> {state.ownStep.origin === "practitioner" ? s("stage.steps.practitionerLabel", { name: childName }) : s("stage.steps.ownLabel")}</span>
                  <div className="line" style={{ gap: 8, flexWrap: "wrap" }}>
                    {!state.ownStep.approvedAt && <button type="button" className="btn ink sm grow" data-plan-own-approve="" onClick={() => dispatch({ type: "ownStepApproved", at: new Date().toISOString() })}><Icon name="check" size={18} />{s("stage.steps.ownApprove")}</button>}
                    <button type="button" className="btn ghost sm" style={{ background: "var(--card)" }} data-plan-own-drop="" onClick={() => dispatch({ type: "ownStepDropped" })}>{s("stage.steps.ownDrop")}</button>
                  </div>
                </div>
              )}
              {!isOwn && menu.length > 1 && (
                <label className="stack ds-col" style={{ gap: 4, marginTop: desk ? "auto" : undefined }}>
                  <span className="small" style={{ fontWeight: 600 }}>{s("stage.steps.swap")}</span>
                  <select className="cp-sel ds-plans-select" value={menuId} data-plan-swap={slot} onChange={(e) => dispatch({ type: "swap", slot, menuId: e.target.value })}>
                    {menu.map((m) => <option key={m.id} value={m.id}>{fillParentLine(m.parentLine, state)[lang].slice(0, 80)}</option>)}
                  </select>
                </label>
              )}
              {slot === 1 && item?.defaultMinutes != null && (
                <div className="line" style={{ gap: 10, flexWrap: "wrap" }}>
                  <label className="stack ds-col" style={{ gap: 4 }}><span className="small" style={{ fontWeight: 600 }}>{s("stage.steps.minutes")}</span>
                    <select className="cp-sel ds-plans-select" value={state.minutes} data-plan-minutes="" onChange={(e) => dispatch({ type: "minutes", minutes: Number(e.target.value) })}>
                      {Array.from({ length: def.minutesRange[1] - def.minutesRange[0] + 1 }, (_, i) => def.minutesRange[0] + i).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="stack ds-col" style={{ gap: 4 }}><span className="small" style={{ fontWeight: 600 }}>{s("stage.steps.time")}</span>
                    <select className="cp-sel ds-plans-select" value={state.time} data-plan-time="" onChange={(e) => dispatch({ type: "time", time: e.target.value as PlanTime })}>
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
        <section className="cp-card" data-plan-own="">
          <h2 className="cp-q">{s("stage.steps.own")}</h2>
          <p className="cp-lede">{s("stage.steps.ownHint")}</p>
          <div className="line" style={{ gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label={s("stage.steps.origin")} data-plan-own-origin-choice="">
            {(["parent", "practitioner"] as const).map((o) => (
              <button key={o} type="button" role="radio" aria-checked={ownOrigin === o} className={ownOrigin === o ? "cp-chip on ds-plans-chipbtn" : "cp-chip ds-plans-chipbtn"} data-plan-own-origin-pick={o} onClick={() => setOwnOrigin(o)}>
                {o === "practitioner" ? s("stage.steps.origin.practitioner", { name: childName }) : s("stage.steps.origin.parent")}
              </button>
            ))}
          </div>
          <div className="line" style={{ gap: 8, flexWrap: "wrap", alignItems: "stretch" }}>
            <select className="cp-sel ds-plans-select" value={ownSlot} data-plan-own-slot="" aria-label={s("stage.steps.origin")} onChange={(e) => setOwnSlot(Number(e.target.value) as 1 | 2 | 3)}>
              {([1, 2, 3] as const).map((n) => <option key={n} value={n}>{s("stage.steps.step", { n })}</option>)}
            </select>
            <textarea className="nx-in ds-plans-input ds-plans-textarea" rows={2} maxLength={240} value={ownText} data-plan-own-text="" dir="auto" aria-label={s("stage.steps.own")} onChange={(e) => setOwnText(e.target.value)} />
          </div>
          {refused && <p role="alert" className="cp-lede" style={{ color: "var(--ink)" }}>{s("stage.steps.ownRefused")}</p>}
          {crisis && (
            <div role="alert" className="stack ds-col" style={{ gap: 6 }} data-plan-own-crisis="">
              <p style={{ fontSize: 14, color: "var(--ink)" }}>{s("stage.steps.ownCrisis")}</p>
              {/* B-ASKJB-49: the helplines themselves, in the request's language
                  (the shared crisis card's lines; this alert carries the words). */}
              <UrgentSupport testId="plan-own-urgent-support" requestLang={lang} showInstructions={false} className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 t-sm" />
              {onSafety && <button type="button" className="btn ghost sm" style={{ background: "var(--card)", alignSelf: "flex-start" }} onClick={onSafety}><Icon name="health_and_safety" size={18} />{s("stage.steps.ownCrisisDoor")}</button>}
            </div>
          )}
          <div className="line" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="ds-plans-draft"><Icon name="edit" size={15} />{plansCopy(lang).draftLabel}</span>
            <button type="button" className="btn ghost sm" style={{ background: "var(--card)", marginInlineStart: "auto" }} disabled={phrasing || ownText.trim().length < 3} data-plan-own-phrase="" onClick={() => void phrase()}><Icon name="auto_awesome" size={18} />{phrasing ? s("stage.steps.ownPhrasing") : s("stage.steps.ownPhrase")}</button>
          </div>
        </section>
      )}
      <button type="button" className="btn primary block" style={{ minHeight: 52 }} disabled={problems > 0} data-plan-steps-next="" onClick={() => dispatch({ type: "stepsDone" })}>{s("stage.steps.next")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
      <p className="cp-lede">{c.notSaved}</p>
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
    <div className="ds-plans-preview" style={{ position: "relative", minHeight: 560, borderRadius: 18, overflow: "hidden" }} data-plan-preview="">
      <BookReader key={opening} book={book} lang={lang} child={child} onClose={() => setOpening((n) => n + 1)} narration="off" initialBox={{ width: 390, height: 560 }} />
    </div>
  );
}
