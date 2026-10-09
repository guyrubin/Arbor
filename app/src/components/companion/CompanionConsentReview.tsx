import React, { useId, useEffect, useRef } from "react";
import Icon from "../ui/Icon";
import { COMPANION_CONSENT_COPY } from "./companionConsentCopy";
import type { useCompanionConsent } from "./useCompanionConsent";

export default function CompanionConsentReview({ consent, language, onReturnToDraft }: { consent: ReturnType<typeof useCompanionConsent>; language: "en" | "he"; onReturnToDraft: () => void }) {
  const copy = COMPANION_CONSENT_COPY[language];
  const id = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const wasReviewing = useRef(false);
  const returnToDraft = useRef(onReturnToDraft);
  returnToDraft.current = onReturnToDraft;
  useEffect(() => {
    if (consent.reviewing) title.current?.focus();
    else if (wasReviewing.current) returnToDraft.current();
    wasReviewing.current = consent.reviewing;
  }, [consent.reviewing]);
  if (!consent.reviewing) return consent.notice ? <p className="companion-media-note" role="status">{copy[consent.notice]}</p> : null;
  return <section className="companion-consent" aria-labelledby={`${id}-title`}>
    <header><Icon name="shield" size={22} /><h3 id={`${id}-title`} ref={title} tabIndex={-1}>{copy.title}</h3><button type="button" onClick={consent.close} aria-label={copy.close}><Icon name="close" size={20} /></button></header>
    <div className="companion-consent-explanation">
      <p className="companion-consent-status">{consent.active ? copy.active : copy.inactive}</p>
      <p>{copy.processing}</p><p>{copy.record}</p><p>{copy.duration}</p>
      {consent.active ? <p>{copy.noDelete}</p> : <label htmlFor={`${id}-allow`} className="companion-consent-check"><input id={`${id}-allow`} type="checkbox" checked={consent.checked} disabled={!!consent.busy} onChange={event => consent.setChecked(event.target.checked)} /><span>{copy.checkbox}</span></label>}
    </div>
    {consent.error && <p role="alert">{copy.failed}</p>}
    {consent.busy === "checking" && <p role="status">{copy.loading}</p>}
    <div className="companion-consent-actions">
      {consent.error && <button type="button" disabled={!!consent.busy} onClick={() => void consent.check()}>{copy.retry}</button>}
      {consent.active ? <button type="button" disabled={!!consent.busy} onClick={() => void consent.revoke()}>{consent.busy === "revoking" ? copy.revoking : copy.revoke}</button> : <button type="button" className="companion-consent-allow" disabled={!consent.checked || !!consent.busy} onClick={() => void consent.allow()}>{consent.busy === "granting" ? copy.saving : copy.allow}</button>}
      <button type="button" onClick={consent.close}>{consent.active ? copy.close : copy.later}</button>
    </div>
  </section>;
}
