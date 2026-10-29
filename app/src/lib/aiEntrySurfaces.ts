/**
 * B-GA-11 — every enabled place the app sends a parent's or child's input to
 * a model, and how the parent is told it is AI (EU AI Act Art. 50).
 *
 * Pure registry, read by aiEntrySurfaces.guard.test.ts, which scans the
 * client source for every AI call and fails when one is not listed here, when
 * an interaction surface stops rendering its approved line (EN and HE), or
 * when a new AI wording appears that is not an approved one.
 *
 * Classes:
 *  - interaction: the parent's words, voice, photo or document go to the AI
 *    and the AI answers or drafts. The approved line shows at the input, so
 *    it is visible at the first interaction (Talk's composer foot,
 *    AiDisclosureLine, or the surface's own approved line).
 *  - generated: a parent taps for an output built from what Arbor already
 *    holds (a plan, a pattern, an explanation, a story, a note, a summary).
 *    How synthetic output is labelled is counsel's decision (GA acceptance
 *    B-GA-11: "synthetic-output duties applied only as counsel determines").
 *  - kid: kid mode. The parent register never renders there (two registers),
 *    and the parent meets the disclosure at Talk, describe and the first-run
 *    wow. Child-facing wording is counsel's.
 *  - voice-output: Arbor's own text, read aloud; nothing the user typed or
 *    said is sent.
 */

export type AiSurface =
  | {
      file: string; kind: "interaction"; disclosure: AiDisclosureKey; via?: "CompanionComposer" | "AiDisclosureLine";
      /** AiDisclosureLine surfaces: every input whose words, voice or file go
       *  to the AI (an element id, a data-testid, or the onClick handler of
       *  the action that sends them). The guard checks the line renders right
       *  after each one, before the next form control. */
      inputs?: readonly string[];
    }
  | { file: string; kind: "generated" | "kid" | "voice-output"; why: string };

/** The approved Art. 50 wordings (EN + HE in the i18n dictionaries; the plan
 *  step labels in lib/plans/planStrings.ts). A new AI wording must be one of
 *  these or be listed in AI_MENTIONS. */
export const AI_DISCLOSURE_KEYS = {
  "companion.input.foot": "the first-interaction line: Talk's composer foot and AiDisclosureLine",
  "elev.describe.aiLine": "the describe readback: Arbor's AI drafted these rows",
  "elev.wow.aiNote": "the first-run wow, where the avatar, the comic and coaching are introduced",
  "elev.pilot.photo.pdf.or.pasted.text.check.each.line.against.the.original.edi": "home program import: reading a file uses AI",
  "stage.steps.ownLabel": "Everyday Plans: a step phrased by Arbor's AI",
  "stage.steps.practitionerLabel": "Everyday Plans: a professional's step phrased by Arbor's AI",
  "elev.aihonesty.coachStatus": "Talk's identity: AI guide",
  "companion.portrait.confirmed": "provenance: an AI proposal a parent confirmed",
  "ms.heReview.note": "the Hebrew milestone wording is an AI-assisted draft awaiting native review",
  "coach.aiDisclosure": "the general Art. 50 line in i18n.ts (approved; not rendered today)",
  "coach.coachStatus": "the retired identity line (not rendered since AI-13)",
} as const;
export type AiDisclosureKey = keyof typeof AI_DISCLOSURE_KEYS;

/** Strings that mention AI but are not a disclosure of an interaction. */
export const AI_MENTIONS: Readonly<Record<string, string>> = {
  "elev.plan.plus.2": "plan feature label",
  "elev.plan.pw.bodySchoolNotes": "paywall feature copy",
  "elev.safety.guard.gdpr.body": "safety policy statement",
  "trust.avatar.stores.1": "training claim (never used to train AI)",
  "trust.avatar.consent.claim": "training claim (never used to train AI)",
  "shell.sandbox.body": "developer sandbox banner",
  "shell.sandbox.toast": "developer sandbox toast",
  "set.admin.founder.sub": "admin dashboard",
  "section.lede": "Everyday Plans: says no AI runs while the book is read",
  "stage.door.body": "Everyday Plans: says no AI runs while the book is read",
};

/** Every client file that calls a model route → the endpoints it calls and
 *  the surfaces a person reaches them from. */
export const AI_CALLERS: Readonly<Record<string, { endpoints: readonly string[]; surfaces: readonly AiSurface[] }>> = {
  "components/tabs/CoachTab.tsx": {
    endpoints: ["api.extractConversationProposals", "api.liveToken", "api.liveTurn", "streamVoice"],
    surfaces: [{ file: "components/tabs/CoachTab.tsx", kind: "interaction", disclosure: "companion.input.foot", via: "CompanionComposer" }],
  },
  "context/ArborContext.tsx": {
    endpoints: ["/api/chat", "streamCouncil", "/api/explain", "api.analyzeBehavior", "api.generatePlan"],
    surfaces: [
      { file: "components/tabs/CoachTab.tsx", kind: "interaction", disclosure: "companion.input.foot", via: "CompanionComposer" },
      { file: "components/tabs/BehaviorsTab.tsx", kind: "generated", why: "\"Find a pattern\": counts from the moments already kept" },
      { file: "components/tabs/PlansTab.tsx", kind: "generated", why: "a plan built from a chosen challenge and the record's counts" },
      { file: "components/tabs/MilestonesTab.tsx", kind: "generated", why: "an explanation of a catalogue milestone" },
    ],
  },
  "components/tabs/MilestonesTab.tsx": {
    endpoints: ["/api/explain"],
    surfaces: [{ file: "components/tabs/MilestonesTab.tsx", kind: "generated", why: "an explanation of a catalogue milestone" }],
  },
  "lib/describeChildClient.ts": {
    endpoints: ["api.describeChild"],
    surfaces: [
      { file: "components/describe/DescribeChild.tsx", kind: "interaction", disclosure: "companion.input.foot", via: "AiDisclosureLine", inputs: ["describe-text"] },
      { file: "components/describe/DescribeThread.tsx", kind: "interaction", disclosure: "companion.input.foot", via: "AiDisclosureLine", inputs: ["describe-answer-text"] },
      { file: "components/describe/DescribeReadback.tsx", kind: "interaction", disclosure: "elev.describe.aiLine" },
    ],
  },
  "components/overview/QuickLogModal.tsx": {
    endpoints: ["api.extractLog"],
    surfaces: [{ file: "components/overview/QuickLogModal.tsx", kind: "interaction", disclosure: "companion.input.foot", via: "AiDisclosureLine", inputs: ["quick-log-moment", "quick-log-trigger"] }],
  },
  "components/program/HomeProgramImport.tsx": {
    endpoints: ["api.importHomeRecommendations"],
    surfaces: [{ file: "components/program/HomeProgramImport.tsx", kind: "interaction", disclosure: "elev.pilot.photo.pdf.or.pasted.text.check.each.line.against.the.original.edi" }],
  },
  "components/profile/AvatarCreator.tsx": {
    endpoints: ["api.generateAvatar"],
    surfaces: [{ file: "components/profile/AvatarCreator.tsx", kind: "interaction", disclosure: "companion.input.foot", via: "AiDisclosureLine", inputs: ["generate"] }],
  },
  "lib/plans/planApi.ts": {
    endpoints: ["/api/plans/phrase"],
    surfaces: [{ file: "components/plans/PlanComposer.tsx", kind: "interaction", disclosure: "stage.steps.ownLabel" }],
  },
  "components/sections/SchoolBrief.tsx": {
    endpoints: ["api.generateBrief"],
    surfaces: [{ file: "components/sections/SchoolBrief.tsx", kind: "generated", why: "a note for a teacher or professional, drafted from the record" }],
  },
  "components/tabs/BedtimeStoriesTab.tsx": {
    endpoints: ["api.generateBedtimeStory"],
    surfaces: [{ file: "components/tabs/BedtimeStoriesTab.tsx", kind: "generated", why: "a bedtime story for tonight, generated and discarded" }],
  },
  "hooks/useTodaysFocus.ts": {
    endpoints: ["/api/todays-focus"],
    surfaces: [{ file: "hooks/useTodaysFocus.ts", kind: "generated", why: "Today's focus line, from the record" }],
  },
  "hooks/useWeeklyRecap.ts": {
    endpoints: ["api.digest"],
    surfaces: [{ file: "hooks/useWeeklyRecap.ts", kind: "generated", why: "the weekly recap, from the week's record" }],
  },
  "components/tabs/HeroJourneyTab.tsx": {
    endpoints: ["api.generateHeroJourney"],
    surfaces: [{ file: "components/tabs/HeroJourneyTab.tsx", kind: "kid", why: "the child's story text, personalised once and kept" }],
  },
  "components/practice/WorldScene.tsx": {
    endpoints: ["api.generateScene"],
    surfaces: [{ file: "components/practice/WorldScene.tsx", kind: "kid", why: "world scene art" }],
  },
  "lib/heroComics.ts": {
    endpoints: ["api.generateComic"],
    surfaces: [{ file: "lib/heroComics.ts", kind: "kid", why: "comic pages of the child's story books (the kid shelf and Our books)" }],
  },
  "lib/firstComic.ts": {
    endpoints: ["api.generateComic"],
    surfaces: [{ file: "components/onboarding/WowOnboarding.tsx", kind: "interaction", disclosure: "elev.wow.aiNote" }],
  },
  "components/kidmode/hero/buildHeroSheet.ts": {
    endpoints: ["/api/hero-pose"],
    surfaces: [{ file: "components/kidmode/hero/buildHeroSheet.ts", kind: "kid", why: "the hero's pose art, drawn from the generated hero; the parent reviews it on the profile" }],
  },
  "components/kidmode/hero/buildBookSheet.ts": {
    endpoints: ["/api/hero-pose"],
    surfaces: [{ file: "components/kidmode/hero/buildBookSheet.ts", kind: "kid", why: "the book's hero sheet, drawn from the generated hero" }],
  },
  "components/kidmode/hero/buildBookNarration.ts": {
    endpoints: ["/book-narration"],
    surfaces: [{ file: "components/kidmode/hero/buildBookNarration.ts", kind: "kid", why: "book narration in the child's name" }],
  },
  "lib/speechScorer.ts": {
    endpoints: ["api.scoreUtterance"],
    surfaces: [{ file: "lib/speechScorer.ts", kind: "kid", why: "child speech practice; off in production (CHILD_ASR_PROVIDER=none)" }],
  },
  "lib/naturalVoice.ts": {
    endpoints: ["/api/tts"],
    surfaces: [{ file: "lib/naturalVoice.ts", kind: "voice-output", why: "Arbor's own reply or question, read aloud" }],
  },
};

/** The client calls the guard scans for (lib/api.ts AI methods, the stream
 *  helpers and the direct routes). */
export const AI_CLIENT_METHODS = [
  "analyzeBehavior", "generatePlan", "generateBedtimeStory", "generateHeroJourney", "generateBrief", "extractLog",
  "describeChild", "importHomeRecommendations", "vision", "generateAvatar", "generateScene", "generateComic",
  "generateAdventure", "scoreUtterance", "council", "extractConversationProposals", "liveToken", "liveTurn", "digest",
] as const;
export const AI_STREAM_HELPERS = ["streamVoice", "streamCouncil", "streamChat"] as const;
export const AI_DIRECT_ROUTES = ["/api/chat", "/api/explain", "/api/todays-focus", "/api/tts", "/api/hero-pose", "/api/plans/phrase", "/book-narration", "/api/voice", "/api/council", "/api/live/token"] as const;
