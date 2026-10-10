import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { HELPLINE_DIRECTORY } from "../../safety/escalation";

/** Existing urgent-support wording and dial targets, available before setup completes. */
export function UrgentSupport({ testId = "onboarding-urgent-support", className = "first-run-hint" }: { testId?: string; className?: string }) {
  const { t } = useLanguage();
  return <aside role="alert" data-testid={testId} className={className}>
    <p>{t("elev.safety.crisis.danger")}</p><p>{t("screen.safetyNote")}</p>
    {HELPLINE_DIRECTORY.filter(line => ["il_mda", "il_police", "il_welfare", "il_eran"].includes(line.id)).map(line =>
      <a key={line.id} className="inline-flex min-h-11 items-center underline px-2" href={`tel:${line.tel}`}>{t(`elev.safety.helpline.${line.id}`)} · {line.number}</a>)}
  </aside>;
}

