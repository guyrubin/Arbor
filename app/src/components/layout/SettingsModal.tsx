import React, { useState } from "react";
import { Languages, Sparkles, LogOut, ShieldCheck, BarChart3 } from "lucide-react";
import { Modal } from "../ui/Modal";
import AdminDashboard from "./AdminDashboard";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useEntitlement } from "../../hooks/useEntitlement";
import { api } from "../../lib/api";
import { T } from "../../lib/tokens";

/** Lightweight app settings — wired to real app state (AI language, AI Engines
 *  panel, account). Replaces the previously dead "Settings" sidebar button. */
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { aiLang, setAiLang, t } = useLanguage();
  const { showAiRail, setShowAiRail, setActiveTab } = useArbor();
  const { user, signOut, firebaseEnabled } = useAuth();
  const { toast } = useToast();
  const { entitlement } = useEntitlement();
  const isPaid = entitlement.plan !== "free";
  const isBeta = isPaid && !entitlement.enforced;
  const coachLimit = entitlement.limits.coachMessagesPerDay;
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [adminOpen, setAdminOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const planLabel = isBeta
    ? t("set.plan.beta")
    : entitlement.plan === "family"
      ? t("set.plan.family")
      : entitlement.plan === "plus"
        ? t("set.plan.plus")
        : t("set.plan.free");
  const planDesc = entitlement.plan === "family"
    ? t("set.plan.familyDesc")
    : entitlement.plan === "plus"
      ? t("set.plan.plusDesc")
      : t("set.plan.freeDesc");

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "";
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? new Date(ms).toLocaleDateString() : "";
  };
  // The status line under a paid plan: trial / renews / ends / payment issue.
  const statusLine = (() => {
    if (!isPaid || isBeta) return null;
    const date = fmtDate(entitlement.currentPeriodEnd);
    if (entitlement.status === "grace_period") return t("set.plan.grace");
    if (entitlement.status === "in_trial" && date) return t("set.plan.trial", { date });
    if (entitlement.willRenew === false && date) return t("set.plan.renewOff", { date });
    if (date) return t("set.plan.renews", { date });
    return null;
  })();

  const startCheckout = async (plan: "plus" | "family") => {
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await api.billingCheckout(plan, cadence);
      window.location.href = url;
    } catch {
      toast(t("set.plan.checkoutSoon"), "success");
    } finally {
      setBusy(false);
    }
  };
  const openPortal = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await api.billingPortal();
      if (url) window.location.href = url;
      else toast(t("set.plan.manageStore"), "success");
    } catch {
      toast(t("set.plan.manageStore"), "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Modal open={open} onClose={onClose} title={t("set.title")}>
      <div className="space-y-5 text-sm">
        {/* Plan — read from the real entitlement endpoint (MON-1 / MON-2 billing) */}
        {/* m3-hex-sweep: #eef6f1 insight-wash start has no m2 token yet; left as-is
            per spec (would become --gradient-insight if m2 adds it). */}
        <div className="rounded-2xl p-4" style={{ background: "linear-gradient(120deg,#eef6f1,var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: T.paperElevated, color: "var(--arbor-green-ink)" }}><Sparkles className="w-4 h-4" /></span>
              <div className="min-w-0">
                <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>
                  {t("set.plan.your", { plan: planLabel })}
                </p>
                <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{planDesc}</p>
              </div>
            </div>
          </div>

          {/* Paid: show renewal/trial status + manage */}
          {isPaid && !isBeta && (
            <>
              {statusLine && (
                <p className="text-xs mt-2" style={{ color: entitlement.status === "grace_period" ? "var(--arbor-pink-ink)" : "var(--arbor-muted)" }}>
                  {statusLine}
                </p>
              )}
              {entitlement.provider && entitlement.provider !== "none" && entitlement.provider !== "comp" && (
                <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>
                  {t("set.plan.viaStore", { provider: entitlement.provider })}
                </p>
              )}
              <button onClick={() => void openPortal()} disabled={busy} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 disabled:opacity-50" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                {t("set.plan.manage")}
              </button>
            </>
          )}

          {/* Free: usage + cadence toggle + upgrade to Plus / Family */}
          {!isPaid && (
            <>
              {coachLimit !== null && (
                <p className="text-xs mt-2" style={{ color: "var(--arbor-muted)" }}>
                  {t("set.plan.coachToday", { used: entitlement.usage.coachMessagesToday, limit: coachLimit })}
                </p>
              )}
              <p className="text-xs leading-relaxed mt-3" style={{ color: "var(--arbor-muted)" }}>
                {t("set.plan.plusPitch")}
              </p>
              <div className="flex items-center gap-1 rounded-xl p-1 mt-3 w-fit" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                {(["monthly", "annual"] as const).map((c) => (
                  <button key={c} onClick={() => setCadence(c)} className="px-3 py-1 rounded-lg text-xs font-bold transition"
                    style={cadence === c ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}>
                    {t(c === "monthly" ? "set.plan.monthly" : "set.plan.annual")}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <button onClick={() => void startCheckout("plus")} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 disabled:opacity-50" style={{ background: "var(--arbor-clay)", color: T.onAccent }}>
                  {t("set.plan.upgradePlus")}
                </button>
                <button onClick={() => void startCheckout("family")} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 disabled:opacity-50" style={{ background: "var(--arbor-green-ink)", color: T.onAccent }}>
                  {t("set.plan.upgradeFamily")}
                </button>
              </div>
            </>
          )}
        </div>

        {/* AI response language */}
        <Row icon={<Languages className="w-4 h-4" />} title={t("set.aiLang.title")} sub={t("set.aiLang.sub")}>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            {([["en", "EN"], ["he", "עב"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setAiLang(k)} className="px-3 py-1 rounded-lg text-xs font-bold transition"
                style={aiLang === k ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}>
                {label}
              </button>
            ))}
          </div>
        </Row>

        {/* AI Engines panel */}
        <Row icon={<Sparkles className="w-4 h-4" />} title={t("set.rail.title")} sub={t("set.rail.sub")}>
          <button onClick={() => setShowAiRail(!showAiRail)} aria-pressed={showAiRail} className="w-11 h-6 rounded-full transition relative" style={{ background: showAiRail ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${showAiRail ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </Row>

        {/* Data & privacy → profile editor (export / delete live there) */}
        <Row icon={<ShieldCheck className="w-4 h-4" />} title={t("set.data.title")} sub={t("set.data.sub")}>
          <button onClick={() => { onClose(); setActiveTab("profile"); }} className="text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            {t("set.data.open")}
          </button>
        </Row>

        {/* ADM-1: founder-only single-pane dashboard (users, paying, token spend) */}
        {entitlement.isAdmin && (
          <Row icon={<BarChart3 className="w-4 h-4" />} title="Founder dashboard" sub="Users, paying plans, and AI spend today">
            <button onClick={() => setAdminOpen(true)} className="text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-clay)", color: T.onAccent }}>
              Open
            </button>
          </Row>
        )}

        {/* P0-5: attribution + UTM funnel dashboard (operator-only) */}
        {entitlement.isAdmin && (
          <Row icon={<BarChart3 className="w-4 h-4" />} title="Attribution & funnel" sub="Install → activation → paid, by channel and market">
            <button onClick={() => { onClose(); setActiveTab("attribution"); }} className="text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
              Open
            </button>
          </Row>
        )}

        {firebaseEnabled && user && (
          <div className="pt-4" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{user.displayName || t("set.signedIn")}</p>
                {user.email && <p className="text-xs truncate" style={{ color: "var(--arbor-muted)" }}>{user.email}</p>}
              </div>
              <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
                <LogOut className="w-3.5 h-3.5" /> {t("set.signOut")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
    {entitlement.isAdmin && <AdminDashboard open={adminOpen} onClose={() => setAdminOpen(false)} />}
    </>
  );
}

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>{icon}</span>
        <div className="min-w-0">
          <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>{title}</p>
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{sub}</p>
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
