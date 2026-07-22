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

  const weeklyFocus = useMemo(() => {
    const nextMilestone = milestones.find((m) => !m.checked);
    if (nextMilestone) {
      return {
        title: nextMilestone.title,
        body: nextMilestone.skillLooksLike || nextMilestone.description,
        action: "daily-play" as const,
      };
    }
    return {
      title: t("growth.focus.empty.title"),
      body: t("growth.focus.empty.body"),
      action: "check" as const,
    };
  }, [milestones, t]);

  const recentMoments = useMemo(() => {
    const moments = [
      ...behaviorLogs.map((log) => ({
        id: `behavior-${log.id}`,
        at: new Date(log.timestamp).getTime(),
        icon: "chat_bubble",
        title: log.behaviorType,
        meta: [log.context, new Date(log.timestamp).toLocaleDateString()].filter(Boolean).join(" · "),
      })),
      ...playLogs.map((log) => ({
        id: `play-${log.id}`,
        at: new Date(log.timestamp).getTime(),
        icon: "toys",
        title: log.title,
        meta: new Date(log.timestamp).toLocaleDateString(),
      })),
    ];
    return moments.sort((a, b) => b.at - a.at).slice(0, 3);
  }, [behaviorLogs, playLogs]);

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
    <div className="mx-auto max-w-[1180px] space-y-6">
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
      {/* One action first, then the neutral development picture. */}
      <section className="overflow-hidden rounded-[24px]" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }} aria-labelledby="growth-weekly-focus">
        <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
          <div className="p-5 sm:p-7">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--arbor-green-ink)" }}>
              <Icon name="explore" size={16} /> {t("growth.focus.eyebrow")}
            </span>
            <h2 id="growth-weekly-focus" className="mt-2 text-2xl font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{weeklyFocus.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{weeklyFocus.body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => weeklyFocus.action === "check" ? setCheckOpen(true) : setActiveTab("daily-play")} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]" style={{ background: "var(--arbor-clay)" }}>
                <Icon name={weeklyFocus.action === "check" ? "assignment_turned_in" : "play_arrow"} size={18} />
                {weeklyFocus.action === "check" ? t("growth.focus.check") : t("growth.focus.try")}
              </button>
              <button type="button" onClick={() => setActiveTab("milestones")} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
                <Icon name="edit_note" size={18} /> {t("growth.focus.review")}
              </button>
            </div>
          </div>
          <div className="border-t p-5 sm:p-6 lg:border-s lg:border-t-0" style={{ background: "var(--arbor-paper-deep)", borderColor: "var(--arbor-rule)" }}>
            <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("growth.recent.title")}</h3>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("growth.recent.body")}</p>
            {recentMoments.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {recentMoments.map((moment) => (
                  <li key={moment.id} className="flex items-start gap-3 rounded-xl bg-white p-3" style={{ border: "1px solid var(--arbor-rule)" }}>
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name={moment.icon} size={16} /></span>
                    <span className="min-w-0"><span className="block truncate text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{moment.title}</span><span className="mt-0.5 block truncate text-[11px]" style={{ color: "var(--arbor-muted)" }}>{moment.meta}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <button type="button" onClick={() => setActiveTab("daily-play")} className="mt-4 flex w-full items-center gap-3 rounded-xl bg-white p-3 text-start" style={{ border: "1px dashed var(--arbor-rule-strong)" }}>
                <Icon name="add_circle" size={18} style={{ color: "var(--arbor-green-ink)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{t("growth.recent.empty")}</span>
              </button>
            )}
          </div>
        </div>
      </section>
      {/* The Map — the record's home (counts only). */}
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
