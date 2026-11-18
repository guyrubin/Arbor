import { afterEach, describe, expect, it, vi } from "vitest";
import { souvenirStrip, type KidSouvenir } from "./kidSouvenirs";

const book = (id: string, earnedAt: string): KidSouvenir => ({
  id: `book:${id}`, kind: "book", refId: id, earnedAt,
});

afterEach(() => vi.useRealTimers());

describe("child keepsake history integrity", () => {
  it("orders real instants across offsets, rather than lexicographic timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
    const earlier = book("earlier", "2026-11-13T10:00:00+02:00"); // 08:00 UTC
    const later = book("later", "2026-11-13T08:30:00Z");
    expect(souvenirStrip([earlier, later]).map(s => s.refId)).toEqual(["later", "earlier"]);
  });

  it("does not let a corrupt or future-dated row displace a genuine kept book", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
    const kept = book("kept", "2026-11-13T09:00:00Z");
    const forgedFuture = book("kept", "2099-01-01T00:00:00Z");
    const otherFuture = book("not-yet", "2099-01-01T00:00:00Z");
    const malformed = book("bad-date", "not-a-timestamp");
    expect(souvenirStrip([forgedFuture, otherFuture, malformed, kept])).toEqual([kept]);
  });

  it("tolerates a small clock skew without applying expiry or deleting history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
    const nearby = book("nearby", "2026-11-13T12:04:00Z");
    const ahead = book("ahead", "2026-11-14T00:00:00Z");
    expect(souvenirStrip([ahead, nearby])).toEqual([nearby]);
    vi.setSystemTime(new Date("2026-11-14T00:01:00Z"));
    expect(souvenirStrip([ahead, nearby])).toEqual([ahead, nearby]);
  });

  it("preserves a single permanent record for repeated valid IDs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
    const original = book("one", "2026-11-12T14:00:00Z");
    const duplicate = book("one", "2026-11-13T09:00:00Z");
    expect(souvenirStrip([original, duplicate])).toEqual([duplicate]);
  });
});
