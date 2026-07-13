import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sprout } from "lucide-react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { HubHero } from "../ui/HubHero";
import { EvidenceChip } from "../ui/EvidenceChip";
import { countSince, WEEK_MS } from "../../lib/pulse";
import DevScoreCard from "../sections/DevScoreCard";
import PhysicalGrowthCard from "../sections/PhysicalGrowthCard";
import ScreeningSheet from "../sections/ScreeningSheet";

/* Growth › Development — ONE coherent screen, no inner tab layer (masterplan
   L2: category → pill is the only navigation; deeper capabilities appear as
   visible cards). The former HubTabs facets are re-homed: the "Now" copilot
   strip renders inline below the hero; Milestones and Journey are visible
   link cards to their own routes (the Growth pill row already carries
   Milestones); the child Profile belongs to the Profile category. Every old
   route (#/copilot, #/milestones, #/journey, #/profile) stays valid. */

/** Inline push opt-in toggle — renders null unless pushCapable() (no VAPID key). */
function PushOptInToggle({
  enabled, pending, onToggle, label, sublabel,
}: {
  enabled: boolean; pending: boolean; onToggle: () => void; label: string; sublabel: string;
}) {
  const [capable, setCapable] = useState(false);
  useEffect(() => {
    import("../../lib/push.js").then(({ pushCapable }) => setCapable(pushCapable()));
  }, []);
  if (!capable) return null;
  return (
    <div className="flex items-center justify-between rounded-2xl px-4 py-3"
      style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
      <div>
        <p className="text-sm font-bold" style={{ color: "var(--arbor-green-ink)" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{sublabel}</p>
      </div>
      <button role="switch" aria-checked={enabled} disabled={pending} onClick={onToggle}
        aria-label={label}
        className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2"
        style={{ background: enabled ? "var(--arbor-clay)" : "var(--arbor-rule)", opacity: pending ? 0.6 : 1, cursor: pending ? "wait" : "pointer" }}>
        <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5"
          style={{ marginLeft: 2, transform: enabled ? "translateX(20px)" : "translateX(0)" }} />
      </button>
    </div>
  );
}

export default function DevelopmentTab() {
  const { t } = useLanguage();
  const { milestones, behaviorLogs, playLogs, childProfile, setActiveTab } = useArbor();
  const [checkOpen, setCheckOpen] = useState(false);
  const firstName = (childProfile.name || "").split(" ")[0];

  // E2 hero stat trio — CLINICAL FIREWALL: counts and plain activity facts
  // only ("x of y noticed", active-domain count, moments-this-week count).
  // Never percentages, verdicts, or trend deltas on this surface.
  const heroStats = useMemo(() => {
    const noticed = milestones.filter((m) => m.checked).length;
    const domainsActive = new Set(milestones.filter((m) => m.checked).map((m) => m.domain)).size;
    const nowMs = Date.now();
    const weekAgo = nowMs - WEEK_MS;
    const momentsWeek = countSince(behaviorLogs, weekAgo, nowMs) + countSince(playLogs, weekAgo, nowMs);
    return { noticed, total: milestones.length, domainsActive, momentsWeek };
  }, [milestones, behaviorLogs, playLogs]);

  // C2 — push opt-in state. The toggle is hidden when pushCapable() is false
  // (no VITE_FIREBASE_VAPID_KEY in the build).
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPending, setPushPending] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
  }, []);
  const handlePushToggle = useCallback(async () => {
    const { pushCapable, registerPush, unregisterPush } = await import("../../lib/push.js");
    if (!pushCapable()) return;
    const apiBase = (window as unknown as { __ARBOR_API_BASE__?: string }).__ARBOR_API_BASE__ || "/api";
    setPushPending(true);
    try {
      if (pushEnabled) {
        await unregisterPush(apiBase);
        setPushEnabled(false);
      } else {
        const result = await registerPush(apiBase);
        setPushEnabled(result === "granted");
      }
    } finally {
      setPushPending(false);
    }
  }, [pushEnabled]);

  return (
    <div className="space-y-5">
      {/* E2 — Growth hub hero: eyebrow → job sentence → ONE CTA (quick check)
          → count trio. Sits ABOVE the existing cards; ring/domain internals
          below are untouched. E8: EvidenceChip on the hero's meta row. */}
      <div>
        <HubHero
          tone="mint"
          icon={Sprout}
          eyebrow={t("elev.hero.growth.eyebrow")}
          title={t("elev.hero.growth.title")}
          subtitle={t("elev.hero.growth.sub")}
          cta={{
            label: t("elev.hero.growth.cta"),
            onClick: () => setCheckOpen(true),
            icon: <Icon name="assignment_turned_in" size={16} />,
            testId: "growth-hero-cta",
          }}
          stats={[
            { value: heroStats.noticed, label: t("elev.hero.growth.stat.noticed", { total: heroStats.total }) },
            { value: heroStats.domainsActive, label: t("elev.hero.growth.stat.domains") },
            { value: heroStats.momentsWeek, label: t("elev.hero.growth.stat.week") },
          ]}
          testId="growth-hub-hero"
        />
        {/* Meta row — pulled up under the hero (hero carries its own mb-6). */}
        <div className="-mt-3 flex items-center px-1">
          <EvidenceChip />
        </div>
      </div>
      {/* The Map — the record's home (ring + domains; counts only). */}
      <DevScoreCard />
      {/* C1 — Monitoring now lives in ONE home: Development Check (the
          ScreeningSheet). The hub keeps only a slim, neutral pointer into it —
          no scores, verdicts, or risk framing (CLINICAL FIREWALL). */}
      <button
        type="button"
        onClick={() => setCheckOpen(true)}
        data-testid="dev-watching-pointer"
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start transition active:scale-[0.99]"
        style={{ minHeight: 44, background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
          <Icon name="visibility" size={18} style={{ color: "var(--arbor-green-ink)" }} />
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug" style={{ color: "var(--arbor-ink)" }}>
          {firstName
            ? t("dev.watching.line", { name: firstName })
            : t("dev.watching.lineGeneric")}
        </span>
        <span className="inline-flex flex-shrink-0 items-center gap-1 text-[12px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
          {t("dev.watching.cta")}
          <Icon name="chevron_right" size={16} className="rtl:rotate-180" />
        </span>
      </button>
      {/* Deep-dive doors — visible cards, not a second tab layer. Each is a
          real route (also reachable from the Growth pill row / fallbacks). */}
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { tab: "milestones", glyph: "check_circle", label: t("hub.milestones"), sub: t("elev.growth.link.milestones.sub") },
          { tab: "journey", glyph: "calendar_month", label: t("hub.journey"), sub: t("elev.growth.link.journey.sub") },
          { tab: "copilot", glyph: "center_focus_strong", label: t("elev.growth.link.copilot.label"), sub: t("elev.growth.link.copilot.sub") },
        ] as const).map((l) => (
          <button
            key={l.tab}
            onClick={() => setActiveTab(l.tab)}
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-start transition"
            style={{ minHeight: 44, background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
              <Icon name={l.glyph} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{l.label}</span>
              <span className="block text-xs truncate" style={{ color: "var(--arbor-muted)" }}>{l.sub}</span>
            </span>
            <Icon name="chevron_right" size={18} className="rtl:rotate-180 flex-shrink-0" />
          </button>
        ))}
      </div>
      {/* C4 — Physical growth: parent-logged measurements → longitudinal
          trajectory. Raw data only; pediatrician holds the reference charts. */}
      <PhysicalGrowthCard />
      <ScreeningSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
      {/* C2 — parent-facing push opt-in. Hidden unless pushCapable(). AADC: no guilt framing. */}
      <PushOptInToggle
        enabled={pushEnabled}
        pending={pushPending}
        onToggle={handlePushToggle}
        label={t("push.optin.label")}
        sublabel={t("push.optin.sublabel")}
      />
    </div>
  );
}
