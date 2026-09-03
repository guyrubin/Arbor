import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import type { PatternEcho as PatternEchoModel } from "./patternEcho";

/**
 * PatternEcho — TJB-06: the count echo under the Behaviors capture bar after a
 * save, and the ONE "Turn this into a plan" CTA once the echo carries a plan
 * suggestion (≥ 3 similar incident logs this week). Counts only — the type
 * label is the schema vocabulary through the taxonomy label map, the reason
 * line is the suggestion's own count sentence. Dismissible, no residue.
 */
export default function PatternEcho({
  echo,
  onPlan,
  onDismiss,
}: {
  echo: PatternEchoModel;
  onPlan: (topic: string) => void;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const type = behaviorTypeLabel(echo.type, t);
  const line = echo.count === 1 ? t("beh.echo.count.one", { type }) : t("beh.echo.count.many", { type, n: echo.count });
  return (
    <div
      role="status"
      dir="auto"
      data-testid="behavior-pattern-echo"
      className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
      style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule)" }}
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)" }}>
        <Icon name="timeline" size={16} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>
        {line}
      </p>
      {echo.suggestion && (
        <button
          type="button"
          onClick={() => onPlan(echo.suggestion!.topic)}
          data-testid="behavior-pattern-echo-plan"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-extrabold transition active:scale-[0.98]"
          style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)", background: "var(--arbor-paper-elevated)" }}
        >
          <Icon name="eco" size={15} /> {t("beh.echo.cta")}
          <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("beh.echo.dismiss")}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}
