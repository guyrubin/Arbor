/**
 * retentionRollup.test.ts — N1-04 guard.
 *
 * Four things must stay true, each with a control that FAILS in the shape the
 * tree had before this item:
 *
 *  (a) the writer merges one day per session, is idempotent within a day, and
 *      never throws when the db is absent or the read/write rejects;
 *  (b) the written object's keys are exactly the documented set — a `childName`
 *      fixture must fail, so no child field can be added later in silence;
 *  (c) neither retention.ts nor retentionRollup.ts contains /streak|consecutive/i
 *      (law 3: the cumulative shape is the only one allowed to exist);
 *  (d) the cohort report can answer week-4 — `d28` is in the key set — and an
 *      empty denominator is `null`, never 0.
 *
 * A scan that silently returns an empty string passes vacuously, which is how
 * an instrumentation regression hides; every source scan below therefore also
 * asserts the file is non-empty.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  RETENTION_ROLLUP_COLLECTION,
  RETENTION_ROLLUP_DOC_KEYS,
  nextRollupDoc,
  parseStoredRollup,
  upsertRetentionRollup,
  type RetentionRollupDoc,
  type RetentionRollupStore,
  type RetentionSessionContext,
} from "./retentionRollup";
import { MAX_ACTIVE_DAYS, RETENTION_DAYS, cohortRetention, mergeRollup, retentionFlags } from "./retention";

const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(__dirname, "..", rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const ctx = (over: Partial<RetentionSessionContext> = {}): RetentionSessionContext => ({
  uid: "u1",
  at: "2026-09-15T09:00:00Z",
  tzOffsetMinutes: 180,
  source: "direct",
  market: "il",
  ...over,
});

/** In-memory Firestore stand-in that records every write. */
function fakeStore(initial: unknown = null) {
  const state: { doc: unknown; writes: RetentionRollupDoc[]; reads: number } = {
    doc: initial,
    writes: [],
    reads: 0,
  };
  const store: RetentionRollupStore = {
    async read() {
      state.reads += 1;
      return state.doc;
    },
    async write(_uid, document) {
      state.writes.push(document);
      state.doc = document;
    },
  };
  return { store, state };
}

describe("N1-04 (a) — the writer: one merge per new day, idempotent within a day", () => {
  it("creates the document on the first-ever session: firstSeen = today, one active day", async () => {
    const { store, state } = fakeStore(null);
    expect(await upsertRetentionRollup(store, ctx())).toBe("written");
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].firstSeen).toBe("2026-09-15");
    expect(state.writes[0].activeDays).toEqual(["2026-09-15"]);
  });

  it("a second session the SAME day is a no-op write-wise (no duplicate day)", async () => {
    const { store, state } = fakeStore(null);
    await upsertRetentionRollup(store, ctx());
    // 18:00Z at +180 is 21:00 local, still the 15th.
    expect(await upsertRetentionRollup(store, ctx({ at: "2026-09-15T18:00:00Z" }))).toBe("unchanged");
    expect(state.writes).toHaveLength(1);
  });

  it("a session on a NEW local day merges that day in exactly once", async () => {
    const { store, state } = fakeStore(null);
    await upsertRetentionRollup(store, ctx());
    expect(await upsertRetentionRollup(store, ctx({ at: "2026-09-18T07:00:00Z" }))).toBe("written");
    expect(state.writes[1].activeDays).toEqual(["2026-09-15", "2026-09-18"]);
    expect(state.writes[1].firstSeen).toBe("2026-09-15");
  });

  it("uses the family's own day boundary, not UTC: 23:30 local counts on the day lived", async () => {
    const { store, state } = fakeStore(null);
    // 20:30Z at +180 is 23:30 local on the 15th.
    await upsertRetentionRollup(store, ctx({ at: "2026-09-15T20:30:00Z" }));
    expect(state.writes[0].activeDays).toEqual(["2026-09-15"]);
  });

  it("a late-syncing device moves firstSeen EARLIER, never later", async () => {
    const stored = { firstSeen: "2026-09-10", activeDays: ["2026-09-10"], source: "direct", market: "il", tzOffsetMinutes: 180, updatedAt: "x" };
    const earlier = nextRollupDoc(stored, ctx({ at: "2026-09-01T09:00:00Z" }));
    expect(earlier?.firstSeen).toBe("2026-09-01");
    const later = nextRollupDoc(stored, ctx({ at: "2026-09-20T09:00:00Z" }));
    expect(later?.firstSeen).toBe("2026-09-10");
  });

  it("never throws: absent store, rejecting read, rejecting write, empty uid", async () => {
    expect(await upsertRetentionRollup(null, ctx())).toBe("skipped");
    expect(await upsertRetentionRollup(fakeStore().store, ctx({ uid: "" }))).toBe("skipped");
    const rejectingRead: RetentionRollupStore = {
      read: () => Promise.reject(new Error("offline")),
      write: async () => undefined,
    };
    expect(await upsertRetentionRollup(rejectingRead, ctx())).toBe("skipped");
    const rejectingWrite: RetentionRollupStore = {
      read: async () => null,
      write: () => Promise.reject(new Error("permission-denied")),
    };
    expect(await upsertRetentionRollup(rejectingWrite, ctx())).toBe("skipped");
  });

  it("a malformed stored document degrades to 'no prior rollup' rather than corrupting the merge", () => {
    expect(parseStoredRollup(null)).toBeNull();
    expect(parseStoredRollup({ firstSeen: 7, activeDays: ["2026-09-01"] })).toBeNull();
    expect(parseStoredRollup({ firstSeen: "2026-09-01", activeDays: [] })).toBeNull();
    expect(parseStoredRollup({ firstSeen: "2026-09-01", activeDays: ["2026-09-01", 5] })).toEqual({
      firstSeen: "2026-09-01",
      activeDays: ["2026-09-01"],
    });
  });

  it("writes to the top-level collection the founder reader scans, not a user sub-path", () => {
    expect(RETENTION_ROLLUP_COLLECTION).toBe("retentionRollups");
    expect(RETENTION_ROLLUP_COLLECTION).not.toContain("/");
  });
});

describe("N1-04 (b) — payload scan: the key set is exactly the documented one", () => {
  const keysOf = (d: unknown) => Object.keys(d as Record<string, unknown>).sort();

  it("the written document carries exactly { firstSeen, activeDays, source, market, tzOffsetMinutes, updatedAt }", async () => {
    const { store, state } = fakeStore(null);
    await upsertRetentionRollup(store, ctx());
    expect(keysOf(state.writes[0])).toEqual([...RETENTION_ROLLUP_DOC_KEYS]);
    expect([...RETENTION_ROLLUP_DOC_KEYS]).toEqual([
      "activeDays",
      "firstSeen",
      "market",
      "source",
      "tzOffsetMinutes",
      "updatedAt",
    ]);
  });

  it("NEGATIVE CONTROL: a rollup carrying a childName must fail the payload scan", async () => {
    const { store, state } = fakeStore(null);
    await upsertRetentionRollup(store, ctx());
    const leaky = { ...state.writes[0], childName: "Noa" };
    expect(keysOf(leaky)).not.toEqual([...RETENTION_ROLLUP_DOC_KEYS]);
    expect(keysOf(leaky)).toContain("childName");
  });

  it("no written value is an object or free text — day keys, two slice ids and two numbers", async () => {
    const { store, state } = fakeStore(null);
    await upsertRetentionRollup(store, ctx());
    const written = state.writes[0] as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(written)) {
      if (key === "activeDays") {
        expect(Array.isArray(value)).toBe(true);
        for (const day of value as unknown[]) expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        continue;
      }
      expect(["string", "number", "object"]).toContain(typeof value);
      if (typeof value === "object") expect(value).toBeNull(); // source/market may be null
    }
    expect(JSON.stringify(written)).not.toMatch(/child|note|transcript/i);
  });

  it("activeDays can never exceed the cap, however long the family stays", () => {
    const day0 = Date.parse("2023-01-01T00:00:00Z");
    const many = Array.from({ length: 900 }, (_, i) =>
      new Date(day0 + i * 86_400_000).toISOString().slice(0, 10),
    ).sort();
    const capped = mergeRollup({ firstSeen: many[0], activeDays: many }, { firstSeen: many[0], activeDays: many });
    expect(capped?.activeDays.length).toBe(MAX_ACTIVE_DAYS);
    expect(MAX_ACTIVE_DAYS).toBe(400);
    // The cap trims the TAIL: the earliest days — the ones d1/d7/d28/d30 are
    // measured from — survive. Dropping the head would fake a d1 miss.
    expect(capped?.activeDays[0]).toBe(many[0]);
  });
});

describe("N1-04 (c) — law 3: no streak shape exists in either file", () => {
  const retention = read("lib/retention.ts");
  const rollup = read("lib/retentionRollup.ts");

  it("both files are non-empty (a vacuous scan proves nothing)", () => {
    expect(retention.length).toBeGreaterThan(500);
    expect(rollup.length).toBeGreaterThan(500);
  });

  it("neither file mentions streak or consecutive in live code", () => {
    expect(retention.match(/streak|consecutive/gi) ?? []).toHaveLength(0);
    expect(rollup.match(/streak|consecutive/gi) ?? []).toHaveLength(0);
  });

  it("NEGATIVE CONTROL: the forbidden shape trips the same scan", () => {
    const forbidden = "export interface R { currentStreak: number; longestStreak: number; }";
    expect(forbidden.match(/streak|consecutive/gi) ?? []).not.toHaveLength(0);
  });
});

describe("N1-04 (e) — the writer is MOUNTED, and mounted exactly once", () => {
  const srcRoot = path.resolve(__dirname, "..");

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  };

  const importers = walk(srcRoot).filter((file) =>
    /from\s+["'][^"']*\/retentionRollup["']/.test(fs.readFileSync(file, "utf8")),
  );

  it("exactly one file imports lib/retentionRollup, and it is context/AuthContext.tsx", () => {
    expect(importers.map((f) => path.relative(srcRoot, f).replace(/\\/g, "/"))).toEqual([
      "context/AuthContext.tsx",
    ]);
  });

  it("no component imports it — a retention rate is a product fact, never a parent surface (law 1)", () => {
    const inComponents = importers.filter((f) => path.relative(srcRoot, f).startsWith("components"));
    expect(inComponents).toHaveLength(0);
    // Same law for the arithmetic module the writer wraps.
    const retentionInComponents = walk(path.join(srcRoot, "components")).filter((file) =>
      /from\s+["'][^"']*\/retention["']/.test(fs.readFileSync(file, "utf8")),
    );
    expect(retentionInComponents).toHaveLength(0);
  });

  it("the call site is at auth-ready, beside trackSessionOpen, guarded by a uid", () => {
    const authCtx = read("context/AuthContext.tsx");
    expect(authCtx).toContain("recordRetentionSession");
    expect(authCtx).toMatch(/if \(user\?\.uid\) recordRetentionSession\(user\.uid\);/);
    expect(authCtx).toContain("if (user?.uid) trackSessionOpen();");
    // NEGATIVE CONTROL: the pre-fix effect body had the session event and no
    // rollup write — the shape that left the arithmetic with no caller.
    const preFix = "if (user?.uid) void initNaturalVoice();\n    if (user?.uid) trackSessionOpen();";
    expect(preFix).not.toContain("recordRetentionSession");
  });
});

describe("N1-04 (d) — week-4 is answerable, and an empty denominator is null", () => {
  const rollup = { firstSeen: "2026-09-01", activeDays: ["2026-09-01", "2026-09-29"] };

  it("RETENTION_DAYS carries 28 and the flag key set is exactly d1/d7/d28/d30", () => {
    expect([...RETENTION_DAYS]).toEqual([1, 7, 28, 30]);
    expect(Object.keys(retentionFlags(rollup, "2026-11-01")).sort()).toEqual(["d1", "d28", "d30", "d7"]);
  });

  it("NEGATIVE CONTROL: the pre-fix RETENTION_DAYS array fails the d28 key set", () => {
    const preFix = [1, 7, 30] as const;
    const preFixKeys = preFix.map((d) => `d${d}`).sort();
    expect(preFixKeys).not.toEqual(["d1", "d28", "d30", "d7"]);
    expect(preFixKeys).not.toContain("d28");
  });

  it("the IL gate question is computable: a day-28 return reads true, a day-30 gap reads false", () => {
    const report = cohortRetention([rollup], "2026-11-01");
    expect(report.d28.eligible).toBe(1);
    expect(report.d28.returned).toBe(1);
    expect(report.d28.rate).toBe(1);
    expect(report.d30.returned).toBe(0);
  });

  it("an empty denominator is null, NEVER 0", () => {
    const empty = cohortRetention([], "2026-11-01");
    for (const day of RETENTION_DAYS) {
      expect(empty[`d${day}`].rate).toBeNull();
      expect(empty[`d${day}`].rate).not.toBe(0);
    }
  });

  it("NEGATIVE CONTROL: a bucket that reported 0 on an empty denominator fails the same assertion", () => {
    const dishonest = { eligible: 0, returned: 0, rate: 0 };
    expect(dishonest.rate).not.toBeNull();
    expect(() => expect(dishonest.rate).toBeNull()).toThrow();
  });
});
