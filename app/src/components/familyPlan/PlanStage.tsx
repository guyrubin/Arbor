import React from "react";
import type { Composition } from "../../design/useComposition";
import { Fig, LivingForm, NewTag, Scene, StartHere, Token, TokenLegend } from "../../design/primitives";
import { stateOf, type FamilyPlanDate, type FamilyPlanState } from "../../lib/familyPlan/model";
import type { FamilyPlanApi } from "../../hooks/useFamilyPlan";
import type { FamilyPlanCopy } from "./familyPlanCopy";
import { adultLabel, dayNum, dayShort, rangeLabel, weekdayShort, whenLabel, type Lang } from "./format";

const tokState = (s: FamilyPlanState) => (s === "has" ? "solid" : s === "asked" ? "open" : "none") as "solid" | "open" | "none";

function stateWords(item: FamilyPlanDate, s: FamilyPlanState, c: FamilyPlanCopy, meUid: string): string {
  if (s === "has") return item.holder?.uid === meUid ? c.stateHasYou : c.stateHas(adultLabel(item.holder, meUid, c));
  if (s === "asked" && item.request) return c.stateAsked(adultLabel({ uid: item.request.toUid, email: item.request.toEmail }, meUid, c));
  return c.stateNone;
}

export interface StageProps {
  composition: Composition;
  plan: FamilyPlanApi;
  lang: Lang;
  c: FamilyPlanCopy;
  onOpen: (id: string) => void;
  onAsk: (id: string) => void;
  /** The screen's one "Add a school message" (stamped by the route), shown here only while the plan is empty. */
  emptyAction: React.ReactNode;
}

/**
 * The week as a ribbon (canvas V77, desk and phone): seven day tiles, each
 * date's token standing on its day, a dotted line, then the later dates in
 * the plan window. A token is solid when an adult has the date and dashed
 * when nobody has it yet (an unanswered request is not cover); who has it is
 * in the token's name, the dates rail and the date sheet.
 */
function WeekRibbon({ plan, lang, c, onOpen, phone }: Pick<StageProps, "plan" | "lang" | "c" | "onOpen"> & { phone: boolean }) {
  const { window: w } = plan;
  const last = w.days[w.days.length - 1];
  const later = plan.dates.filter((d) => d.date > last);
  const laterDays = [...new Set(later.map((d) => d.date))];
  const token = (item: FamilyPlanDate) => {
    const s = stateOf(item);
    const words = stateWords(item, s, c, plan.me.uid);
    // Phone tiles are narrower than the 44 px floor: there the token is a
    // picture and each date opens from The dates list just below.
    if (phone) return <Token key={item.id} kind="date" state={tokState(s)} label={c.tokenLabel(item.title, `${whenLabel(item, lang)}, ${words}`)}>{dayNum(item.date)}</Token>;
    return (
      <button key={item.id} type="button" className="fp-tok" onClick={() => onOpen(item.id)} aria-label={c.tokenLabel(item.title, `${whenLabel(item, lang)}, ${words}`)}>
        <Token kind="date" state={tokState(s)} size="lg" label={c.tokenLabel(item.title, words)}>{dayNum(item.date)}</Token>
      </button>
    );
  };
  return (
    <div style={{ padding: phone ? "4px 12px 0" : "14px 28px 0" }}>
      <div className={`nx-rb${phone ? " m" : ""}`} role="group" aria-label={c.stops.who}>
        {w.days.map((d) => (
          <div key={d} className={`rbd${d === w.today ? " today" : ""}`} aria-current={d === w.today ? "date" : undefined}>
            <small>{weekdayShort(d, lang)}</small>
            <b>{dayNum(d)}</b>
            <span className="slot">{plan.dates.filter((x) => x.date === d).map(token)}</span>
          </div>
        ))}
        <span className="gap" aria-hidden="true" />
        <div className="rbd later">
          <small>{laterDays.length === 1 ? weekdayShort(laterDays[0], lang) : c.later}</small>
          <b>{laterDays.length === 1 ? dayNum(laterDays[0]) : "\u00a0"}</b>
          <span className="slot">{later.map(token)}</span>
        </div>
      </div>
    </div>
  );
}

export function PlanStage({ composition, plan, lang, c, onOpen, onAsk, emptyAction }: StageProps) {
  const desk = composition === "desk";
  const { counts, dates, window: w } = plan;
  const range = rangeLabel(w.days[0], w.days[w.days.length - 1], lang, c);
  const nobody = dates.filter((d) => stateOf(d) !== "has" && d.status === "open" && d.date >= w.today);
  const next = nobody[0] ?? null;
  const art = desk
    ? <LivingForm src="/visuals/parent/v2/area-family-960.webp" width={150} height={106.8} crop={{ w: 179.6, h: 179.6, x: -14.4, y: -44.7 }} style={{ gridRow: "span 2", marginInlineEnd: 8 }} />
    : <LivingForm src="/visuals/parent/v2/area-family-480.webp" width={92} height={65.8} crop={{ w: 108.2, h: 108.2, x: -7.9, y: -26.2 }} />;
  const orbs = desk
    ? [{ size: 420, left: -250, bottom: -280, opacity: 0.55 }, { size: 360, right: -170, top: -230, opacity: 0.8, b: true }]
    : [{ size: 240, left: -160, bottom: -160, opacity: 0.5 }, { size: 220, right: -120, top: -130, opacity: 0.75, b: true }];
  const empty = plan.loaded && dates.length === 0;
  const legend = (
    <TokenLegend
      items={[
        { token: <Token kind="date" size="sm" label={c.legendHas}>{dayNum(w.today)}</Token>, label: c.legendHas },
        { token: <Token kind="date" state="none" size="sm" label={c.legendNone}>{dayNum(w.today)}</Token>, label: c.legendNone },
      ]}
    />
  );
  return (
    <>
      <Scene field="plan" orbs={orbs} style={{ padding: 0, gap: 0, flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: desk ? "8px 20px" : "4px 8px", alignItems: "center", padding: desk ? "20px 28px 0" : "16px 16px 0" }}>
          <div className="fp-col" style={{ gap: desk ? 8 : 6 }}>
            <span className="gsec" style={{ flexWrap: "wrap", gap: 8 }}>
              <span className="kicker">{desk ? c.kicker(range) : range}</span>
              <NewTag>{c.isNew}</NewTag>
              <StartHere>{c.startHere}</StartHere>
            </span>
            <h1 className="hero" style={desk ? { fontSize: 36, lineHeight: 1.06 } : { fontSize: 26, lineHeight: 1.08 }}>{c.pageTitle}</h1>
          </div>
          {art}
          {!empty && (
            <div style={{ display: "flex", gap: desk ? 28 : 12, alignItems: "flex-end", flexWrap: "nowrap", whiteSpace: desk ? "nowrap" : undefined, gridColumn: desk ? undefined : "1 / -1", padding: desk ? 0 : "8px 0 12px" }}>
              <Fig size={desk ? "md" : "sm"} n={counts.dates} unit={c.figDates(counts.dates)} sub={desk && dates.length ? c.figRange(dayShort(dates[0].date, lang), dayShort(dates[dates.length - 1].date, lang)) : undefined} />
              {counts.withAdult > 0 && <Fig size={desk ? "md" : "sm"} n={counts.withAdult} unit={c.figWithAdult(counts.withAdult)} />}
              {counts.nobodyYet > 0 && <Fig size={desk ? "md" : "sm"} n={counts.nobodyYet} unit={c.figNobody} sub={desk && next ? dayShort(next.date, lang) : undefined} className="fp-fig-none" />}
            </div>
          )}
        </div>
        {empty ? (
          <div className="fp-empty">
            <p className="h3">{c.emptyTitle}</p>
            <p className="small" style={{ maxWidth: 520 }}>{c.emptyBody}</p>
            <div>{emptyAction}</div>
          </div>
        ) : !plan.loaded ? (
          <p role="status" className="small" style={{ padding: "12px 28px" }}>{c.loading}</p>
        ) : (
          <>
            <WeekRibbon plan={plan} lang={lang} c={c} onOpen={onOpen} phone={!desk} />
            <div className="line between" style={{ gap: 16, padding: desk ? "12px 28px 20px" : "10px 16px 0", flexWrap: "wrap" }}>
              {legend}
              {desk && next && <button type="button" className="btn primary sm" onClick={() => onAsk(next.id)} aria-label={`${c.whoTakes} ${c.tokenLabel(next.title, whenLabel(next, lang))}`}>{c.whoTakes}</button>}
            </div>
          </>
        )}
        {!desk && <div style={{ height: 16 }} />}
      </Scene>
      {!desk && !empty && next && (
        <button type="button" className="btn primary block" onClick={() => onAsk(next.id)} aria-label={`${c.whoTakes} ${c.tokenLabel(next.title, whenLabel(next, lang))}`}>{c.whoTakes}</button>
      )}
    </>
  );
}
