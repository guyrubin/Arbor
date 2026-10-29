import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { HELPLINE_DIRECTORY, type HelplineEntry } from "../../safety/escalation";
import { careSafetyLines } from "../../safety/safetyLines";
import { Icon } from "../ui/Icon";

/** The onboarding default's dial targets (Israel's lines, before setup completes). */
const DEFAULT_LINE_IDS = ["il_mda", "il_police", "il_welfare", "il_eran"];

/** Existing urgent-support wording and dial targets, available before setup completes. */
export function UrgentSupport({ testId = "onboarding-urgent-support", className = "first-run-hint", showInstructions = true, onSafety, requestLang, lead }: {
  testId?: string; className?: string;
  /** Omit only inside a containing alert that displays both instructions in full. */
  showInstructions?: boolean;
  /** FEAT-06: when given, a door to the Safety & escalation tab after the lines
   *  (the coach composer's crisis-wording slot). */
  onSafety?: () => void;
  /** B-ASKJB-49: the server's crisis screen answered 409 for a request made in
   *  this language. The lines become Safety's own selection for it
   *  (safety/safetyLines careSafetyLines: the family's market first, else this
   *  language; the emergency line and the family's own talk line, never a
   *  foreign country's), the instruction is the danger line, and when the
   *  family's region has no talk line the door names Safety's by-country list. */
  requestLang?: string;
  /** B-ASKJB-49: one line before the instructions, already in the page language
   *  (why the request stopped), for a surface that has no copy of its own. */
  lead?: string;
}) {
  const { t } = useLanguage();
  const family = requestLang === undefined ? null : careSafetyLines(requestLang);
  const lines: HelplineEntry[] = family
    ? [family.emergency, family.talk].filter((line): line is HelplineEntry => !!line)
    : HELPLINE_DIRECTORY.filter(line => DEFAULT_LINE_IDS.includes(line.id));
  // B-ASKJB-49 r2: a div, not an <aside>: the shell's global `.arbor-app aside`
  // rule (sidebar paper with !important, a one-sided hairline) belongs to the
  // sidebar and the AI rail, and painted over every host's own tokens.
  return <div role={showInstructions ? "alert" : undefined} data-testid={testId} data-request-lang={requestLang} className={className}>
    {showInstructions && lead && <p data-testid={`${testId}-lead`}>{lead}</p>}
    {showInstructions && (family ? <p>{t("elev.safety.crisis.danger")}</p> : <><p>{t("elev.safety.crisis.danger")}</p><p>{t("screen.safetyNote")}</p></>)}
    {lines.map(line =>
      <a key={line.id} className="inline-flex min-h-11 items-center underline px-2" href={`tel:${line.tel}`}>{t(`elev.safety.helpline.${line.id}`)} · {line.number}</a>)}
    {onSafety && <button type="button" data-testid={`${testId}-safety`} className="inline-flex min-h-11 items-center gap-1.5 underline px-2" onClick={onSafety}><Icon name="gpp_maybe" size={18} />{t(family?.findLine ? "elev.safety.crisis.findLine" : "elev.safety.open")}</button>}
  </div>;
}
