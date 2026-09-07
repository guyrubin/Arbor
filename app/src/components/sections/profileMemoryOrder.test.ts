/**
 * memory primary move · OBJ-PROFILE-03 · OBJ-PROFILE-04 residue · GP-26/IA-09
 *
 * Four defects on the Profile hub and its memory leaf, all of the same kind:
 * the screen said something that was not true of the parent's actual job.
 *
 *  1. Child Memory's pending queue — the hub's declared primary move — rendered
 *     BELOW the firsts moment, the "what Arbor knows" count and the month
 *     keepsake, putting Approve at roughly y 1100 on a phone: three
 *     celebrations ahead of the decision the parent opened the page to make.
 *  2. A failed ledger read said "Something interrupted the connection" even for
 *     an HTTP 429, blaming the parent's wifi for our own queue. ff5bebaf added
 *     the back-off and exposed `memoryReviewErrorKind`; nothing read it.
 *  3. Profile rendered TWO doors to "what Arbor remembers" on one screen —
 *     chapter 6 and a footer tile.
 *  4. `#/strengths` duplicated Profile chapter 4 and was reachable only from a
 *     link inside that same chapter.
 *
 * These are ORDER and PRESENCE facts, which a source read can establish exactly
 * (this suite runs in `environment: "node"`); the pixel positions behind them
 * are the orchestrator's rendered pass. Negative controls are the pre-fix
 * orderings and the pre-fix single-body error card.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..");
const memory = readFileSync(path.join(SRC, "components/sections/ChildMemory.tsx"), "utf8");
const profile = readFileSync(path.join(SRC, "components/sections/ChildProfile.tsx"), "utf8");

/** Position of a marker in a file, asserted to exist. */
const at = (src: string, marker: string) => {
  const i = src.indexOf(marker);
  expect(i, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return i;
};

describe("Child Memory · the action queue comes first", () => {
  it("the pending queue renders before every celebration module", () => {
    const queue = at(memory, "elev.childmem.pending.title");
    for (const later of ["<FirstsMoment />", "<ArborKnowsTile />", "<MonthKeepsake />"]) {
      expect(at(memory, later), `${later} must render after the queue`).toBeGreaterThan(queue);
    }
    // ...and still after the honest-error card, which replaces the lists.
    expect(at(memory, "surface=\"child-memory\"")).toBeLessThan(queue);
  });

  it("NEGATIVE CONTROL: the pre-fix order put the queue last of the four", () => {
    const preFix = ["<FirstsMoment />", "<ArborKnowsTile />", "<MonthKeepsake />", "pending.title"].join("\n");
    expect(preFix.indexOf("pending.title")).toBeGreaterThan(preFix.indexOf("<ArborKnowsTile />"));
  });

  it("a 429 says Arbor is catching up, not that the connection dropped", () => {
    expect(memory).toContain("memoryReviewErrorKind");
    expect(memory).toContain('memoryReviewErrorKind === "rate_limited" ? t("elev.memory.catchingUp") : t("err.memory.body")');
    // It is actually destructured from the context, not just mentioned.
    const destructure = memory.slice(at(memory, "} = useArbor();") - 400, at(memory, "} = useArbor();"));
    expect(destructure).toContain("memoryReviewErrorKind");
  });

  it("NEGATIVE CONTROL: the pre-fix card had one body for every failure", () => {
    const preFix = 'body={t("err.memory.body")}';
    expect(preFix.includes("rate_limited")).toBe(false);
    expect(memory.includes(preFix)).toBe(false);
  });
});

describe("Profile · one door per room", () => {
  it("OBJ-PROFILE-03 — the memory door is the chapter, not a chapter plus a tile", () => {
    // Chapter 6's own review link survives; the duplicate footer tile is gone.
    expect(profile).toContain('t("cp.reviewMemory", { name: first })');
    expect(profile).not.toContain('t("cp.footer.memory")');
    const footer = profile.slice(at(profile, "Footer jump strip"));
    expect(footer).not.toContain('tab: "memory"');
    // The two surviving footer doors are unrelated surfaces.
    expect(footer).toContain('tab: "timeline"');
    expect(footer).toContain('tab: "behaviors"');
  });

  it("GP-26 — the strengths leaf's only door is gone with the leaf", () => {
    expect(profile).not.toContain('setActiveTab("strengths")');
    // The chapter that absorbed it still renders both of its lists.
    expect(profile).toContain('t("cp.ch.strengths")');
    expect(profile).toContain('t("cp.ch.support")');
  });

  it("NEGATIVE CONTROL: both pre-fix markups are detectable", () => {
    const preFixTile = '{ tab: "memory" as const, tone: "lav" as const, label: t("cp.footer.memory") },';
    const preFixDoor = '<JumpLink onClick={() => setActiveTab("strengths")} color="var(--arbor-green-ink)">';
    expect(preFixTile.includes('t("cp.footer.memory")')).toBe(true);
    expect(preFixDoor.includes('setActiveTab("strengths")')).toBe(true);
    expect(profile.includes(preFixTile)).toBe(false);
    expect(profile.includes(preFixDoor)).toBe(false);
  });
});
