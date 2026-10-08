import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { coParentCopy } from "../../lib/i18nElevation/coParent";
import { coParentApi, coParentLink, CoParentError } from "../../lib/coParentApi";
import { readTodayPin } from "../../lib/practice/todayPin";
import type { CoParentActivitySelection } from "../../sharing/coParentTypes";
import { api } from "../../lib/api";
import type { ShareGrant } from "../../types";
import Icon from "../ui/Icon";
import { CoParentRequests } from "../../lib/coParentRequests";

const button = "min-h-11 rounded-xl px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:cursor-wait";
type CoParentInviteProps = { childId: string; childName: string; grants: ShareGrant[]; onChanged: () => Promise<void> };
export default function CoParentInvite(props: CoParentInviteProps) {
  return <CoParentInviteSession key={props.childId} {...props} />;
}
function CoParentInviteSession({ childId, childName, grants, onChanged }: CoParentInviteProps) {
  const { uiLang } = useLanguage();
  const c = coParentCopy[uiLang];
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invited, setInvited] = useState<ShareGrant | null>(null);
  const [selection, setSelection] = useState<CoParentActivitySelection | null>(null);
  const [choice, setChoice] = useState("");
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [activityBusy, setActivityBusy] = useState(false);
  const choiceRequest = useRef(crypto.randomUUID());
  const activityRequests = useRef(new CoParentRequests());
  const activityMutations = useRef(new CoParentRequests());
  const invitationRequests = useRef(new CoParentRequests());
  const currentCopy = useRef(c);
  currentCopy.current = c;
  useEffect(() => () => { activityRequests.current.invalidate(); activityMutations.current.invalidate(); invitationRequests.current.invalidate(); }, []);
  const pinned = readTodayPin(childId);
  const loadActivities = useCallback(async () => {
    const ticket = activityRequests.current.begin();
    setActivityLoading(true);
    try {
      const result = await coParentApi.activities(childId, uiLang);
      if (!activityRequests.current.latest(ticket)) return;
      setSelection(result); setActivityError("");
      setChoice((current) => result.choices.some((p) => p.id === current) ? current
        : result.choices.find((p) => p.id === pinned)?.id ?? result.choices.find((p) => p.id === result.activity?.practiceId)?.id ?? result.choices[0]?.id ?? "");
    } catch { if (activityRequests.current.latest(ticket)) setActivityError(c.choiceLoadError); }
    finally { if (activityRequests.current.latest(ticket)) setActivityLoading(false); }
  }, [childId, uiLang, pinned, c.choiceLoadError]);
  // Locale changes replace reads, while a mutation still belongs to this child.
  // Its completion reloads through the current locale rather than a stale closure.
  const currentActivityLoad = useRef(loadActivities);
  currentActivityLoad.current = loadActivities;
  useEffect(() => {
    activityRequests.current.invalidate();
    setSelection(null); setChoice(""); setActivityError("");
    void loadActivities();
    const refresh = () => { if (document.visibilityState === "visible") void loadActivities(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { activityRequests.current.invalidate(); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [loadActivities]);
  const saveChoice = async (event: React.FormEvent) => {
    event.preventDefault(); if (!choice) return;
    activityRequests.current.invalidate();
    const ticket = activityMutations.current.begin();
    setActivityBusy(true); setActivityError(""); setNotice("");
    try {
      await coParentApi.chooseActivity(childId, choice, choiceRequest.current, uiLang);
      if (!activityMutations.current.latest(ticket)) return;
      choiceRequest.current = crypto.randomUUID(); setNotice(currentCopy.current.chooseSaved);
      await currentActivityLoad.current();
    } catch { if (activityMutations.current.latest(ticket)) setActivityError(currentCopy.current.chooseError); }
    finally { if (activityMutations.current.latest(ticket)) setActivityBusy(false); }
  };
  const completeChoice = async () => {
    if (!selection?.activity) return;
    activityRequests.current.invalidate();
    const ticket = activityMutations.current.begin();
    setActivityBusy(true); setActivityError(""); setNotice("");
    try {
      await coParentApi.completeOwnedActivity(childId, selection.activity.id);
      if (!activityMutations.current.latest(ticket)) return;
      setNotice(currentCopy.current.completed);
      await currentActivityLoad.current();
    } catch (e) { if (activityMutations.current.latest(ticket)) setActivityError(e instanceof CoParentError && e.status === 409 ? currentCopy.current.changed : currentCopy.current.completeError); }
    finally { if (activityMutations.current.latest(ticket)) setActivityBusy(false); }
  };
  const candidate = selection?.choices.find((p) => p.id === choice);
  const team = grants.filter((g) => g.childId === childId && g.accessMode === "family_workspace" && !g.revokedAt && (!g.expiresAt || Date.parse(g.expiresAt) > Date.now()));
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const ticket = invitationRequests.current.begin();
    try {
      const grant = await coParentApi.invite(childId, childName, email.trim());
      if (!invitationRequests.current.latest(ticket)) return;
      setInvited(grant); setEmail(""); await onChanged();
    }
    catch { if (invitationRequests.current.latest(ticket)) setError(c.createError); }
    finally { if (invitationRequests.current.latest(ticket)) setBusy(false); }
  };
  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(coParentLink(id)); setNotice(c.copied); }
    catch { setNotice(c.copyFailed); }
  };
  const share = async (id: string) => {
    if (!navigator.share) return copy(id);
    try { await navigator.share({ title: c.title, text: c.inviteMessage, url: coParentLink(id) }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) await copy(id); }
  };
  const revoke = async (id: string) => {
    const ticket = invitationRequests.current.begin();
    setBusy(true); setError("");
    try { await api.revokeShare(id); if (!invitationRequests.current.latest(ticket)) return; setInvited(null); setNotice(c.stopped); await onChanged(); }
    catch { if (invitationRequests.current.latest(ticket)) setError(c.error); }
    finally { if (invitationRequests.current.latest(ticket)) setBusy(false); }
  };
  return <section className="rounded-2xl p-5 space-y-4 arbor-depth-card min-w-0" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }} data-testid="coparent-invite">
    <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}><Icon name="diversity_3" size={22} /></span><div className="min-w-0"><p className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{c.free}</p><h2 className="arbor-type-title">{c.title}</h2></div></div>
    <p className="text-sm leading-relaxed">{c.intro}</p>
    <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--arbor-paper-deep)" }} data-testid="coparent-owner-activity">
      {selection?.activity && <div className="space-y-3"><h3 className="text-base font-bold">{c.activity}</h3><p className="text-sm leading-relaxed" dir="auto">{selection.activity.do || selection.activity.text}</p>{selection.activity.say && <p className="text-sm leading-relaxed" dir="auto"><span className="font-bold">{c.sayLabel}: </span><q>{selection.activity.say}</q></p>}{selection.activity.completedAt ? <p className="text-sm font-bold flex items-center gap-2"><Icon name="check" size={18} />{c.completed}</p> : <button type="button" disabled={activityBusy} className={button} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }} onClick={() => void completeChoice()}>{activityBusy ? c.saving : c.done}</button>}</div>}
      <details open={!selection?.activity}><summary className="min-h-11 flex items-center cursor-pointer text-sm font-bold" style={{ color: "var(--arbor-clay)" }}>{c.choose}</summary>
        <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--arbor-muted)" }}>{c.chooseHint}</p>
        {activityLoading && !selection ? <p role="status" className="text-sm">{c.chooseLoading}</p> : selection && selection.choices.length === 0 ? <p className="text-sm">{c.choiceEmpty}</p> : selection && <form onSubmit={(e) => void saveChoice(e)} className="space-y-3">
          <label htmlFor="coparent-practice" className="block text-sm font-bold">{c.chooseLabel}</label>
          <select id="coparent-practice" value={choice} disabled={activityBusy} onChange={(e) => { setChoice(e.target.value); choiceRequest.current = crypto.randomUUID(); }} className="w-full min-w-0 min-h-11 rounded-xl px-3 text-sm" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)" }}>
            {selection.choices.map((p) => <option key={p.id} value={p.id}>{p.id === pinned ? `${c.pinned} · ` : ""}{p.do}</option>)}
          </select>
          {candidate && <div className="space-y-2"><p className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{candidate.minutes} {c.minutes}{candidate.id === pinned ? ` · ${c.pinned}` : ""}</p><p className="text-sm leading-relaxed" dir="auto">{candidate.do}</p><p className="text-sm leading-relaxed" dir="auto"><span className="font-bold">{c.sayLabel}: </span><q>{candidate.say}</q></p></div>}
          <button type="submit" disabled={activityBusy || !candidate} className={button} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>{activityBusy ? c.saving : c.chooseSave}</button>
        </form>}
      </details>
      {activityError && <div role="alert" className="space-y-2"><p className="text-sm" style={{ color: "var(--arbor-pink-ink)" }}>{activityError}</p><button type="button" disabled={activityBusy || activityLoading} onClick={() => void loadActivities()} className={button} style={{ color: "var(--arbor-clay)" }}>{c.refresh}</button></div>}
    </div>
    <form onSubmit={(e) => void create(e)} className="space-y-3">
      <label htmlFor="coparent-email" className="block text-sm font-bold">{c.email}</label>
      <div className="flex flex-col sm:flex-row gap-2"><input id="coparent-email" type="email" autoComplete="email" inputMode="email" required maxLength={254} dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 w-full min-h-11 rounded-xl px-3 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} /><button type="submit" disabled={busy} className={`${button} shrink-0`} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>{busy ? c.creating : c.invite}</button></div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.consent}</p>
    </form>
    {error && <p role="alert" className="text-sm" style={{ color: "var(--arbor-pink-ink)" }}>{error}</p>}
    {invited && <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--arbor-paper-deep)" }}><h3 className="font-bold">{c.ready}</h3><p className="text-sm break-all" dir="auto">{invited.recipientEmail}</p><p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.sendHint}</p><div className="flex flex-wrap gap-2"><button type="button" className={button} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }} onClick={() => void share(invited.id)}>{c.send}</button><button type="button" className={button} style={{ color: "var(--arbor-clay)" }} onClick={() => void copy(invited.id)}>{c.copy}</button></div><input aria-label={c.copy} value={coParentLink(invited.id)} readOnly dir="ltr" className="w-full min-w-0 min-h-11 rounded-lg px-2 text-xs" style={{ background: "var(--arbor-paper-elevated)" }} onFocus={(e) => e.target.select()} /></div>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {team.length > 0 && <ul aria-label={c.roster} className="divide-y" style={{ borderColor: "var(--arbor-rule)" }}>{team.map((g) => <li key={g.id} className="py-3 flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><p dir="auto" className="text-sm font-bold break-all">{g.recipientEmail}</p><p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{g.acceptedAt ? c.statusAccepted : c.statusPending}</p></div><button type="button" onClick={() => setInvited(g)} className={button} style={{ color: "var(--arbor-clay)" }}>{c.send}</button><button type="button" disabled={busy} onClick={() => void revoke(g.id)} className={button} style={{ color: "var(--arbor-muted)" }}>{c.stop}</button></li>)}</ul>}
  </section>;
}
