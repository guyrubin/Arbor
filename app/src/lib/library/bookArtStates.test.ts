/**
 * bookArtStates — manuscript v3: p9's four picture states cued by the words
 * (swing → the stone in flight on "The stone flew" → the dust on "BOOM" →
 * the quiet after the file ends); a per-voice sidecar gives the cue times,
 * else fractions (0.80 / 0.93); Sound off: 4 s, +1.5 s, +3 s.
 */
import { describe, expect, it } from "vitest";
import { ART_STATE_HOLD_MS, audioStage, cueMs, cuesPath, nextIntent, overlayHiddenAt, pageArtStates, readCues, statePlateAt, statePoseAt, timerDelay } from "./bookArtStates";
import { fiveSmoothStones } from "./books/fiveSmoothStones";
import type { ArtState, Page } from "./types";

const p9 = fiveSmoothStones.pages.find((p) => p.id === "p9")!;
const S: ArtState[] = [
  { id: "flight", plateId: "PL7-flight", pose: "sling-release", overlays: [], cue: { atFraction: 0.8 }, cueKey: "flight", silentAfterMs: 4000 },
  { id: "dust", overlays: ["dust-cloud"], cue: { atFraction: 0.93 }, cueKey: "boom", silentAfterMs: 1500 },
  { id: "quiet", plateId: "PL7-quiet", overlays: [], cue: "audioEnd", silentAfterMs: 3000 },
];
const clock = (positionMs: number, durationMs = 10000, ended = false) => ({ positionMs, durationMs, ended });

describe("art states (v3 cues)", () => {
  it("p9's authored states: flight, dust, quiet — a state whose plate is not delivered is skipped", () => {
    const all = pageArtStates({ ...p9, artStates: S }, () => true).map((s) => s.id);
    expect(all).toEqual(["flight", "dust", "quiet"]);
    const noFlight = pageArtStates({ ...p9, artStates: S }, (id) => id !== "PL7-flight");
    expect(noFlight.map((s) => [s.id, s.silentAfterMs])).toEqual([["dust", 5500], ["quiet", 3000]]);
    const ids = p9.artStates!.map((s) => s.id);
    expect(ids).toEqual(["flight", "dust", "quiet"]);
    expect(p9.artStates!.map((s) => s.silentAfterMs)).toEqual([4000, 1500, 3000]);
    expect(p9.artStates!.map((s) => s.cueKey ?? null)).toEqual(["flight", "boom", null]);
  });

  it("without a sidecar: flight at 0.80 of the file, dust at 0.93, quiet on the end", () => {
    expect(audioStage(S, 0, clock(7900), {})).toBe(0);
    expect(audioStage(S, 0, clock(8000), {})).toBe(1);
    expect(audioStage(S, 1, clock(9200), {})).toBe(1);
    expect(audioStage(S, 1, clock(9300), {})).toBe(2);
    expect(audioStage(S, 2, clock(9990), {})).toBe(2);
    expect(audioStage(S, 2, clock(10000, 10000, true), {})).toBe(3);
    // the duration not known yet: nothing fires before the end
    expect(audioStage(S, 0, clock(9000, NaN), {})).toBe(0);
  });

  it("with the per-voice sidecar (p9.cues.json): its ms win over the fractions", () => {
    const cues = readCues({ flight: 6200, boom: 8100, junk: "x", "../x": 3, neg: -1 });
    expect(cues).toEqual({ flight: 6200, boom: 8100 });
    expect(cueMs(S[0], 10000, cues)).toBe(6200);
    expect(audioStage(S, 0, clock(6200), cues)).toBe(1);
    expect(audioStage(S, 0, clock(8100), cues)).toBe(2);
    expect(cuesPath("/_dev/narration/five-smooth-stones/dylan-v2/en/p9.mp3")).toBe("/_dev/narration/five-smooth-stones/dylan-v2/en/p9.cues.json");
    expect(cuesPath("/a/p9.wav")).toBe("/a/p9.cues.json");
  });

  it("Sound off: 4 s, then +1.5 s, then +3 s; with audio the narration drives (timed cues excepted)", () => {
    expect([0, 1, 2].map((n) => timerDelay(S, n, true))).toEqual([4000, 1500, 3000]);
    expect(timerDelay(S, 3, true)).toBeNull();
    expect([0, 1, 2].map((n) => timerDelay(S, n, false))).toEqual([null, null, null]);
    expect(timerDelay([{ id: "x", overlays: [], cue: { afterMs: 2000 }, silentAfterMs: 3000 }], 0, false)).toBe(2000);
  });

  it("the flight plate and pose come at stage 1; the dust shows only in its state; the quiet plate last", () => {
    expect([0, 1, 2, 3].map((n) => statePlateAt(S, n))).toEqual([null, "PL7-flight", "PL7-flight", "PL7-quiet"]);
    expect([0, 1, 3].map((n) => statePoseAt(S, n))).toEqual([null, "sling-release", "sling-release"]);
    expect([0, 1, 2, 3].map((n) => overlayHiddenAt(S, n, "dust-cloud"))).toEqual([true, true, false, true]);
    expect(overlayHiddenAt(S, 0, "helmet-worn")).toBe(false);
  });

  it("a page without authored states derives one from its after-narration overlays (the v1 dust)", () => {
    const { artStates: _drop, ...v1 } = p9;
    expect(pageArtStates(v1 as Page, () => true)).toEqual([{ id: "reveal", overlays: ["dust-cloud"], cue: "audioEnd", silentAfterMs: 5000 }]);
    expect(pageArtStates(fiveSmoothStones.pages[0], () => true)).toEqual([]);
  });

  it("Next: brings the next unseen state, holds still after the last, then turns", () => {
    expect(nextIntent(true, false, false)).toBe("reveal");
    expect(nextIntent(true, true, true)).toBe("hold");
    expect(nextIntent(true, true, false)).toBe("turn");
    expect(nextIntent(false, false, false)).toBe("turn");
    expect(ART_STATE_HOLD_MS).toBe(1500);
  });
});
