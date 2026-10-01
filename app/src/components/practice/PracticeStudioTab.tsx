/**
 * Practice Studio — the PARENT-register launcher for the practice suite
 * (IA fix: the ten skill worlds existed but had no parent door; the kid-register
 * Hero Arcade stays in Kid Mode via PracticeHubTab, this surface replaces it on
 * the parent #/practice route).
 *
 * Register rules: calm/clinical parent framing, tokens only, counts never
 * verdicts. Each world says what skill it nurtures, shows the count of its
 * own records in its own unit (B-PLAY-02), and names its Kid Mode world so parent and child share a vocabulary.
 * Worlds with a standalone route open directly (parent hands the device over);
 * arcade-only worlds launch Kid Mode (parent-locked).
 */
import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { cardCls } from "../ui/kit";
import { PASTEL } from "../../lib/tokens";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useKidMode } from "../kidmode/KidModeContext";
import { markPinNudgeShown, shouldNudgeForPin } from "../kidmode/parentGate";
import { usePracticeData } from "../../practice/usePracticeData";
import { STUDIO_WORLDS, studioCountKey, type StudioWorld } from "./studioWorlds";
import { track } from "../../lib/analytics";
import { requestOpenSettings } from "../layout/settingsBus";
import { useChildCollection } from "../../hooks/useChildCollection";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { SINCE_LAST_PLAY_FALLBACK_MS, sinceLastPlayLine } from "../../lib/kidExitRecap";
import { lastKidSessionStartedAt } from "../../lib/kidModeGate";
import type { HeroJourneyRun } from "../../types";

// B-PLAY-02: the world list and each tile's count + unit live in the pure
// components/practice/studioWorlds module (fixture-testable without React).

export default function PracticeStudioTab() {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const { openKidMode } = useKidMode();
  const isRtl = uiLang === "he";
  const firstName = (childProfile.name || "").split(" ")[0];
  const data = usePracticeData(childProfile.id);
  const heroRuns = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");

  // B-PLAY-05: ONE "since last play" line inside the Kid Mode door (no new
  // module): what the child did since the latest Kid Mode session began (7
  // days when this tab has seen none) — the exit strip's counts plus finished
  // story titles. Hidden when nothing happened.
  const sinceLine = React.useMemo(() => {
    const sinceMs = lastKidSessionStartedAt() ?? Date.now() - SINCE_LAST_PLAY_FALLBACK_MS;
    return sinceLastPlayLine({
      ledgers: {
        speech: data.speech.items.map((x) => x.timestamp),
        mimic: data.mimic.items.map((x) => x.timestamp),
        mission: data.missions.items.map((x) => x.timestamp),
        adventure: data.adventures.items.map((x) => x.timestamp),
        practice: data.events.items.map((x) => x.timestamp),
      },
      stories: heroRuns.items,
      sinceMs,
      t: withChildSignals(t, uiLang === "he"),
      childName: firstName,
    });
  }, [data.speech.items, data.mimic.items, data.missions.items, data.adventures.items, data.events.items, heroRuns.items, t, uiLang, firstName]);

  // KID-21: this session's parent area was reached by answering the math
  // question, and no PIN is set. Say so ONCE, here on the parent door next to
  // the Kid Mode entrance — never in front of the child, never twice.
  const [nudgePin] = React.useState(() => shouldNudgeForPin());
  React.useEffect(() => {
    if (nudgePin) markPinNudgeShown();
  }, [nudgePin]);

  const openWorld = (world: StudioWorld) => {
    try { track("practice_studio_open", { world: world.id, via: world.tab ? "direct" : "kidmode" }); } catch { /* noop */ }
    if (world.tab) setActiveTab(world.tab);
    else openKidMode();
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 max-w-[980px]">
      {/* Header */}
      <div>
        <h1 className="text-[1.6rem] leading-tight tracking-tight" style={{ color: "var(--arbor-ink)" }}>
          {t("practice.studio.title")}
        </h1>
        <p className="text-[13px] mt-1 max-w-[62ch]" style={{ color: "var(--arbor-muted)" }}>
          {t("practice.studio.subtitle", { name: firstName || t("learn.yourChild") })}
        </p>
      </div>

      {/* Kid Mode — the safe play space, one clear primary action */}
      <section
        data-module="practice-kidmode-door"
        className="rounded-[22px] p-5 flex flex-wrap items-center justify-between gap-4"
        style={{ background: "var(--arbor-coach-grad, var(--arbor-paper-deep))", border: "1px solid var(--arbor-rule)" }}
        aria-label={t("practice.studio.kidmode.title")}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="inline-flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-clay-deep)", width: 48, height: 48, boxShadow: "var(--shadow-xs)" }}
          >
            <Icon name="sports_esports" size={24} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
              {t("practice.studio.kidmode.title")}
            </h2>
            <p className="text-[12.5px]" style={{ color: "var(--arbor-ink-soft)" }}>
              {t("practice.studio.kidmode.sub")}
            </p>
            {sinceLine && (
              <p data-testid="practice-since-last-play" className="text-[12.5px] font-bold mt-1" style={{ color: "var(--arbor-ink)" }} dir="auto">
                {sinceLine}
              </p>
            )}
            {/* KID-20 / RUN-04: the three reassurance chips are PARENT copy, so
                they live here on the door — not in the child's first viewport. */}
            <ul aria-label={t("elev.practice.door.aria")} className="flex flex-wrap gap-1.5 mt-2 list-none p-0 m-0">
              {(["elev.practice.door.locked", "elev.practice.door.private", "elev.practice.door.stars"] as const).map((key) => (
                <li
                  key={key}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}
                >
                  <Icon name="verified_user" size={12} style={{ color: "var(--arbor-green-ink)" }} />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button
          onClick={() => {
            try { track("practice_studio_open", { world: "kidmode", via: "hero" }); } catch { /* noop */ }
            openKidMode();
          }}
          className="inline-flex items-center gap-1.5 font-bold text-[13px] rounded-xl px-4 py-2.5 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--gradient-cta, var(--arbor-clay))", color: "var(--arbor-subtab-on-ink)" }}
        >
          <Icon name="play_arrow" size={18} fill={1} />
          {t("practice.studio.kidmode.cta")}
        </button>
      </section>

      {/* B-PLAY-06: the PIN nudge is a 44 px button that opens Settings with
          the PIN row in view (was a static "… · Settings" line). Removed again
          when lane-X B-KID-14 carries "Set PIN once". */}
      {nudgePin && (
        <button
          type="button"
          data-testid="gate-pin-nudge"
          onClick={() => requestOpenSettings({ focus: "pin" })}
          className="w-full min-h-11 rounded-2xl px-4 py-3 text-start text-[12.5px] leading-relaxed transition focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}
        >
          <span className="flex items-center gap-3">
            <Icon name="lock" size={18} />
            <span className="min-w-0 flex-1">
              <b style={{ color: "var(--arbor-ink)" }}>{t("elev.gate.set.title")}</b>{" "}
              {t("elev.gate.set.sub")}
            </span>
            <span className="font-extrabold flex-shrink-0" style={{ color: "var(--arbor-ink)" }}>{t("elev.gate.set.cta")}</span>
          </span>
        </button>
      )}

      {/* World grid */}
      <section data-module="practice-worlds" aria-label={t("practice.studio.worlds")}>
        <div className="flex items-baseline justify-between mb-2.5">
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
            {t("practice.studio.worlds")}
          </h2>
          <span className="text-[11.5px] font-bold" style={{ color: "var(--arbor-muted)" }}>
            {t("practice.studio.count", { n: STUDIO_WORLDS.length })}
          </span>
        </div>
        {/* The declared primaryMove for #/practice ("start-world"): the grid of
            world tiles. Stamped once, on the control group. */}
        <div className="grid sm:grid-cols-2 gap-4" data-primary-move="start-world">
          {STUDIO_WORLDS.map((world, i) => {
            const tone = PASTEL[world.tone];
            const sessions = world.count(data);
            return (
              <motion.button
                key={world.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.24) }}
                onClick={() => openWorld(world)}
                className={`${cardCls} w-full flex items-start gap-3.5 p-4 text-start transition motion-safe:hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none focus-visible:ring-2`}
              >
                <span
                  className="inline-flex items-center justify-center rounded-2xl flex-shrink-0 mt-0.5"
                  style={{ background: tone.soft, color: tone.ink, width: 44, height: 44 }}
                >
                  <Icon name={world.msIcon} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14.5px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
                      {t(`practice.world.${world.key}.name`)}
                    </span>
                    {sessions > 0 && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                        style={{ background: tone.soft, color: tone.ink }}
                      >
                        {t(studioCountKey(world.unit, sessions), { n: sessions })}
                      </span>
                    )}
                  </span>
                  <span className="block text-[12.5px] leading-relaxed mt-0.5" style={{ color: "var(--arbor-muted)" }}>
                    {t(`practice.world.${world.key}.skill`)}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1 text-[11.5px] font-bold" style={{ color: world.tab ? "var(--arbor-clay-deep)" : "var(--arbor-lav-ink)" }}>
                    {/* CR-13: the arrow used `rtl:-scale-x-100`, a variant this
                        build never emitted — the glyph pointed right on a
                        right-to-left page, i.e. backwards. `isRtl` is already
                        resolved above from the UI language, so mirror inline
                        where nothing can drop the rule. */}
                    <Icon
                      name={world.tab ? "arrow_forward" : "sports_esports"}
                      size={13}
                      style={world.tab && isRtl ? { transform: "scaleX(-1)" } : undefined}
                    />
                    {world.tab
                      ? world.tabNameKey
                        ? t("practice.studio.openIn", { tab: t(world.tabNameKey) })
                        : t("practice.studio.openDirect")
                      : t("practice.studio.openKidmode", { world: t(world.kidNameKey) })}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* OBJ-PRACTICE-01: a three-pill "related parent spines" row (Language,
          Daily Play, Development Check) used to sit here. #/practice declares a
          moduleBudget of 2 and a single primary move ("start-world"); a row of
          three sideways doors under the world grid is a third module and three
          competing moves, and every one of those destinations already has its
          own hub door in the sidebar and the More sheet. Deleted, not hidden —
          nothing became unreachable (routeReachability.test.ts). */}
      {/* Register note — what practice is and is not */}
      <p className="text-[11px]" style={{ color: "var(--arbor-faint)" }}>
        {t("practice.studio.note")}
      </p>
    </div>
  );
}
