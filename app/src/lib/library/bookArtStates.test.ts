/**
 * bookArtStates — manuscript v2, engine 1: p9's ordered picture states
 * (swing → dust on the narration cue → "the soldiers rise" ~2 s later, 3 s
 * when silent; then 1.5 s of stillness before Next).
 */
import { describe, expect, it } from "vitest";
import { ART_STATE_HOLD_MS, nextIntent, nextStateDelay, overlayHiddenAt, pageArtStates, statePlateAt } from "./bookArtStates";
import { fiveSmoothStones } from "./books/fiveSmoothStones";
import type { ArtState, Page } from "./types";

const p9 = fiveSmoothStones.pages.find((p) => p.id === "p9")!;
const RISE: ArtState[] = [
  { id: "dust", overlays: ["dust-cloud"], trigger: "narration" },
  { id: "rise", plateId: "PL7-rise", overlays: [], trigger: { afterMs: 2000, silentAfterMs: 3000 } },
];
const withRise: Page = { ...p9, artStates: RISE };

describe("art states", () => {
  it("p9 today: the dust state on the narration cue; 'rise' is skipped until PL7-rise is a registered plate", () => {
    expect(pageArtStates(withRise, () => false).map((s) => s.id)).toEqual(["dust"]);
    expect(pageArtStates(withRise, (id) => id === "PL7-rise").map((s) => s.id)).toEqual(["dust", "rise"]);
    expect(pageArtStates(p9, () => true)[0]).toEqual({ id: "dust", overlays: ["dust-cloud"], trigger: "narration" });
  });

  it("a page without authored states derives one from its after-narration overlays (the v1 dust)", () => {
    const { artStates: _drop, ...v1 } = p9;
    expect(pageArtStates(v1 as Page, () => true)).toEqual([{ id: "reveal", overlays: ["dust-cloud"], trigger: "narration" }]);
    const p1 = fiveSmoothStones.pages[0];
    expect(pageArtStates(p1, () => true)).toEqual([]);
  });

  it("the dust shows only in its state; the rise plate cross-fades in at stage 2 (and the dust goes)", () => {
    expect(overlayHiddenAt(RISE, 0, "dust-cloud")).toBe(true);
    expect(overlayHiddenAt(RISE, 1, "dust-cloud")).toBe(false);
    expect(overlayHiddenAt(RISE, 2, "dust-cloud")).toBe(true);
    expect(overlayHiddenAt(RISE, 0, "helmet-worn")).toBe(false);
    expect([0, 1, 2].map((n) => statePlateAt(RISE, n))).toEqual([null, null, "PL7-rise"]);
  });

  it("timing: the first state waits for the narration; 'rise' comes 2 s after the dust (3 s when silent); none after the last", () => {
    expect(nextStateDelay(RISE, 0, false)).toBeNull();
    expect(nextStateDelay(RISE, 1, false)).toBe(2000);
    expect(nextStateDelay(RISE, 1, true)).toBe(3000);
    expect(nextStateDelay(RISE, 2, false)).toBeNull();
    expect(ART_STATE_HOLD_MS).toBe(1500);
  });

  it("Next: brings the next state while one is to come, holds still after the last, then turns", () => {
    expect(nextIntent(true, false, false)).toBe("reveal");
    expect(nextIntent(true, true, true)).toBe("hold");
    expect(nextIntent(true, true, false)).toBe("turn");
    expect(nextIntent(false, false, false)).toBe("turn");
  });
});
