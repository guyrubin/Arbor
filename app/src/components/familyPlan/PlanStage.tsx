import React from "react";
import type { Composition } from "../../design/useComposition";
import { Fig, LivingForm, NewTag, Scene, StartHere, Token, TokenLegend } from "../../design/primitives";
import { stateOf, type FamilyPlanDate, type FamilyPlanState } from "../../lib/familyPlan/model";
import type { Lane } from "../../lib/familyPlan/week";
import type { FamilyPlanApi } from "../../hooks/useFamilyPlan";
import type { FamilyPlanCopy } from "./familyPlanCopy";
import { adultInitial, adultLabel, dayNum, dayShort, rangeLabel, weekdayShort, whenLabel, type Lang } from "./format";

const tokState = (s: FamilyPlanState) => (s === "has" ? "solid" : s === "asked" ? "open" : "none") as "solid" | "open" | "none";

function stateWords(item: FamilyPlanDate, s: FamilyPlanState, c: FamilyPlanCopy, meUid: string): string {
  if (s === "has") return item.holder?.uid === meUid ? c.stateHasYou : c.stateHas(adultLabel(item.holder, meUid, c));
  if (s === "asked" && item.request) return c.stateAsked(adultLabel({ uid: item.request.toUid, email: item.request.toEmail }, meUid, c));
  return c.stateNone;
}

function laneName(lane: Lane, c: FamilyPlanCopy, meUid: string) {
  return lane.adult ? adultLabel(lane.adult, meUid, c) : c.nobodyYet;
}

function laneSub(lane: Lane, c: FamilyPlanCopy) {
  const n = lane.dates.length;
  const asked = lane.adult && lane.dates.some((d) => d.state === "asked");
  return `${c.laneDates(n)}${asked ? `, ${c.laneAsked}` : ""}`;
}

function LaneAvatar({ lane, name }: { lane: Lane; name: string }) {
  // The reader's own lane says "You"; its initial is the one their account shows.
  if (lane.adult && lane.adult.role === "owner" && lane.adult.email) name = lane.adult.email;
  if (!lane.adult) return <span className="av sm" aria-hidden="true" style={{ background: "var(--card)", boxShadow: "inset 0 0 0 1.5px var(--rule-strong)", color: "var(--ink-soft)" }}>?</span>;
  return <span className={`av sm${lane.adult.role === "co_parent" ? " b" : ""}`} aria-hidden="true">{adultInitial(name)}</span>;
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

/** Desk: the ribbon of seven days with one lane per adult (and nobody yet), then a "later" column. */
function Ribbon({ plan, lang, c, onOpen }: Pick<StageProps, "plan" | "lang" | "c" | "onOpen">) {
  const { window: w, lanes } = plan;
  const later = plan.dates.filter((d) => d.date > w.days[w.days.length - 1]);
  const laterLabel = later.length ? `${weekdayShort(later[0].date, lang)}` : c.later;
  const cols = `128px repeat(7, minmax(0, 1fr)) minmax(0, 1.25fr)`;
  return (
    <div className="fp-ribbon-scroll" style={{ padding: "14px 28px 0" }}>
      <div className="hasw" style={{ gridTemplateColumns: cols, minWidth: 640 }} role="table" aria-label={c.stops.who}>
        <div role="row" style={{ display: "contents" }}>
          <span role="columnheader" />
          {w.days.map((d) => (
            <span key={d} role="columnheader" className={`dh${d === w.today ? " today" : ""}`}>{weekdayShort(d, lang)}<b>{dayNum(d)}</b></span>
          ))}
          <span role="columnheader" className="dh" style={{ borderInlineStart: "2px dotted var(--rule-strong)" }}>{later.length > 1 ? c.later : laterLabel}<b>{later.length ? dayNum(later[0].date) : ""}</b></span>
        </div>
        {lanes.map((lane) => {
          const name = laneName(lane, c, plan.me.uid);
          return (
            <div role="row" key={lane.key} style={{ display: "contents" }}>
              <span role="rowheader" className={`hl${lane.adult ? "" : " nobody"}`}>
                <LaneAvatar lane={lane} name={name} />
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><bdi>{name}</bdi><small style={{ display: "block", fontWeight: 400, fontSize: 12, color: "var(--ink-soft)" }}>{laneSub(lane, c)}</small></span>
              </span>
              {w.days.map((d) => (
                <span role="cell" key={d} className={`lc${d === w.today ? " today" : ""}`}>
                  {lane.dates.filter((x) => x.item.date === d).map(({ item, state }) => (
                    <button key={item.id} type="button" className="fp-tok" onClick={() => onOpen(item.id)} aria-label={c.tokenLabel(item.title, stateWords(item, state === "none" ? stateOf(item) : state, c, plan.me.uid))}>
                      <Token kind="date" state={tokState(state)} size="lg" label={c.tokenLabel(item.title, whenLabel(item, lang))}>{dayNum(item.date)}</Token>
                      <span dir="auto">{item.title.length > 22 ? `${item.title.slice(0, 21)}…` : item.title}</span>
                    </button>
                  ))}
                </span>
              ))}
              <span role="cell" className="lc gap">
                {lane.dates.filter((x) => x.item.date > w.days[w.days.length - 1]).map(({ item, state }) => (
                  <button key={item.id} type="button" className="fp-tok" onClick={() => onOpen(item.id)} aria-label={c.tokenLabel(item.title, `${whenLabel(item, lang)}, ${stateWords(item, stateOf(item), c, plan.me.uid)}`)}>
                    <Token kind="date" state={tokState(state)} size="lg" label={c.tokenLabel(item.title, whenLabel(item, lang))}>{dayNum(item.date)}</Token>
                    <span dir="auto">{item.title.length > 22 ? `${item.title.slice(0, 21)}…` : item.title}</span>
                  </button>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Phone: one row per adult, their dates listed in the lane. */
function PhoneLanes({ plan, lang, c, onOpen }: Pick<StageProps, "plan" | "lang" | "c" | "onOpen">) {
  return (
    <div className="fp-col" style={{ gap: 8, padding: "0 12px" }}>
      {plan.lanes.filter((l) => l.dates.length || l.adult?.uid === plan.me.uid || !l.adult).map((lane) => {
        const name = laneName(lane, c, plan.me.uid);
        return (
          <div key={lane.key} className={`nx-lane${lane.adult ? "" : " nobody"}`}>
            <span className="nx-who"><LaneAvatar lane={lane} name={name} /><bdi>{name}</bdi></span>
            <div className="fp-col" style={{ gap: 4 }}>
              {lane.dates.length === 0 && <span className="small">{c.laneDates(0)}</span>}
              {lane.dates.map(({ item, state }) => (
                <button key={item.id} type="button" className="it" onClick={() => onOpen(item.id)}>
                  <Token kind="date" state={tokState(state)} label={c.tokenLabel(item.title, stateWords(item, stateOf(item), c, plan.me.uid))}>{dayNum(item.date)}</Token>
                  <span><b dir="auto">{item.title}</b>{state === "asked" ? `${whenLabel(item, lang)} · ${c.noAnswer}` : whenLabel(item, lang)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
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
        { token: <Token kind="date" state="open" size="sm" label={c.legendAsked}>{dayNum(w.today)}</Token>, label: c.legendAsked },
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
            <div style={{ display: "flex", gap: desk ? 28 : 16, alignItems: "flex-end", flexWrap: desk ? "nowrap" : "wrap", whiteSpace: desk ? "nowrap" : undefined, gridColumn: desk ? undefined : "1 / -1", padding: desk ? 0 : "8px 0 12px" }}>
              <Fig size={desk ? "md" : "sm"} n={counts.dates} unit={c.figDates(counts.dates)} sub={desk && dates.length ? c.figRange(dayShort(dates[0].date, lang), dayShort(dates[dates.length - 1].date, lang)) : undefined} />
              {counts.withAdult > 0 && <Fig size={desk ? "md" : "sm"} n={counts.withAdult} unit={c.figWithAdult(counts.withAdult)} />}
              {counts.nobodyYet > 0 && <Fig size={desk ? "md" : "sm"} n={counts.nobodyYet} unit={c.figNobody} sub={desk && next ? whenLabel(next, lang) : undefined} className="fp-fig-none" />}
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
            {desk ? <Ribbon plan={plan} lang={lang} c={c} onOpen={onOpen} /> : <PhoneLanes plan={plan} lang={lang} c={c} onOpen={onOpen} />}
            <div style={{ padding: desk ? "12px 28px 0" : "10px 16px 0" }}>{legend}</div>
          </>
        )}
        {desk && !empty && plan.loaded && (
          <div className="fp-next">
            {next ? (
              <>
                <span className="t"><span className="small">{c.nextLabel}</span><bdi>{stateOf(next) === "asked" && next.request ? c.nextAsked(next.title, adultLabel({ uid: next.request.toUid, email: next.request.toEmail }, plan.me.uid, c)) : c.nextNobody(next.title, whenLabel(next, lang))}</bdi></span>
                <button type="button" className="btn primary sm" onClick={() => onAsk(next.id)}>{c.whoTakes}</button>
                <button type="button" className="btn ghost sm" style={{ background: "var(--card)" }} onClick={() => onOpen(next.id)}>{c.openDate}</button>
              </>
            ) : (
              <>
                <span className="t">{c.nextAllCovered}</span>
                <span />
                <span />
              </>
            )}
          </div>
        )}
        {!desk && <div style={{ height: 16 }} />}
      </Scene>
      {!desk && !empty && next && (
          <div className="fp-next" style={{ margin: 0 }}>
            <span className="t"><span className="small">{c.nextLabel}</span><bdi>{stateOf(next) === "asked" && next.request ? c.nextAsked(next.title, adultLabel({ uid: next.request.toUid, email: next.request.toEmail }, plan.me.uid, c)) : c.nextNobody(next.title, whenLabel(next, lang))}</bdi></span>
            <button type="button" className="btn primary block" style={{ minHeight: 52 }} onClick={() => onAsk(next.id)}>{c.whoTakes}</button>
          </div>
      )}
    </>
  );
}
