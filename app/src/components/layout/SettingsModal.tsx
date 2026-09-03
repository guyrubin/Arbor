import React, { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import AdminDashboard from "./AdminDashboard";
import ParentalGatePanel from "./ParentalGatePanel";
import DeleteAccountModal from "./DeleteAccountModal";
import InviteCard from "../referral/InviteCard";
import { PlanPrices } from "../billing/PlanPrices";
import { LegalLinks } from "../billing/LegalLinks"; // MOB-01: Privacy · Terms · Support — the About section's legal row
import { Skeleton } from "../ui/Skeleton";
import { PlanBadge } from "../ui/PlanBadge";
import { useLanguage, type AiLang } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useEntitlement } from "../../hooks/useEntitlement";
import { useCheckout } from "../../hooks/useCheckout";
import { T } from "../../lib/tokens";
import { fmtDay } from "../../lib/formatDate";
import { readBuildInfo, webBuildInfo, type BuildInfo } from "../../lib/appInfo";
import { isNativePlatform } from "../../lib/runtime";
import { SUPPORT_EMAIL, mailtoHref } from "../../lib/supportContacts";
import { openLegalLink } from "../../lib/legalLinks";
import { exportChildData, downloadJson } from "../../lib/childData";

/** Lightweight app settings — wired to real app state (app language, trust panels,
 *  notifications, billing, account, and MOB-20 the store-expected About basics). */
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { uiLang, aiLang, setUiLang, setAiLang, t } = useLanguage();
  const { showAiRail, setShowAiRail, setActiveTab, childProfile } = useArbor();
  const { user, signOut, firebaseEnabled } = useAuth();
  const { toast } = useToast();
  // MOB-08: `loading` → skeleton row (never "Free" while unsure); `isFallback`
  // → "couldn't verify — showing last known · Retry" line.
  const { entitlement, loading: entitlementLoading, isFallback: entitlementUnverified, retry: retryEntitlement } = useEntitlement();
  const isPaid = entitlement.plan !== "free";
  const isBeta = isPaid && !entitlement.enforced;
  const coachLimit = entitlement.limits.coachMessagesPerDay;
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [adminOpen, setAdminOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // STORE-2: all checkout/manage/restore actions go through the ONE platform-
  // gated hook — no inline `/api/billing/*` calls in this file (guard-tested).
  const { busy, startCheckout, openPortal, restorePurchases, isNative } = useCheckout();

  // RUN-17: language applies on tap (no Save/Cancel pair). LANG-ADV-OVERRIDE:
  // bilingual parents (e.g. Hebrew interface, English clinical guidance) can
  // opt the AI response language away from the app language — the only
  // deliberate toggle left. Off → the AI follows the app language.
  const [aiOverride, setAiOverride] = useState<boolean>(aiLang !== uiLang);
  useEffect(() => {
    if (open) setAiOverride(aiLang !== uiLang);
  }, [open, uiLang, aiLang]);

  const tapUiLang = (k: "en" | "he") => {
    if (k === uiLang) return;
    setUiLang(k); // cascades aiLang := k
    if (aiOverride) setAiLang(aiLang); // keep the deliberate override
  };
  const toggleAiOverride = () => {
    const next = !aiOverride;
    setAiOverride(next);
    if (!next) setAiLang(uiLang);
  };

  // MOB-20: version + native build number (the plugin answers after mount).
  const [buildInfo, setBuildInfo] = useState<BuildInfo>(webBuildInfo);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void readBuildInfo({ isNative: isNativePlatform }).then((info) => {
      if (alive) setBuildInfo(info);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  // MOB-20: "Export my data" — the existing GDPR export path (lib/childData),
  // one tap from Settings instead of two hops via the profile drawer.
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportChildData(user?.uid, childProfile);
      downloadJson(`arbor-${childProfile.name.toLowerCase().replace(/\s+/g, "-")}-export.json`, data);
      toast(t("elev.settingsWave.about.exported"), "success");
    } catch {
      toast(t("elev.settingsWave.about.exportFail"), "error");
    } finally {
      setExporting(false);
    }
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

  // F-09: explicit-month app-locale date, never the browser's numeric default.
  const fmtDate = (iso?: string | null) => fmtDay(iso, uiLang);
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

  const versionLine = buildInfo.native && buildInfo.build
    ? t("elev.settingsWave.about.version.native", { version: buildInfo.version, build: buildInfo.build })
    : t("elev.settingsWave.about.version.web", { version: buildInfo.version });

  const chipBtn: React.CSSProperties = { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" };
  const childFirstName = (childProfile.name || "").split(" ")[0] || t("elev.settingsWave.age.childFallback");

  return (
    <>
    <Modal open={open} onClose={onClose} title={t("set.title")}>
      <div className="space-y-5 text-sm">
        <Section title={t("set.section.billing")} sub={t("set.section.billingSub")}>
        {/* Plan — read from the real entitlement endpoint (MON-1 / MON-2 billing) */}
        {/* m3-hex-sweep (resolved): the old green-tinted #eef6f1 wash now has a sapphire
            token — --arbor-paper-tinted — so the insight well sits in the 2035 chrome. */}
        <div className="rounded-2xl p-4" style={{ background: "linear-gradient(120deg,var(--arbor-paper-tinted),var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: T.paperElevated, color: "var(--arbor-clay-deep)" }}><Icon name="auto_awesome" size={18} /></span>
              <div className="min-w-0">
                {entitlementLoading ? (
                  /* MOB-08: skeleton while the entitlement is unresolved — a Plus
                     parent must never read "Your plan: Free" during the fetch. */
                  <div role="status" aria-label={t("elev.storeshell.plan.verifying")} data-testid="plan-loading" className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                ) : (
                  <>
                    <p className="font-bold flex items-center gap-2 flex-wrap" style={{ color: "var(--arbor-ink)" }}>
                      {t("set.plan.your", { plan: planLabel })}
                      {/* 3.6 — the plan chip on the plan row itself (paid plans only). */}
                      {entitlement.plan === "plus" && <PlanBadge plan="plus" />}
                      {entitlement.plan === "family" && <PlanBadge plan="family" />}
                    </p>
                    <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{planDesc}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* MOB-08: the server could not be asked — say so, and offer Retry
              instead of silently showing Free + upgrade CTAs. */}
          {!entitlementLoading && entitlementUnverified && (
            <p className="text-xs mt-2 flex flex-wrap items-center gap-2" data-testid="plan-unverified" style={{ color: "var(--arbor-peach-ink)" }}>
              <span>{t("elev.storeshell.plan.unverified")}</span>
              <button type="button" onClick={() => void retryEntitlement()} className="font-bold underline underline-offset-2 min-h-[44px]" style={{ color: "var(--arbor-clay-deep)" }}>
                {t("elev.storeshell.plan.retry")}
              </button>
            </p>
          )}

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
              <button onClick={() => void openPortal()} disabled={busy} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px] disabled:opacity-50" style={chipBtn}>
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
                  <button key={c} onClick={() => setCadence(c)} className="px-3 py-1 rounded-lg text-xs font-bold transition min-h-[44px]"
                    style={cadence === c ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}>
                    {t(c === "monthly" ? "set.plan.monthly" : "set.plan.annual")}
                  </button>
                ))}
              </div>
              {/* CARE-5: the real price, in the parent's language, BEFORE any redirect. */}
              <div className="mt-2.5">
                <PlanPrices cadence={cadence} />
              </div>
              {/* 3.6 — each upgrade row carries its plan badge, so what's paid is
                  labeled BEFORE any tap toward checkout. */}
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1.5">
                  <button onClick={() => void startCheckout("plus", cadence)} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px] disabled:opacity-50" style={{ background: "var(--arbor-clay)", color: T.onAccent }}>
                    {t("set.plan.upgradePlus")}
                  </button>
                  <PlanBadge plan="plus" />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <button onClick={() => void startCheckout("family", cadence)} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px] disabled:opacity-50" style={{ background: "var(--arbor-clay-deep)", color: T.onAccent }}>
                    {t("set.plan.upgradeFamily")}
                  </button>
                  <PlanBadge plan="family" />
                </span>
              </div>
            </>
          )}

          {/* STORE-2: Apple-required Restore Purchases — native builds ONLY
              (StoreKit/Play re-links past purchases to this account). */}
          {isNative && (
            <button onClick={() => void restorePurchases()} disabled={busy} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px] disabled:opacity-50" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
              {t("set.plan.restore")}
            </button>
          )}
        </div>

        {/* mk-p0-2 referral loop: invite a parent, both earn a free Plus month */}
        <div>
          <Row icon={<Icon name="redeem" size={18} />} title={t("set.referral.title")} sub={t("set.referral.sub")}>
            <span />
          </Row>
          <InviteCard />
        </div>
        </Section>

        <Section title={t("set.section.languageAppearance")} sub={t("set.section.languageAppearanceSub")}>
        {/* App language — RUN-17: one tap applies it (no Save/Cancel). */}
        <Row icon={<Icon name="language" size={18} />} title={t("set.language.title")} sub={t("set.language.sub")}>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }} data-testid="settings-ui-lang">
              {([["en", "EN"], ["he", "עב"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => tapUiLang(k)}
                  aria-pressed={uiLang === k}
                  className="min-h-[44px] min-w-[44px] px-3 rounded-lg text-xs font-bold transition"
                  style={uiLang === k ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[11px]" style={{ color: "var(--arbor-faint)" }}>{t("elev.settingsWave.language.applied")}</span>
          </div>
        </Row>

        {/* LANG-ADV-OVERRIDE: advanced — let the AI answer in a different language than the UI */}
        <Row icon={<Icon name="language" size={18} />} title={t("set.aiLang.title")} sub={t("set.aiLang.sub")}>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={toggleAiOverride}
              aria-pressed={aiOverride}
              aria-label={t("set.aiLang.toggle")}
              className="w-11 h-6 rounded-full transition relative"
              style={{ background: aiOverride ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${aiOverride ? "end-[22px]" : "start-0.5"}`} style={{ background: T.paperElevated }} />
            </button>
            {aiOverride && (
              <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }} data-testid="settings-ai-lang">
                {([["en", "EN"], ["he", "עב"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setAiLang(k as AiLang)}
                    aria-pressed={aiLang === k}
                    className="min-h-[44px] min-w-[44px] px-3 rounded-lg text-xs font-bold transition"
                    style={aiLang === k ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Row>
        {/* CR-19: the accent-theme picker is gone — three options resolved to one palette. */}
        </Section>

        <Section title={t("set.section.privacyTrust")} sub={t("set.section.privacyTrustSub")}>

        {/* AI Engines panel */}
        <Row icon={<Icon name="auto_awesome" size={18} />} title={t("set.rail.title")} sub={t("set.rail.sub")}>
          <button onClick={() => setShowAiRail(!showAiRail)} aria-pressed={showAiRail} className="w-11 h-6 rounded-full transition relative" style={{ background: showAiRail ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${showAiRail ? "end-[22px]" : "start-0.5"}`} style={{ background: T.paperElevated }} />
          </button>
        </Row>
        {/* STORE-3: parent PIN management — the ONLY setup surface (the kid-mode
            challenge card can no longer mint the PIN). */}
        <div className="pt-1">
          <Row icon={<Icon name="lock" size={18} />} title={t("elev.gate.set.title")} sub={t("elev.gate.set.sub")}>
            <span />
          </Row>
          <ParentalGatePanel />
        </div>
        </Section>

        <Section title={t("set.section.notifications")} sub={t("set.section.notificationsSub")}>

        {/* AP-058: Gentle Reminders — parent nudge preferences over existing JITAI
            (MOB-19/ENG-23: the phone-push toggle lives there, under Delivery). */}
        <Row icon={<Icon name="notifications" size={18} />} title={t("sr.title")} sub={t("sr.subtitle")}>
          <button
            onClick={() => { onClose(); setActiveTab("smart-reminders"); }}
            className="text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]"
            style={chipBtn}
            data-testid="settings-open-smart-reminders"
          >
            {t("elev.settingsWave.notif.open")}
          </button>
        </Row>
        </Section>

        <Section title={t("set.section.childData")} sub={t("set.section.childDataSub")}>

        {/* AP-060: The Science — source-transparency page (static editorial, no child data) */}
        <Row icon={<Icon name="science" size={18} />} title={t("sci.settings.title")} sub={t("sci.settings.sub")}>
          <button
            onClick={() => { onClose(); setActiveTab("science"); }}
            className="text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]"
            style={chipBtn}
            data-testid="settings-open-science"
          >
            {t("sci.settings.open")}
          </button>
        </Row>

        {/* Data & privacy → profile editor (edit / per-child delete live there) */}
        <Row icon={<Icon name="verified_user" size={18} />} title={t("set.data.title")} sub={t("set.data.sub")}>
          <button onClick={() => { onClose(); setActiveTab("profile"); }} className="text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]" style={chipBtn}>
            {t("set.data.open")}
          </button>
        </Row>
        </Section>

        {/* MOB-20 / CR-19 / RUN-17: the store-expected basics — version, support,
            legal, export, delete — in ONE visible section (settingsAbout.test.ts). */}
        <Section title={t("elev.settingsWave.about.title")} sub={t("elev.settingsWave.about.sub")}>
          <Row icon={<Icon name="info" size={18} />} title={t("elev.settingsWave.about.version")} sub={versionLine}>
            <span data-testid="settings-about-version" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>
              {buildInfo.version}
            </span>
          </Row>

          <Row icon={<Icon name="mail" size={18} />} title={t("elev.settingsWave.about.support")} sub={t("elev.settingsWave.about.support.sub")}>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={mailtoHref(SUPPORT_EMAIL)}
                className="inline-flex items-center text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]"
                style={chipBtn}
                data-testid="settings-support-email"
              >
                {t("elev.settingsWave.about.support.email")}
              </a>
              <button
                type="button"
                onClick={() => void openLegalLink("support", { isNative: isNativePlatform })}
                className="inline-flex items-center text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
                data-testid="settings-support-page"
              >
                {t("elev.settingsWave.about.support.page")}
              </button>
            </div>
          </Row>

          {/* MOB-01: Privacy · Terms · Support — reachable in-app (Apple 5.1.1(i),
              Play Data Safety). */}
          <Row icon={<Icon name="policy" size={18} />} title={t("elev.settingsWave.about.legal")} sub={t("elev.settingsWave.about.legal.sub")}>
            <div data-testid="settings-legal-links">
              <LegalLinks />
            </div>
          </Row>

          <Row icon={<Icon name="download" size={18} />} title={t("elev.settingsWave.about.export")} sub={t("elev.settingsWave.about.export.sub", { name: childFirstName })}>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              aria-busy={exporting}
              className="text-xs font-bold rounded-xl px-3 py-2 min-h-[44px] disabled:opacity-60"
              style={chipBtn}
              data-testid="settings-export-data"
            >
              {t("elev.settingsWave.about.export.cta")}
            </button>
          </Row>

          {/* STORE-4: full account deletion (Apple 5.1.1(v) / Play / GDPR
              Art. 17) — a visible row; the heavy type-to-confirm lives in the modal. */}
          <Row icon={<Icon name="delete" size={18} />} title={t("elev.settingsWave.about.delete")} sub={t("elev.settingsWave.about.delete.sub")}>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]"
              style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}
              data-testid="settings-delete-account"
            >
              {t("elev.settingsWave.about.delete.cta")}
            </button>
          </Row>
        </Section>

        {/* P0.2 (SET-ADMIN): operator-only tools isolated in their own section */}
        {entitlement.isAdmin && (
          <Section title={t("set.section.admin")} sub={t("set.section.adminSub")}>
            {/* ADM-1: founder-only single-pane dashboard (users, paying, token spend) */}
            <Row icon={<Icon name="bar_chart" size={18} />} title={t("set.admin.founder.title")} sub={t("set.admin.founder.sub")}>
              <button onClick={() => setAdminOpen(true)} className="text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]" style={{ background: "var(--arbor-clay)", color: T.onAccent }}>
                {t("set.admin.open")}
              </button>
            </Row>
            {/* P0-5: attribution + UTM funnel dashboard (operator-only) */}
            <Row icon={<Icon name="bar_chart" size={18} />} title={t("set.admin.attribution.title")} sub={t("set.admin.attribution.sub")}>
              <button onClick={() => { onClose(); setActiveTab("attribution"); }} className="text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]" style={{ background: "var(--arbor-clay)", color: T.onAccent }}>
                {t("set.admin.open")}
              </button>
            </Row>
          </Section>
        )}

        {firebaseEnabled && user && (
          <div className="pt-4" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{user.displayName || t("set.signedIn")}</p>
                {user.email && <p className="text-xs truncate" style={{ color: "var(--arbor-muted)" }}>{user.email}</p>}
              </div>
              <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
                <Icon name="logout" size={16} /> {t("set.signOut")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
    {entitlement.isAdmin && <AdminDashboard open={adminOpen} onClose={() => setAdminOpen(false)} />}
    <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-3 space-y-3" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
      <div>
        {/* GREEN-DRIFT-SETTINGS: neutral eyebrow, not emerald, in the sapphire 2035 chrome */}
        <h3 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--arbor-faint)" }}>{sub}</p>
      </div>
      {children}
    </section>
  );
}

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        {/* GREEN-DRIFT-SETTINGS: sapphire chip (clay-dim/clay-deep, the Sidebar/Topbar idiom) — green stays reserved for semantic success/active state. */}
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}>{icon}</span>
        <div className="min-w-0">
          <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>{title}</p>
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{sub}</p>
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
