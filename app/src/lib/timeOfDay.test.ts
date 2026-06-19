import { describe, it, expect } from "vitest";
import { dayPartFor } from "./timeOfDay";

describe("dayPartFor", () => {
  it("buckets early hours as morning", () => {
    expect(dayPartFor(0)).toBe("morning");
    expect(dayPartFor(11)).toBe("morning");
  });

  it("flips to afternoon at noon", () => {
    expect(dayPartFor(12)).toBe("afternoon");
    expect(dayPartFor(17)).toBe("afternoon");
  });

  it("flips to evening at 18:00", () => {
    expect(dayPartFor(18)).toBe("evening");
    expect(dayPartFor(23)).toBe("evening");
  });
});
