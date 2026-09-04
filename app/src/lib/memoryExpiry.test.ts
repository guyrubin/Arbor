/**
 * GP-13 — the memory row's expiry, as a DATE.
 *
 * The contract for this surface is "Approve, edit, or forget"
 * (lib/surfaceContract.ts) and the parent-visible chip said
 * "Time-boxed · {retention}" in the PINK tone — the same tone the Forget
 * button uses. The one property that protects the parent (an approved fact
 * forgets itself) was painted as danger and never carried the day it happens,
 * even though the server has computed exactly that since N7.
 *
 * These are BEHAVIOUR tests on the pure helper, plus a drift guard pinning the
 * client parser to the server one (they are two files by necessity — the
 * server module imports node:crypto — so they can silently diverge).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MEMORY_RETENTION,
  RETENTION_CHOICES,
  forgetsOnIso,
  isPermanentRetention,
  nearestRetentionChoice,
  retentionToMs,
} from "./memoryExpiry";

const DAY = 86_400_000;
const CREATED = "2026-01-10T09:00:00.000Z";

describe("retentionToMs — the same grammar the ledger stores", () => {
  it("parses the units the server writes", () => {
    expect(retentionToMs("30 days")).toBe(30 * DAY);
    expect(retentionToMs("2 weeks")).toBe(14 * DAY);
    expect(retentionToMs("3 months")).toBe(90 * DAY);
    expect(retentionToMs("1 year")).toBe(365 * DAY);
    expect(retentionToMs("session")).toBe(DAY);
  });

  it("treats permanent/indefinite as never expiring", () => {
    expect(retentionToMs("permanent")).toBe(Infinity);
    expect(retentionToMs("indefinite")).toBe(Infinity);
    expect(retentionToMs("ongoing")).toBe(Infinity);
    expect(retentionToMs("long-term")).toBe(Infinity);
    expect(isPermanentRetention("permanent")).toBe(true);
    expect(isPermanentRetention("3 months")).toBe(false);
  });

  it("falls back to the default for missing or unparseable values", () => {
    expect(retentionToMs(undefined)).toBe(retentionToMs(DEFAULT_MEMORY_RETENTION));
    expect(retentionToMs("whenever")).toBe(retentionToMs(DEFAULT_MEMORY_RETENTION));
  });
});

describe("forgetsOnIso — the date the chip renders", () => {
  it("is createdAt + the retention window", () => {
    const iso = forgetsOnIso({ retention: "30 days", createdAt: CREATED });
    expect(iso).toBeTruthy();
    expect(new Date(iso as string).getTime()).toBe(new Date(CREATED).getTime() + 30 * DAY);
  });

  it("is null for a permanent fact — no invented countdown", () => {
    expect(forgetsOnIso({ retention: "permanent", createdAt: CREATED })).toBeNull();
  });

  it("is null when the row has no usable creation date", () => {
    expect(forgetsOnIso({ retention: "30 days", createdAt: undefined })).toBeNull();
    expect(forgetsOnIso({ retention: "30 days", createdAt: "not-a-date" })).toBeNull();
  });

  it("uses the SERVER's default window when retention is absent (never 'forever' by omission)", () => {
    const iso = forgetsOnIso({ createdAt: CREATED });
    expect(iso).toBeTruthy();
    expect(new Date(iso as string).getTime()).toBe(new Date(CREATED).getTime() + 90 * DAY);
  });
});

describe("nearestRetentionChoice — the select never opens on a value it cannot show", () => {
  it("snaps every stored value onto one of the three offered choices", () => {
    const offered = RETENTION_CHOICES.map((c) => c.value);
    for (const stored of ["7 days", "30 days", "3 months", "6 months", "1 year", "permanent", "gibberish", undefined]) {
      expect(offered).toContain(nearestRetentionChoice(stored));
    }
  });

  it("keeps the short window short and the permanent one permanent", () => {
    expect(nearestRetentionChoice("7 days")).toBe("3 months");
    expect(nearestRetentionChoice("3 months")).toBe("3 months");
    expect(nearestRetentionChoice("6 months")).toBe("1 year");
    expect(nearestRetentionChoice("permanent")).toBe("permanent");
  });

  it("every offered value round-trips through the parser", () => {
    for (const c of RETENTION_CHOICES) {
      expect(Number.isNaN(retentionToMs(c.value))).toBe(false);
      expect(nearestRetentionChoice(c.value)).toBe(c.value);
    }
  });
});

/* ── Drift guard ───────────────────────────────────────────────────────────
   The client and server parsers are two files by necessity. This pins them to
   the same grammar and the same default, so a change to one that is not made
   to the other fails here rather than in production, where a chip would
   promise a date the server does not honour. */
describe("the client parser does not drift from the server's", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const server = readFileSync(path.join(here, "..", "memory", "memoryService.ts"), "utf8").replace(/\r\n/g, "\n");

  it("reads the server module (extraction proven, not vacuous)", () => {
    expect(server.length).toBeGreaterThan(500);
    expect(server).toContain("parseRetentionMs");
  });

  it("uses the same unit regex and the same default window", () => {
    expect(server).toContain("day|week|month|year");
    expect(server).toContain("permanent|indefinite|ongoing|long");
    // The default the server applies when retention is missing — the value the
    // client must mirror exactly, or the chip promises a date nothing honours.
    const serverDefault = server.match(/DEFAULT_MEMORY_RETENTION = "([^"]+)"/);
    expect(serverDefault, "server default not found").toBeTruthy();
    expect(DEFAULT_MEMORY_RETENTION).toBe(serverDefault![1]);
    expect(retentionToMs(undefined)).toBe(90 * DAY);
  });
});
