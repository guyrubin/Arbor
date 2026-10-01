import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Masterplan 1.8 firewall guard — the months layer added a per-month spine to
 * StoryTimelineTab. The clinical firewall allows EVENTS and CUMULATIVE
 * (monotonic) counts there, but never a month-vs-month comparison, a rate
 * framing, or a percentage on a child metric. SOURCE-BASED (same style as
 * clinicalFirewall.wave3.test.ts) so a future re-wiring is caught at CI time.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
}

const FILES = [
  "components/tabs/StoryTimelineTab.tsx",
  "lib/signalTimeline.ts",
  "lib/i18nElevation/childsignals.ts",
];

// Comparative / rate / percentage wording that would turn the months spine
// (or the child-activity fold) into a period-vs-period verdict surface.
const BANNED = [
  /more than last/i,
  /less than last/i,
  /fewer than last/i,
  /than last (week|month|year)/i,
  /\bfaster\b/i,
  /\bslower\b/i,
  /\d+\s*%/,
  /per (week|month) (more|less|fewer)/i,
  /\bimproved\b/i,
  /\bdeclined\b/i,
  /month[- ]over[- ]month/i,
  /week[- ]over[- ]week/i,
];

describe("StoryTimelineTab months layer — no comparative wording (clinical firewall)", () => {
  for (const rel of FILES) {
    it(`${rel} emits no comparison/rate/percent framing`, () => {
      const code = stripComments(fs.readFileSync(path.join(SRC_ROOT, rel), "utf8"));
      for (const pat of BANNED) {
        expect(code, `${rel} contains comparative framing (${pat})`).not.toMatch(pat);
      }
    });
  }

  it("MonthNode exposes no per-month count (cumulative only)", () => {
    const code = fs.readFileSync(path.join(SRC_ROOT, "lib/signalTimeline.ts"), "utf8");
    const monthNode = /export interface MonthNode \{[\s\S]*?\n\}/.exec(code)?.[0] ?? "";
    expect(monthNode).toContain("cumulativeMoments");
    // No monthly/period count field on the rendered node type.
    expect(monthNode).not.toMatch(/momentsInMonth|monthlyCount|periodCount|countThisMonth/);
  });
});

/**
 * B-ASKJB-18 — the Story row drew a 5-dot intensity scale filled with
 * PASTEL.coral.ink for any `signal.intensity` (every log carries one, plain
 * moments included): a chromatic severity grade on the child. Gone; the value
 * stays in the record only.
 */
describe("B-ASKJB-18 · no intensity dots on a Story row", () => {
  const code = stripComments(
    fs.readFileSync(path.join(SRC_ROOT, "components/tabs/StoryTimelineTab.tsx"), "utf8"),
  );
  const signalRow = (() => {
    const at = code.indexOf("function SignalRow(");
    expect(at, "SignalRow not found").toBeGreaterThan(-1);
    const end = code.indexOf("\nfunction ", at + 10);
    return code.slice(at, end === -1 ? undefined : end);
  })();

  it("no IntensityDots symbol in the source", () => {
    expect(code).not.toMatch(/IntensityDots/);
  });
  it("no coral fill and no intensity read inside SignalRow", () => {
    expect(signalRow).not.toMatch(/PASTEL\.coral\.ink/);
    expect(signalRow).not.toMatch(/--arbor-coral/);
    expect(signalRow).not.toMatch(/signal\.intensity/);
  });
  it("the intensityAria key is removed EN + HE", () => {
    const dict = fs.readFileSync(path.join(SRC_ROOT, "lib/i18nElevation/childsignals.ts"), "utf8");
    expect(dict).not.toContain("elev.childsignals.story.intensityAria");
  });
});
