import { describe, expect, it } from "vitest";
import { STUDIO_WORLDS } from "../../practice/studioWorlds";
import { kidViewKey, restoredKidView, studioActivityView } from "../KidModeOverlay";
import { parentDoorTarget } from "./studioCatalog";

describe("V2 routes preserve real destinations", () => {
  it.each(["memory", "feelings", "mimic", "sound-explorer", "pattern", "calm-builder", "beat", "puzzle", "sneak"])("opens %s through its real V2 game", id => {
    expect(studioActivityView(id)).toBe("studio-game");
    expect(restoredKidView("studio-game", id)).toBe("studio-game");
  });
  it.each(["mend-bowl", "stitch-garden", "paper-boat", "season-dial", "crank-works", "windup-race", "clay-theatre", "bottle-lab", "ice-age-friend", "tiny-builders", "fox-trail", "maker-desk"])("routes maker %s to StudioGame, which decides availability", id => {
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
  it("sends every parent door to the same surface the kid shelf uses", () => {
    for (const world of STUDIO_WORLDS) {
      const surface = studioActivityView(world.id);
      expect(parentDoorTarget(world.id), world.id).toEqual({ view: surface === "studio-game" ? "studio-game" : "arcade", worldId: world.id });
    }
    expect(parentDoorTarget("feelings").view).toBe("studio-game");
    expect(parentDoorTarget("memory").view).toBe("studio-game");
    expect(parentDoorTarget("mimic").view).toBe("studio-game");
    expect(parentDoorTarget("pattern").view).toBe("studio-game");
    expect(parentDoorTarget("beat").view).toBe("studio-game");
    expect(parentDoorTarget("speech").view).toBe("arcade");
    expect(parentDoorTarget("adventures").view).toBe("arcade");
    expect(parentDoorTarget("reading").view).toBe("arcade");
    expect(parentDoorTarget("pose").view).toBe("arcade");
    expect(parentDoorTarget("word-world").view).toBe("arcade");
  });
  it("gives every world and game a distinct mounted lifetime", () => {
    expect(new Set([kidViewKey("home", null), kidViewKey("studio-world", "feelings"), kidViewKey("studio-world", "playbank"), kidViewKey("studio-game", "feelings"), kidViewKey("studio-game", "memory")]).size).toBe(5);
  });
});
