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
 * (v10.1: the views' tablist, choose-moments-view; capture is the dock's), on
 * #/journal on the shelf grid (open-shelf). Moments' five blocks (toolbar ·
 * view on the stage, By kind · The newest moment · Shelf by shelf) are
 * #/timeline's budget; on #/journal JournalTab stamps its own blocks.
 */
export default function TimelineTab() {
  // `conversations` is read here for a COUNT ONLY — to decide whether the
  // privacy line has an audience. Nothing about a thread is rendered, and it
  // is never handed to the moments record (AI-04 consent gate).
  const { activeTab, conversations } = useArbor();
  const { t } = useLanguage();
  const moments = activeTab === "timeline";
  // v4: My child's phone doors are gone (each has a visible home now); Moments
  // keeps its own one journal door in every view and record state (F-INT-1).
  // v10.1: capture lives in the shell's dock only, so Moments' move is choosing
  // how to read the record (the views' tablist); #/journal keeps open-shelf.
  const primaryMove = { "data-primary-move": moments ? "choose-moments-view" : "open-shelf" };
  const toolbarModule = { "data-module": "moments-toolbar" };
  const viewModule = { "data-module": "moments-view" };
  // v10.1: the three sections below Moments' stage.
  const sectionModules = {
    kinds: { "data-module": "moments-kinds" },
    newest: { "data-module": "moments-newest" },
    shelves: { "data-module": "moments-shelves" },
  };

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
        <MomentsBody primaryMoveProps={primaryMove} toolbarModule={toolbarModule} viewModule={viewModule} sectionModules={sectionModules} />
      ) : (
        <JournalTab primaryMoveProps={primaryMove} />
      )}
    </motion.div>
  );
}
