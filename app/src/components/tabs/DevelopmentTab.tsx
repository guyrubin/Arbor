import React, { lazy, useState, useEffect, useCallback } from "react";
import { Gauge, CheckCircle2, UserCircle, CalendarDays, ClipboardCheck } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import HubTabs from "../ui/HubTabs";
import DevScoreCard from "../sections/DevScoreCard";
import ArborNoticedCard from "../sections/ArborNoticedCard";
import PhysicalGrowthCard from "../sections/PhysicalGrowthCard";
import ScreeningSheet from "../sections/ScreeningSheet";

/* My Child › Development — the four confusable "Development *" leaves
   (Dashboard, Milestones, Profile, Journey) collapsed into one place with
   internal facets. Each panel is the existing, unchanged tab component.
   b2: a quiet inline "Quick development check" opens the screener sheet here,
   replacing the former standalone Screening leaf. */

const DevelopmentCopilot = lazy(() => import("../practice/DevelopmentCopilot"));
const MilestonesTab = lazy(() => import("./MilestonesTab"));
const ChildProfile = lazy(() => import("../sections/ChildProfile"));
const JourneyTab = lazy(() => import("../practice/JourneyTab"));

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
  const [checkOpen, setCheckOpen] = useState(false);

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
      <DevScoreCard />
      {/* C1 — Arbor Noticed: weekly in-app monitoring card, grounded in the
          child's own logged milestones and moments. Non-diagnostic. */}
      <ArborNoticedCard />
      {/* C4 — Physical growth: parent-logged measurements → longitudinal
          trajectory. Raw data only; pediatrician holds the reference charts. */}
      <PhysicalGrowthCard />
      <div>
        <button
          onClick={() => setCheckOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl px-4 text-sm font-bold"
          style={{ minHeight: 44, background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          <ClipboardCheck className="w-4 h-4" /> {t("mychild.quickcheck.cta")}
        </button>
      </div>
      <ScreeningSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
      {/* C2 — parent-facing push opt-in. Hidden unless pushCapable(). AADC: no guilt framing. */}
      <PushOptInToggle
        enabled={pushEnabled}
        pending={pushPending}
        onToggle={handlePushToggle}
        label={t("push.optin.label")}
        sublabel={t("push.optin.sublabel")}
      />
      <HubTabs
        ariaLabel="Development facets"
        panels={[
          { id: "now", label: t("hub.now"), icon: Gauge, Comp: DevelopmentCopilot },
          { id: "milestones", label: t("hub.milestones"), icon: CheckCircle2, Comp: MilestonesTab },
          { id: "profile", label: t("hub.profile"), icon: UserCircle, Comp: ChildProfile },
          { id: "journey", label: t("hub.journey"), icon: CalendarDays, Comp: JourneyTab },
        ]}
      />
    </div>
  );
}
