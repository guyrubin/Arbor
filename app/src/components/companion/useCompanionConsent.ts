import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { COMPANION_CONSENT_EVENT, COMPANION_CONSENT_PURPOSE, companionConsentActive, latestCompanionConsent } from "../../lib/companionConsent";
import type { ConsentGrant } from "../../types";

/** A fresh server read owns each send/review. No grant is inferred from a file. */
export function useCompanionConsent(childId: string) {
  const { user } = useAuth();
  const accountId = user?.uid ?? "";
  const identity = `${accountId}:${childId}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const request = useRef(0);
  const mutation = useRef(false);
  const mounted = useRef(true);
  const [grant, setGrant] = useState<ConsentGrant>();
  const [reviewing, setReviewing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<"checking" | "granting" | "revoking" | null>(null);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<"saved" | "revoked" | null>(null);

  useEffect(() => {
    request.current++;
    mutation.current = false;
    setGrant(undefined); setReviewing(false); setChecked(false); setBusy(null); setError(false); setNotice(null);
  }, [identity]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++; }; }, []);
  const current = (ticket: number) => mounted.current && identityRef.current === identity && request.current === ticket;

  const check = async (): Promise<boolean> => {
    if (mutation.current) return false;
    const ticket = ++request.current;
    setBusy("checking"); setError(false); setNotice(null);
    try {
      const result = await api.listConsent(childId);
      if (!current(ticket)) return false;
      const latest = latestCompanionConsent(result.grants, childId);
      setGrant(latest);
      return companionConsentActive(latest);
    } catch {
      if (current(ticket)) { setGrant(undefined); setError(true); }
      return false;
    } finally { if (current(ticket)) setBusy(null); }
  };
  const review = () => { if (mutation.current) return; setChecked(false); setReviewing(true); void check(); };
  useEffect(() => {
    const openReview = (event: Event) => {
      if ((event as CustomEvent<{ childId?: string }>).detail?.childId === childId) review();
    };
    window.addEventListener(COMPANION_CONSENT_EVENT, openReview);
    return () => window.removeEventListener(COMPANION_CONSENT_EVENT, openReview);
    // The account/child lease invalidates every pending read/write. State changes
    // do not re-register a stale failure-card action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  const allow = async () => {
    if (!checked || busy || mutation.current || !accountId || !childId) return;
    mutation.current = true;
    const ticket = ++request.current;
    setBusy("granting"); setError(false); setNotice(null);
    try {
      const result = await api.grantConsent({ childId, purpose: COMPANION_CONSENT_PURPOSE });
      if (!current(ticket)) return;
      const permitted = latestCompanionConsent([result.grant], childId);
      if (!companionConsentActive(permitted)) throw new Error("Permission was not recorded");
      setGrant(permitted); setChecked(false); setNotice("saved"); setReviewing(false);
    } catch { if (current(ticket)) setError(true); }
    finally { if (current(ticket)) { mutation.current = false; setBusy(null); } }
  };
  const revoke = async () => {
    if (!grant || !companionConsentActive(grant) || busy || mutation.current) return;
    mutation.current = true;
    const ticket = ++request.current;
    setBusy("revoking"); setError(false); setNotice(null);
    try {
      const result = await api.revokeConsent(grant.id, childId);
      if (!current(ticket)) return;
      if (result.grant.childId !== childId || result.grant.purpose !== COMPANION_CONSENT_PURPOSE || companionConsentActive(result.grant)) throw new Error("Permission was not revoked");
      setGrant(result.grant); setChecked(false); setNotice("revoked"); setReviewing(false);
    } catch { if (current(ticket)) setError(true); }
    finally { if (current(ticket)) { mutation.current = false; setBusy(null); } }
  };
  const requirePermission = async () => {
    const allowed = await check();
    if (!allowed && mounted.current && identityRef.current === identity) { setChecked(false); setReviewing(true); }
    return allowed;
  };
  return { accountId, active: companionConsentActive(grant), reviewing, checked, setChecked, busy, error, notice, review, allow, revoke,
    requirePermission, close: () => { setReviewing(false); setChecked(false); }, check };
}
