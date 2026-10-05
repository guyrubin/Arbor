/**
 * B-GAME-11 — one practice record per Sneak & Freeze sitting: counts and
 * experiences, never right/wrong, a score, a level or a band.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { startSitting, step, type SneakState } from "./rules";
import { SNEAK_SKILL, durationBucket, sittingRecord } from "./record";
import { KID_GAME_EVENT_KINDS, domainConfidence } from "../../../../practice/signals";

const here = path.dirname(fileURLToPath(import.meta.url));

function playSitting(seed: string): SneakState {
  let s = startSitting({ seed, track: "B", level: 2, intro: true });
  for (let t = 0; t < 900000 && s.phase !== "done"; t += 10) s = step(s, 10, { holding: s.phase === "intro" || s.phase === "ready" || s.phase === "counting" });
  return s;
}

describe("the Sneak & Freeze sitting record", () => {
  const s = playSitting("record");
  const now = new Date(2026, 9, 6, 17, 30);
  const rec = sittingRecord(s, 4 * 60000, now);

  it("names the game, the skill, the day, a duration bucket, the rounds, the experiences met and the prizes", () => {
    expect(rec.kind).toBe("stop-signal");
    expect(rec.game).toBe("sneak-freeze");
    expect(rec.skill).toBe(SNEAK_SKILL);
    expect(SNEAK_SKILL).toBe("stop-on-signal");
    expect(rec.day).toBe("2026-10-06");
    expect(rec.durationBucket).toBe("3-5m");
    expect(rec.rounds).toBe(3);
    expect(rec.experiences).toContain("sunglasses");
    expect(rec.prizes).toHaveLength(3);
    expect(rec.timestamp).toBe(now.toISOString());
  });

  it("carries no right/wrong, no score, no level, no band", () => {
    const keys = Object.keys(rec);
    for (const k of ["correct", "score", "level", "band", "track", "catches", "statues"]) expect(keys).not.toContain(k);
    expect(JSON.stringify(rec)).not.toMatch(/"(correct|score|level|band)"/);
  });

  it("buckets the duration (never the exact time)", () => {
    expect(durationBucket(30000)).toBe("under-1m");
    expect(durationBucket(90000)).toBe("1-3m");
    expect(durationBucket(6 * 60000)).toBe("5-10m");
    expect(durationBucket(30 * 60000)).toBe("over-10m");
  });

  it("moves no band or confidence: the kind is read by no derivation", () => {
    const base = domainConfidence("cognition", [], [], [], [], []);
    const many = Array.from({ length: 30 }, (_, i) => sittingRecord(s, 60000, new Date(2026, 9, 1 + (i % 9))));
    expect(domainConfidence("cognition", [], [], [], many, [])).toBe(base);
    expect(KID_GAME_EVENT_KINDS.has("stop-signal")).toBe(false);
  });

  it("is written ONCE per sitting through the existing practice writer, with one kid activity", () => {
    const src = readFileSync(path.join(here, "SneakFreeze.tsx"), "utf8");
    expect((src.match(/practice\.events\.upsert\(/g) ?? []).length).toBe(1);
    expect((src.match(/noteKidActivity\(\)/g) ?? []).length).toBe(1);
    expect(src).toContain("recorded.current === s.seed");
    expect(src).toContain("usePracticeData(childId)");
  });
});
