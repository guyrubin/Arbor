import React, { useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useComposition } from "../../design/useComposition";
import { DsRoot, Guide, Route, RouteHead, RouteSection, Row12, SideRail } from "../../design/primitives";
import { useFamilyPlan } from "../../hooks/useFamilyPlan";
import { track } from "../../lib/analytics";
import { defaultIcsEgressDeps, saveIcsFile } from "../../lib/careTrack";
import { familyPlanToIcs } from "../../lib/familyPlan/ics";
import type { FamilyPlanDate } from "../../lib/familyPlan/model";
import { Receipt } from "../ui/Receipt";
import { Icon } from "../ui/Icon";
import { familyPlanCopy } from "./familyPlanCopy";
import { PlanStage } from "./PlanStage";
import { ChangeTile, DateCards, MessageTile, RequestsTile, StandingTile } from "./PlanSections";
import { FoundSnap, HeldChangeCard, heldChangeOf } from "./PlanChange";
import { scrollToSection, Tile } from "../../design/primitives";
import { AddDateSheet, ReviewSheet } from "./ReviewSheet";
import { AskSheet } from "./AskSheet";
import { DateSheet } from "./DateSheet";
import "./familyPlan.css";

/**
 * Now › Family plan (route `family-plan`, new in v10.1).
 *
 * Who has what this week: the dates from the child's kindergarten or school
 * (kept from a reviewed message, or added by hand), one lane per adult in the
 * family, each date with an adult, asked with no answer yet, or nobody yet.
 * Sections (the same names and order on desk and phone): 1 Who has what,
 * 2 The dates, 3 What came in, 4 Where each thing stands. Every action is a
 * real write with one receipt and Undo; reminders are in the app only.
 */
export default function FamilyPlanView() {
  const { childProfile, setActiveTab } = useArbor();
  const { uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const c = familyPlanCopy[lang];
  const composition = useComposition();
  const desk = composition === "desk";
  const plan = useFamilyPlan(childProfile.id);
  const [sheet, setSheet] = useState<null | { at: "message" } | { at: "manual" } | { at: "date"; id: string } | { at: "ask"; id: string }>(null);
  const [calendar, setCalendar] = useState<null | "download" | "native_share" | "unavailable">(null);

  const byId = (id: string) => plan.all.find((d) => d.id === id) ?? null;
  const openDate = (id: string) => setSheet({ at: "date", id });
  const ask = (id: string) => setSheet({ at: "ask", id });
  const close = () => setSheet(null);

  const addToCalendar = async (items: FamilyPlanDate[]) => {
    const file = familyPlanToIcs(items.filter((d) => d.status === "open"), Date.now());
    if (!file) return;
    const channel = await saveIcsFile(file, defaultIcsEgressDeps());
    track("family_plan_calendar", { channel, count: items.length });
    setCalendar(channel);
  };

  const held = heldChangeOf(plan);
  // Desk (N-Plan-D) and phone (N-Plan-M) draw different sections; each guide names its own.
  const stops = desk
    ? [
        { id: "fp-who", title: c.stops.who, sub: c.guideSub.who },
        { id: "fp-dates", title: c.stops.dates, sub: c.guideSub.dates },
        { id: "fp-came", title: c.stops.cameIn, sub: c.guideSub.cameIn },
        { id: "fp-standing", title: c.stops.standing, sub: c.guideSub.standing },
      ]
    : [
        { id: "fp-who", title: c.stops.who },
        ...(held ? [{ id: "fp-change", title: c.stopsPhone.change }] : []),
        { id: "fp-found", title: c.stopsPhone.found },
        { id: "fp-alerts", title: c.stopsPhone.alerts },
      ];
  const common = { plan, lang, c, onOpen: openDate } as const;
  const hasChange = !!held || plan.dates.some((d) => d.previous && d.previous.length);
  const openItems = plan.dates.filter((d) => d.status === "open");

  const empty = plan.loaded && plan.dates.length === 0;
  // The screen's one "Add a school message": the stage's primary while the
  // plan is empty, then the first control of What came in's toolbar.
  const addMessage = (
    <button type="button" className={empty ? "btn primary" : "btn ghost sm"} style={empty ? { minHeight: 48 } : { background: "var(--tint-2)", boxShadow: "none", color: "var(--sapphire-deep)", minHeight: 44 }} onClick={() => setSheet({ at: "message" })} data-primary-move="family-plan-add-message">
      <Icon name="description" size={16} />{c.addMessage}
    </button>
  );
  const addDate = <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setSheet({ at: "manual" })}>{c.addDate}</button>;
  const datesBody = empty ? (
    <div className="fp-col" style={{ gap: 10, alignItems: "flex-start" }}>
      <p className="small">{c.datesEmpty}</p>
      {addDate}
    </div>
  ) : <DateCards {...common} />;
  const calendarButton = (
    <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={!openItems.length} onClick={() => void addToCalendar(openItems)}>
      <Icon name="download" size={16} />{c.addToCalendar}
    </button>
  );
  const calendarNote = calendar ? (
    <p role="status" className="small" style={{ fontWeight: 600 }}>
      {calendar === "unavailable" ? c.calendarUnavailable : calendar === "native_share" ? c.calendarShared : c.calendarSaved}
    </p>
  ) : null;
  // Desk "What came in" and phone "From the kindergarten's message" are one module in two compositions.
  const cameIn = (
    <div className={desk ? "g12" : undefined} data-module="family-plan-came-in">
      {desk ? (
        <>
          {!empty && (
            <div style={{ gridColumn: hasChange ? "span 4" : "span 6", display: "flex" }}>
              <MessageTile {...common} />
            </div>
          )}
          {hasChange && (
            <div id="fp-change" style={{ gridColumn: "span 4", display: "flex" }}>
              {held ? (
                <Tile icon="history" kind="date" title={c.whatChanged} titleId="fp-chg-h"><HeldChangeCard item={held} plan={plan} lang={lang} c={c} onAsk={ask} desk /></Tile>
              ) : <ChangeTile {...common} />}
            </div>
          )}
          <div style={{ gridColumn: hasChange ? "span 4" : "span 6", display: "flex" }}>
            <RequestsTile {...common} />
          </div>
        </>
      ) : <FoundSnap plan={plan} lang={lang} c={c} onOpen={openDate} />}
    </div>
  );
  const cameInActions = empty ? null : (
    <span className="line" style={{ gap: 8, marginInlineStart: desk ? "auto" : undefined, flexWrap: "wrap" }}>
      {addMessage}
      {addDate}
      {calendarButton}
    </span>
  );

  const receipt = plan.receipt ? (
    <div className="fp-receipt" key={plan.receipt.id}>
      <Receipt
        testId="family-plan-receipt"
        undo={plan.receipt.undo ? { label: c.undo, onUndo: () => void plan.receipt?.undo?.(), testId: "family-plan-undo", disabled: plan.busy } : null}
      >
        {c.receipt[plan.receipt.kind](plan.receipt.count)}
      </Receipt>
    </div>
  ) : null;

  return (
    <DsRoot composition={composition} className="fp" data-testid="family-plan">
      <Guide stops={stops} mini={!desk} label={c.guideLabel} />
      <Route composition={composition} tight={!desk}>
        <RouteSection id="fp-who" n={1} on>
          <div data-module="family-plan-who" className={desk ? "g12" : "fp-col"} style={desk ? undefined : { gap: 12 }}>
            <div className={desk ? "x8" : undefined} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PlanStage composition={composition} plan={plan} lang={lang} c={c} onOpen={openDate} onAsk={ask} emptyAction={empty ? addMessage : null} heldId={held?.id ?? null} onReviewChange={() => scrollToSection("fp-change")} />
            </div>
            {desk && (
              <SideRail id="fp-dates" n={2} title={c.datesTitle} sub={empty ? undefined : c.datesSub} titleId="fp-dates-h" className={empty ? "x4 fp-rail-empty" : "x4"}>
                {datesBody}
              </SideRail>
            )}
          </div>
        </RouteSection>

        {!desk && held && (
          <RouteSection id="fp-change" n={2}>
            <RouteHead title={c.changeHead} />
            <div data-module="family-plan-change"><HeldChangeCard item={held} plan={plan} lang={lang} c={c} onAsk={ask} /></div>
          </RouteSection>
        )}
        {!desk && (
          <RouteSection id="fp-found" n={held ? 3 : 2}>
            <RouteHead title={c.fromTheMessage} />
            {cameIn}
          </RouteSection>
        )}
        {!desk && (
          <RouteSection id="fp-alerts" n={held ? 4 : 3}>
            <RouteHead title={c.requestsReminders} />
            <div className="fp-col" style={{ gap: 12 }}>
              {/* N-Plan-M: the bell line and the actions in one card, no figures. */}
              <RequestsTile {...common} figures={false}>
                {calendarNote}
                <div className="fp-col" style={{ gap: 8, alignItems: "flex-start" }}>{empty ? addDate : <>{addMessage}{addDate}{calendarButton}</>}</div>
              </RequestsTile>
            </div>
          </RouteSection>
        )}
        {desk && (
          <>
        <RouteSection id="fp-came" n={3} stopTop={2}>
          <div className="rhead" style={{ alignItems: "center", flexWrap: "nowrap" }}>
            <h2 className="h3" style={{ whiteSpace: "nowrap" }}>{c.cameInTitle}</h2>
            {cameInActions}
          </div>
          {calendarNote}
          {cameIn}
        </RouteSection>

        <RouteSection id="fp-standing" n={4} stopTop={2}>
          <RouteHead title={c.standingTitle} />
          <div className="g12" data-module="family-plan-standing">
            <StandingTile {...common} composition={composition} />
          </div>
        </RouteSection>
          </>
        )}
      </Route>

      {plan.error && !sheet && (
        <p role="alert" className="fp-err">
          {c.saveError} <button type="button" className="ds-link" onClick={plan.clearError}>{c.retry}</button>
        </p>
      )}
      {receipt}

      <ReviewSheet open={sheet?.at === "message"} onClose={close} plan={plan} childName={childProfile.name} lang={lang} c={c} onSafety={() => setActiveTab("safety")} />
      <AddDateSheet open={sheet?.at === "manual"} onClose={close} plan={plan} lang={lang} c={c} />
      <DateSheet item={sheet?.at === "date" ? byId(sheet.id) : null} onClose={close} plan={plan} lang={lang} c={c} onAsk={ask} onCalendar={(items) => void addToCalendar(items)} />
      <AskSheet childName={childProfile.name} item={sheet?.at === "ask" ? byId(sheet.id) : null} onClose={close} plan={plan} lang={lang} c={c} onInvite={() => { close(); setActiveTab("sharing"); }} />
    </DsRoot>
  );
}
