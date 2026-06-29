import React, { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import type { ShareGrant, ShareRole } from "../../types";
import { PageHeader, SectionCard, cardCls, Chip, PASTEL, PastelKey, InitialsTile } from "../ui/kit";
import { ErrorState } from "../ui/ErrorState";

const ROLE_META: Record<ShareRole, { label: string; tone: PastelKey }> = {
  co_parent: { label: "Co-parent", tone: "mint" },
  professional: { label: "Professional", tone: "sky" },
  viewer: { label: "Viewer", tone: "lav" },
};

const expiryLabel = (g: ShareGrant) =>
  g.expiresAt ? `Access until ${new Date(g.expiresAt).toLocaleDateString()}` : "Access until revoked";

/** Care Network › My Care Team — the people coordinating around the child, derived
 *  from real, server-enforced share grants (no placeholder data). */
export default function CareTeam() {
  const { childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  const [mine, setMine] = useState<ShareGrant[]>([]);
  const [inbound, setInbound] = useState<ShareGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    // Track each call independently: a partial failure still renders what loaded,
    // but a total failure surfaces a real error/retry instead of a false "empty" team.
    let aFailed = false;
    let bFailed = false;
    try {
      const [a, b] = await Promise.all([
        api.listShares(childProfile.id).catch(() => { aFailed = true; return { shares: [] }; }),
        api.sharedWithMe().catch(() => { bFailed = true; return { shares: [] }; }),
      ]);
      setMine((a.shares || []).filter((g) => !g.revokedAt));
      setInbound((b.shares || []).filter((g) => !g.revokedAt));
      if (aFailed && bFailed) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [childProfile.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Care Network"
        title={t("sec.care.title")}
        subtitle={t("sec.care.sub", { name: first })}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab("sharing")} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)" }}>
              <Icon name="person_add" size={18} /> Add someone
            </button>
            <button onClick={() => setActiveTab("find-pro")} className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 bg-white" style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}>
              <Icon name="search" size={18} /> Find a professional
            </button>
          </div>
        }
      />

      {loading ? (
        <div className={`${cardCls} p-6 flex items-center gap-2 text-sm`} style={{ color: "var(--arbor-muted)" }}>
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading your care team…
        </div>
      ) : error ? (
        <ErrorState
          headline={t("err.careTeam.title")}
          body={t("err.careTeam.body", { name: first })}
          onRetry={() => void load()}
          retryLabel={t("err.retry")}
          retrying={loading}
        />
      ) : mine.length === 0 && inbound.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            <Icon name="diversity_3" size={26} fill={1} />
          </div>
          <h3 className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>No one on the team yet</h3>
          <p className="text-sm mt-1.5 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }}>
            Add a co-parent, teacher or therapist and choose exactly what they can see about {first}. Every grant is time-boxed and revocable.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setActiveTab("sharing")} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)" }}>
              <Icon name="person_add" size={18} /> Add someone
            </button>
            <button onClick={() => setActiveTab("find-pro")} className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 bg-white" style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}>
              <Icon name="search" size={18} /> Find a professional
            </button>
          </div>
        </div>
      ) : (
        <>
          {mine.length > 0 && (
            <SectionCard title={`Coordinating around ${first}`} icon={<Icon name="diversity_3" size={20} fill={1} />} tone="mint">
              <div className="grid lg:grid-cols-2 gap-4">
                {mine.map((g) => {
                  const meta = ROLE_META[g.role] || ROLE_META.viewer;
                  return (
                    <div key={g.id} className={`${cardCls} p-5`}>
                      <div className="flex items-center gap-3">
                        <InitialsTile name={g.recipientEmail} tone={meta.tone} />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-extrabold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{g.recipientEmail}</h3>
                          <p className="text-xs" style={{ color: PASTEL[meta.tone].ink }}>{meta.label}</p>
                        </div>
                        <Chip tone={meta.tone}>{meta.label}</Chip>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        <Chip tone="sky" icon={<Icon name="verified_user" size={15} fill={1} />}>{g.scopes.join(", ") || "No scopes"}</Chip>
                        <Chip tone="yellow" icon={<Icon name="schedule" size={15} />}>{expiryLabel(g)}</Chip>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Action icon={<Icon name="visibility" size={15} />} label="Manage access" onClick={() => setActiveTab("sharing")} />
                        <Action icon={<Icon name="share" size={15} />} label="Update what's shared" onClick={() => setActiveTab("sharing")} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {inbound.length > 0 && (
            <SectionCard title="Children shared with you" icon={<Icon name="inbox" size={20} />} tone="lav">
              <div className="grid lg:grid-cols-2 gap-4">
                {inbound.map((g) => {
                  const meta = ROLE_META[g.role] || ROLE_META.viewer;
                  return (
                    <div key={g.id} className={`${cardCls} p-5`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{g.childName || "A child"}</h3>
                          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>from {g.ownerEmail || "a parent"} · you are {meta.label}</p>
                        </div>
                        <Chip tone="yellow" icon={<Icon name="schedule" size={15} />}>{expiryLabel(g)}</Chip>
                      </div>
                      <div className="mt-3"><Chip tone="sky" icon={<Icon name="verified_user" size={15} fill={1} />}>{g.scopes.join(", ")}</Chip></div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </motion.div>
  );
}

function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
      {icon} {label}
    </button>
  );
}
