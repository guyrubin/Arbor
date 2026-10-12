import { motion } from "motion/react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import JournalTab from "./JournalTab";
import MomentsBody from "../moments/MomentsBody";

/**
 * The leaf for #/timeline and #/journal.
 *
 * F-CHILD-2: #/timeline is Moments — the parent's own moments over time, in
 * different places and across areas (MomentsBody). #/journal stays the
 * "Your journal" door: the shelves, the capture tiles and the day-grouped
 * thread (JournalTab). The old Feed · Story toggle is gone; Moments links to
 * the journal and the journal links to Moments, each with one quiet door.
 *
 * Item 11 (IA-02): the surface contract reaches the DOM from this one file.
 * The move stamp is built once and handed to whichever body is live, so the
 * page renders exactly one: on #/timeline it sits on "Keep a moment"
 * (capture-moment), on #/journal on the shelf grid (open-shelf). The two
 * Moments blocks (toolbar · view) are #/timeline's whole budget of two;
 * on #/journal JournalTab stamps its own header · compose · thread.
 */
export default function TimelineTab() {
  // `conversations` is read here for a COUNT ONLY — to decide whether the
  // privacy line has an audience. Nothing about a thread is rendered, and it
  // is never handed to the moments record (AI-04 consent gate).
  const { activeTab, conversations } = useArbor();
  const { t } = useLanguage();
  const moments = activeTab === "timeline";
  const primaryMove = { "data-primary-move": moments ? "capture-moment" : "open-shelf" };
  const toolbarModule = { "data-module": "moments-toolbar" };
  const viewModule = { "data-module": "moments-view" };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/*
        AI-04 (consent gate) — one quiet, always-true line. An Ask thread is
        not folded into the moments, so a parent who remembers seeing those
        rows here is told where they went (nowhere: they are still in Ask).
      */}
      {conversations.length > 0 && (
        <p className="text-[11.5px] font-semibold px-1" style={{ color: "var(--arbor-muted)" }} dir="auto">
          {t("timeline.privacy.ask")}
        </p>
      )}
      {moments ? (
        <MomentsBody primaryMoveProps={primaryMove} toolbarModule={toolbarModule} viewModule={viewModule} />
      ) : (
        <JournalTab primaryMoveProps={primaryMove} />
      )}
    </motion.div>
  );
}
