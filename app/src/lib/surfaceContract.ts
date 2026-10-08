import type { ActiveTab } from "./routes";
import type { SignalSource } from "./signalTimeline";

/**
 * Heartwood Law 1 — One Job, One Move (ARBOR-HEARTWOOD-MASTERPLAN-2026-08-16 §1).
 *
 * Every surface declares ONE job (one sentence, parent language), offers exactly
 * ONE primary move, and holds a hard module budget; everything else earns a slot
 * or is demoted somewhere it still lives. This file is the second half of the
 * one manifest, beside routes.ts: routes.ts says which surfaces EXIST, this file
 * says what each one is FOR.
 *
 * Law 3 hook: `threadWrite` names the buildTimeline ingest source the primary
 * move feeds (a real `SignalSource` key), or declares `"consented"` (thread
 * write only via an explicit parent action, e.g. the coach's "Keep this") or
 * `"none"` — always with a one-line justification in the contract literal
 * (SC-4: no silent dead-ends).
 *
 * THE READ MANIFEST (B-SHELL-20 (e)) — not a declaration on paper. Its readers:
 *  · components/layout/Shell.tsx — `contractFor(route)` stamps every leaf's
 *    SurfaceFrame (job, hub, depth) at runtime;
 *  · lib/navigation.ts — `HubId` types the section ids and TAB_SECTION_FALLBACK;
 *  · lib/pulse.ts — `HubId` keys the hub pulse;
 *  · scripts/framework-check.mjs (`npm run check:framework`) — parses
 *    `moduleBudget` (R25: top-level stamps ≤ budget) and `primaryMove` (the
 *    leaf's data-primary-move literal set must contain it), so a stamp that
 *    drifts from its contract fails the build;
 *  · surfaceContract.test.ts (SC-1 completeness · SC-3 demotion · SC-4 thread
 *    integrity) and surfaceContract.render.test.ts (rendered budgets).
 * Change a route's primary move or budget HERE and in its stamp together.
 */

/**
 * The ten Heartwood hubs, in sidebar order — must mirror navigation.ts
 * SECTIONS ids exactly (asserted by SC-1). Kept as a literal here so contracts
 * are type-checked without importing React-adjacent nav code.
 */
export const HUB_IDS = [
  "today", "journal", "ask", "behaviors", "growth",
  "practice", "stories", "learn", "care", "profile",
] as const;

export type HubId = (typeof HUB_IDS)[number];

export type SurfaceContract = {
  route: ActiveTab;
  hub: HubId;
  /** 0 = the hub's leaf surface, 1 = a tool inside it. There is no depth 2. */
  depth: 0 | 1;
  /** One sentence, parent language, no jargon. */
  job: string;
  /** The single action id this surface exists to produce. */
  primaryMove: string;
  /** Top-level sibling modules, hard cap (SC-2 will count real renders). */
  moduleBudget: number;
  /** Where demoted modules land: another live route, or in-surface disclosure. */
  demotionTarget: ActiveTab | "disclosure";
  /** Law 3: the buildTimeline source the primary move feeds, or an exception. */
  threadWrite: SignalSource | "consented" | "none";
};

/**
 * One contract per ROUTE_IDS entry — grouped by hub for readability only.
 * Hub homes follow the post-B1 navigation.ts (10-hub Heartwood IA: items /
 * primaryTabs / tools / TAB_SECTION_FALLBACK), which is the truth for
 * assignments. Every `threadWrite` naming a source was verified against
 * buildTimeline's actual ingest loops in signalTimeline.ts.
 */
export const SURFACE_CONTRACTS: readonly SurfaceContract[] = [
  // ── TODAY ──────────────────────────────────────────────────────────────────
  {
    route: "overview", hub: "today", depth: 0,
    // B-LOOP-07: Today = three blocks (practice · notice · tonight); the door
    // "More for today" is chrome, never counted (todayModules.ts v3, budget 3).
    job: "Choose what matters now: a question, a next step or support.",
    primaryMove: "choose-next-step", moduleBudget: 3, demotionTarget: "disclosure",
    // Budget 3 = todayModules.ts TODAY_MODULE_BUDGET (v3, B-LOOP-07); every
    // demoted object (what changed, the watch signal, the week, play, the
    // first steps, a lifecycle moment) lives behind the one disclosure.
    // Wave L TJB-05: the "action-outcome" source the plan wanted NOW EXISTS —
    // signalTimeline.ts ingests `actionOutcomes` (the actionLoops ledger) as
    // kind "action", so accepting the day's step writes a real thread row and
    // recording the outcome updates that same row. This declaration was
    // "none" while nothing read the ledger; it is a SignalSource now because
    // buildTimeline genuinely folds it, not because the plan says so.
    threadWrite: "actionOutcomes",
  },
  {
    route: "day-windows", hub: "today", depth: 1,
    job: "See when today is likely calm and when it is likely tricky.",
    primaryMove: "view-day-windows", moduleBudget: 2, demotionTarget: "overview",
    // AP-051: read-only over lib/jitai.ts predictRhythm — deliberately no write.
    threadWrite: "none",
  },
  {
    route: "smart-reminders", hub: "today", depth: 1,
    job: "Choose when and how Arbor is allowed to nudge you.",
    primaryMove: "set-reminder-prefs", moduleBudget: 3, demotionTarget: "disclosure",
    // AP-058: a parent PREFERENCE surface (quiet hours) — settings, no write.
    threadWrite: "none",
  },
  {
    route: "weekly", hub: "today", depth: 1,
    job: "Read this week's story and take one thing from it into today.",
    primaryMove: "accept-recap-recommendation", moduleBudget: 3, demotionTarget: "overview",
    // Re-homed Profile → Today (Heartwood D3: the recap is a ritual, not a
    // settings page). Accepting the last card feeds Today, not the timeline —
    // no such source id exists in buildTimeline; "none" is honest.
    // B-TODAY-22 (FU-N1-L1, framer default) — STATE-CONDITIONAL SECONDARY:
    // with no report stored for the current week there is nothing to accept,
    // so the stamped `weekly-empty` module offers ONE explicit secondary move,
    // `data-secondary-move="capture-moment"` (open the capture sheet in place).
    // The primary move stays the declaration; it renders once a week exists.
    threadWrite: "none",
  },

  // ── ASK ────────────────────────────────────────────────────────────────────
  {
    route: "coach", hub: "ask", depth: 0,
    job: "Help me right now.",
    primaryMove: "ask", moduleBudget: 3, demotionTarget: "disclosure",
    // Budget 3 per plan §4: composer · answer · history-as-record-rows.
    // SHIPPED behavior, honestly: coach turns are private by default. AI-04
    // closed both halves of the gate — buildTimeline no longer has an ingest
    // source for Ask threads at all (the `conversations` key is gone from
    // TimelineSources, not merely unread), and the ONE way an answer reaches
    // the child's thread is the parent tapping "Keep this", which commits a
    // behaviorLogs row through commitConversationProposal with its origin
    // recorded. So this surface's primary move writes nothing on its own:
    // "consented" is now the true statement, and the threads themselves stay
    // in Ask, in the account, and on the GDPR export exactly as before.
    threadWrite: "consented",
  },
  {
    route: "scholar", hub: "ask", depth: 1,
    job: "Browse the research lenses behind Arbor's answers.",
    primaryMove: "ask", moduleBudget: 3, demotionTarget: "disclosure",
    // B-ASKJB-12: retired to coach (RETIRED_ROUTES) — the lens library is Ask's
    // ToneSheet ("How should Arbor talk with you?"). The id and this entry keep
    // their seat like find-pro, and Shell renders the Ask leaf for it, so the
    // move and budget are the Ask leaf's own (ScholarTab's open-lens / 2 left
    // with ScholarTab). Read-only for the lens choice — no write.
    threadWrite: "none",
  },

  // ── JOURNAL ────────────────────────────────────────────────────────────────
  // B-LOOP-11: the journal is nine shelves — the grid (≤ 3 modules), a shelf
  // page (3: header · suggested now · entries) and the professional view
  // (`?view=pro`) are the same route; "Everything by date" (`?view=all`) is
  // the day-grouped thread behind its door.
  {
    route: "journal", hub: "journal", depth: 0,
    job: "See {name} shelf by shelf, and what to try next.",
    primaryMove: "open-shelf", moduleBudget: 3, demotionTarget: "timeline",
    // A moment added from a shelf enters the stream from behaviorLogs,
    // filed on that shelf, before any AI runs (plan §4).
    threadWrite: "behaviorLogs",
  },
  {
    route: "timeline", hub: "journal", depth: 1,
    job: "Read the same moments as one flowing story of the week.",
    primaryMove: "switch-density", moduleBudget: 2, demotionTarget: "journal",
    // journal/timeline are two DENSITIES of one surface (both render
    // TimelineTab); this route IS the density. Read surface — no write.
    threadWrite: "none",
  },

  // ── BEHAVIORS ──────────────────────────────────────────────────────────────
  {
    route: "behaviors", hub: "behaviors", depth: 0,
    job: "Log what happened; see the pattern form.",
    primaryMove: "log-behavior", moduleBudget: 3, demotionTarget: "plans",
    // Pattern echo is a COUNT observation, never a verdict; after 3 similar
    // logs one contextual CTA routes to plans (the demotion target's job).
    threadWrite: "behaviorLogs",
  },
  {
    route: "plans", hub: "behaviors", depth: 1,
    job: "Turn a repeating challenge into a step-by-step plan you can run.",
    primaryMove: "advance-plan-step", moduleBudget: 3, demotionTarget: "behaviors",
    // plans source → kind "plan" with steps done/total.
    threadWrite: "plans",
  },

  // ── GROWTH ─────────────────────────────────────────────────────────────────
  {
    route: "development", hub: "growth", depth: 0,
    job: "Watch her record grow.",
    // W2-GROWTH r2 (Law 7): the tail is demoted IN PAGE — the `growth-more`
    // disclosure holds MonthInReview + the Full Picture (IA-homed on this hub,
    // never on #/milestones), so the target is the disclosure, not a route.
    primaryMove: "explore-child-record", moduleBudget: 3, demotionTarget: "disclosure",
    // Count moves + the tree gains a leaf, same frame; months layer is
    // monotonic cumulative only.
    // B-PROG-05: `?view=program` is the program page (components/program/
    // ProgramPage, its own ONE stamp do-this-week, three modules) — a mode of
    // this leaf until lib/routes.ts gains the `program` id; the `program` row
    // (hub growth, depth 1, job "See where you are in {program} and what
    // moved.", primaryMove do-this-week, moduleBudget 3) is the residue hunk
    // in REJECTIONS P6-PRACTICE (7 Oct, session A).
    threadWrite: "milestones",
  },
  {
    route: "milestones", hub: "growth", depth: 1,
    // B-LOOP-05: the shelf map — nine parent shelves, one Notice card each,
    // earlier and later bands behind each shelf's door, word search.
    job: "See what to notice next, shelf by shelf.",
    primaryMove: "notice-milestone", moduleBudget: 3, demotionTarget: "disclosure",
    // Celebration fires only on a fresh "yes", once per milestone id ever;
    // caps per Law 2 (≤800ms, ≤12 particles).
    threadWrite: "milestones",
  },
  {
    route: "language", hub: "growth", depth: 1,
    job: "Support the languages your family actually speaks.",
    primaryMove: "log-language-moment", moduleBudget: 3, demotionTarget: "disclosure",
    // B-GROWTH-15: the words logged here (`langObs`) fold into the timeline
    // as one "{count} new words in {language}" moment per day per language.
    // B-GROWTH-36: from age 3 the same move keeps a `quote` keepsake ("Things
    // {name} said", Tonight's kind) — the under-3 words stay `langObs`.
    // B-GROWTH-37: `?view=said` is the month page (a mode of this route, two
    // modules: the sheet + Print / Send to…); it carries no stamp because it
    // is a read-and-send view of what the move kept. A `language/said` route
    // id needs lib/routes.ts (REJECTIONS P2-WORDS B-GROWTH-37).
    threadWrite: "langObs",
  },
  {
    route: "screening", hub: "growth", depth: 1,
    job: "A calm check-in on how she's developing — counts, never verdicts.",
    primaryMove: "complete-check", moduleBudget: 2, demotionTarget: "development",
    // Deliberate "none": "screenings" is a CHILD_SUBCOLLECTIONS ledger but NOT
    // a buildTimeline source — results stay out of the thread by design.
    threadWrite: "none",
  },
  {
    route: "daily-play", hub: "growth", depth: 1,
    job: "Pick one good activity for today and play it together.",
    primaryMove: "log-play", moduleBudget: 3, demotionTarget: "overview",
    // play source → kind "play" with playDomain; hero pick also shows on Today.
    threadWrite: "play",
  },
  {
    route: "copilot", hub: "growth", depth: 1,
    job: "The full picture of where she is, in plain counts.",
    primaryMove: "open-full-picture", moduleBudget: 2, demotionTarget: "development",
    // Promotes only as the full-picture card on Development through the M1.7
    // gate (chips → counts). Read surface — no write.
    threadWrite: "none",
  },
  {
    route: "strengths", hub: "growth", depth: 1,
    job: "See what she's already good at — and build on it.",
    primaryMove: "approve-memory", moduleBudget: 3, demotionTarget: "development",
    // GP-26: retired to profile (RETIRED_ROUTES). B-GROWTH-23 deleted the
    // Strengths leaf; the id and this entry keep their seat like scholar /
    // find-pro, and Shell renders the Profile leaf for it, so the move and
    // budget are the Profile leaf's own (review-strengths / 2 left with
    // Strengths.tsx). Resolves to Growth via TAB_SECTION_FALLBACK. No write.
    threadWrite: "none",
  },
  {
    route: "routines", hub: "behaviors", depth: 1,
    job: "Run a ready-made daily routine with her, step by step.",
    primaryMove: "complete-routine-step", moduleBudget: 2, demotionTarget: "disclosure",
    // B-GROWTH-25: retired to plans (RETIRED_ROUTES) — the boards are Plans
    // templates; the id keeps its seat and RoutinesTab stays registered
    // (journey pattern), so its move and budget are unchanged. Homed with
    // the hub that owns plans (TAB_SECTION_FALLBACK routines → behaviors).
    // No routine ledger feeds buildTimeline — "none", said plainly.
    threadWrite: "none",
  },

  // ── PRACTICE (Heartwood D3: promoted to a depth-0 hub) ─────────────────────
  {
    route: "practice", hub: "practice", depth: 0,
    job: "Choose a story, a game or a moment to enjoy together.",
    primaryMove: "choose-together", moduleBudget: 4, demotionTarget: "disclosure",
    // Launcher is already exactly 2 modules (Kid-Mode door + worlds grid).
    // Exit strip line comes from the practiceEvents child-class fold (M1.4).
    threadWrite: "practiceEvents",
  },
  {
    route: "speech", hub: "practice", depth: 1,
    job: "Practice sounds and words as a game she wants to play.",
    primaryMove: "complete-speech-round", moduleBudget: 2, demotionTarget: "practice",
    // Folded one warm aggregated row per day, provenance "child", counts only
    // (the firewall drops correctness).
    // HEBREW EXEMPTION (W2-SHELLPLAY critic r2, recorded until a clinician-
    // reviewed Hebrew sound set exists): SOUND_LIBRARY is English content, so
    // a Hebrew UI session renders the honest door to #/language — its CTA is
    // the screen's one --gradient-cta — and complete-speech-round is EN-only.
    // The framer decides between authoring the HE set and resolving HE #/speech
    // to #/language (REJECTIONS.md, W2-SHELLPLAY r2).
    threadWrite: "speechAttempts",
  },
  {
    route: "mimic", hub: "practice", depth: 1,
    job: "Copy-me play that builds imitation — camera is a mirror, never recorded.",
    primaryMove: "complete-mimic-round", moduleBudget: 2, demotionTarget: "practice",
    threadWrite: "mimicSessions",
  },
  {
    route: "feelings", hub: "practice", depth: 1,
    job: "Name feelings and practice calming, together.",
    primaryMove: "open-world-door", moduleBudget: 2, demotionTarget: "practice",
    // W2-SHELLPLAY critic r2 (B-PLAY-08): the parent page is the co-play door
    // into Mood Mountain (B-KID-11 seam); the scenario quiz runs only in Kid Mode.
    // FeelingsLab record() writes PracticeEvent rows (emotion-id/-why/calm).
    threadWrite: "practiceEvents",
  },
  {
    route: "journey", hub: "practice", depth: 1,
    job: "One small daily quest that keeps practice a habit, never a streak.",
    primaryMove: "complete-mission", moduleBudget: 2, demotionTarget: "practice",
    // Only completed MissionRecords fold; monotonic day counts, never streaks.
    threadWrite: "missionRecords",
  },
  {
    route: "adventures", hub: "practice", depth: 1,
    job: "Story adventures where her choices quietly practice thinking skills.",
    // W2-SHELLPLAY critic r2 (B-PLAY-09): the parent page is ONE door into Kid
    // Mode Story Quest (B-KID-11 seam); scenes and the generator run in Kid Mode.
    primaryMove: "open-story-quest", moduleBudget: 1, demotionTarget: "practice",
    threadWrite: "adventureResults",
  },

  // ── STORIES (Heartwood D2: the child-starring half of the Academy split) ───
  {
    route: "stories", hub: "stories", depth: 0,
    job: "Tonight's story — starring her.",
    primaryMove: "read-tonights-story", moduleBudget: 3, demotionTarget: "disclosure",
    // ONE dominant personalized cover; evening = one pick, not a library —
    // filter rows/shelves demote behind disclosure. heroRuns fold on
    // completedAt || startedAt.
    threadWrite: "heroRuns",
  },
  {
    route: "bedtime-stories", hub: "stories", depth: 1,
    job: "A tonight-only story grown from her real day, read aloud together.",
    primaryMove: "generate-bedtime-story", moduleBudget: 2, demotionTarget: "stories",
    // W2-SHELLPLAY r2: demoted — no longer a Stories pill (one evening door: the
    // Tonight cover's "From today" mode embeds this same body). The route keeps
    // its own doors (Overview Tonight card, search) and this contract.
    // KID-10: "Good night" now writes ONE parent-provenance moment through
    // ArborContext's addMoment seam, so the ritual lands in `behaviorLogs` and
    // buildTimeline ingests it. Generate-and-discard is unchanged — the STORY
    // is still never persisted; only the parent's own line that they read one.
    threadWrite: "behaviorLogs",
  },
  {
    route: "comics", hub: "stories", depth: 1,
    job: "Her adventures as comic books she can open again and again.",
    primaryMove: "open-comic", moduleBudget: 2, demotionTarget: "stories",
    // Re-reading a shelf comic is a revisit, not a new thread event; comics
    // are minted by hero runs (that write belongs to the stories surface).
    threadWrite: "none",
  },

  // ── LEARN (Heartwood D2: the parent-learning half of the Academy split) ────
  {
    route: "masterclasses", hub: "learn", depth: 0,
    job: "Something useful in three minutes.",
    primaryMove: "open-todays-pick", moduleBudget: 3, demotionTarget: "disclosure",
    // The plan wants a "learn-done" thread line — no such source exists in
    // buildTimeline; "none" until one is added.
    threadWrite: "none",
  },
  {
    route: "learn", hub: "learn", depth: 1,
    job: "Browse the library of three-minute parent reads.",
    primaryMove: "open-learn-card", moduleBudget: 3, demotionTarget: "masterclasses",
    // Age-band filter defaults ON; provenance chip on every card. No
    // learn-done source in buildTimeline — "none".
    threadWrite: "none",
  },
  {
    route: "family", hub: "learn", depth: 1,
    job: "Keep the whole family pulling in the same direction.",
    primaryMove: "start-family-ritual", moduleBudget: 2, demotionTarget: "masterclasses",
    // Family Formation (parent register). No family-ritual source feeds
    // buildTimeline — "none".
    threadWrite: "none",
  },

  // ── CARE ───────────────────────────────────────────────────────────────────
  {
    route: "consult", hub: "care", depth: 0,
    job: "Bring in a pro without losing control.",
    primaryMove: "build-share-packet", moduleBudget: 3, demotionTarget: "disclosure",
    // One flow: find → share → track; redaction preview visibly applied before
    // anything leaves. The plan's "share-event" thread line has no source in
    // buildTimeline — "none" until one is added.
    threadWrite: "none",
  },
  {
    route: "safety", hub: "care", depth: 1,
    job: "Get help now — one tap reaches a human.",
    primaryMove: "call-helpline", moduleBudget: 2, demotionTarget: "disclosure",
    // Canon: Safety keeps a persistent reachable entry. tel: dials; the thread
    // deliberately records nothing (plan §4: none).
    threadWrite: "none",
  },
  {
    route: "school-brief", hub: "care", depth: 1,
    job: "Give her teacher a one-page brief that actually helps.",
    primaryMove: "build-school-brief", moduleBudget: 2, demotionTarget: "consult",
    // Export is fail-closed scanned; no share-event source in buildTimeline —
    // "none".
    threadWrite: "none",
  },
  {
    route: "sharing", hub: "care", depth: 1,
    job: "Choose exactly who sees what — and revoke it any time.",
    primaryMove: "grant-share", moduleBudget: 2, demotionTarget: "consult",
    // W4.4: My Care Team merged in — one roster over the same share grants.
    // No share-event source in buildTimeline — "none".
    threadWrite: "none",
  },
  {
    route: "appointments", hub: "care", depth: 1,
    job: "Keep every appointment and its follow-ups in one place.",
    primaryMove: "add-appointment", moduleBudget: 2, demotionTarget: "consult",
    // Chips requested/confirmed/done; no appointment source in buildTimeline —
    // "none".
    threadWrite: "none",
  },
  {
    route: "reports", hub: "care", depth: 1,
    // B-CAREPRO-23: "Your full record" — parent-record documents only; a
    // professional summary goes through Consult (one door on the page).
    job: "Export your own full record; a professional summary goes through Consult.",
    primaryMove: "export-report", moduleBudget: 2, demotionTarget: "consult",
    // The deep-export door folded into the Consult flow; read/export — no write.
    threadWrite: "none",
  },
  {
    route: "find-pro", hub: "care", depth: 1,
    job: "Find the right professional for what you're seeing.",
    primaryMove: "contact-pro", moduleBudget: 2, demotionTarget: "consult",
    // Directory door folded into Consult; no write.
    threadWrite: "none",
  },
  {
    route: "care-team", hub: "care", depth: 1,
    job: "See everyone helping her, in one roster.",
    primaryMove: "open-care-roster", moduleBudget: 2, demotionTarget: "sharing",
    // W4.4: merged into Trusted Sharing — the deep link stays valid and hosts
    // the same roster surface. Read surface — no write.
    threadWrite: "none",
  },
  {
    route: "handoff", hub: "care", depth: 1,
    job: "Hand a professional the story so far — redacted, on your terms.",
    primaryMove: "copy-handoff-brief", moduleBudget: 2, demotionTarget: "consult",
    // The former hidden handoff door, folded into the Consult flow; no
    // share-event source in buildTimeline — "none".
    threadWrite: "none",
  },
  {
    route: "attribution", hub: "care", depth: 1,
    job: "Admin-only: see which channels bring families in.",
    primaryMove: "view-attribution", moduleBudget: 2, demotionTarget: "disclosure",
    // Internal/admin, deep-link + admin-gated Settings only (resolves to Care
    // via TAB_SECTION_FALLBACK). Never a parent surface; no write.
    threadWrite: "none",
  },

  // ── PROFILE ────────────────────────────────────────────────────────────────
  {
    route: "profile", hub: "profile", depth: 0,
    job: "Who she is — and what Arbor remembers.",
    primaryMove: "capture-moment", moduleBudget: 3, demotionTarget: "disclosure",
    // B-SHELL-26 (framer default, REJECTIONS P1-NEXTLEVEL): the review queue is
    // gone — the parent's own facts are kept on creation, inferences are asked
    // inline (B-AI-07) and on #/memory. The hub's one move is now telling Arbor
    // one thing: the stamp sits on the profile's "Add a fact" / "Tell Arbor one
    // thing" door (edit drawer), rendered once in every state. The remembered
    // list carries Forget only.
    threadWrite: "memory",
  },
  {
    route: "memory", hub: "profile", depth: 1,
    job: "Approve, edit, or forget what Arbor remembers about her.",
    primaryMove: "approve-memory-fact", moduleBudget: 3, demotionTarget: "profile",
    // ChildMemory approve/forget over MemoryReviewItem; only approved facts
    // enter the stream (memory source filters status === "approved").
    threadWrite: "memory",
  },
  {
    route: "science", hub: "profile", depth: 1,
    job: "Why Arbor says what it says — the science, in plain language.",
    primaryMove: "open-evidence", moduleBudget: 2, demotionTarget: "profile",
    // Trust/editorial page (trust-center home per M3.3), re-homed to Profile.
    // Read surface — no write.
    threadWrite: "none",
  },
];

/* ════════════════════════════════════════════════════════════════════════════
   Item 11 (IA-02, re-evidenced) — the contract becomes measurable.

   `SURFACE_CONTRACTS` declared budgets for 43 routes and exactly ONE of them
   was enforced. The declaration was not the problem; the missing half was a
   lookup the render tree could reach, so the numbers below can be compared
   against what a route actually paints. `contractFor` is that lookup, and
   Shell's <SurfaceFrame> stamps its two enforceable fields onto the DOM
   (`data-route`, `data-module-budget`) so a measurement — rendered or scripted
   — never has to re-derive which contract governs the surface it is looking at.

   Nothing here interprets the budget: counting is the job of the leaf stamps
   (`data-module` on top-level sibling sections, `data-primary-move` on the one
   declared control) and of scripts/framework-check.mjs, which walks the leaves.
   ════════════════════════════════════════════════════════════════════════════ */

const CONTRACT_BY_ROUTE: ReadonlyMap<ActiveTab, SurfaceContract> = new Map(
  SURFACE_CONTRACTS.map((c) => [c.route, c] as const),
);

/**
 * The contract governing `route`, or `undefined` when the route has none.
 *
 * Undefined is a real answer, not an error: SC-1 pins completeness against
 * ROUTE_IDS, so a caller that reads `undefined` here is looking at a route
 * that was added without a contract — the frame degrades to an unbudgeted
 * surface rather than inventing a number.
 */
export function contractFor(route: ActiveTab): SurfaceContract | undefined {
  return CONTRACT_BY_ROUTE.get(route);
}
