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

describe("3.1 — the chain's destination is the Trust Center, from ONE component", () => {
  it("TrustLink navigates to #/science and is not forked per surface", () => {
    const src = read("components/trust/TrustLink.tsx");
    expect(src).toContain('setActiveTab("science")');
    // The label is a fixed navigation phrase — surfaces pass only `surface`.
    expect(src).toContain('trustText(uiLang, "elev.trust.link")');
  });
});
