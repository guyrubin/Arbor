import React, { useEffect, useState } from "react";
import { Languages, Sparkles, LogOut, ShieldCheck, BarChart3, Gift, Palette, Bell, FlaskConical } from "lucide-react";
import { Modal } from "../ui/Modal";
import AdminDashboard from "./AdminDashboard";
import InviteCard from "../referral/InviteCard";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useEntitlement } from "../../hooks/useEntitlement";
import { api } from "../../lib/api";
import { T } from "../../lib/tokens";
import { ACCENT_THEMES, getSavedTheme, setTheme, type AccentTheme } from "../../lib/theme";
import type { UiLang } from "../../lib/i18n";

/** Lightweight app settings — wired to real app state (app language, trust panels,
 *  notifications, billing, and account). */
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { uiLang, aiLang, setUiLang, t } = useLanguage();
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
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(getSavedTheme);
  const [draftUiLang, setDraftUiLang] = useState<UiLang>(uiLang);
  const languageDirty = draftUiLang !== uiLang || draftUiLang !== aiLang;

  useEffect(() => {
    if (open) setDraftUiLang(uiLang);
  }, [open, uiLang]);

  const handleSaveLanguage = () => {
    setUiLang(draftUiLang);
    toast(t("set.language.saved"), "success");
  };

  const handleCancelLanguage = () => {
    setDraftUiLang(uiLang);
  };

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

  const handleThemeChange = (theme: AccentTheme) => {
    setTheme(theme);
    setAccentTheme(theme);
  };

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
        <Section title={t("set.section.billing")} sub={t("set.section.billingSub")}>
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

        {/* mk-p0-2 referral loop: invite a parent, both earn a free Plus month */}
        <div>
          <Row icon={<Gift className="w-4 h-4" />} title={t("set.referral.title")} sub={t("set.referral.sub")}>
            <span />
          </Row>
          <InviteCard />
        </div>
        </Section>

        <Section title={t("set.section.languageAppearance")} sub={t("set.section.languageAppearanceSub")}>
        {/* App language */}
        <Row icon={<Languages className="w-4 h-4" />} title={t("set.language.title")} sub={t("set.language.sub")}>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              {([["en", "EN"], ["he", "עב"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setDraftUiLang(k)}
                  aria-pressed={draftUiLang === k}
                  className="min-h-[44px] min-w-[44px] px-3 rounded-lg text-xs font-bold transition"
                  style={draftUiLang === k ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelLanguage}
                disabled={!languageDirty}
                className="text-xs font-bold rounded-xl px-3 py-2 disabled:opacity-40"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {t("set.language.cancel")}
              </button>
              <button
                onClick={handleSaveLanguage}
                disabled={!languageDirty}
                className="text-xs font-bold rounded-xl px-3 py-2 disabled:opacity-40"
                style={{ background: "var(--arbor-clay)", color: T.onAccent }}
              >
                {t("set.language.save")}
              </button>
            </div>
          </div>
        </Row>

        {/* AP-052: Accent theme picker */}
        <Row icon={<Palette className="w-4 h-4" />} title={t("set.theme.title")} sub={t("set.theme.sub")}>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            {(ACCENT_THEMES as readonly AccentTheme[]).map((theme) => (
              <button
                key={theme}
                onClick={() => handleThemeChange(theme)}
                aria-pressed={accentTheme === theme}
                className="px-3 py-1 rounded-lg text-xs font-bold transition"
                style={accentTheme === theme ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}
              >
                {t(`set.theme.${theme}`)}
              </button>
            ))}
          </div>
        </Row>
        </Section>

        <Section title={t("set.section.privacyTrust")} sub={t("set.section.privacyTrustSub")}>

        {/* AI Engines panel */}
        <Row icon={<Sparkles className="w-4 h-4" />} title={t("set.rail.title")} sub={t("set.rail.sub")}>
          <button onClick={() => setShowAiRail(!showAiRail)} aria-pressed={showAiRail} className="w-11 h-6 rounded-full transition relative" style={{ background: showAiRail ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${showAiRail ? "end-[22px]" : "start-0.5"}`} />
          </button>
        </Row>
        </Section>

        <Section title={t("set.section.notifications")} sub={t("set.section.notificationsSub")}>

        {/* AP-058: Smart Reminders — parent nudge preferences over existing JITAI */}
        <Row icon={<Bell className="w-4 h-4" />} title={t("sr.title")} sub={t("sr.subtitle")}>
          <button
            onClick={() => { onClose(); setActiveTab("smart-reminders"); }}
            className="text-xs font-bold rounded-xl px-3 py-2"
            style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
            data-testid="settings-open-smart-reminders"
          >
            {t("set.data.open")}
          </button>
        </Row>
        </Section>

        <Section title={t("set.section.childData")} sub={t("set.section.childDataSub")}>

        {/* AP-060: The Science — source-transparency page (static editorial, no child data) */}
        <Row icon={<FlaskConical className="w-4 h-4" />} title={t("sci.settings.title")} sub={t("sci.settings.sub")}>
          <button
            onClick={() => { onClose(); setActiveTab("science"); }}
            className="text-xs font-bold rounded-xl px-3 py-2"
            style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
            data-testid="settings-open-science"
          >
            {t("sci.settings.open")}
          </button>
        </Row>

        {/* Data & privacy → profile editor (export / delete live there) */}
        <Row icon={<ShieldCheck className="w-4 h-4" />} title={t("set.data.title")} sub={t("set.data.sub")}>
          <button onClick={() => { onClose(); setActiveTab("profile"); }} className="text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            {t("set.data.open")}
          </button>
        </Row>
        </Section>

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

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-3 space-y-3" style={{ background: "rgba(255,255,255,0.62)", border: "1px solid var(--arbor-rule)" }}>
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{sub}</p>
      </div>
      {children}
    </section>
  );
}

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
