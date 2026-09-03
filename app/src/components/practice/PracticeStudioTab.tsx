/**
 * Practice Studio — the PARENT-register launcher for the practice suite
 * (IA fix: the ten skill worlds existed but had no parent door; the kid-register
 * Hero Arcade stays in Kid Mode via PracticeHubTab, this surface replaces it on
 * the parent #/practice route).
 *
 * Register rules: calm/clinical parent framing, tokens only, counts never
 * verdicts. Each world says what skill it nurtures, shows the child's session
 * count, and names its Kid Mode world so parent and child share a vocabulary.
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
import { usePracticeData, type PracticeData } from "../../practice/usePracticeData";
import { track } from "../../lib/analytics";
import type { ActiveTab } from "../../lib/routes";

const READING_KINDS = new Set(["phonics", "sight-word", "letter-trace"]);

interface StudioWorld {
  id: string;
  /** i18n key prefix: `practice.world.<id>.name` / `.skill` */
  key: string;
  /** Kid Mode world name — shared vocabulary between parent and child. */
  kidName: string;
  msIcon: string;
  tone: keyof typeof PASTEL;
  /** Standalone parent-shell route, when one exists; else Kid Mode only. */
  tab?: ActiveTab;
  count: (d: PracticeData) => number;
}

const STUDIO_WORLDS: StudioWorld[] = [
  { id: "speech", key: "speech", kidName: "Sound Lab", msIcon: "mic", tone: "sky", tab: "speech", count: (d) => d.speech.items.length },
  { id: "word-world", key: "words", kidName: "Word World", msIcon: "menu_book", tone: "sky", count: (d) => d.events.items.filter((e) => e.kind === "lang-strategy").length },
  { id: "feelings", key: "feelings", kidName: "Mood Mountain", msIcon: "favorite", tone: "pink", tab: "feelings", count: (d) => d.events.items.length },
  { id: "mimic", key: "mimic", kidName: "Mimic Studio", msIcon: "mood", tone: "coral", tab: "mimic", count: (d) => d.mimic.items.length },
  { id: "adventures", key: "adventures", kidName: "Story Quest", msIcon: "map", tone: "yellow", tab: "adventures", count: (d) => d.adventures.items.length },
  { id: "memory", key: "memory", kidName: "Mind Vault", msIcon: "psychology", tone: "lav", count: (d) => d.events.items.filter((e) => e.kind === "memory").length },
  { id: "reading", key: "reading", kidName: "Spell Forge", msIcon: "auto_stories", tone: "yellow", count: (d) => d.events.items.filter((e) => READING_KINDS.has(e.kind)).length },
  { id: "beat", key: "rhythm", kidName: "Beat Keeper", msIcon: "music_note", tone: "coral", count: (d) => d.events.items.filter((e) => e.kind === "rhythm").length },
  { id: "pose", key: "movement", kidName: "Hero Pose", msIcon: "accessibility_new", tone: "mint", count: (d) => d.events.items.filter((e) => e.kind === "pose").length },
  { id: "pattern", key: "logic", kidName: "Pattern Power", msIcon: "category", tone: "lav", count: (d) => d.events.items.filter((e) => e.kind === "pattern").length },
];

export default function PracticeStudioTab() {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const { openKidMode } = useKidMode();
  const isRtl = uiLang === "he";
  const firstName = (childProfile.name || "").split(" ")[0];
  const data = usePracticeData(childProfile.id);

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
        className="rounded-[22px] p-5 flex flex-wrap items-center justify-between gap-4"
        style={{ background: "var(--arbor-hero-grad, var(--arbor-paper-deep))", border: "1px solid var(--arbor-rule)" }}
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

      {/* World grid */}
      <section aria-label={t("practice.studio.worlds")}>
        <div className="flex items-baseline justify-between mb-2.5">
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
            {t("practice.studio.worlds")}
          </h2>
          <span className="text-[11.5px] font-bold" style={{ color: "var(--arbor-muted)" }}>
            {t("practice.studio.count", { n: STUDIO_WORLDS.length })}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
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
                        {t("practice.studio.sessions", { n: sessions })}
                      </span>
                    )}
                  </span>
                  <span className="block text-[12.5px] leading-relaxed mt-0.5" style={{ color: "var(--arbor-muted)" }}>
                    {t(`practice.world.${world.key}.skill`)}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1 text-[11.5px] font-bold" style={{ color: world.tab ? "var(--arbor-clay-deep)" : "var(--arbor-lav-ink)" }}>
                    <Icon name={world.tab ? "arrow_forward" : "sports_esports"} size={13} className="rtl:-scale-x-100" />
                    {world.tab
                      ? t("practice.studio.openDirect")
                      : t("practice.studio.openKidmode", { world: world.kidName })}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Related parent spines — practice feeds the clinical picture */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab("language")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 min-h-[38px] text-[12px] font-bold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="forum" size={15} />
          {t("nav.tab.language")}
        </button>
        <button
          onClick={() => setActiveTab("daily-play")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 min-h-[38px] text-[12px] font-bold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="playing_cards" size={15} />
          {t("nav.tab.daily-play")}
        </button>
        <button
          onClick={() => setActiveTab("copilot")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 min-h-[38px] text-[12px] font-bold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="monitoring" size={15} />
          {t("nav.tab.copilot")}
        </button>
      </div>

      {/* Register note — what practice is and is not */}
      <p className="text-[11px]" style={{ color: "var(--arbor-faint)" }}>
        {t("practice.studio.note")}
      </p>
    </div>
  );
}
