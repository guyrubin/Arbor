import React, { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { downloadJson } from "../../lib/childData";
import { api, ApiError, PaywallError } from "../../lib/api";
import type { DeletionReceipt, ShareGrant, ShareRole, SharedPacketView } from "../../types";
import Modal from "../ui/Modal";
import { PageHeader, SectionCard, cardCls, Chip, TrustSafetyBar, PASTEL, PastelKey, InitialsTile } from "../ui/kit";
import { ErrorState } from "../ui/ErrorState";
import { REPORTS } from "./Reports";
import { isProfessionalReportType } from "../../lib/reportExport";
import { REPORT_SCOPE_BY_TYPE, type ShareScopeId, scopeDisplayLabels, shareScopeLabelKey } from "../../lib/shareScopes";
import { fmtDay } from "../../lib/formatDate";

// IA W4.5 + CARE-3: the professional share scopes mirror the W4.1 preset
// audiences one-to-one — derived from the single REPORTS definition
// (Reports.tsx) via stable scope IDs (lib/shareScopes.ts). Grants store the
// IDs; localized labels resolve at render and can never leak into enforcement.
const PRESET_SCOPE_IDS = REPORTS.flatMap((r) => (isProfessionalReportType(r.type) ? [REPORT_SCOPE_BY_TYPE[r.type]] : []));
const SCOPE_OPTIONS: ShareScopeId[] = ["story_timeline", "weekly_insight", "behavior_patterns", "milestones", ...PRESET_SCOPE_IDS];
// Stable duration IDs sent to the server (expiryFromDuration reads "30"/"60"/
// "term"/"revok" out of them); localized labels via share.duration.* keys.
const DURATIONS = ["30d", "60d", "term", "until_revoked"] as const;
const ROLES: ShareRole[] = ["co_parent", "viewer", "professional"];
const ROLE_TONE: Record<ShareRole, PastelKey> = { co_parent: "mint", professional: "sky", viewer: "lav" };

/** Care Network › Trusted Sharing — the ONE roster surface (W4.4 merged the
 *  former My Care Team here): the people coordinating around the child, derived
 *  from real, server-enforced share grants — scoped, time-boxed, revocable
 *  (incl. co-parents) — plus what's shared with you. */
export default function TrustedSharing() {
  const { childProfile, behaviorLogs, actionPlans, openPaywall, setActiveTab } = useArbor();
  const { deleteChild } = useProfile();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  // CARE-3: display resolvers — stable IDs → localized labels, at render only.
  const roleLabel = (r: ShareRole) => t(`share.role.${ROLES.includes(r) ? r : "viewer"}`);
  const scopesLabel = (scopes: string[]) => scopeDisplayLabels(scopes, t).join(", ");
  const expiryLabel = (g: ShareGrant) =>
    g.expiresAt ? t("sec.sharing.expires", { date: fmtDay(g.expiresAt, uiLang) }) : t("share.duration.until_revoked");

  const [shares, setShares] = useState<ShareGrant[]>([]);
  const [inbound, setInbound] = useState<ShareGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [draft, setDraft] = useState({ recipientEmail: "", role: "co_parent" as ShareRole, scopes: [] as ShareScopeId[], duration: DURATIONS[0] as string });

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    // Track each call independently: a partial failure still renders what loaded,
    // but a total failure surfaces a real error/retry instead of a false "empty" roster.
    let aFailed = false;
    let bFailed = false;
    try {
      const [mine, toMe] = await Promise.all([
        // CARE-6: one owner fetch returns the FULL grant record set (history=1);
        // live grants form the roster, ended ones the sharing history below.
        api.listShares(childProfile.id, { history: true }).catch(() => { aFailed = true; return { shares: [] }; }),
        api.sharedWithMe().catch(() => { bFailed = true; return { shares: [] }; }),
      ]);
      setShares(mine.shares || []);
      setInbound(toMe.shares || []);
      if (aFailed && bFailed) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [childProfile.id]);

  useEffect(() => { void load(); }, [load]);

  // CARE-6 + CARE-8: the roster shows only live grants; revoked/expired grants
  // move to the persistent "Sharing history" card — the grant records
  // (createdAt/expiresAt/revokedAt) ARE the audit trail, surviving reloads.
  const isLiveGrant = (g: ShareGrant) => !g.revokedAt && (!g.expiresAt || Date.parse(g.expiresAt) > Date.now());
  const team = shares.filter(isLiveGrant);
  const history = shares.filter((g) => !isLiveGrant(g));
  // F-09: explicit-month app-locale date, never the browser's numeric default.
  const fmtDate = (iso: string | null) => fmtDay(iso, uiLang);

  const setScope = (f: ShareScopeId) => setDraft((d) => ({ ...d, scopes: d.scopes.includes(f) ? d.scopes.filter((x) => x !== f) : [...d.scopes, f] }));

  const createShare = async () => {
    const email = draft.recipientEmail.trim();
    if (!email || draft.scopes.length === 0) return;
    setBusy("create");
    try {
      await api.createShare({ childId: childProfile.id, childName: childProfile.name, recipientEmail: email, role: draft.role, scopes: draft.scopes, duration: draft.duration });
      toast(t("sec.sharing.audit.shared", { scopes: scopesLabel(draft.scopes), email, role: roleLabel(draft.role) }), "success");
      setDraft({ recipientEmail: "", role: "co_parent", scopes: [], duration: DURATIONS[0] });
      setReviewing(false);
      setAdding(false);
      await load();
    } catch (e: any) {
      if (e instanceof PaywallError) openPaywall(e.feature, e.plan);
      else toast(t("sec.sharing.audit.createError", { message: e.message }), "error");
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (g: ShareGrant) => {
    setBusy(g.id);
    try {
      await api.revokeShare(g.id);
      // CARE-6: no ephemeral log needed — the reload moves the revoked grant
      // (with its revocation date) into the persistent Sharing history card.
      toast(t("sec.sharing.audit.revoked", { email: g.recipientEmail }), "success");
      await load();
    } catch (e: any) {
      toast(t("sec.sharing.audit.revokeError", { message: e.message }), "error");
    } finally {
      setBusy(null);
    }
  };

  // CARE-2: the recipient shared VIEW — clicking an inbound card opens a
  // read-only viewer of exactly the granted scopes, assembled server-side
  // through the fail-closed consult-packet egress (counts only, no raw
  // documents, no write access). A 403/404 means the share has ended → the
  // card disappears from the inbound roster.
  const [viewing, setViewing] = useState<ShareGrant | null>(null);
  const [view, setView] = useState<SharedPacketView | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<"ended" | "blocked" | "generic" | null>(null);

  const openSharedView = async (g: ShareGrant) => {
    setViewing(g);
    setView(null);
    setViewError(null);
    setViewLoading(true);
    try {
      setView(await api.sharedPacket(g.id));
    } catch (e: any) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        // Server says no access NOW (revoked/expired/fail-closed scopes):
        // drop the dead card so the roster reflects reality.
        setViewError("ended");
        setInbound((prev) => prev.filter((x) => x.id !== g.id));
      } else if (e instanceof ApiError && e.status === 422) {
        setViewError("blocked");
      } else {
        setViewError("generic");
      }
    } finally {
      setViewLoading(false);
    }
  };

  const closeSharedView = () => {
    setViewing(null);
    setView(null);
    setViewError(null);
  };

  const exportData = () => {
    downloadJson(`arbor-${first.toLowerCase()}-data.json`, {
      exportedAt: new Date().toISOString(),
      child: childProfile,
      behaviorLogs,
      actionPlans,
      note: t("sec.sharing.data.exportNote"),
    });
    toast(t("sec.sharing.audit.exported", { name: first }), "success");
  };

  // CARE-1: REAL GDPR Art. 17 erasure — the old confirm/alert theater claimed a
  // server-side deletion request that never left the browser. The flow now runs
  // through the ONE tested erase seam: typed child-name confirmation in the app
  // Modal → ProfileContext.deleteChild → eraseEverything (childData.ts) →
  // POST /privacy/erase + full client wipe via the CHILD_SUBCOLLECTIONS
  // allow-list → provable DeletionReceipt rendered as the done-state.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [erasing, setErasing] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  const [deletedName, setDeletedName] = useState("");

  const nameMatches = confirmName.trim().toLowerCase() === first.trim().toLowerCase();

  const closeDeleteModal = () => {
    if (erasing) return; // never abandon an erasure mid-flight
    setDeleteOpen(false);
    setConfirmName("");
    setDeleteFailed(false);
    if (receipt) {
      // The child no longer exists — route away from the deleted child's surfaces.
      setReceipt(null);
      setActiveTab("overview");
    }
  };

  const confirmDelete = async () => {
    if (!nameMatches || erasing) return;
    setErasing(true);
    setDeleteFailed(false);
    const name = first;
    const childId = childProfile.id;
    try {
      const r = await deleteChild(childId);
      setDeletedName(name);
      setReceipt(
        r ?? { childId, erasedAt: new Date().toISOString(), counts: { memoryEvents: 0, shares: 0 } }
      );
    } catch {
      setDeleteFailed(true);
    } finally {
      setErasing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[920px] space-y-6">
      <PageHeader
        eyebrow={t("nav.care")}
        title={t("sec.sharing.title")}
        subtitle={t("sec.sharing.sub", { name: first })}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setAdding((a) => !a)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: "var(--arbor-gradient-primary)" }}>
              <Icon name="add" size={18} /> {t("sec.sharing.new")}
            </button>
            <button onClick={() => setActiveTab("find-pro")} className="inline-flex min-h-11 items-center justify-center gap-2 px-1 py-2 text-sm font-bold" style={{ color: "var(--arbor-green-ink)" }}>
              {t("sec.sharing.findPro")} <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
            </button>
          </div>
        }
      />

      <TrustSafetyBar note={t("sec.sharing.trustNote")} />

      {error && (
        <ErrorState
          headline={t("err.careTeam.title")}
          body={t("err.careTeam.body", { name: first })}
          onRetry={() => void load()}
          retryLabel={t("err.retry")}
          retrying={loading}
        />
      )}

      {adding && (
        <div className="space-y-4 border-y py-5" style={{ borderColor: "var(--arbor-rule)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("sec.sharing.form.title", { name: first })}</h3>
            <button onClick={() => { setAdding(false); setReviewing(false); }} aria-label={t("aria.cancel")}><Icon name="close" size={17} style={{ color: "var(--arbor-muted)" }} /></button>
          </div>
          {!reviewing && <>
          <input value={draft.recipientEmail} onChange={(e) => setDraft({ ...draft, recipientEmail: e.target.value })} placeholder={t("sec.sharing.form.emailPlaceholder")} type="email" inputMode="email" autoComplete="email" className="w-full rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.form.role")}</p>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button key={r} onClick={() => setDraft({ ...draft, role: r })} aria-pressed={draft.role === r} className="rounded-full px-3 py-1 text-xs font-bold" style={draft.role === r ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{roleLabel(r)}</button>
              ))}
            </div>
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.form.nothingDefault")}</p>
          </div>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.form.what")}</p>
            <div className="flex flex-wrap gap-1.5">
              {SCOPE_OPTIONS.map((f) => {
                const on = draft.scopes.includes(f);
                return <button key={f} onClick={() => setScope(f)} aria-pressed={on} className="rounded-full px-3 py-1 text-xs font-bold" style={on ? { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{t(shareScopeLabelKey(f))}</button>;
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.form.duration")}</p>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button key={d} onClick={() => setDraft({ ...draft, duration: d })} aria-pressed={draft.duration === d} className="rounded-full px-3 py-1 text-xs font-bold" style={draft.duration === d ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{t(`share.duration.${d}`)}</button>
              ))}
            </div>
          </div>
          <button onClick={() => setReviewing(true)} disabled={!/^\S+@\S+\.\S+$/.test(draft.recipientEmail.trim()) || draft.scopes.length === 0} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-2.5 disabled:opacity-40" style={{ background: "var(--arbor-clay)" }}>
            {t("sec.sharing.form.review")} <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
          </button>
          </>}
          {reviewing && <div className="space-y-4" aria-live="polite">
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.review.recipient")}</p><p className="text-sm font-extrabold mt-0.5 break-all" dir="auto" style={{ color: "var(--arbor-ink)" }}>{draft.recipientEmail.trim()}</p></div><Chip tone="mint">{roleLabel(draft.role)}</Chip></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.review.canSee")}</p><div className="flex flex-wrap gap-1.5 mt-1.5">{draft.scopes.map((scope) => <Chip key={scope} tone="sky">{t(shareScopeLabelKey(scope))}</Chip>)}</div></div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--arbor-muted)" }}><Icon name="schedule" size={16} /> {t(`share.duration.${draft.duration}`)}</div>
            </div>
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "var(--arbor-yellow-soft)", border: "1px solid var(--arbor-rule)" }}><Icon name="verified_user" size={19} style={{ color: "var(--arbor-yellow-ink)" }} /><p className="text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{t("sec.sharing.review.note")}</p></div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end"><button onClick={() => setReviewing(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}>{t("sec.sharing.review.back")}</button><button onClick={createShare} disabled={busy === "create"} className="inline-flex items-center justify-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-2.5 disabled:opacity-60" style={{ background: "var(--arbor-clay)" }}>{busy === "create" ? <><Icon name="progress_activity" size={16} className="animate-spin" /> {t("sec.sharing.review.working")}</> : t("sec.sharing.review.approve")}</button></div>
          </div>}
        </div>
      )}

      {/* CARE-8: ONE roster — the people coordinating around the child, exactly
          one card per live grant (the richer InitialsTile visual, W4.4 intent)
          with the revoke action folded in. The former duplicate "Active shares"
          list is gone. */}
      {!error && (
        <SectionCard title={t("sec.sharing.team.title", { name: first })} icon={<Icon name="diversity_3" size={20} fill={1} />} tone="mint">
          {loading ? (
            <p className="text-sm flex items-center gap-2" style={{ color: "var(--arbor-muted)" }}><Icon name="progress_activity" size={16} className="animate-spin" /> {t("sec.sharing.active.loading")}</p>
          ) : team.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.active.empty")}</p>
          ) : (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {team.map((g) => {
                const tone = ROLE_TONE[g.role] || ROLE_TONE.viewer;
                return (
                  <div key={g.id} className="min-w-0 border-b p-4 last:border-b-0" style={{ borderColor: "var(--arbor-rule)" }}>
                    <div className="flex items-center gap-3">
                      <InitialsTile name={g.recipientEmail} tone={tone} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-extrabold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{g.recipientEmail}</h3>
                        <p className="text-xs" style={{ color: PASTEL[tone].ink }}>{roleLabel(g.role)}</p>
                      </div>
                      <button onClick={() => revoke(g)} disabled={busy === g.id} className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-bold disabled:opacity-50" style={{ color: "var(--arbor-pink-ink)" }}>
                        {busy === g.id ? <Icon name="progress_activity" size={14} className="animate-spin" /> : <Icon name="close" size={15} />} {t("sec.sharing.revoke")}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <Chip tone="sky" icon={<Icon name="verified_user" size={15} fill={1} />}>{scopesLabel(g.scopes) || t("sec.sharing.noScopes")}</Chip>
                      <Chip tone="yellow" icon={<Icon name="schedule" size={15} />}>{expiryLabel(g)}</Chip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {!error && inbound.length > 0 && (
        <SectionCard title={t("sec.sharing.inbound.title")} icon={<Icon name="inbox" size={20} />} tone="lav">
          <div className="space-y-3">
            {inbound.map((s) => (
              <div key={s.id} className={`${cardCls} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{s.childName || t("sec.sharing.inbound.aChild")}</h3>
                    <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.inbound.fromRole", { owner: s.ownerEmail || "—", role: roleLabel(s.role) })}</p>
                  </div>
                  <Chip tone="yellow" icon={<Icon name="schedule" size={15} />}>{expiryLabel(s)}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Chip tone="sky" icon={<Icon name="verified_user" size={15} fill={1} />}>{scopesLabel(s.scopes) || t("sec.sharing.noScopes")}</Chip>
                </div>
                {/* CARE-2: the card is no longer a dead end — open the read-only view. */}
                <button
                  onClick={() => void openSharedView(s)}
                  data-testid={`shared-view-open-${s.id}`}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
                  style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                >
                  <Icon name="visibility" size={17} /> {t("sec.sharing.viewer.open")}
                  <Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <SectionCard title={t("sec.sharing.data.title")} icon={<Icon name="download" size={20} />} tone="lav">
          <div className="space-y-2">
            <button onClick={exportData} className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}><Icon name="download" size={18} /> {t("sec.sharing.data.export")}</button>
            <button onClick={() => setDeleteOpen(true)} data-testid="delete-child-btn" className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-3" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}><Icon name="delete" size={18} /> {t("sec.sharing.delete.btn")}</button>
          </div>
        </SectionCard>
        {/* CARE-6: REAL sharing history — rendered from the persistent grant
            records (created/expired/revoked with dates), not a session-ephemeral
            list. Grants ARE the audit record; it survives any reload. */}
        <SectionCard title={t("sec.sharing.history.title")} icon={<Icon name="history" size={20} />} tone="sky">
          {history.length === 0 ? (
            <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.history.empty")}</p>
          ) : (
            <ul className="space-y-2.5 text-xs max-h-44 overflow-y-auto" data-testid="sharing-history">
              {history.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold truncate" dir="auto" style={{ color: "var(--arbor-ink)" }}>{g.recipientEmail}</p>
                    <p style={{ color: "var(--arbor-muted)" }}>{roleLabel(g.role)} · {t("sec.sharing.history.createdOn", { date: fmtDate(g.createdAt) })}</p>
                  </div>
                  <span className="flex-shrink-0 font-bold" style={{ color: "var(--arbor-pink-ink)" }}>
                    {g.revokedAt
                      ? t("sec.sharing.history.revokedOn", { date: fmtDate(g.revokedAt) })
                      : t("sec.sharing.history.expiredOn", { date: fmtDate(g.expiresAt) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* CARE-2: read-only recipient viewer — exactly the granted scopes,
          server-assembled and guard-checked. No capture paths, no writes. */}
      <Modal
        open={viewing !== null}
        onClose={closeSharedView}
        title={t("sec.sharing.viewer.title", { name: viewing?.childName || t("sec.sharing.inbound.aChild") })}
      >
        <div className="space-y-4" data-testid="shared-view" aria-live="polite">
          {viewLoading && (
            <p className="text-sm flex items-center gap-2" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="progress_activity" size={16} className="animate-spin" /> {t("sec.sharing.viewer.loading")}
            </p>
          )}
          {!viewLoading && viewError && (
            <p role="alert" className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
              {t(`sec.sharing.viewer.${viewError === "ended" ? "ended" : viewError === "blocked" ? "blocked" : "error"}`)}
            </p>
          )}
          {!viewLoading && !viewError && view && (
            <>
              <div className="rounded-2xl p-3 flex items-start gap-2.5" style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule)" }}>
                <Icon name="verified_user" size={18} style={{ color: "var(--arbor-green-ink)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
                  {t("sec.sharing.viewer.readOnly", { owner: view.ownerEmail || "—" })}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {view.scopes.map((scope) => <Chip key={scope} tone="sky">{scopeDisplayLabels([scope], t)[0] || scope}</Chip>)}
              </div>
              {view.sections.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.viewer.empty")}</p>
              ) : (
                view.sections.map((section) => (
                  <div key={section.id} className="rounded-2xl p-4 space-y-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                    <h3 className="text-sm font-extrabold" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{section.title}</h3>
                    {section.note && <p className="text-[11px]" dir="auto" style={{ color: "var(--arbor-muted)" }}>{section.note}</p>}
                    <ul className="space-y-1.5">
                      {section.items.map((item) => (
                        <li key={item.id} className="flex items-start gap-2 text-sm leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                          <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full" style={{ background: "var(--arbor-muted)" }} />
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </>
          )}
          <div className="flex sm:justify-end">
            <button onClick={closeSharedView} className="w-full sm:w-auto rounded-xl px-4 py-2.5 text-sm font-bold" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}>
              {t("sec.sharing.viewer.close")}
            </button>
          </div>
        </div>
      </Modal>

      {/* CARE-1: typed-name confirmation → real erasure → deletion receipt. */}
      <Modal
        open={deleteOpen}
        onClose={closeDeleteModal}
        title={receipt ? t("sec.sharing.receipt.title") : t("sec.sharing.delete.title", { name: first })}
      >
        {!receipt ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{t("sec.sharing.delete.body", { name: first })}</p>
            <div className="space-y-1.5">
              <label htmlFor="delete-confirm-input" className="block text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.delete.typeToConfirm", { name: first })}</label>
              <input
                id="delete-confirm-input"
                data-testid="delete-confirm-input"
                dir="auto"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
            </div>
            {deleteFailed && (
              <p role="alert" className="text-xs font-bold" style={{ color: "var(--arbor-pink-ink)" }}>{t("sec.sharing.delete.error")}</p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button onClick={closeDeleteModal} disabled={erasing} className="rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}>{t("sec.sharing.delete.cancel")}</button>
              <button
                onClick={confirmDelete}
                disabled={!nameMatches || erasing}
                data-testid="delete-confirm-btn"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40"
                style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}
              >
                {erasing
                  ? <><Icon name="progress_activity" size={16} className="animate-spin" /> {t("sec.sharing.delete.working")}</>
                  : <><Icon name="delete_forever" size={16} /> {t("sec.sharing.delete.confirm")}</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4" data-testid="delete-receipt" aria-live="polite">
            <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
              {t("sec.sharing.receipt.body", { name: deletedName, date: fmtDay(receipt.erasedAt, uiLang) })}
            </p>
            <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.receipt.memoryEvents")}</span>
                <span className="font-extrabold" style={{ color: "var(--arbor-ink)" }}>{receipt.counts.memoryEvents}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.receipt.shares")}</span>
                <span className="font-extrabold" style={{ color: "var(--arbor-ink)" }}>{receipt.counts.shares}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span style={{ color: "var(--arbor-muted)" }}>{t("sec.sharing.receipt.consents")}</span>
                <span className="font-extrabold" style={{ color: "var(--arbor-ink)" }}>{receipt.counts.consents ?? 0}</span>
              </div>
            </div>
            <div className="flex sm:justify-end">
              <button onClick={closeDeleteModal} className="w-full sm:w-auto rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: "var(--arbor-gradient-primary)" }}>{t("sec.sharing.receipt.done")}</button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
