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
 * DECLARATION ONLY — no component imports this yet; guards live in
 * surfaceContract.test.ts (SC-1 completeness · SC-3 demotion · SC-4 thread
 * integrity; SC-2 render-count budgets are the declared follow-up, prototyped
 * by components/overview/todayModules.ts).
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
    job: "One thing to do now — and what changed since you left.",
    primaryMove: "do-today-action", moduleBudget: 5, demotionTarget: "disclosure",
    // Budget 5 = todayModules.ts TODAY_MODULE_BUDGET (Rule A, already law);
    // demoted modules land in the collapsed "More" drawer.
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
    primaryMove: "open-lens", moduleBudget: 2, demotionTarget: "coach",
    // Canon: the lens library stays in the Ask hub. Read-only browse — no write.
    threadWrite: "none",
  },

  // ── JOURNAL ────────────────────────────────────────────────────────────────
  {
    route: "journal", hub: "journal", depth: 0,
    job: "Catch the moment before it's gone.",
    primaryMove: "capture-moment", moduleBudget: 3, demotionTarget: "timeline",
    // Captured moments enter the stream as kind "moment" from behaviorLogs;
    // the row appears in the timeline BEFORE any AI runs (plan §4).
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
    primaryMove: "notice-milestone", moduleBudget: 4, demotionTarget: "milestones",
    // Count moves + the tree gains a leaf, same frame; months layer is
    // monotonic cumulative only.
    threadWrite: "milestones",
  },
  {
    route: "milestones", hub: "growth", depth: 1,
    job: "Mark what she just did for the first time.",
    primaryMove: "mark-milestone", moduleBudget: 3, demotionTarget: "disclosure",
    // Celebration fires only on a fresh "yes", once per milestone id ever;
    // caps per Law 2 (≤800ms, ≤12 particles).
    threadWrite: "milestones",
  },
  {
    route: "language", hub: "growth", depth: 1,
    job: "Support the languages your family actually speaks.",
    primaryMove: "log-language-moment", moduleBudget: 3, demotionTarget: "disclosure",
    // No language/vocab ledger feeds buildTimeline today — "none" until a
    // source exists.
    threadWrite: "none",
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
    primaryMove: "review-strengths", moduleBudget: 2, demotionTarget: "development",
    // Folded into the Development Profile, resolves to Growth via
    // TAB_SECTION_FALLBACK. Read surface — no write.
    threadWrite: "none",
  },
  {
    route: "routines", hub: "growth", depth: 1,
    job: "Run a ready-made daily routine with her, step by step.",
    primaryMove: "complete-routine-step", moduleBudget: 2, demotionTarget: "disclosure",
    // ⚠ Plan §3's hub table omits "routines" entirely — homed here per the
    // actual navigation.ts (Growth tools + fallback routines:"growth"); flag
    // for Guy. Progress is a COUNT {done}/{total} only (clinical firewall).
    // No routine ledger feeds buildTimeline — "none", said plainly.
    threadWrite: "none",
  },

  // ── PRACTICE (Heartwood D3: promoted to a depth-0 hub) ─────────────────────
  {
    route: "practice", hub: "practice", depth: 0,
    job: "Play the games that grow her.",
    primaryMove: "start-world", moduleBudget: 2, demotionTarget: "disclosure",
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
    primaryMove: "complete-feelings-scenario", moduleBudget: 2, demotionTarget: "practice",
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
    primaryMove: "complete-adventure-scene", moduleBudget: 2, demotionTarget: "practice",
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
    // AP-057: day-rooted, generate-and-discard. The plan wants "co-read
    // logged" — no bedtime/co-read source exists in buildTimeline; "none"
    // until one is added.
    threadWrite: "none",
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
    job: "Export the deep report when a pro needs the full record.",
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
    primaryMove: "approve-memory", moduleBudget: 3, demotionTarget: "disclosure",
    // The hub's one move per plan §4 (MY CHILD): approve a proposed fact —
    // the approve control itself lives on the memory tool (ChildProfile's
    // memory chapter routes there); approved facts land as kind "memory".
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
