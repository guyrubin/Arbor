import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import JournalTab from "./JournalTab";
import StoryTimelineTab from "./StoryTimelineTab";

/**
 * The ONE timeline surface.
 *
 * Journal and Story were two components rendering the SAME ledger stream
 * (both called buildTimeline with identical arguments) behind two sidebar pills
 * — the parent met the same moments twice, in two shapes, with no relationship
 * between them. They are now two DENSITIES of one surface:
 *
 *   • Feed  (#/journal)  — a flat, calm column of moments. Capture lives here.
 *   • Story (#/timeline) — the grouped rail + the narrated story, momentum,
 *                          filters and the memory queue.
 *
 * Both routes render this component; the route IS the density, so the toggle is
 * deep-linkable and the browser back button behaves. The bodies are unchanged —
 * this composes them rather than forking a third rendering of the same data.
 */

type Density = "feed" | "story";

const DENSITIES: { key: Density; tab: "journal" | "timeline"; icon: string; labelKey: string }[] = [
  { key: "feed", tab: "journal", icon: "view_agenda", labelKey: "timeline.density.feed" },
  { key: "story", tab: "timeline", icon: "auto_stories", labelKey: "timeline.density.story" },
];

export default function TimelineTab() {
  const { activeTab, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const density: Density = activeTab === "timeline" ? "story" : "feed";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Density toggle — one surface, two reading densities over one stream. */}
      <div
        className="inline-flex items-center gap-1 rounded-full p-1"
        role="tablist"
        aria-label={t("timeline.density.aria")}
        style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
      >
        {DENSITIES.map((d) => {
          const active = density === d.key;
          return (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(d.tab)}
              className="inline-flex items-center gap-1.5 rounded-full px-4 min-h-[36px] text-[12.5px] font-extrabold transition"
              style={
                active
                  ? { background: "var(--arbor-paper)", color: "var(--arbor-ink)", boxShadow: "var(--shadow-sm)" }
                  : { background: "transparent", color: "var(--arbor-muted)" }
              }
            >
              <Icon name={d.icon} size={17} fill={active ? 1 : 0} />
              {t(d.labelKey)}
            </button>
          );
        })}
      </div>

      {density === "feed" ? <JournalTab /> : <StoryTimelineTab />}
    </motion.div>
  );
}
