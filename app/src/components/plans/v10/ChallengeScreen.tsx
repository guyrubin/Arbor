import React, { useMemo, useState } from "react";
import { Icon } from "../../ui/Icon";
import { Fig, Guide, Route, RouteHead, RouteSection, Scene, SideRail, Snap, SnapDots, StartHere, Tile, TokenLegend, type GuideStop } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { planString } from "../../../lib/plans/planStrings";
import { daysBetween, dayKey } from "../../../lib/programs/enrolment";
import { activePlans, nightRecorded, nightsCount, tonightStepForChild, tonightStepForParent, type ActivePlan } from "../../../lib/plans/planWeek";
import { planBookFromDoc } from "../../../lib/library/plans/planBookDoc";
import type { PatternDef } from "../../../lib/library/plans/patterns";
import type { HeGender, PatternId } from "../../../lib/library/types";
import { ChallengeBook } from "./ChallengeBook";
import { mirrorPoints, Road, zigzagPoints } from "./Road";
import { plansCopy } from "./plansCopy";

/**
 * Challenge Plans, homed under Now › Plans (Guy, 16 Nov). One page per running
 * plan (N-Challenge): the stage (the book's typographic cover, its title, the
 * night count and the journey road: recognise → agree → preview → try →
 * reflect), "Today" (tonight's step as the parent does it beside the child's
 * own line from the book, and the night question), the plan on one page (the
 * three approved steps and the box, the nights a parent confirmed, the
 * sources), then every pattern this family may start.
 *
 * Restyle only (B-GA-37): pattern wording, steps and safety copy come from the
 * pattern registry unchanged. FIREWALL: counts of nights a parent confirmed;
 * a night with no answer is unknown (dashed), never a miss; the child never
 * sees this surface.
 */

export interface ChallengeScreenProps {
  lang: "en" | "he";
  composition: Composition;
  childName: string;
  gender: HeGender;
  planRows: readonly unknown[];
  /** Patterns this family may compose (server table), in authored order. */
  composable: PatternDef[];
  now: Date;
  /** The plan asked for (`?challenge=<id>`); null = the list (and the newest running plan). */
  focus: PatternId | null;
  onFocus: (pattern: PatternId) => void;
  onStart: (def: PatternDef) => void;
  onOpenBook: (plan: ActivePlan) => void;
  onChange: (plan: ActivePlan) => void;
  onPrint: (plan: ActivePlan) => void;
  onKeep: (plan: ActivePlan) => void;
  onClose: (plan: ActivePlan) => void;
  onNight: (plan: ActivePlan) => void;
  onUndoNight: (plan: ActivePlan) => void;
  onJournal: (plan: ActivePlan) => void;
}

const fmt = (lang: "en" | "he", d: Date, opts: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", opts).format(d);
  } catch {
    return d.toDateString();
  }
};
const dayDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
};

/** "Night 9 of 14" as a figure: the number big, the words around it (one template). */
function NightFig({ lang, night, total, sub, size }: { lang: "en" | "he"; night: number; total: number; sub?: string; size: "md" | "sm" }) {
  const [before, after = ""] = planString("card.night", lang, { n: "\u0000", total }).split("\u0000");
  return (
    <div className={`fig ${size}`}>
      <span style={{ alignSelf: "center", fontSize: size === "md" ? 14 : 13, fontWeight: 600 }}>{before.trim()}</span>
      <b>{night}</b>
      <span>
        {after.trim()}
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}

/** The journey road: five stops, the ones behind filled, the current one ringed. */
function Journey({ plan, lang, composition }: { plan: ActivePlan; lang: "en" | "he"; composition: Composition }) {
  const c = plansCopy(lang);
  const desk = composition === "desk";
  const approved = new Date(plan.doc.approvedAt);
  const reflectFrom = new Date(approved.getTime() + plan.doc.durationDays * 86_400_000);
  const short = { weekday: "short", day: "numeric", month: "short" } as const;
  const current = plan.review ? 4 : 3;
  const names = desk ? c.stops : c.stopsShort;
  const stops = [
    { name: names.recognise, sub: fmt(lang, new Date(plan.doc.createdAt || plan.doc.approvedAt), short) },
    { name: names.agree, sub: c.threeSteps },
    { name: names.preview, sub: c.approvedShort },
    { name: names.try, sub: c.tonightLower },
    { name: names.reflect, sub: c.from(fmt(lang, reflectFrom, short)) },
  ];
  const pts = mirrorPoints(zigzagPoints(5, { low: desk ? 80 : 76, high: desk ? 20 : 24 }), lang === "he");
  return (
    <div className="gfx cp-jr" style={{ marginBottom: 44 }} role="img" aria-label={`${c.journey}: ${stops.map((s) => s.name).join(", ")}. ${stops[current].name}.`}>
      <Road points={pts} width={640} height={84} strokeWidth={desk ? 22 : 18} stretches={[0, 3]} />
      {stops.map((s, i) => (
        <React.Fragment key={i}>
          <i className={`at tok plan${i === current ? " here" : i > current ? " open" : ""}${desk ? " lg" : " md"}`} style={{ left: `${pts[i].x}%`, top: `${pts[i].y}%` }} aria-hidden="true" />
          <span className={`jl${i === current ? " cur" : ""}`} style={{ left: `${pts[i].x}%`, top: "calc(100% + 8px)", fontSize: desk ? 13 : 12 }} aria-hidden="true">
            {desk && <span style={{ fontVariantNumeric: "lining-nums" }}>{i + 1} · </span>}
            {s.name}
            {desk && <small>{s.sub}</small>}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/** The nights since approval, as tokens: confirmed (solid), tonight (ringed), no answer (dashed). */
function NightsStrip({ plan, lang, now }: { plan: ActivePlan; lang: "en" | "he"; now: Date }) {
  const c = plansCopy(lang);
  const today = dayKey(now);
  const start = dayKey(new Date(plan.doc.approvedAt));
  const span = Math.min(14, Math.max(1, daysBetween(start, today) + 1));
  const nights = new Set(plan.doc.nights ?? []);
  const days = Array.from({ length: span }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (span - 1 - i), 12);
    return dayKey(d);
  });
  const label = days
    .map((k) => {
      const d = dayDate(k);
      const name = fmt(lang, d, { weekday: "short", day: "numeric" });
      return `${name} ${nights.has(k) ? planString("today.night.yes", lang) : k === today ? c.tonightMark : c.noAnswer}`;
    })
    .join(", ");
  return (
    <div className="cp-nights" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} role="img" aria-label={c.nightsLabel(label)}>
      {days.map((k) => {
        const d = dayDate(k);
        const yes = nights.has(k);
        const isToday = k === today;
        return (
          <span key={k} className={isToday ? "t" : yes ? "y" : "u"}>
            {fmt(lang, d, { weekday: "short" })}
            <b>{d.getDate()}</b>
            <i className={`tok plan md${yes ? "" : isToday ? " here" : " none"}`} aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
}

export function ChallengeScreen(p: ChallengeScreenProps) {
  const { lang, composition, childName } = p;
  const c = plansCopy(lang);
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const desk = composition === "desk";
  const running = useMemo(() => activePlans(p.planRows, p.now), [p.planRows, p.now]);
  const plan = (p.focus ? running.find((r) => r.def.id === p.focus) : running[0]) ?? null;
  const runningIds = new Set(running.map((r) => r.def.id));
  const listed = [...running.map((r) => r.def), ...p.composable.filter((d) => !runningIds.has(d.id))];
  const [notTonight, setNotTonight] = useState(false);
  const [journaled, setJournaled] = useState(false);

  const stops: GuideStop[] = plan
    ? [
        { id: "cp-stage", title: c.childPlan(childName), sub: c.bookReady },
        { id: "cp-today", title: c.today, sub: c.todayGuideSub },
        { id: "cp-page", title: c.onePageShort, sub: c.onePageSub },
        { id: "cp-all", title: c.allShort(listed.length), sub: c.pickAnother },
      ]
    : [{ id: "cp-all", title: c.allShort(listed.length), sub: s("section.hard") }];

  const book = plan ? planBookFromDoc(plan.doc) : null;
  const title = plan ? plan.def.title[lang] : "";
  const recorded = plan ? nightRecorded(plan.doc, p.now) : false;
  const parentStep = plan ? tonightStepForParent(plan.doc, lang) : null;
  const childLine = plan ? tonightStepForChild(plan.doc, lang, p.gender) : null;
  const total = plan?.doc.durationDays ?? 0;
  const night = plan ? Math.min(plan.day, total) : 0;

  const actions = plan && (
    <div className="cp-act" style={{ padding: desk ? "14px 28px 24px" : 0, marginTop: desk ? "auto" : undefined, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      {/* Once-only: tonight's step lives in Today (the rail) and the three steps; here only the book. */}
      {desk && <span style={{ flexBasis: "100%", fontSize: 14, color: "var(--ink)" }} dir="auto"><b style={{ fontWeight: 600 }}>{c.tonightAt}</b> {c.tonightRead(childName)}</span>}
      {plan.review && desk && <button type="button" className="btn primary" style={{ minWidth: 160 }} data-plan-keep="" onClick={() => p.onKeep(plan)}>{s("review.keep")}</button>}
      {desk && (
        <button type="button" className={plan.review ? "btn ghost" : "btn primary"} style={plan.review ? { background: "var(--card)" } : { minWidth: 160 }} data-plan-open="" onClick={() => p.onOpenBook(plan)}>
          <Icon name="menu_book" size={18} />
          {s("card.open")}
        </button>
      )}
      <button type="button" className={`btn ghost${desk ? "" : " sm"}`} style={{ background: "var(--card)" }} data-plan-print="" onClick={() => p.onPrint(plan)}>
        <Icon name="description" size={15} />
        {s("section.print")}
      </button>
      <button type="button" className={`btn ghost${desk ? "" : " sm"}`} style={{ background: "var(--card)" }} data-plan-change="" onClick={() => p.onChange(plan)}>{s("review.change")}</button>
      <button type="button" className={`btn text${desk ? "" : " sm"}`} data-plan-close="" onClick={() => p.onClose(plan)}>{s("review.close")}</button>
    </div>
  );

  const nightQuestion = plan && (
    <div className="stack ds-col" style={{ gap: 10 }} data-plan-night="">
      {!recorded && !notTonight && (
        <>
          <b style={{ fontSize: 14, fontWeight: 600 }}>{s("today.night.q")}</b>
          <div className="cp-yn" role="group" aria-label={s("today.night.q")}>
            <button type="button" data-plan-night-yes="" onClick={() => p.onNight(plan)}>{s("today.night.yes")}</button>
            <button type="button" data-plan-night-no="" onClick={() => setNotTonight(true)}>{s("today.night.no")}</button>
          </div>
          <span className="small">{c.oneTap}</span>
        </>
      )}
      {recorded && (
        <div className="line" style={{ gap: 8, flexWrap: "wrap" }} data-plan-night-done="">
          <p role="status" style={{ fontSize: 14, color: "var(--ink)" }}>{s("today.night.done")}</p>
          <button type="button" className="btn text sm" data-plan-night-undo="" onClick={() => p.onUndoNight(plan)}>{s("today.night.undo")}</button>
          {journaled ? (
            <p role="status" className="small">{s("today.night.journaled")}</p>
          ) : (
            <button type="button" className="btn ghost sm" style={{ background: "var(--card)" }} data-plan-night-journal="" onClick={() => { setJournaled(true); p.onJournal(plan); }}>
              <Icon name="edit_note" size={15} />
              {s("today.night.journal")}
            </button>
          )}
        </div>
      )}
      {!recorded && notTonight && <p role="status" className="small">{s("today.night.no")}</p>}
    </div>
  );

  const stage = plan && (
    <Scene
      field="plan"
      style={{ padding: 0, gap: 0, flex: desk ? 1 : undefined }}
      orbs={desk ? [{ size: 440, left: -250, bottom: -280, opacity: 0.6 }, { size: 380, right: -180, top: -250, opacity: 0.8, b: true }] : [{ size: 240, left: -150, bottom: -150, opacity: 0.55 }, { size: 220, right: -120, top: -130, opacity: 0.75, b: true }]}
      data-plan-running={plan.def.id}
    >
      <div className="line between" style={{ padding: desk ? "24px 28px 0" : "16px 16px 0", alignItems: "flex-start" }}>
        <span className="gsec">
          <span className="kicker">{c.challengePlan}</span>
          <StartHere>{c.today}</StartHere>
        </span>
        {desk && <NightFig lang={lang} night={night} total={total} size="md" />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: desk ? 22 : 14, alignItems: "center", padding: desk ? "6px 28px 0" : "10px 16px 0" }}>
        <ChallengeBook title={title} nameLine={plan.def.coverNameLine[lang].replace("{name}", childName)} size={desk ? "lg" : undefined} width={desk ? 132 : 92} label={c.book(title)} />
        <div className="stack ds-col" style={{ gap: desk ? 8 : 6 }}>
          <h1 className="hero" dir="auto" style={{ fontSize: desk ? 34 : 22, lineHeight: 1.08 }}>{plan.review ? s("review.title") : title}</h1>
          {plan.review && <p data-plan-review="" className="cp-lede">{s("review.body", { count: nightsCount(plan.doc) })}</p>}
          {plan.review ? null : desk ? (
            <p style={{ fontSize: 14, lineHeight: 1.42, color: "var(--ink-soft)", maxWidth: 470 }} dir="auto">{c.stageLede(childName, plan.doc.durationDays)}</p>
          ) : (
            <NightFig lang={lang} night={night} total={total} size="sm" />
          )}
        </div>
      </div>
      <div style={{ padding: desk ? "26px 44px 0" : "22px 36px 6px" }}>
        <Journey plan={plan} lang={lang} composition={composition} />
      </div>
      {desk && actions}
    </Scene>
  );

  const todayCards = plan && (
    <>
      <div className="nx-co" style={{ gridTemplateColumns: "minmax(0, 1fr)", gap: 10, alignItems: "start", flex: desk ? 1.6 : undefined }}>
        <div className="line between" style={{ gap: 8, flexWrap: "wrap" }}>
          <b style={{ fontSize: 14, fontWeight: 600 }}>{s(`time.${plan.doc.time}` as Parameters<typeof planString>[0])}</b>
          <span className="cp-st2 ok"><Icon name="check" size={15} />{c.approvedByYou}</span>
        </div>
        {parentStep && (
          <div className="cp-st">
            <span className="cp-n"><b>1</b><Icon name="group" size={18} /></span>
            <div className="cp-pl" dir="auto"><small>{c.youDo}</small>{parentStep}</div>
          </div>
        )}
        {childLine && (
          <div className="cp-kid" dir="auto"><small>{c.inTheBook(childName)}</small>{childLine}</div>
        )}
      </div>
      <div className="nx-co" style={{ gridTemplateColumns: "minmax(0, 1fr)", gap: 10, alignItems: "start" }}>{nightQuestion}</div>
    </>
  );

  const stepsTile = plan && book && (
    <Tile className={desk ? "x4" : undefined} icon="checklist" kind="plan" title={c.theSteps} titleId="cp-steps" link={<button type="button" className="ds-link" onClick={() => p.onChange(plan)}>{s("review.change")}</button>}>
      <ol className="stack ds-col" style={{ gap: 14, margin: 0, padding: 0, listStyle: "none" }} data-plan-steps="">
        {book.parent.planSteps.map((line, i) => (
          <li key={i} className="cp-st">
            <span className="cp-n"><b>{i + 1}</b><Icon name="check" size={18} /></span>
            <div className="cp-pl" dir="auto">{line[lang]}</div>
          </li>
        ))}
      </ol>
      {book.box && book.box.length > 0 && (
        <p className="line1" dir="auto"><b>{c.theBox}</b> {book.box.map((b) => b.label[lang]).join(" · ")}</p>
      )}
    </Tile>
  );

  const nightsTile = plan && (
    <Tile className={desk ? "x4" : undefined} icon="nightlight" kind="plan" title={c.tried} titleId="cp-nights">
      <Fig n={nightsCount(plan.doc)} unit={c.nightsUnit} size="md" />
      <NightsStrip plan={plan} lang={lang} now={p.now} />
      <TokenLegend
        items={[
          { token: <i className="tok plan sm" aria-hidden="true" />, label: s("today.night.yes") },
          { token: <i className="tok plan none sm" aria-hidden="true" />, label: c.noAnswer },
        ]}
      />
    </Tile>
  );

  const sourcesTile = plan && (
    <Tile className={desk ? "x4" : undefined} icon="menu_book" title={c.whereFrom} titleId="cp-sources">
      <ul className="stack ds-col" style={{ gap: 8, margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.35 }} data-plan-sources="">
        {plan.def.sources.map((src) => (
          <li key={src.id} dir="auto">
            {src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 2 }}>{src.label[lang]}</a> : src.label[lang]}
          </li>
        ))}
      </ul>
    </Tile>
  );

  const card = (d: PatternDef) => {
    const r = running.find((x) => x.def.id === d.id);
    const bookTitle = d.title[lang];
    const onClick = () => (r ? p.onFocus(d.id) : p.onStart(d));
    if (!desk) {
      return (
        <button key={d.id} type="button" className={`cp-row${r ? " run" : ""}`} onClick={onClick} data-plan-door={d.id} aria-current={r && plan?.def.id === d.id ? "true" : undefined}>
          <i className="ci" aria-hidden="true"><Icon name="auto_stories" size={18} /></i>
          <span>
            <b dir="auto">{bookTitle}</b>
            <small dir="auto">{d.parentWords[lang]}</small>
          </span>
          <span className="rs">{r ? (plan?.def.id === d.id ? c.runningAbove : c.runningNight(Math.min(r.day, r.doc.durationDays), r.doc.durationDays)) : s("chooser.age", { age: d.ageText })}</span>
        </button>
      );
    }
    return (
      <div key={d.id} style={{ gridColumn: "span 3", display: "flex" }}>
        <button type="button" style={{ flex: 1 }} className={`cp-cat${r ? " run" : ""}`} onClick={onClick} data-plan-door={d.id} aria-current={r && plan?.def.id === d.id ? "true" : undefined}>
          <div className="cb" style={{ alignItems: "center" }}>
            <ChallengeBook title={bookTitle} size="sm" width={54} label={c.book(bookTitle)} />
            <div className="stack ds-col" style={{ gap: 3 }}>
              <h3 className="ds-plans-cat" dir="auto" data-plan-door-title="">{bookTitle}</h3>
              <p dir="auto">{d.parentWords[lang]}</p>
            </div>
          </div>
          <div className="cf2" style={{ flexWrap: "nowrap" }}>
            {r ? <span className="run">{plan?.def.id === d.id ? c.runningOpenAbove : c.runningNight(Math.min(r.day, r.doc.durationDays), r.doc.durationDays)}</span> : <span data-plan-door-age="">{s("chooser.age", { age: d.ageText })}</span>}
            {!r && <span>{c.days(d.defaultDurationDays)}</span>}
            <span style={{ marginInlineStart: "auto", background: "none", padding: 0, color: "var(--sapphire-deep)" }}>{r ? s("card.open") : c.startThis}</span>
          </div>
        </button>
      </div>
    );
  };

  const all = listed.length > 0 && (
    <>
      {/* With no plan running there is no stage, so the list's title is the screen's one h1. */}
      <RouteHead level={plan ? 2 : 1} title={s("section.hard")} sub={desk ? c.allSub(listed.length, childName) : undefined} />
      {!plan && <p className="small" style={{ marginBottom: 8 }}>{c.noRunning}</p>}
      {desk ? (
        <div className="g12" data-plans-chooser="">{listed.map(card)}</div>
      ) : (
        <section className="vt" style={{ padding: 16, borderRadius: 18, gap: 0 }} data-plans-chooser="">{listed.map(card)}</section>
      )}
    </>
  );

  return (
    <>
      {stops.length > 1 && <Guide stops={stops} label={c.onThisPage} mini={!desk} />}
      <Route composition={composition} tight={!desk}>
        {plan && desk && (
          <RouteSection id="cp-stage" n={1} on>
            <div className="g12" data-module="plans-challenge">
              <div className="x8" style={{ display: "flex", flexDirection: "column" }}>{stage}</div>
              <SideRail id="cp-today" n={2} title={c.today} sub={c.todaySub(childName)} titleId="cp-today-title" className="x4">{todayCards}</SideRail>
            </div>
          </RouteSection>
        )}
        {plan && !desk && (
          <>
            <RouteSection id="cp-stage" n={1} on>
              <div className="stack ds-col" style={{ gap: 12 }} data-module="plans-challenge">
                {stage}
                {plan.review ? (
                  <button type="button" className="btn primary block" style={{ minHeight: 52 }} data-plan-keep="" onClick={() => p.onKeep(plan)}>{s("review.keep")}</button>
                ) : null}
                <button type="button" className={plan.review ? "btn ghost block" : "btn primary block"} style={plan.review ? { minHeight: 48, background: "var(--card)" } : { minHeight: 52 }} data-plan-open="" onClick={() => p.onOpenBook(plan)}>
                  <Icon name="menu_book" size={18} />
                  {s("card.open")}
                </button>
                {actions}
              </div>
            </RouteSection>
            <RouteSection id="cp-today" n={2}>
              <RouteHead title={c.today} sub={c.todaySub(childName)} />
              <div className="stack ds-col" style={{ gap: 10 }}>{todayCards}</div>
            </RouteSection>
          </>
        )}
        {plan && (
          <RouteSection id="cp-page" n={3} stopTop={2}>
            <RouteHead title={c.onePage} sub={desk ? c.onePageSub : undefined} />
            {desk ? (
              <div className="g12" data-module="plans-challenge-page">{stepsTile}{nightsTile}{sourcesTile}</div>
            ) : (
              <div data-module="plans-challenge-page" className="stack ds-col" style={{ gap: 10 }}>
                <Snap label={c.onePage}>{stepsTile}{nightsTile}{sourcesTile}</Snap>
                <SnapDots count={3} caption={c.theSteps} />
              </div>
            )}
          </RouteSection>
        )}
        {all && (
          <RouteSection id="cp-all" n={plan ? 4 : 1} on={!plan} stopTop={2}>
            <div data-module="plans-challenge-all" className="stack ds-col" style={{ gap: 12 }}>{all}</div>
          </RouteSection>
        )}
      </Route>
    </>
  );
}
