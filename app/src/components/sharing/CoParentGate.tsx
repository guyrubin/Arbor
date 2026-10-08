import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { coParentCopy } from "../../lib/i18nElevation/coParent";
import { coParentApi, CoParentError } from "../../lib/coParentApi";
import type { CoParentWorkspace } from "../../sharing/coParentTypes";
import type { ShareGrant } from "../../types";
import Icon from "../ui/Icon";

const button = "min-h-11 rounded-xl px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:cursor-wait";
const primary = { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" };
const card = { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" };

/** The invited adult reaches this BEFORE child onboarding. All content and
 * writes stay in the original owner's child tree; this creates no profile. */
export default function CoParentGate({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { loading: profileLoading, needsOnboarding } = useProfile();
  const { uiLang } = useLanguage();
  const c = coParentCopy[uiLang];
  // Labelled, invented QA state; this branch is removed from production builds.
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("coparent-preview");
  const [requested] = useState(() => new URLSearchParams(window.location.search).get("join"));
  const [dismissed, setDismissed] = useState(false);
  const [shares, setShares] = useState<ShareGrant[]>([]);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<CoParentWorkspace | null>(null);
  const [error, setError] = useState<"verify" | "ended" | "error" | "saveError" | null>(null);
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const active = !dismissed && (preview || ((Boolean(requested) || needsOnboarding) && user?.uid !== "local-sandbox"));

  const failure = (e: unknown, saving = false) => {
    if (e instanceof CoParentError && e.status === 403) {
      setWorkspace(null); setSelected(null);
      setError(e.code === "verify_email" ? "verify" : "ended");
    } else setError(saving ? "saveError" : "error");
  };
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    if (preview) {
      setWorkspace({ childId: "preview-only", childName: uiLang === "he" ? "נועם · משפחה לדוגמה" : "Noam · example family", ownerEmail: null,
        activity: { id: "preview-activity", text: uiLang === "he" ? "בונים מגדל בתורות. מניחים קובייה אחת, מחכים ואז מזמינים: עכשיו תורך." : "Build a tower together. Place one block, wait, then invite: Your turn.", acceptedAt: "2026-10-08T12:00:00Z", completedAt: null },
        moments: [{ id: "preview-moment", text: uiLang === "he" ? "אחרי הגן ישבנו ביחד על השטיח. נועם בחר את הקובייה הראשונה." : "After preschool, we sat together on the rug. Noam chose the first block.", at: "2026-10-08T12:05:00Z", addedByYou: false }] });
      setSelected("preview-only"); setChecked(true); setLoading(false); return;
    }
    try {
      const result = await coParentApi.invitations();
      setShares(result.shares);
      if (requested) {
        const match = result.shares.find((g) => g.id === requested);
        if (!match) { setWorkspace(null); setSelected(null); setError("ended"); }
        else if (match.acceptedAt) {
          setWorkspace(await coParentApi.workspace(match.id)); setSelected(match.id);
        }
      }
    } catch (e) { failure(e); }
    finally { setLoading(false); setChecked(true); }
  }, [requested, user?.uid, preview, uiLang]);
  useEffect(() => { if (active && !profileLoading) void load(); }, [active, profileLoading, load]);

  const refresh = useCallback(async () => {
    if (!selected || preview) return load();
    setLoading(true); setError(null);
    try { setWorkspace(await coParentApi.workspace(selected)); }
    catch (e) { failure(e); }
    finally { setLoading(false); }
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
    setBusy(true); setError(null);
    try {
      await coParentApi.accept(id);
      setWorkspace(await coParentApi.workspace(id)); setSelected(id); setNote("");
      requestId.current = crypto.randomUUID();
    } catch (e) { failure(e); }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected || !note.trim()) return;
    setBusy(true); setError(null); setNotice("");
    if (preview) {
      setWorkspace((w) => w && ({ ...w, moments: [{ id: requestId.current, text: note.trim(), at: new Date().toISOString(), addedByYou: true }, ...w.moments] }));
      setNote(""); requestId.current = crypto.randomUUID(); setNotice(c.saved); setBusy(false); return;
    }
    try {
      await coParentApi.note(selected, note.trim(), requestId.current);
      setNote(""); requestId.current = crypto.randomUUID(); setNotice(c.saved);
      try { setWorkspace(await coParentApi.workspace(selected)); } catch (e) { failure(e); }
    } catch (e) { failure(e, true); }
    finally { setBusy(false); }
  };
  const complete = async () => {
    if (!selected || !workspace?.activity) return;
    setBusy(true); setError(null);
    if (preview) { setWorkspace((w) => w && ({ ...w, activity: w.activity && { ...w.activity, completedAt: new Date().toISOString() } })); setNotice(c.completed); setBusy(false); return; }
    try { await coParentApi.complete(selected, workspace.activity.id); setNotice(c.completed); try { setWorkspace(await coParentApi.workspace(selected)); } catch (e) { failure(e); } }
    catch (e) { failure(e, true); }
    finally { setBusy(false); }
  };
  const leave = () => {
    const url = new URL(window.location.href); url.searchParams.delete("join");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setWorkspace(null); setSelected(null); setDismissed(true);
  };
  if (!active || (checked && !requested && !preview && !error && shares.length === 0)) return <>{children}</>;
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
        <section className="rounded-2xl p-5 space-y-4 arbor-depth-primary" style={card} data-testid="coparent-activity"><div className="flex items-center gap-3"><Icon name="diversity_3" size={24} style={{ color: "var(--arbor-clay)" }} /><h2 className="arbor-type-title">{c.activity}</h2></div><p className="text-base leading-relaxed whitespace-pre-wrap" dir="auto">{workspace.activity?.text || c.noActivity}</p>{workspace.activity && <>{workspace.activity.completedAt ? <p className="text-sm font-bold flex items-center gap-2"><Icon name="check" size={18} />{c.completed} · <bdi>{date(workspace.activity.completedAt)}</bdi></p> : <button type="button" disabled={busy} className={button} style={primary} onClick={() => void complete()}>{busy ? c.saving : c.done}</button>}</>}</section>
        <form onSubmit={(e) => void save(e)} className="rounded-2xl p-5 space-y-3 arbor-depth-card" style={card}><label htmlFor="coparent-note" className="block arbor-type-title">{c.note}</label><textarea id="coparent-note" dir="auto" value={note} onChange={(e) => { setNote(e.target.value); requestId.current = crypto.randomUUID(); }} disabled={busy} required maxLength={1200} rows={4} placeholder={c.placeholder} aria-describedby="coparent-note-hint" className="w-full rounded-xl p-3 text-sm leading-relaxed resize-y" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} /><p id="coparent-note-hint" className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.noteHint}</p><button type="submit" disabled={busy || !note.trim()} className={button} style={primary}>{busy ? c.saving : c.save}</button></form>
        <section className="space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="arbor-type-title">{c.moments}</h2><button type="button" disabled={loading} onClick={() => void refresh()} className={button} style={{ color: "var(--arbor-clay)" }}>{c.refresh}</button></div>{workspace.moments.length === 0 ? <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{c.noMoments}</p> : <ul className="space-y-3">{workspace.moments.map((m) => <li key={m.id} className="rounded-2xl p-5 space-y-2 arbor-depth-card" style={card}><p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{m.addedByYou ? c.you : c.shared} · <bdi>{date(m.at)}</bdi></p><p dir="auto" className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.text}</p></li>)}</ul>}</section>
      </> : checked && !loading && !error && <section className="space-y-3">{invitations.length === 0 ? <p className="text-sm leading-relaxed">{c.empty}</p> : invitations.map((g) => <div key={g.id} className="rounded-2xl p-5 space-y-4 arbor-depth-card" style={card}><p className="arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>{c.invitation}</p><h2 className="arbor-type-title" dir="auto">{g.childName}</h2><p className="text-sm break-words">{c.invitedBy} <bdi>{g.ownerEmail}</bdi></p><p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.intro}</p><button type="button" disabled={busy} onClick={() => void join(g.id)} className={button} style={primary}>{busy ? c.joining : g.acceptedAt ? c.open : c.join}</button></div>)}</section>}
      <footer className="border-t pt-4 flex flex-wrap gap-2" style={{ borderColor: "var(--arbor-rule)" }}><button type="button" onClick={leave} className={button} style={{ color: "var(--arbor-muted)" }}>{needsOnboarding ? c.own : c.back}</button><button type="button" onClick={() => void signOut()} className={button} style={{ color: "var(--arbor-muted)" }}>{c.signOut}</button></footer>
    </div>
  </main>;
}
