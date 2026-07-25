import React from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { capacityMinutes, type ActionOutcome } from "../../actionLoop/model";

/**
 * TODAY-2/CODEX-1: this card renders ONLY when an accepted/completed action
 * exists for today — the pre-accept state (capacity chips + accept CTA) moved
 * into the TodayRecommendation hero, which OverviewTab swaps out for this card
 * once a step is chosen, so the focus headline never renders twice and there
 * is never a second gradient-primary CTA. The accept seam is NOT reachable
 * from here anymore; the TODAY-1 guard (no fallback copy can be persisted into
 * actionLoops) is enforced at the hero's `accept` prop.
 */
export default function TodayActionLoop() {
  const { activeTodayAction, recordTodayOutcome, removeTodayAction } = useArbor();
  // TODAY-5/PLAT-4/CODEX-6: copy lives in i18n.ts (today.action.*), never an
  // inline per-language ternary object — keys stay visible to the parity test.
  const { t } = useLanguage();
  const copy = {
    eyebrow: t("today.action.eyebrow"), tried: t("today.action.tried"), helped: t("today.action.helped"), somewhat: t("today.action.somewhat"), notToday: t("today.action.notToday"), receipt: t("today.action.receipt"), adapt: t("today.action.adapt"), remove: t("today.action.remove"),
  };

  if (!activeTodayAction) return null;

  const outcomes: { value: ActionOutcome; label: string }[] = [{ value: "helped", label: copy.helped }, { value: "somewhat", label: copy.somewhat }, { value: "not_today", label: copy.notToday }];
  return (
    <section className="rounded-[20px] p-5 sm:p-6" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }} aria-labelledby="active-action-title">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name={activeTodayAction.status === "completed" ? "verified" : "task_alt"} size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-green-ink)" }}>{copy.eyebrow} · {capacityMinutes[activeTodayAction.capacity]} {t("today.action.min")}</p><button type="button" onClick={() => removeTodayAction(activeTodayAction.id)} className="min-h-9 px-2 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{copy.remove}</button></div><h2 id="active-action-title" className="mt-1 text-lg font-bold leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{activeTodayAction.recommendation}</h2></div></div>
      {activeTodayAction.status === "accepted" ? <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--arbor-rule)" }}><p className="text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{copy.tried}</p><div className="mt-2 grid grid-cols-3 gap-2">{outcomes.map(({ value, label }) => <button key={value} type="button" onClick={() => recordTodayOutcome(activeTodayAction.id, value)} className="min-h-11 rounded-xl px-2 text-xs font-bold transition active:scale-[0.98]" style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)", background: "var(--arbor-paper-elevated)" }}>{label}</button>)}</div></div> : <div className="mt-4 flex items-start gap-3 rounded-xl p-3.5" style={{ background: "var(--arbor-green-soft)" }} role="status"><Icon name="check_circle" size={18} style={{ color: "var(--arbor-green-ink)" }} /><div><p className="text-xs font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{copy.receipt}</p><p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{copy.adapt}</p></div></div>}
    </section>
  );
}
