import React from "react";
import { motion } from "motion/react";
import { NotebookPen, Mic, Camera, Keyboard } from "lucide-react";
import { PageHeader, SectionCard } from "../ui/kit";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";

/**
 * UC-1 Journal — placeholder route (Wave 1 foundation).
 *
 * The journal-agent (Wave 2) fills this in: an action-forward compose card
 * (Voice / Photo / Text) over a flat moment feed reading the SHARED
 * buildTimeline() data, with an AUTO-vs-MANUAL provenance badge and a per-entry
 * 7-domain chip. It is ADDITIVE — StoryTimelineTab stays fully intact.
 *
 * This stub only proves the route resolves (Shell registry + ActiveTab union +
 * navigation IA + sidebar/sub-tab). It renders nothing evaluative — no score,
 * verdict, or weakest-domain pointer (clinical firewall).
 */
export default function JournalTab() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[840px] mx-auto">
      <PageHeader
        title={t("nav.title.journal")}
        subtitle={t("nav.sub.journal", { name: childProfile.name })}
      />
      <SectionCard title={t("journal.compose.title")} icon={<NotebookPen className="w-4 h-4" />} tone="lav">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Mic, label: t("journal.mode.voice") },
            { icon: Camera, label: t("journal.mode.photo") },
            { icon: Keyboard, label: t("journal.mode.text") },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl py-5 text-[var(--t-sm)] font-bold"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
            >
              <Icon className="w-5 h-5" />
              {label}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[var(--t-sm)]" style={{ color: "var(--arbor-muted)" }}>
          {t("journal.empty")}
        </p>
      </SectionCard>
    </motion.div>
  );
}
