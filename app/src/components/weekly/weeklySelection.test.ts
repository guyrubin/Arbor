import { describe, expect, it } from "vitest";
import { recapWeekId, recapWeekStartMs, weekAnchorDate } from "../../hooks/useWeeklyRecap";
import { reportWeekBounds } from "./weeklySelection";

/* v3 F-NOW-3 — a history week renders the same dashboard as the current one,
   over the instants its report id holds. Every expectation is written through
   recapWeekId itself, so it holds in any time zone (the id is local time). */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const FNS = { weekId: recapWeekId, weekStartMs: recapWeekStartMs };

describe("reportWeekBounds — the instants one report week spans", () => {
  it("2026-W42: the first and last instants carry the id, their neighbours do not", () => {
    const id = recapWeekId(new Date(2026, 9, 14, 12));
    expect(id).toBe("2026-W42");
    const b = reportWeekBounds(id, null, FNS)!;
    expect(b).not.toBeNull();
    expect(recapWeekId(new Date(b.startMs))).toBe(id);
    expect(recapWeekId(new Date(b.startMs - 1))).not.toBe(id);
    expect(recapWeekId(new Date(b.endMs))).toBe(id);
    expect(recapWeekId(new Date(b.endMs + 1))).not.toBe(id);
    expect(b.startMs).toBe(recapWeekStartMs(new Date(2026, 9, 14, 12)));
    // A whole week (an hour either way for a clock change).
    expect(Math.abs(b.endMs - b.startMs - 7 * DAY)).toBeLessThanOrEqual(HOUR);
    for (let t = b.startMs; t <= b.endMs; t += HOUR) expect(recapWeekId(new Date(t))).toBe(id);
  });

  it("2026-W01 opens on Jan 1, the year cut", () => {
    const b = reportWeekBounds("2026-W01", null, FNS)!;
    expect(b.startMs).toBe(new Date(2026, 0, 1).getTime());
    expect(recapWeekId(new Date(b.startMs - 1))).toBe(recapWeekId(new Date(2025, 11, 31, 23)));
    expect(recapWeekId(new Date(b.endMs))).toBe("2026-W01");
    expect(recapWeekId(new Date(b.endMs + 1))).toBe("2026-W02");
  });

  it("the last week of a year closes on Dec 31, before W01", () => {
    const id = recapWeekId(new Date(2025, 11, 31, 12));
    const b = reportWeekBounds(id, null, FNS)!;
    expect(recapWeekId(new Date(b.endMs))).toBe(id);
    expect(recapWeekId(new Date(b.endMs + 1))).toBe("2026-W01");
  });

  it("a malformed or impossible id gives null, whatever the anchor", () => {
    const anchor = weekAnchorDate({ weekStart: "2026-10-10" });
    expect(reportWeekBounds("week-42", null, FNS)).toBeNull();
    expect(reportWeekBounds("2026-42", anchor, FNS)).toBeNull();
    expect(reportWeekBounds("2026-W60", anchor, FNS)).toBeNull();
    expect(reportWeekBounds("", null, FNS)).toBeNull();
  });

  it("the stored anchor is only a fallback, and only for the id it carries", () => {
    const anchor = new Date(2026, 9, 12, 9);
    const id = recapWeekId(anchor);
    expect(reportWeekBounds(id, anchor, FNS)).toEqual(reportWeekBounds(id, null, FNS));
  });
});
