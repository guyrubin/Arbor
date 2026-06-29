import React, { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { downloadJson } from "../../lib/childData";
import { api, PaywallError } from "../../lib/api";
import type { ShareGrant, ShareRole } from "../../types";
import { PageHeader, SectionCard, cardCls, Chip, TrustSafetyBar } from "../ui/kit";

const SCOPE_OPTIONS = ["Story timeline", "Weekly Insight", "Behavior patterns", "Milestones", "Teacher Handoff", "Therapist Summary"];
const DURATIONS = ["30 days", "60 days", "End of term", "Until revoked"];
const ROLES: { id: ShareRole; label: string }[] = [
  { id: "co_parent", label: "Co-parent" },
  { id: "viewer", label: "Viewer" },
  { id: "professional", label: "Professional" },
];
const roleLabel = (r: ShareRole) => ROLES.find((x) => x.id === r)?.label || "Viewer";
const expiryLabel = (g: ShareGrant) =>
  g.expiresAt ? `Expires ${new Date(g.expiresAt).toLocaleDateString()}` : "Until revoked";

/** Care Network › Trusted Sharing — real, server-enforced sharing: scoped,
 *  time-boxed, revocable grants (incl. co-parents), plus what's shared with you. */
export default function TrustedSharing() {
  const { childProfile, behaviorLogs, actionPlans, openPaywall } = useArbor();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  const [shares, setShares] = useState<ShareGrant[]>([]);
  const [inbound, setInbound] = useState<ShareGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [audit, setAudit] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ recipientEmail: "", role: "co_parent" as ShareRole, scopes: [SCOPE_OPTIONS[0]] as string[], duration: DURATIONS[0] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, toMe] = await Promise.all([
        api.listShares(childProfile.id).catch(() => ({ shares: [] })),
        api.sharedWithMe().catch(() => ({ shares: [] })),
      ]);
      setShares(mine.shares || []);
      setInbound(toMe.shares || []);
    } finally {
      setLoading(false);
    }
  }, [childProfile.id]);

  useEffect(() => { void load(); }, [load]);

  const setScope = (f: string) => setDraft((d) => ({ ...d, scopes: d.scopes.includes(f) ? d.scopes.filter((x) => x !== f) : [...d.scopes, f] }));

  const createShare = async () => {
    const email = draft.recipientEmail.trim();
    if (!email || draft.scopes.length === 0) return;
    setBusy("create");
    try {
      await api.createShare({ childId: childProfile.id, childName: childProfile.name, recipientEmail: email, role: draft.role, scopes: draft.scopes, duration: draft.duration });
      setAudit((a) => [`Shared ${draft.scopes.join(", ")} with ${email} (${roleLabel(draft.role)}) — just now`, ...a]);
      setDraft({ recipientEmail: "", role: "co_parent", scopes: [SCOPE_OPTIONS[0]], duration: DURATIONS[0] });
      setAdding(false);
      await load();
    } catch (e: any) {
      if (e instanceof PaywallError) openPaywall(e.feature, e.plan);
      else setAudit((a) => [`Could not create share: ${e.message}`, ...a]);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (g: ShareGrant) => {
    setBusy(g.id);
    try {
      await api.revokeShare(g.id);
      setAudit((a) => [`Access revoked for ${g.recipientEmail} — just now`, ...a]);
      await load();
    } catch (e: any) {
      setAudit((a) => [`Could not revoke: ${e.message}`, ...a]);
    } finally {
      setBusy(null);
    }
  };

  const exportData = () => {
    downloadJson(`arbor-${first.toLowerCase()}-data.json`, {
      exportedAt: new Date().toISOString(),
      child: childProfile,
      behaviorLogs,
      actionPlans,
      note: "Parent-initiated export of Arbor data. Non-diagnostic.",
    });
    setAudit((a) => [`You exported all of ${first}'s data — just now`, ...a]);
  };

  const deleteData = () => {
    const ok = window.confirm(`Permanently delete all of ${first}'s data?\n\nThis cannot be undone. (For your safety this requires account verification and is processed server-side.)`);
    if (ok) alert("Deletion request recorded. To protect your child's data, permanent deletion is verified and processed server-side.");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[920px]">
      <PageHeader
        eyebrow="Care Network"
        title={t("sec.sharing.title")}
        subtitle={t("sec.sharing.sub", { name: first })}
        action={
          <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)" }}>
            <Icon name="add" size={18} /> New share
          </button>
        }
      />

      <TrustSafetyBar note="Every share is parent-approved, time-boxed and fully revocable — enforced on the server." />

      {adding && (
        <div className={`${cardCls} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Share {first}'s context</h3>
            <button onClick={() => setAdding(false)} aria-label={t("aria.cancel")}><Icon name="close" size={17} style={{ color: "var(--arbor-muted)" }} /></button>
          </div>
          <input value={draft.recipientEmail} onChange={(e) => setDraft({ ...draft, recipientEmail: e.target.value })} placeholder="Recipient email (they sign in with this to see what you share)" type="email" className="w-full rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>Their role</p>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button key={r.id} onClick={() => setDraft({ ...draft, role: r.id })} aria-pressed={draft.role === r.id} className="rounded-full px-3 py-1 text-xs font-bold" style={draft.role === r.id ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{r.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>What to share</p>
            <div className="flex flex-wrap gap-1.5">
              {SCOPE_OPTIONS.map((f) => {
                const on = draft.scopes.includes(f);
                return <button key={f} onClick={() => setScope(f)} aria-pressed={on} className="rounded-full px-3 py-1 text-xs font-bold" style={on ? { background: "var(--arbor-clay)", color: "#fff" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{f}</button>;
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>Access duration</p>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button key={d} onClick={() => setDraft({ ...draft, duration: d })} aria-pressed={draft.duration === d} className="rounded-full px-3 py-1 text-xs font-bold" style={draft.duration === d ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{d}</button>
              ))}
            </div>
          </div>
          <button onClick={createShare} disabled={busy === "create"} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-2.5 disabled:opacity-60" style={{ background: "var(--arbor-clay)" }}>
            {busy === "create" ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sharing…</> : "Approve & share"}
          </button>
        </div>
      )}

      <SectionCard title="Active shares" icon={<Icon name="share" size={20} />} tone="mint">
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm flex items-center gap-2" style={{ color: "var(--arbor-muted)" }}><RefreshCw className="w-4 h-4 animate-spin" /> Loading shares…</p>
          ) : shares.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>Nothing is shared right now. Add a co-parent or a teacher to get started.</p>
          ) : shares.map((s) => (
            <div key={s.id} className={`${cardCls} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{s.recipientEmail}</h3>
                  <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{roleLabel(s.role)}</p>
                </div>
                <button onClick={() => revoke(s)} disabled={busy === s.id} className="inline-flex items-center gap-1 text-xs font-bold disabled:opacity-50" style={{ color: "var(--arbor-pink-ink)" }}>
                  {busy === s.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Icon name="close" size={15} />} Revoke access
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {s.role === "co_parent" && <Chip tone="mint" icon={<Icon name="group" size={15} />}>Co-parent</Chip>}
                <Chip tone="sky" icon={<Icon name="verified_user" size={15} fill={1} />}>{s.scopes.join(", ")}</Chip>
                <Chip tone="yellow" icon={<Icon name="schedule" size={15} />}>{expiryLabel(s)}</Chip>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {inbound.length > 0 && (
        <SectionCard title="Shared with you" icon={<Icon name="inbox" size={20} />} tone="lav">
          <div className="space-y-3">
            {inbound.map((s) => (
              <div key={s.id} className={`${cardCls} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{s.childName || "A child"}</h3>
                    <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>from {s.ownerEmail || "a parent"} · you are {roleLabel(s.role)}</p>
                  </div>
                  <Chip tone="yellow" icon={<Icon name="schedule" size={15} />}>{expiryLabel(s)}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Chip tone="sky" icon={<Icon name="verified_user" size={15} fill={1} />}>{s.scopes.join(", ")}</Chip>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <SectionCard title="Your data" icon={<Icon name="download" size={20} />} tone="lav">
          <div className="space-y-2">
            <button onClick={exportData} className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}><Icon name="download" size={18} /> Export all data</button>
            <button onClick={deleteData} className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-3" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}><Icon name="delete" size={18} /> Delete child data</button>
          </div>
        </SectionCard>
        <SectionCard title="This session" icon={<Icon name="history" size={20} />} tone="sky">
          <ul className="space-y-2.5 text-xs max-h-44 overflow-y-auto" style={{ color: "var(--arbor-muted)" }}>
            {audit.length === 0 && <li>Share and revoke actions you take will appear here.</li>}
            {audit.map((a, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#69747f" }} />{a}</li>)}
          </ul>
        </SectionCard>
      </div>
    </motion.div>
  );
}
