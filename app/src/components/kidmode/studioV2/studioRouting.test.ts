import { describe, expect, it } from "vitest";
import { kidViewKey, restoredKidView, studioActivityView } from "../KidModeOverlay";

describe("V2 routes preserve real destinations", () => {
  it.each(["memory", "feelings", "mimic", "sound-explorer", "pattern", "calm-builder", "beat", "puzzle", "sneak"])("opens %s through its real V2 game", id => {
    expect(studioActivityView(id)).toBe("studio-game");
    expect(restoredKidView("studio-game", id)).toBe("studio-game");
  });
  it.each(["reading", "adventures", "pose", "speech"])("preserves the existing %s destination, including restored state", id => {
    expect(studioActivityView(id)).toBe("arcade");
    expect(restoredKidView("studio-game", id)).toBe("arcade");
  });
  it.each(["playbank", "stories", "feelings", "studio"])("restores valid world %s", id => {
    expect(restoredKidView("studio-world", id)).toBe("studio-world");
  });
  it("rejects unknown and prototype route names", () => {
    for (const id of ["unknown", "constructor", "toString", "__proto__", ""]) {
      expect(studioActivityView(id)).toBeNull();
      expect(restoredKidView(id, "memory")).toBe("home");
      expect(restoredKidView("studio-world", id)).toBe("home");
      expect(restoredKidView("studio-game", id)).toBe("home");
    }
  });
  it("gives every world and game a distinct mounted lifetime", () => {
    expect(new Set([kidViewKey("home", null), kidViewKey("studio-world", "feelings"), kidViewKey("studio-world", "playbank"), kidViewKey("studio-game", "feelings"), kidViewKey("studio-game", "memory")]).size).toBe(5);
  });
});
