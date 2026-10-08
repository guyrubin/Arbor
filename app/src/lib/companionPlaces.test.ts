import { describe, expect, it } from "vitest";
import { ROUTE_IDS } from "./routes";
import { COMPANION_PLACES, placeForTab } from "./companionPlaces";
describe("three places, complete route coverage", () => {
  it("keeps every deep link in a named place", () => {
    expect(ROUTE_IDS).toHaveLength(43);
    for (const tab of ROUTE_IDS) expect(COMPANION_PLACES).toContain(placeForTab(tab));
  });
  it("keeps family care with the child and play with Together", () => {
    expect(placeForTab("consult").id).toBe("child");
    expect(placeForTab("memory").id).toBe("child");
    expect(placeForTab("stories").id).toBe("together");
    expect(placeForTab("daily-play").id).toBe("together");
    expect(placeForTab("masterclasses").id).toBe("now");
  });
});
