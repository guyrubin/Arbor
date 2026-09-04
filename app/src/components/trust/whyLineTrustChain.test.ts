/**
 * Masterplan 3.1 — the why-line → Trust Center chain, pinned per surface.
 *
 * History (visual audit 2026-08-12): TrustLink.tsx shipped READY but was passed
 * `trustLink` in exactly ONE place (LearnLibrary's picked-for-you rail). Every
 * other recommendation why-line in the app was inert text — "Why this fits …"
 * with nothing to press. Masterplan 3.1 requires the why-line on EVERY
 * recommendation card to reach the Trust Center, so a card whose why-line has
 * no TrustLink fails review.
 *
 * This is a SOURCE scan (the repo's Screening.firewall.test.ts / ContentActionBar
 * pattern — the suite runs in `environment: "node"`, so no DOM render). For each
 * surface it asserts BOTH halves of the pair: the why-line still renders, and a
 * TrustLink is mounted on that same surface with its analytics tag.
 *
 * Deliberately NOT asserted: chip placement/styling. The rule is that the chain
 * exists and stays secondary — Today's one-primary-action rule is pinned by
 * todayConsolidation.test.ts, not here.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(app, rel), "utf8");

/** A TrustLink mounted with an explicit surface tag (self-closing JSX). */
const mount = (surface: string) =>
  new RegExp(`<TrustLink\\s+surface=["']${surface}["']\\s*/>`);
/** The shared why-line slot carrying trustLink (ContentActionBar route). */
const WHY_SLOT_WITH_TRUST = /<ContentWhyLine[\s\S]{0,200}?\btrustLink\b/;

/* ── Negative controls ──────────────────────────────────────────────────────
   Verbatim fixtures of the INERT why-lines the audit found. If a refactor ever
   weakens the matchers past rejecting these, this half fails first — the guard
   can never rot into a vacuous pass. */
const OLD_PROMPT_WHY = `      <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: "var(--arbor-faint)" }}>
        <span className="font-extrabold" style={{ color: "var(--arbor-muted)" }}>{t("today.intent.why")}</span>{" "}
        {t("today.intent.whySimple")}
      </p>`;
const OLD_PLAY_WHY = `        <p className="text-[12px] mt-3.5" style={{ color: "var(--arbor-faint)" }}>{why}</p>`;
const OLD_WHY_SLOT = `<ContentWhyLine why={why} surface="learn-rail" />`;

describe("3.1 chain guard — the matchers still reject the OLD inert why-lines", () => {
  it("rejects the pre-fix PromptCaptureCard why-line", () => {
    expect(mount("today-prompt").test(OLD_PROMPT_WHY)).toBe(false);
  });
  it("rejects the pre-fix DailyPlayCard why-line", () => {
    expect(mount("daily-play").test(OLD_PLAY_WHY)).toBe(false);
  });
  it("rejects a shared why-slot that opted OUT of trustLink", () => {
    expect(WHY_SLOT_WITH_TRUST.test(OLD_WHY_SLOT)).toBe(false);
  });
});

/* ── The surfaces ───────────────────────────────────────────────────────────
   [file, why-line evidence, TrustLink surface tag] */
const SURFACES: [string, RegExp, string][] = [
  // Today's AI-focus hero. The why COPY is composed one level up in OverviewTab
  // today, so the card accepts an optional `why` (rendered through the shared
  // slot with trustLink ON) and mounts a bare TrustLink when it is omitted —
  // either way the chain is present on this surface.
  ["components/overview/TodayRecommendation.tsx", /\bwhy\?:\s*string/, "today-focus"],
  ["components/overview/PromptCaptureCard.tsx", /t\("today\.intent\.why"\)/, "today-prompt"],
  ["components/overview/DailyPlayCard.tsx", /<span dir="auto">\{why\}<\/span>/, "daily-play"],
  ["components/sections/AcademyForYou.tsx", /t\("foryou\.whyToggle"\)/, "academy-foryou"],
  ["components/sections/ScholarHubCard.tsx", /t\("hub\.scholar\.provenance"\)/, "scholar-hub"],
  // UI-WIRE inventory 2026-08-20: the two missing mounts, now pinned.
  // Learn reader — provenance hedge + chip on the same wrapping row
  // (scholar-hub-reader pattern).
  ["components/sections/LearnLibrary.tsx", /t\("learn\.provenance"\)/, "learn-reader"],
  // Coach answer cards — the highest-trust-stakes surface; the chip rides the
  // attribution row, beside the "why this might be happening" disclosure.
  ["components/coach/CoachAnswerCards.tsx", /t\("coach\.cards\.why"\)/, "coach-answer"],
  // N3: CourseCard — TodayRecommendation pattern: optional caller-owned `why`
  // (honesty gate lives in DailyPlayTab), bare TrustLink when it is omitted.
  ["components/overview/CourseCard.tsx", /\bwhy\?:\s*string/, "course-card"],
];

describe("3.1 — every recommendation why-line reaches the Trust Center", () => {
  for (const [file, whyLine, surface] of SURFACES) {
    describe(file, () => {
      const src = read(file);
      it("still renders its why-line", () => {
        expect(src).toMatch(whyLine);
      });
      it(`mounts <TrustLink surface="${surface}" />`, () => {
        expect(src).toMatch(mount(surface));
        expect(src).toContain('from "../trust/TrustLink"');
      });
    });
  }

  it("TodayRecommendation routes a caller-supplied why through the shared slot with trustLink ON", () => {
    const src = read("components/overview/TodayRecommendation.tsx");
    expect(src).toMatch(WHY_SLOT_WITH_TRUST);
  });

  it("LearnLibrary's picked-for-you rail keeps its chain (no regression)", () => {
    expect(read("components/sections/LearnLibrary.tsx")).toMatch(WHY_SLOT_WITH_TRUST);
  });

  it("ScholarHub's reader overlay carries the chain too", () => {
    expect(read("components/sections/ScholarHubCard.tsx")).toMatch(mount("scholar-hub-reader"));
  });
});

/* ── N3: CourseCard honesty gate ────────────────────────────────────────────
   A course why-line may render ONLY where an honest per-child rationale exists:
   the course's domain came from the child's logged concern domains. Parent-
   chosen readiness tracks and the no-signal fallback get the bare TrustLink —
   a fabricated rationale must never appear. */
describe("N3 — CourseCard why-line is honesty-gated", () => {
  it("CourseCard routes a caller-supplied why through the shared slot with trustLink ON", () => {
    expect(read("components/overview/CourseCard.tsx")).toMatch(WHY_SLOT_WITH_TRUST);
  });

  it("DailyPlayTab gates the recommended course's why on the logged concern domains", () => {
    const src = read("components/tabs/DailyPlayTab.tsx");
    // The why prop must be conditioned on concernDomains.includes(course.domain)
    // and resolve through the course.why i18n key (plain observed factors).
    expect(src).toMatch(/why=\{concernDomains\.includes\(course\.domain\)[\s\S]{0,200}?t\("course\.why"/);
  });

  it("the parent-chosen readiness course mounts NO why (bare TrustLink chain only)", () => {
    const src = read("components/tabs/DailyPlayTab.tsx");
    const readinessMount = src.match(/<CourseCard\s+course=\{readinessCourse\}[\s\S]*?\/>/);
    expect(readinessMount).not.toBeNull();
    expect(readinessMount![0]).not.toMatch(/\bwhy=/);
  });
});

describe("3.1 — the chain's destination is the Trust Center, from ONE component", () => {
  it("TrustLink navigates to #/science and is not forked per surface", () => {
    const src = read("components/trust/TrustLink.tsx");
    expect(src).toContain('setActiveTab("science")');
    // The label is a fixed navigation phrase — surfaces pass only `surface`.
    expect(src).toContain('trustText(uiLang, "elev.trust.link")');
  });
});

/* ── TJB-04: the Behaviors analysis card joins the chain ─────────────────────
   The card used to be component state with no why-line and no "keep" — a
   synthesis a parent could not find tomorrow. It now renders through the
   shared ContentActionBar slot (why-line + TrustLink surface
   "behavior-analysis" + the canonical `save` verb = "Keep this") and is
   persisted to the child's `insights` subcollection. */
describe("TJB-04 — the Behaviors analysis card carries the why-line → Trust Center chain and a Keep", () => {
  const BAR_WITH_TRUST = /<ContentActionBar[\s\S]{0,300}?surface="behavior-analysis"[\s\S]{0,300}?\btrustLink\b/;

  it("NEGATIVE CONTROL — the pre-fix card (coach button only, no why, no chain) fails the matcher", () => {
    const preFix = `<div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <button onClick={() => { seedCoach({ prompt: \`…\`, source: "behavior-analysis" }); }}>
                    <Icon name="auto_awesome" size={15} fill={1} /> {t("beh.analyzeCoachCta")}
                  </button>
                </div>`;
    expect(BAR_WITH_TRUST.test(preFix)).toBe(false);
    expect(preFix).not.toMatch(/t\("beh\.analysis\.why"/);
  });

  it("BehaviorsTab renders the why-line through the shared slot with trustLink ON, surface behavior-analysis", () => {
    const src = read("components/tabs/BehaviorsTab.tsx");
    expect(src).toMatch(/t\("beh\.analysis\.why"/);
    expect(src).toMatch(BAR_WITH_TRUST);
    expect(src).toContain('from "../ui/ContentActionBar"');
  });

  it("offers ONE-tap Keep this through the canonical save verb, writing to the insights record", () => {
    const src = read("components/tabs/BehaviorsTab.tsx");
    expect(src).toMatch(/verb: "save",\s*label: t\("beh\.analysis\.keep"\)/);
    expect(src).toMatch(/keepBehaviorInsight\(behaviorAnalysis\.actionPlanSuggestion\)/);
    const ctx = read("context/ArborContext.tsx");
    expect(ctx).toMatch(/useChildCollection<InsightRecord>\(childProfile\.id, "insights"/);
    expect(ctx).toMatch(/kind: "behavior-analysis"/);
    expect(ctx).toMatch(/kind: "kept-insight"/);
  });

  it("the why-line is counts-only copy in both languages (no score/percent/verdict)", () => {
    const en = read("lib/i18n.ts").match(/"beh\.analysis\.why":\s*"([^"]+)"/g) ?? [];
    expect(en.length).toBe(2);
    for (const line of en) expect(line).not.toMatch(/%|score|on track|delay/i);
  });
});

/* ── GP-22: the Growth lane's remaining why-lines join the chain ────────────
   Audit 2026-09-03: grep for TrustLink/EvidenceChip across the Growth lane
   returned ZERO matches outside DevelopmentTab's hero EvidenceChip. The
   screener, the watch points, the Full Picture's weekly recommendation, each
   "worth a conversation" row and the memory queue all rendered a why WITHOUT a
   door — the highest-stakes explanations in the app were the ones a parent
   could not interrogate.

   These surfaces mount through the SHARED slot (ContentWhyLine why=… trustLink
   surface=…) rather than a bare <TrustLink/>, so they are pinned by the slot
   matcher plus their own surface tag. Same rule, one component. */
describe("GP-22 — the Growth lane why-lines reach the Trust Center", () => {
  /** A ContentWhyLine carrying BOTH trustLink and this surface tag, in either
   *  prop order (the slot takes them as siblings). */
  const slot = (surface: string) =>
    new RegExp(
      `<ContentWhyLine[^>]*\\btrustLink\\b[^>]*surface="${surface}"|<ContentWhyLine[^>]*surface="${surface}"[^>]*\\btrustLink\\b`,
    );

  it("NEGATIVE CONTROL — the pre-fix inert why-lines fail every matcher", () => {
    // Verbatim pre-change shapes from the audit.
    const oldWatchPoints = `            <p style={{ color: "var(--arbor-muted)" }}>
              {watchPoints.length > 0 ? (<>{...}</>) : (t("ms.watch.none"))}
            </p>`;
    const oldCopilotFocus = `            <p className="text-xs mt-1.5 leading-relaxed max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{recommendation.why}</p>`;
    const oldCopilotWatch = `                    {evidence.map((e, i) => (<p key={i}>Evidence: {e}</p>))}`;
    const oldSlotWithoutTrust = `<ContentWhyLine why={why} surface="milestone-watch" />`;
    for (const [src, surface] of [
      [oldWatchPoints, "milestone-watch"],
      [oldCopilotFocus, "copilot-focus"],
      [oldCopilotWatch, "copilot-watch"],
      [oldSlotWithoutTrust, "milestone-watch"],
    ] as [string, string][]) {
      expect(src).toBeTruthy();
      expect(slot(surface).test(src)).toBe(false);
    }
  });

  const GROWTH_SURFACES: [string, RegExp, string][] = [
    // The hub's weekly-focus card — the pick the parent is asked to act on.
    ["components/tabs/DevelopmentTab.tsx", /t\("growth\.focus\.eyebrow"\)/, "growth-focus"],
    // "Gentle watch points" — a COUNT of things not marked yet, on the map.
    ["components/tabs/MilestonesTab.tsx", /t\("ms\.watchPoints"\)/, "milestone-watch"],
    // The Full Picture's weekly recommendation + each conversation row.
    ["components/practice/DevelopmentCopilot.tsx", /\{recommendation\.why\}/, "copilot-focus"],
    ["components/practice/DevelopmentCopilot.tsx", /elev\.fullpicture\.watch\.title/, "copilot-watch"],
    // The memory queue: every pending row is a claim about the child.
    ["components/sections/ChildMemory.tsx", /t\("elev\.childmem\.trustNote"\)/, "child-memory"],
    // GP-32 / GP-33 — the two new Growth records carry the chain from day one.
    ["components/growth/MonthInReview.tsx", /elev\.waveR\.month\.eyebrow/, "growth-month-review"],
    ["components/growth/FirstWordsLedger.tsx", /elev\.waveR\.words\.eyebrow/, "growth-first-words"],
  ];

  for (const [file, whyLine, surface] of GROWTH_SURFACES) {
    it(`${file} keeps its why-line and mounts the chain as "${surface}"`, () => {
      const src = read(file).replace(/\r\n/g, "\n");
      expect(src, `${file} is empty or unreadable`).toBeTruthy();
      expect(src).toMatch(whyLine);
      expect(src).toMatch(slot(surface));
      expect(src).toContain('from "../ui/ContentActionBar"');
    });
  }

  it("GP-23 — the milestone AI answers carry the chain through the action bar", () => {
    const src = read("components/tabs/MilestonesTab.tsx").replace(/\r\n/g, "\n");
    expect(src).toBeTruthy();
    for (const surface of ["milestone-explain", "milestone-gaps"]) {
      const bar = src.match(new RegExp(`<ContentActionBar[\\s\\S]{0,600}?surface="${surface}"[\\s\\S]{0,600}?/>`));
      expect(bar, `no ContentActionBar for ${surface}`).toBeTruthy();
      expect(bar![0]).toMatch(/\btrustLink\b/);
      expect(bar![0]).toMatch(/\bwhy=/);
    }
  });
});
