import React from "react";
import { Icon } from "../../ui/Icon";
import { SayThis } from "../../ui/AiBlock";
import { SideRail, Snap, SnapDots, RouteHead } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { translate, type UiLang } from "../../../lib/i18n";
import type { ActionPlan } from "../../../types";
import { plansCopy } from "./plansCopy";

/**
 * Stop 2, "What to say, moment by moment": the plan's own scripts, one card
 * per situation — "Say:" through the shared SayThis (the quote, Read aloud,
 * Copy), "Avoid:" below — and "Refine in Coach", which
 * seeds Ask with the plan's title (unchanged). Desktop: the rail beside the
 * stage. Phone: a snap row with its dots.
 */

function ScriptCard({ scenario, say, avoid, lang }: { scenario: string; say: string; avoid?: string; lang: UiLang }) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  return (
    <article className="nx-sy" data-plan-script="">
      <h3 className="ds-plans-h4" dir="auto">{scenario}</h3>
      <div className="sl">
        <b>{t("plan.say")}</b>
        {/* B-ASKJB-24: each plan script through the shared SayThis (quote, Read aloud, Copy). */}
        <SayThis text={say} title={t("plan.say")} lang={lang} copyLabel={t("coach.action.copy")} copiedLabel={t("coach.cards.copied")} presentation="quote" />
      </div>
      {avoid && (
        <div className="sl">
          <b>{t("plan.avoid")}</b>
          <span className="av1 ds-avoid" dir="auto">{avoid}</span>
        </div>
      )}
    </article>
  );
}

export function PlanScripts({ plan, lang, composition, n, onRefine }: { plan: ActionPlan; lang: UiLang; composition: Composition; n: number; onRefine: () => void }) {
  const c = plansCopy(lang === "he" ? "he" : "en");
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const title = t("elev.words.plans.scripts");
  const cards = plan.scripts.map((sc, i) => <ScriptCard key={i} scenario={sc.scenario} say={sc.say} avoid={sc.avoid} lang={lang} />);
  const refine = (
    <button type="button" className="ds-link min-h-11" onClick={onRefine} style={{ alignSelf: "flex-start" }}>
      <Icon name="auto_awesome" size={15} />
      {t("plan.refine")}
    </button>
  );
  if (composition === "desk") {
    return (
      <SideRail id="plans-rail" n={n} title={title} titleId="plans-rail-title" className="x4">
        <div data-testid="plan-scripts" className="stack ds-col" style={{ gap: 12, flex: 1 }}>
          {cards}
          {refine}
        </div>
      </SideRail>
    );
  }
  return (
    <div data-testid="plan-scripts" className="stack ds-col" style={{ gap: 10 }}>
      <RouteHead title={title} />
      <Snap label={title}>{cards}</Snap>
      {plan.scripts.length > 1 && <SnapDots count={plan.scripts.length} caption={c.momentOf(1, plan.scripts.length)} />}
      {refine}
    </div>
  );
}
