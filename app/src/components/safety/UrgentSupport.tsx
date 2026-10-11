import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { HELPLINE_DIRECTORY } from "../../safety/escalation";
import { Icon } from "../ui/Icon";

/** Existing urgent-support wording and dial targets, available before setup completes. */
export function UrgentSupport({ testId = "onboarding-urgent-support", className = "first-run-hint", showInstructions = true, onSafety }: {
  testId?: string; className?: string;
  /** Omit only inside a containing alert that displays both instructions in full,
   *  or (FEAT-06) where the caller names the lines itself and the parent opened
   *  the surface: the hard-moment "you first" view. */
  showInstructions?: boolean;
  /** FEAT-06: when given, a door to the Safety & escalation tab after the lines. */
  onSafety?: () => void;
}) {
  const { t } = useLanguage();
  return <aside role={showInstructions ? "alert" : undefined} data-testid={testId} className={className}>
    {showInstructions && <><p>{t("elev.safety.crisis.danger")}</p><p>{t("screen.safetyNote")}</p></>}
    {HELPLINE_DIRECTORY.filter(line => ["il_mda", "il_police", "il_welfare", "il_eran"].includes(line.id)).map(line =>
      <a key={line.id} className="inline-flex min-h-11 items-center underline px-2" href={`tel:${line.tel}`}>{t(`elev.safety.helpline.${line.id}`)} · {line.number}</a>)}
    {onSafety && <button type="button" data-testid={`${testId}-safety`} className="inline-flex min-h-11 items-center gap-1.5 underline px-2" onClick={onSafety}><Icon name="gpp_maybe" size={18} />{t("elev.safety.open")}</button>}
  </aside>;
}

