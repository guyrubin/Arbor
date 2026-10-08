import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { coParentCopy } from "../../lib/i18nElevation/coParent";
import { coParentApi, coParentLink } from "../../lib/coParentApi";
import { api } from "../../lib/api";
import type { ShareGrant } from "../../types";
import Icon from "../ui/Icon";

const button = "min-h-11 rounded-xl px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:cursor-wait";
export default function CoParentInvite({ childId, childName, grants, onChanged }: { childId: string; childName: string; grants: ShareGrant[]; onChanged: () => Promise<void> }) {
  const { uiLang } = useLanguage();
  const c = coParentCopy[uiLang];
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invited, setInvited] = useState<ShareGrant | null>(null);
  const team = grants.filter((g) => g.accessMode === "family_workspace" && !g.revokedAt && (!g.expiresAt || Date.parse(g.expiresAt) > Date.now()));
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { setInvited(await coParentApi.invite(childId, childName, email.trim())); setEmail(""); await onChanged(); }
    catch { setError(c.createError); }
    finally { setBusy(false); }
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
    setBusy(true); setError("");
    try { await api.revokeShare(id); setInvited(null); setNotice(c.stopped); await onChanged(); }
    catch { setError(c.error); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl p-5 space-y-4 arbor-depth-card min-w-0" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }} data-testid="coparent-invite">
    <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}><Icon name="diversity_3" size={22} /></span><div className="min-w-0"><p className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{c.free}</p><h2 className="arbor-type-title">{c.title}</h2></div></div>
    <p className="text-sm leading-relaxed">{c.intro}</p>
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
