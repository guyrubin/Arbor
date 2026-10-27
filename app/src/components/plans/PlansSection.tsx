/**
 * PlansSection — B-BOOK-77/78: "Everyday plans" on the parent's journal grid
 * (and, scoped to one shelf, on a shelf page). Two modules: the plans running
 * now (each with its COUNT of confirmed nights and the days to go; past the
 * duration, the keep / change / close choice) and the doors (one per pattern
 * this viewer may compose, in the parent's own words). A pattern the server
 * has not opened for this family is not a door (B-KID-167: dark); a pattern
 * already running has no door.
 *
 * FIREWALL: counts only (never a rate, a streak, a percentage or a verdict);
 * no age statement; the child never sees this surface.
 */
import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { SectionHead } from "../ui/SectionHead";
import { useLanguage } from "../../context/LanguageContext";
import { authoredPatterns } from "../../lib/library/plans/planBooks";
import type { PatternDef } from "../../lib/library/plans/patterns";
import { activePlans, nightsCount, patternsOnShelf, planShelf, type ActivePlan } from "../../lib/plans/planWeek";
import { planString } from "../../lib/plans/planStrings";
import type { PlanVisibility } from "../../lib/plans/planApi";
import type { PatternId } from "../../lib/library/types";
import type { ShelfId } from "../../lib/shelves/registry";

const CARD: React.CSSProperties = { background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-lg)", boxShadow: "var(--arbor-shadow-card)" };
const QUIET: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };
const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 t-sm font-semibold focus:outline-none focus-visible:ring-2";

export interface PlansSectionProps {
  childName: string;
  /** The child's `books` rows. */
  planRows: readonly unknown[];
  /** The server's table; null while unknown (no door renders). */
  visibility: PlanVisibility | null;
  now: Date;
  /** Only the patterns whose door sits on this shelf (a shelf page); absent = every pattern (the grid). */
  shelf?: ShelfId;
  onOpenDoor: (pattern: PatternId) => void;
  onOpenPlan: (plan: ActivePlan) => void;
  onKeep: (plan: ActivePlan) => void;
  onChange: (plan: ActivePlan) => void;
  onClose: (plan: ActivePlan) => void;
  /** B-BOOK-79 door (b): the parent-only printed copy. */
  onPrint: (plan: ActivePlan) => void;
}

export default function PlansSection({ childName, planRows, visibility, now, shelf, onOpenDoor, onOpenPlan, onKeep, onChange, onClose, onPrint }: PlansSectionProps) {
  const { uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const all = useMemo(() => authoredPatterns(), []);
  const defs = shelf ? patternsOnShelf(all, shelf) : all;
  const running = useMemo(() => activePlans(planRows, now).filter((p) => !shelf || planShelf(p.def) === shelf), [planRows, now, shelf]);
  const runningIds = new Set(running.map((p) => p.def.id));
  const doors = defs.filter((d) => !runningIds.has(d.id) && visibility?.composable[d.id]?.[lang]);
  if (!running.length && !doors.length && shelf) return null;
  return (
    <section data-module="everyday-plans" className="min-w-0" dir={lang === "he" ? "rtl" : "ltr"}>
      <SectionHead icon="auto_stories" title={s("section.title")} />
      {!shelf && <p className="mt-1 t-base leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{s("section.lede", { name: childName })}</p>}
      {running.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3" style={{ listStyle: "none", margin: 0, padding: 0 }} data-plans-running="">
          {running.map((p) => <RunningPlan key={p.doc.id} plan={p} lang={lang} onOpen={() => onOpenPlan(p)} onKeep={() => onKeep(p)} onChange={() => onChange(p)} onClose={() => onClose(p)} onPrint={() => onPrint(p)} />)}
        </ul>
      )}
      {doors.length > 0 && (
        <>
          <p className="mt-4 arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>{s("section.doors")}</p>
          <ul className="mt-2 flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }} data-plans-doors="">
            {doors.map((d) => <Door key={d.id} def={d} lang={lang} childName={childName} onOpen={() => onOpenDoor(d.id)} />)}
          </ul>
        </>
      )}
      {!running.length && !doors.length && <p className="mt-3 t-base" style={{ color: "var(--arbor-muted)" }}>{s("section.empty")}</p>}
    </section>
  );
}

function Door({ def, lang, childName, onOpen }: { def: PatternDef; lang: "en" | "he"; childName: string; onOpen: () => void }) {
  return (
    <li>
      <button type="button" className="flex w-full min-h-11 items-center gap-3 p-4 text-start transition active:scale-[0.99] focus:outline-none focus-visible:ring-2" style={CARD} data-plan-door={def.id} onClick={onOpen}>
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}><Icon name="auto_stories" size={22} /></span>
        <span className="min-w-0 flex-1">
          <b className="block t-base" style={{ color: "var(--arbor-ink)" }} dir="auto">{def.parentWords[lang]}</b>
          <small className="block t-sm" style={{ color: "var(--arbor-muted)" }}>{planString("door.open", lang, { name: childName })}</small>
        </span>
        <Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
      </button>
    </li>
  );
}

function RunningPlan({ plan, lang, onOpen, onKeep, onChange, onClose, onPrint }: { plan: ActivePlan; lang: "en" | "he"; onOpen: () => void; onKeep: () => void; onChange: () => void; onClose: () => void; onPrint: () => void }) {
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const nights = nightsCount(plan.doc);
  return (
    <li className="p-4" style={CARD} data-plan-running={plan.def.id}>
      <p className="arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>{s("section.running")}</p>
      <h3 className="mt-1 arbor-type-title" style={{ color: "var(--arbor-ink)" }} dir="auto">{plan.def.title[lang]}</h3>
      <p className="arbor-num mt-1 t-sm" style={{ color: "var(--arbor-ink-soft)" }} data-plan-nights={nights}>
        {s("section.nights", { count: nights })}{plan.review ? "" : ` · ${s("section.daysLeft", { count: plan.daysLeft })}`}
      </p>
      {plan.review ? (
        <div className="mt-3" data-plan-review="">
          <p className="t-base" style={{ color: "var(--arbor-ink)" }}>{s("review.body", { count: nights })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={BTN} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }} data-plan-keep="" onClick={onKeep}>{s("review.keep")}</button>
            <button type="button" className={BTN} style={QUIET} data-plan-change="" onClick={onChange}>{s("review.change")}</button>
            <button type="button" className={BTN} style={QUIET} data-plan-close="" onClick={onClose}>{s("review.close")}</button>
            <button type="button" className={BTN} style={QUIET} data-plan-print="" onClick={onPrint}><Icon name="description" size={18} />{s("section.print")}</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={BTN} style={QUIET} data-plan-open="" onClick={onOpen}>{s("today.open")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
          <button type="button" className={BTN} style={QUIET} data-plan-print="" onClick={onPrint}><Icon name="description" size={18} />{s("section.print")}</button>
        </div>
      )}
    </li>
  );
}
