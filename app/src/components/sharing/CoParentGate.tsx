import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { coParentCopy } from "../../lib/i18nElevation/coParent";
import { coParentApi, CoParentError } from "../../lib/coParentApi";
import type { CoParentWorkspace } from "../../sharing/coParentTypes";
import type { ShareGrant } from "../../types";
import Icon from "../ui/Icon";
import { CoParentRequests, type CoParentRequestTicket } from "../../lib/coParentRequests";

const button = "min-h-11 rounded-xl px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:cursor-wait";
const primary = { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" };
const card = { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" };

/** The invited adult reaches this BEFORE child onboarding. All content and
 * writes stay in the original owner's child tree; this creates no profile. */
export default function CoParentGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // An authenticated identity never inherits another adult's cached view.
  return <CoParentSession key={`${user?.uid ?? "signed-out"}:${user?.email ?? ""}`} children={children} />;
}

function CoParentSession({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { loading: profileLoading, needsOnboarding, loadError } = useProfile();
  const { uiLang } = useLanguage();
  const c = coParentCopy[uiLang];
  // Labelled, invented QA state; this branch is removed from production builds.
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("coparent-preview");
  const [requested] = useState(() => new URLSearchParams(window.location.search).get("family-invite"));
  const [dismissed, setDismissed] = useState(false);
  const [shares, setShares] = useState<ShareGrant[]>([]);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<CoParentWorkspace | null>(null);
  const [error, setError] = useState<"verify" | "ended" | "error" | "saveError" | "completeError" | "changed" | null>(null);
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const requests = useRef(new CoParentRequests());
  const activeGrant = useRef<string | null>(null);
  useEffect(() => () => { requests.current.invalidate(); }, []);
  const active = !loadError && !dismissed && (preview || ((Boolean(requested) || needsOnboarding) && user?.uid !== "local-sandbox"));
  useEffect(() => {
    if (!active) { requests.current.invalidate(); activeGrant.current = null; setWorkspace(null); setSelected(null); }
  }, [active]);

  const failure = (e: unknown, ticket: CoParentRequestTicket, saving = false) => {
    if (!requests.current.belongs(ticket)) return;
    if (e instanceof CoParentError && (e.status === 403 || (e.status === 404 && e.code === "child_unavailable"))) {
      requests.current.invalidate();
      activeGrant.current = null;
      setWorkspace(null); setSelected(null); setShares([]); setNote(""); setNotice("");
      setLoading(false); setBusy(false); setChecked(true);
      setError(e.code === "verify_email" ? "verify" : "ended");
    } else if (saving || requests.current.latest(ticket)) setError(saving ? "saveError" : "error");
  };
  const load = useCallback(async () => {
    const ticket = requests.current.begin();
    setLoading(true); setError(null);
    if (preview) {
      setWorkspace({ childId: "preview-only", childName: c.previewChild, ownerEmail: null,
        activity: { id: "preview-activity", text: c.previewDo, do: c.previewDo, say: c.previewSay, acceptedAt: "2026-10-08T12:00:00Z", completedAt: null },
        moments: [{ id: "preview-moment", text: c.previewMoment, at: "2026-10-08T12:05:00Z", addedByYou: false }] });
      activeGrant.current = "preview-only"; setSelected("preview-only"); setChecked(true); setLoading(false); return;
    }
    try {
      const result = await coParentApi.invitations();
      if (!requests.current.latest(ticket)) return;
      setShares(result.shares);
      if (requested) {
        const match = result.shares.find((g) => g.id === requested);
        if (!match) { failure(new CoParentError(403, "ended"), ticket); }
        else if (match.acceptedAt) {
          const next = await coParentApi.workspace(match.id);
          if (!requests.current.latest(ticket)) return;
          activeGrant.current = match.id;
          setWorkspace(next); setSelected(match.id);
        }
      }
    } catch (e) { failure(e, ticket); }
    finally { if (requests.current.latest(ticket)) { setLoading(false); setChecked(true); } }
  }, [requested, user?.uid, preview, uiLang]);
  useEffect(() => { if (active && !profileLoading) void load(); }, [active, profileLoading, load]);

  const refresh = useCallback(async () => {
    if (activeGrant.current !== selected) return;
    if (!selected || preview) return load();
    const ticket = requests.current.begin();
    setLoading(true); setError(null);
    try {
      const next = await coParentApi.workspace(selected);
      if (requests.current.latest(ticket)) setWorkspace(next);
    }
    catch (e) { failure(e, ticket); }
    finally { if (requests.current.latest(ticket)) setLoading(false); }
  }, [selected, load, preview]);
  // Revalidation on focus and every minute removes a revoked view. Every save
  // independently authorizes server-side, including inside its transaction.
  useEffect(() => {
    if (!selected || !active) return;
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    const timer = window.setInterval(focus, 60_000);
    return () => { window.removeEventListener("focus", focus); window.clearInterval(timer); };
  }, [selected, active, refresh]);
  const join = async (id: string) => {
    requests.current.invalidate();
    activeGrant.current = id;
    const ticket = requests.current.begin();
    setWorkspace(null); setSelected(null); setNote(""); setNotice("");
    setBusy(true); setLoading(false); setError(null);
    try {
      await coParentApi.accept(id);
      if (!requests.current.belongs(ticket)) return;
      const next = await coParentApi.workspace(id);
      if (!requests.current.latest(ticket)) return;
      setWorkspace(next); setSelected(id); setNote("");
      requestId.current = crypto.randomUUID();
    } catch (e) {
      if (requests.current.belongs(ticket)) activeGrant.current = null;
      failure(e, ticket);
    }
    finally { if (requests.current.belongs(ticket)) setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected || !note.trim()) return;
    requests.current.invalidate();
    const ticket = requests.current.begin();
    setBusy(true); setError(null); setNotice("");
    if (preview) {
      setWorkspace((w) => w && ({ ...w, moments: [{ id: requestId.current, text: note.trim(), at: new Date().toISOString(), addedByYou: true }, ...w.moments] }));
      setNote(""); requestId.current = crypto.randomUUID(); setNotice(c.saved); setBusy(false); return;
    }
    try {
      await coParentApi.note(selected, note.trim(), requestId.current);
      if (!requests.current.belongs(ticket)) return;
      setNote(""); requestId.current = crypto.randomUUID(); setNotice(c.saved);
      await refresh();
    } catch (e) { failure(e, ticket, true); }
    finally { if (requests.current.belongs(ticket)) setBusy(false); }
  };
  const complete = async () => {
    if (!selected || !workspace?.activity) return;
    requests.current.invalidate();
    const ticket = requests.current.begin();
    setBusy(true); setError(null);
    if (preview) { setWorkspace((w) => w && ({ ...w, activity: w.activity && { ...w.activity, completedAt: new Date().toISOString() } })); setNotice(c.completed); setBusy(false); return; }
    try {
      await coParentApi.complete(selected, workspace.activity.id);
      if (!requests.current.belongs(ticket)) return;
      setNotice(c.completed); await refresh();
    }
    catch (e) {
      if (!requests.current.belongs(ticket)) return;
      if (e instanceof CoParentError && (e.status === 403 || (e.status === 404 && e.code === "child_unavailable"))) failure(e, ticket);
      else setError(e instanceof CoParentError && e.status === 409 ? "changed" : "completeError");
    }
    finally { if (requests.current.belongs(ticket)) setBusy(false); }
  };
  const leave = () => {
    requests.current.invalidate();
    activeGrant.current = null;
    const url = new URL(window.location.href); url.searchParams.delete("family-invite");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setWorkspace(null); setSelected(null); setDismissed(true);
  };
  const exitAccount = () => { requests.current.invalidate(); activeGrant.current = null; setWorkspace(null); setSelected(null); setShares([]); setNote(""); void signOut(); };
  // Let ProfileGate show its retryable error even when an invite is in the URL.
  if (loadError || !active || (checked && !requested && !preview && !error && shares.length === 0)) return <>{children}</>;
  const invitations = requested ? shares.filter((g) => g.id === requested) : shares;
  const date = (at: string) => Number.isFinite(Date.parse(at)) ? new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(at)) : "";
  return <main className="arbor-app arbor-parent min-h-screen px-4 py-8 sm:py-12" dir={uiLang === "he" ? "rtl" : "ltr"} style={{ background: "var(--arbor-paper)", color: "var(--arbor-ink)" }}>
    <div className="max-w-2xl mx-auto space-y-6 min-w-0">
      {preview && <p role="note" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{c.preview}</p>}
      <header className="space-y-3"><p className="arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>Arbor · {c.free}</p><h1 className="arbor-type-hero" dir="auto">{workspace?.childName || c.heading}</h1><p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{workspace ? c.joined : c.intro}</p></header>
      {(loading || profileLoading || !checked) && <p role="status" className="text-sm">{c.loading}</p>}
      {error && <section role="alert" className="rounded-2xl p-5 space-y-3 arbor-depth-card" style={card}><p className="text-sm leading-relaxed">{c[error]}</p><button type="button" onClick={() => void refresh()} className={button} style={primary}>{c.retry}</button></section>}
      {notice && <p role="status" className="text-sm font-bold">{notice}</p>}
      {workspace ? <>
        <section className="rounded-2xl p-5 space-y-4 arbor-depth-primary" style={card} data-testid="coparent-activity"><div className="flex items-center gap-3"><Icon name="diversity_3" size={24} style={{ color: "var(--arbor-clay)" }} /><h2 className="arbor-type-title">{c.activity}</h2></div><p className="text-base leading-relaxed whitespace-pre-wrap" dir="auto">{workspace.activity?.do || workspace.activity?.text || c.noActivity}</p>{workspace.activity?.say && <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--arbor-paper-deep)" }}><p className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{c.sayLabel}</p><p className="text-base leading-relaxed" dir="auto"><q>{workspace.activity.say}</q></p></div>}{workspace.activity && <>{workspace.activity.completedAt ? <p className="text-sm font-bold flex items-center gap-2"><Icon name="check" size={18} />{c.completed} · <bdi>{date(workspace.activity.completedAt)}</bdi></p> : <button type="button" disabled={busy} className={button} style={primary} onClick={() => void complete()}>{busy ? c.saving : c.done}</button>}</>}</section>
        <form onSubmit={(e) => void save(e)} className="rounded-2xl p-5 space-y-3 arbor-depth-card" style={card}><label htmlFor="coparent-note" className="block arbor-type-title">{c.note}</label><textarea id="coparent-note" dir="auto" value={note} onChange={(e) => { setNote(e.target.value); requestId.current = crypto.randomUUID(); }} disabled={busy} required maxLength={1200} rows={4} placeholder={c.placeholder} aria-describedby="coparent-note-hint" className="w-full rounded-xl p-3 text-sm leading-relaxed resize-y" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} /><p id="coparent-note-hint" className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.noteHint}</p><button type="submit" disabled={busy || !note.trim()} className={button} style={primary}>{busy ? c.saving : c.save}</button></form>
        <section className="space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="arbor-type-title">{c.moments}</h2><button type="button" disabled={loading} onClick={() => void refresh()} className={button} style={{ color: "var(--arbor-clay)" }}>{c.refresh}</button></div>{workspace.moments.length === 0 ? <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{c.noMoments}</p> : <ul className="space-y-3">{workspace.moments.map((m) => <li key={m.id} className="rounded-2xl p-5 space-y-2 arbor-depth-card" style={card}><p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{m.addedByYou ? c.you : c.shared} · <bdi>{date(m.at)}</bdi></p><p dir="auto" className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.text}</p></li>)}</ul>}</section>
      </> : checked && !loading && !error && <section className="space-y-3">{invitations.length === 0 ? <p className="text-sm leading-relaxed">{c.empty}</p> : invitations.map((g) => <div key={g.id} className="rounded-2xl p-5 space-y-4 arbor-depth-card" style={card}><p className="arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>{c.invitation}</p><h2 className="arbor-type-title" dir="auto">{g.childName}</h2><p className="text-sm break-words">{c.invitedBy} <bdi>{g.ownerEmail}</bdi></p><p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.intro}</p><button type="button" disabled={busy} onClick={() => void join(g.id)} className={button} style={primary}>{busy ? c.joining : g.acceptedAt ? c.open : c.join}</button></div>)}</section>}
      <footer className="border-t pt-4 flex flex-wrap gap-2" style={{ borderColor: "var(--arbor-rule)" }}><button type="button" onClick={leave} className={button} style={{ color: "var(--arbor-muted)" }}>{needsOnboarding ? c.own : c.back}</button><button type="button" onClick={exitAccount} className={button} style={{ color: "var(--arbor-muted)" }}>{c.signOut}</button></footer>
    </div>
  </main>;
}
