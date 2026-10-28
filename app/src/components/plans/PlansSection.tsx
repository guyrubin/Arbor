/**
 * PlansSection — B-BOOK-77/78 → S1 (surfacing): "Everyday plans" as ONE card,
 * not eight doors. It renders on My child › Moments (the journal grid, and
 * scoped to one shelf on a shelf page) and on Today (surface "today", under
 * the lead): the plan(s) running now first — hero title, "Night {n} of
 * {total}", tonight's step as the grown-ups do it, "{k} tries this week" (a
 * COUNT), Open book · Print · Keep · Change · Close — then one line,
 * "Something hard right now?", that opens the pattern chooser: every pattern
 * this family may compose (the server's table; B-KID-167: a dark pattern is
 * not listed; a running pattern is not listed), as a hero title with the
 * parent's own words under it and the age range as a quiet tag. The headline
 * is never the symptom sentence. Choosing opens the existing composer.
 *
 * The owner-only plate painter left this surface for Settings › Owner tools
 * (components/plans/OwnerTools): a parent never sees a plate code here.
 *
 * FIREWALL: counts only (never a rate, a streak, a percentage or a verdict);
 * no age statement about the child (the tag is the pattern's range); the
 * child never sees this surface. Parent register, EN + HE.
 */
import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { SectionHead } from "../ui/SectionHead";
import { useLanguage } from "../../context/LanguageContext";
import { authoredPatterns } from "../../lib/library/plans/planBooks";
import type { PatternDef } from "../../lib/library/plans/patterns";
import { activePlans, patternsOnShelf, planShelf, tonightStepForParent, triesThisWeek, type ActivePlan } from "../../lib/plans/planWeek";
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
  /** The server's table; null while unknown (nothing to choose renders). */
  visibility: PlanVisibility | null;
  now: Date;
  /** Only the patterns whose door sits on this shelf (a shelf page); absent = every pattern. */
  shelf?: ShelfId;
  /** Where the card sits: the journal grid (default) or Today's column. */
  surface?: "moments" | "today";
  /** A plan that already leads the surface (Today's lead): the card does not repeat it. */
  excludePlanId?: string;
  /** The chooser open on arrival (`#/journal?plan=choose`; the evidence sweep and tests). */
  initialChooserOpen?: boolean;
  onOpenDoor: (pattern: PatternId) => void;
  onOpenPlan: (plan: ActivePlan) => void;
  onKeep: (plan: ActivePlan) => void;
  onChange: (plan: ActivePlan) => void;
  onClose: (plan: ActivePlan) => void;
  /** B-BOOK-79 door (b): the parent-only printed copy. */
  onPrint: (plan: ActivePlan) => void;
}

export default function PlansSection({ childName, planRows, visibility, now, shelf, surface = "moments", excludePlanId, initialChooserOpen = false, onOpenDoor, onOpenPlan, onKeep, onChange, onClose, onPrint }: PlansSectionProps) {
  const { uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const all = useMemo(() => authoredPatterns(), []);
  const defs = shelf ? patternsOnShelf(all, shelf) : all;
  const active = useMemo(() => activePlans(planRows, now).filter((p) => !shelf || planShelf(p.def) === shelf), [planRows, now, shelf]);
  const running = active.filter((p) => p.doc.id !== excludePlanId);
  const runningIds = new Set(active.map((p) => p.def.id));
  const choosable = defs.filter((d) => !runningIds.has(d.id) && visibility?.composable[d.id]?.[lang]);
  const [open, setOpen] = useState(initialChooserOpen);
  if (!running.length && !choosable.length) return null;
  const stamp = surface === "moments" ? { "data-module": "everyday-plans" } : {};
  return (
    <section {...stamp} data-everyday-plans={surface} className="min-w-0" dir={lang === "he" ? "rtl" : "ltr"}>
      <div className="p-4" style={CARD}>
        <SectionHead icon="auto_stories" title={s("section.title")} as="h2" />
        {running.length > 0 && (
          <ul className="mt-3 flex flex-col gap-3" style={{ listStyle: "none", margin: 0, padding: 0 }} data-plans-running="">
            {running.map((p) => <RunningPlan key={p.doc.id} plan={p} lang={lang} childName={childName} now={now} onOpen={() => onOpenPlan(p)} onKeep={() => onKeep(p)} onChange={() => onChange(p)} onClose={() => onClose(p)} onPrint={() => onPrint(p)} />)}
          </ul>
        )}
        {choosable.length > 0 && (
          <div className={running.length ? "mt-3 pt-3" : "mt-2"} style={running.length ? { borderTop: "1px solid var(--arbor-rule)" } : undefined} data-plans-hard="">
            <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-start focus:outline-none focus-visible:ring-2" aria-expanded={open} data-plans-chooser-toggle="" onClick={() => setOpen((o) => !o)}>
              <span className="t-base font-semibold" style={{ color: "var(--arbor-ink)" }}>{s("section.hard")}</span>
              <Icon name={open ? "expand_less" : "expand_more"} size={20} style={{ color: "var(--arbor-muted)" }} />
            </button>
            {open && (
              <ul className="mt-2 flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }} data-plans-chooser="">
                {choosable.map((d) => <PatternRow key={d.id} def={d} lang={lang} onOpen={() => onOpenDoor(d.id)} />)}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** One pattern in the chooser: the hero title leads; the parent's words and the age range follow. */
function PatternRow({ def, lang, onOpen }: { def: PatternDef; lang: "en" | "he"; onOpen: () => void }) {
  return (
    <li>
      <button type="button" className="flex w-full min-h-11 items-center gap-3 rounded-xl p-3 text-start transition active:scale-[0.99] focus:outline-none focus-visible:ring-2" style={QUIET} data-plan-door={def.id} onClick={onOpen}>
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}><Icon name="auto_stories" size={22} /></span>
        <span className="min-w-0 flex-1">
          <b className="block t-base" style={{ color: "var(--arbor-ink)" }} dir="auto" data-plan-door-title="">{def.title[lang]}</b>
          <small className="block t-sm" style={{ color: "var(--arbor-muted)" }} dir="auto">{def.parentWords[lang]}</small>
          <small className="arbor-num mt-1 inline-block rounded-full px-2 py-0.5 t-xs" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)" }} data-plan-door-age="">{planString("chooser.age", lang, { age: def.ageText })}</small>
        </span>
        <Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
      </button>
    </li>
  );
}

function RunningPlan({ plan, lang, childName, now, onOpen, onKeep, onChange, onClose, onPrint }: { plan: ActivePlan; lang: "en" | "he"; childName: string; now: Date; onOpen: () => void; onKeep: () => void; onChange: () => void; onClose: () => void; onPrint: () => void }) {
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const tries = triesThisWeek(plan.doc, now);
  const total = plan.doc.durationDays;
  const night = Math.min(plan.day, total);
  const step = tonightStepForParent(plan.doc, lang);
  return (
    <li className="rounded-xl p-4" style={QUIET} data-plan-running={plan.def.id}>
      <p className="arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>{s("door.open", { name: childName })}</p>
      <h3 className="mt-1 arbor-type-title" style={{ color: "var(--arbor-ink)" }} dir="auto">{plan.def.title[lang]}</h3>
      <p className="arbor-num mt-1 t-sm" style={{ color: "var(--arbor-ink-soft)" }} data-plan-night={night} data-plan-tries={tries}>
        {s("card.night", { n: night, total })} · {tries === 1 ? s("card.tries.one") : s("card.tries", { count: tries })}
      </p>
      {step && <p className="mt-2 t-base leading-relaxed" style={{ color: "var(--arbor-ink)" }} dir="auto" data-plan-tonight="">{s("card.tonight", { step })}</p>}
      {plan.review && <p className="mt-2 t-sm" style={{ color: "var(--arbor-ink-soft)" }} data-plan-review="">{s("section.review")}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={BTN} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }} data-plan-open="" onClick={onOpen}><Icon name="menu_book" size={18} />{s("card.open")}</button>
        <button type="button" className={BTN} style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }} data-plan-print="" onClick={onPrint}><Icon name="description" size={18} />{s("section.print")}</button>
        <button type="button" className={BTN} style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }} data-plan-keep="" onClick={onKeep}>{s("review.keep")}</button>
        <button type="button" className={BTN} style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }} data-plan-change="" onClick={onChange}>{s("review.change")}</button>
        <button type="button" className={BTN} style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }} data-plan-close="" onClick={onClose}>{s("review.close")}</button>
      </div>
    </li>
  );
}
