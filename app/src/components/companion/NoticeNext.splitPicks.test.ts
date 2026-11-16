import { describe, expect, it } from "vitest";
import type { Milestone } from "../../types";
import { splitPicks, type NoticePick } from "./NoticeNext";

// V73/V75 (kept in V77): Arbor suggests is the open area's pick; What to
// notice next lists only the OTHER areas. Synthetic picks.
const pick = (id: string, domain: NoticePick["domain"]): NoticePick =>
  ({ milestone: { id, title: id, checked: false } as unknown as Milestone, domain });
const PICKS = [pick("a", "talking"), pick("b", "playing"), pick("c", "hands"), pick("d", "thinking")];

describe("splitPicks — notice next shows only the other areas", () => {
  it("the open area's pick is the suggestion; the rest never include the open area", () => {
    const { first, rest } = splitPicks(PICKS, "hands");
    expect(first?.milestone.id).toBe("c");
    expect(rest.map((p) => p.domain)).toEqual(["talking", "playing", "thinking"]);
  });
  it("with no pick in the open area, the first pick suggests and the open area is still left out", () => {
    const { first, rest } = splitPicks(PICKS, "moving");
    expect(first?.milestone.id).toBe("a");
    expect(rest.map((p) => p.milestone.id)).toEqual(["b", "c", "d"]);
  });
  it("a pick the open area already lists to mark is not suggested again (it would show twice)", () => {
    const { first, rest } = splitPicks(PICKS, "hands", new Set(["c"]));
    expect(first).toBeUndefined();
    expect(rest.map((p) => p.milestone.id)).toEqual(["a", "b", "d"]);
    // Negative control: a listed id in another area does not hide the open area's pick.
    expect(splitPicks(PICKS, "hands", new Set(["a"])).first?.milestone.id).toBe("c");
  });
  it("negative control: nothing open keeps every other pick", () => {
    expect(splitPicks(PICKS, null).rest).toHaveLength(3);
    expect(splitPicks([], "talking")).toEqual({ first: undefined, rest: [] });
  });
});
