/**
 * B-CAREPRO-24 · GP-25 residue — what Arbor keeps about a child, as the rows
 * The Science's "What data Arbor collects and uses" list renders.
 *
 * The list used to be six hand-picked rows and omitted appointments and
 * after-visit notes, safety contacts, language observations, measurements,
 * share grants and the consult export history. It now derives from this
 * grouped map: every per-child subcollection in `CHILD_SUBCOLLECTIONS`
 * (lib/childData.ts — the export/erase sweep) sits in exactly one row, and the
 * rows that hold no subcollection name where that data does live (the profile
 * document, the server memory ledger, share grants + this device's export
 * history). A new subcollection fails `lib/sciencePage.test.ts` until it is
 * placed in a row.
 *
 * Pure: no React, no Firebase — the coverage test reads CHILD_SUBCOLLECTIONS
 * from childData.ts and compares.
 */

export type ChildDataRowId =
  | "profile"
  | "moments"
  | "milestones"
  | "play"
  | "books"
  | "plans"
  | "screening"
  | "coach"
  | "memory"
  | "care"
  | "sharing";

export interface ChildDataRow {
  id: ChildDataRowId;
  /** Material Symbols ligature for the row badge. */
  icon: string;
  /** The per-child subcollections this row stands for (may be empty when the
   *  data lives elsewhere — see `elsewhere`). */
  collections: readonly string[];
  /** Data outside the subcollections that this row names. */
  elsewhere?: readonly ("profile-doc" | "server-memory" | "server-shares" | "device-export-history")[];
}

/** Display order = the order a parent meets the data in the app. */
export const CHILD_DATA_ROWS: readonly ChildDataRow[] = [
  { id: "profile", icon: "person", collections: [], elsewhere: ["profile-doc"] },
  { id: "moments", icon: "edit_note", collections: ["behaviorLogs", "insights", "keepsakes", "wellness", "sleepLogs"] },
  { id: "milestones", icon: "straighten", collections: ["milestones", "growthEntries", "langObs"] },
  {
    id: "play",
    icon: "sports_esports",
    collections: [
      "playLogs", "practiceEvents", "speechAttempts", "mimicSessions", "missionRecords",
      "heroRuns", "heroRenders", "heroSheet", "journeyObjectives", "adventureResults", "savedStories", "savedComics", "kidSouvenirs",
    ],
  },
  // B-BOOK release: the child's own picture-book files (hero sheet, prints,
  // narration in the child's name) — the metadata here; the files in Storage,
  // erased with the child.
  { id: "books", icon: "auto_stories", collections: ["bookAssets"] },
  { id: "plans", icon: "checklist", collections: ["actionPlans", "actionLoops", "routines", "goals", "goalObservations", "savedLearn", "weeklyReports", "programs", "familyGoals", "coachSessions"] },
  { id: "screening", icon: "fact_check", collections: ["screenings", "devScoreSnapshots", "bandSnapshots"] },
  { id: "coach", icon: "forum", collections: ["conversations", "conversationChanges"] },
  { id: "memory", icon: "bookmark", collections: [], elsewhere: ["server-memory"] },
  { id: "care", icon: "event", collections: ["appointments", "apptQuestions", "apptFollowUps", "contacts", "briefs"] },
  { id: "sharing", icon: "share", collections: [], elsewhere: ["server-shares", "device-export-history"] },
];

/** The row a subcollection belongs to (undefined = unplaced — the test fails). */
export function childDataRowFor(collection: string): ChildDataRowId | undefined {
  return CHILD_DATA_ROWS.find((r) => r.collections.includes(collection))?.id;
}
