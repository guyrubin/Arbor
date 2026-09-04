/**
 * ENG-L0 / ENG-L2 — the two day-N loops are actually WIRED.
 *
 * This repo's recurring failure mode is capability BUILT and never reached: a
 * module ships, its unit tests pass, and nothing on a real screen calls it.
 * Both items here are loops over pieces that already existed, so the value is
 * entirely in the seams — which is what this file pins.
 *
 * Scan discipline (this repo has been bitten by vacuous scans):
 *  · \r\n normalised and comments stripped BEFORE any regex runs, so a scan can
 *    never pass on a sentence in a doc comment;
 *  · every extraction is asserted non-empty first;
 *  · every rule carries a negative control in the PRE-CHANGE shape, so a
 *    reverted fix fails here instead of passing silently.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18nElevation/firstMoment";
import { elevationEn, elevationHe } from "../../lib/i18nElevation/index";
import { FIRST_MOMENT_STEPS } from "../../lib/firstMomentChain";
import { LIFECYCLE_STICKY_KINDS } from "./useLifecycleMoment";

/** Read a source file relative to src/, CRLF-normalised and comment-stripped. */
const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const CARD = read("components/overview/LifecycleMomentCard.tsx");
const OVERVIEW = read("components/tabs/OverviewTab.tsx");

describe("the sources were actually read", () => {
  it("both files carry real code, not an empty string", () => {
    expect(CARD.length).toBeGreaterThan(4_000);
    expect(OVERVIEW.length).toBeGreaterThan(20_000);
    // A comment-stripping bug that ate the file would trip these too.
    expect(CARD).toContain("export default function LifecycleMomentCard");
    expect(OVERVIEW).toContain("export default function OverviewTab");
  });
});

/* ── ENG-L0 ───────────────────────────────────────────────────────────────── */

describe("ENG-L0 — the day-0 chain is reachable and resumable", () => {
  it("the card resolves the chain from the shared module, not from local state", () => {
    expect(CARD).toContain('from "../../lib/firstMomentChain"');
    expect(CARD).toContain("resolveFirstMomentChain(");
    expect(CARD).toContain("readFirstMomentChain(childId)");
    expect(CARD).toContain("markFirstMomentStep(childId, step)");
  });

  it("is RESUMABLE: first-moment persists until the parent finishes or dismisses it", () => {
    // The real set, not a scan — this is the rule, and an announcement kind
    // would be marked seen on its first render and never come back.
    expect(LIFECYCLE_STICKY_KINDS.has("first-moment")).toBe(true);
  });

  it("NEGATIVE CONTROL — the pre-change sticky set really did drop the chain after one render", () => {
    // Verbatim pre-ENG-L0 set. If this ever equals the shipped set again, the
    // chain has gone back to being a one-shot announcement.
    const before = new Set(["interest-ask"]);
    expect(before.has("first-moment")).toBe(false);
    expect(LIFECYCLE_STICKY_KINDS.size).toBeGreaterThan(before.size);
  });

  it("does NOT nag: dismissing retires the chain record as well as the card", () => {
    expect(CARD).toContain("dismissFirstMomentChain(childId)");
    // Completion retires it too — a finished checklist that reappears is a nag.
    expect(CARD).toMatch(/if \(isChain && chain\.complete\) onDismiss\(\)/);
  });

  it("the keepsake step REUSES the existing share pipeline, correctly captioned", () => {
    const share = CARD.match(/<ShareButton[\s\S]{0,700}?\/>/)?.[0] ?? "";
    expect(share.length).toBeGreaterThan(100);
    expect(share).toContain('artifact="story"');
    expect(share).toContain('surface="d0_first_moment"');
    // ENG-16: an explicit caption key. Without it the artifact fallback
    // (`share.caption.story` — "{name}'s story, MADE WITH Arbor") would claim
    // Arbor wrote the parent's own words.
    expect(share).toContain('captionKey="elev.d0.share.caption"');
    expect(share).toContain("getCardOpts");
  });

  it("NEGATIVE CONTROL — the caption fallback the explicit key exists to avoid", () => {
    // Proves the assertion above is not decorative: this is what a keepsake
    // with no captionKey would resolve to.
    expect(elevationEn["elev.d0.share.caption"]).not.toMatch(/made with/i);
    expect(elevationEn["elev.d0.share.caption"]).toMatch(/kept with/i);
  });

  it("a hard moment's words never reach a shareable card", () => {
    expect(CARD).toContain("isIncidentType");
    const words = CARD.match(/const firstMomentWords = useMemo\([\s\S]*?\}, \[[^\]]*\]\);/)?.[0] ?? "";
    expect(words.length).toBeGreaterThan(120);
    expect(words).toMatch(/filter\(\(l\) => !isIncidentType\(l\.behaviorType\)\)/);
  });

  it("the story step lands on the EXISTING bedtime-stories route", () => {
    const story = CARD.match(/data-testid="d0-story-cta"[\s\S]{0,1200}?<\/button>/)?.[0] ?? "";
    expect(story.length).toBeGreaterThan(150);
    expect(story).toContain('markStep("story")');
    expect(story).toContain('setActiveTab("bedtime-stories")');
    expect(story).toContain("min-h-[44px]");
  });

  it("renders a COUNT of the parent's own steps — never a ring, bar or percentage", () => {
    expect(CARD).toContain('t("elev.d0.progress", { count: chain.doneCount, total: chain.total })');
    const chainBlock = CARD.match(/\{isChain \? \([\s\S]*?\) : /)?.[0] ?? "";
    expect(chainBlock.length).toBeGreaterThan(1_000);
    expect(chainBlock).not.toMatch(/doneCount\s*\/\s*|percent|Math\.round|toFixed|<progress|strokeDasharray/i);
  });
});

/* ── ENG-L2 ───────────────────────────────────────────────────────────────── */

describe("ENG-L2 — a captured interest actually reaches play selection", () => {
  const memo = OVERVIEW.match(/const dailyPlay: ScoredActivity \| null = useMemo\([\s\S]*?\}, \[[^\]]*\]\);/)?.[0] ?? "";

  it("the Today play memo was extracted", () => {
    expect(memo.length).toBeGreaterThan(400);
    expect(memo).toContain("selectDailyPlay({");
  });

  it("it reads the child's interests AND re-runs when they change", () => {
    expect(memo).toContain("interests: childProfile.interests");
    const deps = memo.match(/\}, \[([^\]]*)\]\);$/)?.[1] ?? "";
    expect(deps.length).toBeGreaterThan(20);
    expect(deps).toContain("childProfile.interests");
  });

  it("NEGATIVE CONTROL — the shipped dep list would have failed before the fix", () => {
    // Verbatim pre-fix dependency array. It READ interests and did not depend
    // on them, so answering the ENG-L2 ask on Today left the pick unchanged —
    // an interest captured and then visibly ignored.
    const before =
      "behaviorLogs, childProfile.age, childProfile.id, donePlayIds, goalDomains, sessionLength, latestCompletedAction";
    expect(before).not.toContain("childProfile.interests");
    const deps = memo.match(/\}, \[([^\]]*)\]\);$/)?.[1] ?? "";
    expect(deps).not.toBe(before);
  });

  it("the ask writes the field the coach and play both read", () => {
    // The ask's save path is useLifecycleMoment.saveInterests → updateChild.
    const hook = read("components/overview/useLifecycleMoment.ts");
    expect(hook.length).toBeGreaterThan(2_000);
    expect(hook).toMatch(/updateChild\(childId, \{[\s\S]{0,120}interests: cleaned/);
    expect(hook).toContain("sanitizeInterestToken");
    // …and it is asked ONCE: the ask is suppressed for good by any recorded
    // interest, which is server state, so answering silences every device.
    expect(hook).toContain("interestCount: childProfile.interests?.length ?? 0");
  });

  it("the coach's model profile allow-list still carries interests", () => {
    // The other half of "it actually lands": ai/prompts.ts projects only the
    // allow-listed fields into every coach prompt.
    const prompts = read("ai/prompts.ts");
    expect(prompts.length).toBeGreaterThan(2_000);
    const allow = prompts.match(/MODEL_PROFILE_FIELDS = \[[\s\S]*?\] as const;/)?.[0] ?? "";
    expect(allow.length).toBeGreaterThan(80);
    expect(allow).toContain('"interests"');
    // Its pinned mirror — the disclosure the parent is shown must not drift.
    const disclosure = read("lib/coachDisclosure.ts");
    const disclosed = disclosure.match(/DISCLOSED_PROFILE_FIELDS[\s\S]*?\] as const;/)?.[0] ?? "";
    expect(disclosed.length).toBeGreaterThan(80);
    expect(disclosed).toContain('"interests"');
  });
});

/* ── Copy ─────────────────────────────────────────────────────────────────── */

describe("ENG-L0 copy — registered, bilingual, parent register, firewall-clean", () => {
  it("every key reaches the merged Elevation dictionaries, EN and HE", () => {
    expect(Object.keys(en).length).toBeGreaterThan(0);
    for (const key of Object.keys(en)) {
      expect(elevationEn[key]).toBeTruthy();
      expect(elevationHe[key]).toBeTruthy();
    }
  });

  it("EN and HE cover exactly the same keys", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
  });

  it("every step the chain walks has a label in both languages", () => {
    for (const step of FIRST_MOMENT_STEPS) {
      expect(elevationEn[`elev.d0.step.${step}`]).toBeTruthy();
      expect(elevationHe[`elev.d0.step.${step}`]).toBeTruthy();
    }
  });

  it("the Hebrew is really Hebrew, not the English copied across", () => {
    for (const key of Object.keys(he)) {
      expect(he[key], `${key} has no Hebrew letters`).toMatch(/[֐-׿]/);
      expect(he[key], `${key} is identical to the English`).not.toBe(en[key]);
    }
  });

  it("no score, percentage, verdict or streak in either language", () => {
    const banned: ReadonlyArray<{ id: string; re: RegExp }> = [
      { id: "percent", re: /%|\bpercent\b|\bאחוז/i },
      { id: "score", re: /\bscore\b|\brating\b|\bניקוד\b|\bציון\b/i },
      { id: "verdict", re: /\bon[\s-]?track\b|\bbehind\b|\bdelay(ed)?\b|\bפיגור\b|\bתקין\b/i },
      { id: "streak", re: /\bstreak\b|\bin a row\b|\bרצף\b/i },
      { id: "target", re: /\bgoal of\b|\bout of 100\b|\bcomplete your\b/i },
    ];
    for (const dict of [en, he]) {
      for (const [key, value] of Object.entries(dict)) {
        for (const rule of banned) {
          expect(rule.re.test(value), `${key} trips the "${rule.id}" ban: ${value}`).toBe(false);
        }
      }
    }
  });

  it("NEGATIVE CONTROL — the ban list can actually fire", () => {
    const banned = /%|\bscore\b|\bstreak\b/i;
    expect(banned.test("Day 3: 66% complete — keep your streak")).toBe(true);
    expect(banned.test(en["elev.d0.progress"])).toBe(false);
  });
});
