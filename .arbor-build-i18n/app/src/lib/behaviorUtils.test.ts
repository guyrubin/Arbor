import { describe, it, expect } from "vitest";
import { intensityColor, timeBand, weekStartKey, escapeHtml } from "./behaviorUtils";

describe("intensityColor", () => {
  it("maps the 1-5 scale from sage to clay", () => {
    expect(intensityColor(1)).toBe("#6f9e6f");
    expect(intensityColor(3)).toBe("#d7aa55");
    expect(intensityColor(5)).toBe("#e2562d");
  });
  it("clamps above 5 to clay", () => {
    expect(intensityColor(9)).toBe("#e2562d");
  });
});

describe("timeBand", () => {
  it("buckets hours into parts of day", () => {
    expect(timeBand(8)).toBe("Morning");
    expect(timeBand(14)).toBe("Afternoon");
    expect(timeBand(19)).toBe("Evening");
    expect(timeBand(23)).toBe("Night");
    expect(timeBand(2)).toBe("Night"); // wraps past midnight
  });
});

describe("weekStartKey", () => {
  it("returns the Monday of the week (ISO date)", () => {
    // 2026-06-03 is a Wednesday → Monday is 2026-06-01
    expect(weekStartKey("2026-06-03T12:00:00.000Z")).toBe("2026-06-01");
    // A Monday maps to itself
    expect(weekStartKey("2026-06-01T08:00:00.000Z")).toBe("2026-06-01");
  });
});

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml(`<b>"a" & 'b'</b>`)).toBe("&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;");
  });
});
