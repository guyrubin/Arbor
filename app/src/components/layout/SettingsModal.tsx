import React, { useEffect, useState } from "react";
import ToneSheet, { toneLabel } from "../coach/ToneSheet";
import { Icon } from "../ui/Icon";
import { APP_BUILD } from "../../lib/buildVersion";
import { Modal } from "../ui/Modal";
// MOB-28 / CR-22: below `lg` this dialog is a bottom SHEET, not a centred
// card. Same contract, same dialogStack ownership — only the box moves.
import { Sheet, useCompactSurface } from "../ui/Sheet";
import AdminDashboard from "./AdminDashboard";
import ParentalGatePanel from "./ParentalGatePanel";
import { consumeSettingsFocus, SETTINGS_FOCUS_ANCHOR } from "./settingsBus";
import DeleteAccountModal from "./DeleteAccountModal";
import YourDataSheet from "./YourDataSheet";
import InviteCard from "../referral/InviteCard";
import { PlanPrices } from "../billing/PlanPrices";
import { LegalLinks } from "../billing/LegalLinks"; // MOB-01: Privacy · Terms · Support in the footer
import { Skeleton } from "../ui/Skeleton";
import { PlanBadge } from "../ui/PlanBadge";
import { useLanguage, type AiLang } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useEntitlement } from "../../hooks/useEntitlement";
import { useCheckout } from "../../hooks/useCheckout";
import { T } from "../../lib/tokens";
import { ACCENT_THEMES, getSavedTheme, setTheme, type AccentTheme } from "../../lib/theme";
import { translate, type UiLang } from "../../lib/i18n";
import { fmtDay } from "../../lib/formatDate";

/** Lightweight app settings — wired to real app state (app language, trust panels,
 *  notifications, billing, and account). */
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { uiLang, aiLang, setUiLang, setAiLang, t } = useLanguage();
  const { setActiveTab, pendingMemoryItems, approvedMemoryItems, selectedLens, setSelectedLens } = useArbor();
  // B-PLAY-21: the ONE tone sheet, opened from section 1 (same store as Ask).
  const [toneOpen, setToneOpen] = useState(false);
  // B-SHELL-13: the "What Arbor remembers" row counts pending + approved facts.
  const memoryCount = (pendingMemoryItems?.length ?? 0) + (approvedMemoryItems?.length ?? 0);
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
  // B-CAREPRO-35: Settings › Your data — export / delete child / delete account.
  const [dataOpen, setDataOpen] = useState(false);
  // STORE-2: all checkout/manage/restore actions go through the ONE platform-
  // gated hook — no inline `/api/billing/…` calls in this file (guard-tested).
  const { busy, startCheckout, openPortal, restorePurchases, isNative } = useCheckout();
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(getSavedTheme);
  const [draftUiLang, setDraftUiLang] = useState<UiLang>(uiLang);
  // LANG-ADV-OVERRIDE: bilingual parents (e.g. Hebrew interface, English clinical
  // guidance) can opt the AI response language away from the app language. When the
  // toggle is off, the AI language follows the app language (the default cascade).
  const [draftAiDifferent, setDraftAiDifferent] = useState<boolean>(aiLang !== uiLang);
  const [draftAiLang, setDraftAiLang] = useState<AiLang>(aiLang);
  const effectiveAiLang: AiLang = draftAiDifferent ? draftAiLang : draftUiLang;
  const languageDirty = draftUiLang !== uiLang || effectiveAiLang !== aiLang;

  useEffect(() => {
    if (open) {
      setDraftUiLang(uiLang);
      setDraftAiDifferent(aiLang !== uiLang);
      setDraftAiLang(aiLang);
    }
  }, [open, uiLang, aiLang]);

  // B-PLAY-06: a caller that opened Settings for one row (Practice's "Set a
  // PIN") lands with that row in view. Two frames: the sheet mounts, then lays out.
  useEffect(() => {
    if (!open) { setDataOpen(false); return; } // a closed Settings never reopens on the sheet
    const focus = consumeSettingsFocus();
    // B-CAREPRO-35: "Export or delete" from any surface opens the sheet itself.
    if (focus === "data") setDataOpen(true);
    if (!focus || typeof window === "undefined") return;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-testid="${SETTINGS_FOCUS_ANCHOR[focus]}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [open]);

  // A closed Settings session must never reopen the destructive confirmation.
  useEffect(() => {
    if (!open || !firebaseEnabled || !user) setDeleteOpen(false);
  }, [open, firebaseEnabled, user?.uid]);

  const handleSaveLanguage = () => {
    setUiLang(draftUiLang); // sets uiLang AND aiLang := draftUiLang (whole-app cascade)
    if (effectiveAiLang !== draftUiLang) setAiLang(effectiveAiLang); // override AI only when it should differ
    // OBJ-SHELL-02: `t` is bound to the OUTGOING language for this render, so
    // the confirmation of a switch to Hebrew arrived in English — the one
    // string in the app whose language IS the thing being confirmed. Translated
    // against the incoming language explicitly.
    toast(translate(draftUiLang, "set.language.saved"), "success");
  };

  const handleCancelLanguage = () => {
    setDraftUiLang(uiLang);
    setDraftAiDifferent(aiLang !== uiLang);
    setDraftAiLang(aiLang);
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

  const handleThemeChange = (theme: AccentTheme) => {
    setTheme(theme);
    setAccentTheme(theme);
  };

  const Surface = useCompactSurface() ? Sheet : Modal;

  return (
    <>
    <Surface open={open && !deleteOpen} onClose={onClose} title={t("set.title")}>
      <div className="space-y-5 text-sm">
        {/* B-SHELL-13: section 1 is how Arbor works with you — language, AI
            language, reminders (moved here, not duplicated) and what Arbor
            remembers. Order: companion → Kid Mode & PIN → plan → your data →
            account (pinned by settingsOrder.test.ts). */}
        <Section title={t("set.section.companion")} sub={t("set.section.companionSub")}>
        {/* App language */}
        <Row icon={<Icon name="language" size={18} />} title={t("set.language.title")} sub={t("set.language.sub")}>
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
                className="text-xs font-bold rounded-xl px-3 min-h-11 disabled:opacity-40"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {t("set.language.cancel")}
              </button>
              <button
                onClick={handleSaveLanguage}
                disabled={!languageDirty}
                className="text-xs font-bold rounded-xl px-3 min-h-11 disabled:opacity-40"
                style={{ background: "var(--arbor-clay)", color: T.onAccent }}
              >
                {t("set.language.save")}
              </button>
            </div>
          </div>
        </Row>

        {/* LANG-ADV-OVERRIDE: advanced — let the AI answer in a different language than the UI */}
        <Row icon={<Icon name="language" size={18} />} title={t("set.aiLang.title")} sub={t("set.aiLang.sub")}>
          <div className="flex flex-col items-end gap-2">
            {/* R5: the switch measured 42x23. The TRACK stays 44x24 — that is
                the right visual — and the button around it is the 44 px target
                the finger needs. */}
            <button
              onClick={() => setDraftAiDifferent((v) => !v)}
              aria-pressed={draftAiDifferent}
              aria-label={t("set.aiLang.toggle")}
              className="w-11 min-h-11 h-11 flex items-center justify-center relative"
            >
              <span className="w-11 h-6 rounded-full transition block" style={{ background: draftAiDifferent ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }} />
              <span className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white transition-all ${draftAiDifferent ? "end-[2px]" : "start-[2px]"}`} />
            </button>
            {draftAiDifferent && (
              <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                {([["en", "EN"], ["he", "עב"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setDraftAiLang(k)}
                    aria-pressed={draftAiLang === k}
                    className="min-h-[44px] min-w-[44px] px-3 rounded-lg text-xs font-bold transition"
                    style={draftAiLang === k ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Row>

        {/* AP-052: Accent theme picker — rendered ONLY when there is a real
            choice. It shipped offering three options whose palettes were
            byte-identical after the CR-01 retint. Restoring a second theme to
            ACCENT_THEMES brings this row back automatically. */}
        {ACCENT_THEMES.length > 1 && (
        <Row icon={<Icon name="palette" size={18} />} title={t("set.theme.title")} sub={t("set.theme.sub")}>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            {(ACCENT_THEMES as readonly AccentTheme[]).map((theme) => (
              <button
                key={theme}
                onClick={() => handleThemeChange(theme)}
                aria-pressed={accentTheme === theme}
                className="px-3 min-h-11 rounded-lg text-xs font-bold transition"
                style={accentTheme === theme ? { background: "var(--arbor-clay)", color: T.onAccent } : { color: "var(--arbor-muted)" }}
              >
                {t(`set.theme.${theme}`)}
              </button>
            ))}
          </div>
        </Row>
        )}

        {/* AP-058: Smart Reminders — parent nudge preferences over existing JITAI */}
        <Row icon={<Icon name="notifications" size={18} />} title={t("sr.title")} sub={t("sr.subtitle")}>
          <button
            onClick={() => { onClose(); setActiveTab("smart-reminders"); }}
            className="text-xs font-bold rounded-xl px-3 min-h-11"
            style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}
            data-testid="settings-open-smart-reminders"
          >
            {/* OBJ-SHELL-07: this row reused `set.data.open` — "Open profile" —
                on the Gentle Reminders row. Its own key, its own sentence. */}
            {t("elev.sr.open")}
          </button>
        </Row>

        {/* TJB-25 / IA-07 + B-TODAY-13: Today's pill row collapses below
            `md`, so this row is the always-present door to #/day-windows at
            390; the other doors are the md+ pill and the rhythm line's "See
            the hours" link when a PREP or CALM cue shows. Same open pattern,
            its own shipped keys (dw.title / dw.subtitle / dw.cta, EN + HE). */}
        <Row icon={<Icon name="schedule" size={18} />} title={t("dw.title")} sub={t("dw.subtitle")}>
          <button
            onClick={() => { onClose(); setActiveTab("day-windows"); }}
            className="text-xs font-bold rounded-xl px-3 min-h-11"
            style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}
            data-testid="settings-open-day-windows"
          >
            {t("dw.cta")}
          </button>
        </Row>

        {/* B-SHELL-13: What Arbor remembers — a plain count of the facts the
            parent has approved plus the ones awaiting their review; opens the
            memory ledger (Profile band 3 once lane-CAREPRO retires memory). */}
        <Row
          icon={<Icon name="psychology" size={18} />}
          title={t("set.memory.title")}
          sub={memoryCount > 0 ? t(memoryCount === 1 ? "set.memory.sub.one" : "set.memory.sub.many", { n: memoryCount }) : t("set.memory.sub.none")}
        >
          <button
            onClick={() => { onClose(); setActiveTab("memory"); }}
            className="text-xs font-bold rounded-xl px-3 min-h-11"
            style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}
            data-testid="settings-open-memory"
          >
            {t("set.memory.open")}
          </button>
        </Row>

        {/* B-PLAY-21: how Arbor talks with you — the same sheet as Ask and Family. */}
        <Row icon={<Icon name="tune" size={18} />} title={t("coach.tone.title")} sub={toneLabel(selectedLens, t)}>
          <button
            onClick={() => setToneOpen(true)}
            className="text-xs font-bold rounded-xl px-3 min-h-11"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
            data-testid="settings-tone-row"
          >
            {t("coach.tone.change")}
          </button>
        </Row>
        <ToneSheet open={toneOpen} onClose={() => setToneOpen(false)} selectedLens={selectedLens} onSelect={setSelectedLens} t={t} />
        </Section>

        <Section title={t("set.section.kidModePin")} sub={t("set.section.kidModePinSub")}>

        {/* B-SHELL-01: the AI-rail switch is gone with the rail; Privacy &
            trust is the PIN row only. */}
        {/* STORE-3: parent PIN management — the ONLY setup surface (the kid-mode
            challenge card can no longer mint the PIN). */}
        <div className="pt-1" data-testid="settings-pin-row">
          <Row icon={<Icon name="lock" size={18} />} title={t("elev.gate.set.title")} sub={t("elev.gate.set.sub")}>
            <span />
          </Row>
          <ParentalGatePanel />
        </div>
        </Section>

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
                ) : entitlementUnverified ? (
                  /* MOB-07: the fetch FINISHED and failed. The fallback plan is
                     "free", and printing it here reads as a verdict on a parent
                     who may have paid ninety seconds ago. Name the state
                     instead; the line below carries the reason and the Retry. */
                  <p className="font-bold" data-testid="plan-unknown" style={{ color: "var(--arbor-ink)" }}>
                    {t("elev.storeshell.plan.verifying")}
                  </p>
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
              <button onClick={() => void openPortal()} disabled={busy} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 min-h-11 disabled:opacity-50" style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}>
                {t("set.plan.manage")}
              </button>
            </>
          )}

          {/* Free: usage + cadence toggle + upgrade to Plus / Family.
              MOB-07/MOB-08: only when the plan is actually KNOWN to be free.
              Selling an upgrade to somebody whose just-completed checkout has
              not been confirmed yet is the worst moment in the product to get
              wrong — and the usage counter under it is fallback data too. */}
          {!isPaid && !entitlementUnverified && (
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
                  <button key={c} onClick={() => setCadence(c)} className="px-3 min-h-11 rounded-lg text-xs font-bold transition"
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
                  <button onClick={() => void startCheckout("plus", cadence, "settings")} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 min-h-11 disabled:opacity-50" style={{ background: "var(--arbor-clay)", color: T.onAccent }}>
                    {t("set.plan.upgradePlus")}
                  </button>
                  <PlanBadge plan="plus" />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <button onClick={() => void startCheckout("family", cadence, "settings")} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 min-h-11 disabled:opacity-50" style={{ background: "var(--arbor-clay-deep)", color: T.onAccent }}>
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
            <button onClick={() => void restorePurchases()} disabled={busy} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 min-h-11 disabled:opacity-50" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
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

        <Section title={t("set.section.childData")} sub={t("set.section.childDataSub")}>

        {/* AP-060: The Science — source-transparency page (static editorial, no child data) */}
        <Row icon={<Icon name="science" size={18} />} title={t("sci.settings.title")} sub={t("sci.settings.sub")}>
          <button
            onClick={() => { onClose(); setActiveTab("science"); }}
            className="text-xs font-bold rounded-xl px-3 min-h-11"
            style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}
            data-testid="settings-open-science"
          >
            {t("sci.settings.open")}
          </button>
        </Row>

        {/* MOB-20: Settings had no version and no way to reach a human — the
            two things a parent needs when something is wrong and they are
            about to write to us. `hello@arbor.app` is the address the app
            already gives (auth.accessFail, EN+HE). B-INF-05: the build is the
            7-char commit SHA stamped by vite (`lib/buildVersion.ts`), "dev" locally. */}
        <Row icon={<Icon name="info" size={18} />} title={t("elev.accountSettings.about.title")} sub={t("elev.accountSettings.about.sub", { version: APP_BUILD })}>
          <a
            href="mailto:hello@arbor.app"
            data-testid="settings-support-link"
            className="inline-flex items-center text-xs font-bold rounded-xl px-3 min-h-11"
            style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}
          >
            {t("elev.accountSettings.about.contact")}
          </a>
        </Row>

        {/* B-CAREPRO-35: Your data — ONE tap opens the one home for export,
            child deletion (with its receipt) and account deletion. It used to
            open #/profile, not the controls. B-CAREPRO-24: the anchor the
            "Export or delete" links scroll to. */}
        <div data-testid="settings-data-row">
        <Row icon={<Icon name="verified_user" size={18} />} title={t("elev.yourData.row.title")} sub={t("elev.yourData.row.sub")}>
          <button onClick={() => setDataOpen(true)} data-testid="settings-open-your-data" aria-haspopup="dialog" className="text-xs font-bold rounded-xl px-3 min-h-11" style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}>
            {t("elev.yourData.row.open")}
          </button>
        </Row>
        </div>
        </Section>

        {/* P0.2 (SET-ADMIN): operator-only tools isolated in their own section */}
        {entitlement.isAdmin && (
          <Section title={t("set.section.admin")} sub={t("set.section.adminSub")}>
            {/* ADM-1: founder-only single-pane dashboard (users, paying, token spend) */}
            <Row icon={<Icon name="bar_chart" size={18} />} title={t("set.admin.founder.title")} sub={t("set.admin.founder.sub")}>
              <button onClick={() => setAdminOpen(true)} className="text-xs font-bold rounded-xl px-3 min-h-11" style={{ background: "var(--arbor-clay)", color: T.onAccent }}>
                {t("set.admin.open")}
              </button>
            </Row>
            {/* P0-5: attribution + UTM funnel dashboard (operator-only) */}
            <Row icon={<Icon name="bar_chart" size={18} />} title={t("set.admin.attribution.title")} sub={t("set.admin.attribution.sub")}>
              <button onClick={() => { onClose(); setActiveTab("attribution"); }} className="text-xs font-bold rounded-xl px-3 min-h-11" style={{ background: "var(--arbor-clay)", color: T.onAccent }}>
                {t("set.admin.open")}
              </button>
            </Row>
          </Section>
        )}

        {firebaseEnabled && user && (
          <Section title={t("elev.accountSettings.title")} sub={t("elev.accountSettings.sub")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{user.displayName || t("set.signedIn")}</p>
                {user.email && <p className="text-xs truncate" style={{ color: "var(--arbor-muted)" }}>{user.email}</p>}
              </div>
              <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
                <Icon name="logout" size={16} /> {t("set.signOut")}
              </button>
            </div>
            {/* STORE-4: full account deletion (Apple 5.1.1(v) / Play / GDPR
                Art. 17) — quiet entry, heavy type-to-confirm inside the modal. */}
            <button type="button" onClick={() => setDeleteOpen(true)} aria-haspopup="dialog" className="inline-flex items-center min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
              {t("set.acctDel.open")}
            </button>
          </Section>
        )}

        {/* MOB-01: Privacy · Terms · Support — reachable in-app (Apple 5.1.1(i),
            Play Data Safety), next to the account controls. */}
        <div className="pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
          <LegalLinks />
        </div>
      </div>
    </Surface>
    {entitlement.isAdmin && <AdminDashboard open={adminOpen} onClose={() => setAdminOpen(false)} />}
    <DeleteAccountModal open={open && deleteOpen && firebaseEnabled && Boolean(user)} onClose={() => setDeleteOpen(false)} />
    <YourDataSheet
      open={open && dataOpen}
      onClose={() => setDataOpen(false)}
      onDeleteAccount={firebaseEnabled && user ? () => setDeleteOpen(true) : undefined}
    />
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-3 space-y-3" style={{ background: "rgba(255,255,255,0.62)", border: "1px solid var(--arbor-rule)" }}>
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
