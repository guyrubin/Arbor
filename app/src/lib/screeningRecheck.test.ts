/**
 * UND-2 — 'Remind me to re-check' must be REAL, not a toast-only done-state.
 *
 * Covers:
 *  - computeRecheckDueAt / isRecheckDue / latestRecheckDueAt (pure logic)
 *  - honesty contract: reminder copy claims only the in-app flag (no push /
 *    email / notification channel is wired on this seam)
 *  - source contract: Screening.tsx persists recheckDueAt via the existing
 *    screenings upsert seam and the old lying toast is gone; DevelopmentTab
 *    surfaces the due state on the dev-watching-pointer row
 *
 * Node harness (vitest environment: "node") — no DOM, no React rendering.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECHECK_MS,
  RECHECK_WEEKS,
  computeRecheckDueAt,
  isRecheckDue,
  latestRecheckDueAt,
} from "./screeningRecheck";
import { en, he, translate } from "./i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string): string =>
  readFileSync(path.join(__dirname, "..", rel), "utf8");

// ── computeRecheckDueAt ──────────────────────────────────────────────────────
describe("computeRecheckDueAt", () => {
  it("is answeredAt + ~3 weeks, exactly RECHECK_MS later", () => {
    const answeredAt = "2026-07-01T10:00:00.000Z";
    const due = computeRecheckDueAt(answeredAt);
    expect(new Date(due).getTime() - new Date(answeredAt).getTime()).toBe(RECHECK_MS);
  });

  it("RECHECK_WEEKS is 3 (the promised 'few weeks')", () => {
    expect(RECHECK_WEEKS).toBe(3);
    expect(RECHECK_MS).toBe(3 * 7 * 24 * 60 * 60 * 1000);
  });

  it("falls back to now + RECHECK_MS on an unparseable answeredAt", () => {
    const now = new Date("2026-07-23T12:00:00.000Z").getTime();
    const due = computeRecheckDueAt("not-a-date", now);
    expect(new Date(due).getTime()).toBe(now + RECHECK_MS);
  });

  it("returns a valid ISO string (retrievable due date)", () => {
    const due = computeRecheckDueAt(new Date().toISOString());
    expect(Number.isFinite(new Date(due).getTime())).toBe(true);
    expect(due).toBe(new Date(due).toISOString());
  });
});

// ── isRecheckDue ─────────────────────────────────────────────────────────────
describe("isRecheckDue", () => {
  const due = "2026-07-22T00:00:00.000Z";
  const dueMs = new Date(due).getTime();

  it("false when no due date was ever saved", () => {
    expect(isRecheckDue(undefined)).toBe(false);
    expect(isRecheckDue(null)).toBe(false);
    expect(isRecheckDue("")).toBe(false);
  });

  it("false before the due date arrives", () => {
    expect(isRecheckDue(due, dueMs - 1)).toBe(false);
  });

  it("true at and after the due date", () => {
    expect(isRecheckDue(due, dueMs)).toBe(true);
    expect(isRecheckDue(due, dueMs + 999)).toBe(true);
  });

  it("false for a corrupt stored value (never a phantom flag)", () => {
    expect(isRecheckDue("garbage", dueMs)).toBe(false);
  });
});

// ── latestRecheckDueAt ───────────────────────────────────────────────────────
describe("latestRecheckDueAt", () => {
  it("returns the due date of the MOST RECENT screening only", () => {
    const items = [
      { answeredAt: "2026-06-01T00:00:00.000Z", recheckDueAt: "2026-06-22T00:00:00.000Z" },
      { answeredAt: "2026-07-01T00:00:00.000Z", recheckDueAt: "2026-07-22T00:00:00.000Z" },
    ];
    expect(latestRecheckDueAt(items)).toBe("2026-07-22T00:00:00.000Z");
  });

  it("undefined when the latest screening has no reminder (older ones don't leak)", () => {
    const items = [
      { answeredAt: "2026-06-01T00:00:00.000Z", recheckDueAt: "2026-06-22T00:00:00.000Z" },
      { answeredAt: "2026-07-01T00:00:00.000Z" },
    ];
    expect(latestRecheckDueAt(items)).toBeUndefined();
  });

  it("undefined for an empty collection", () => {
    expect(latestRecheckDueAt([])).toBeUndefined();
  });

  it("does not mutate the input order", () => {
    const items = [
      { answeredAt: "2026-06-01T00:00:00.000Z" },
      { answeredAt: "2026-07-01T00:00:00.000Z" },
    ];
    latestRecheckDueAt(items);
    expect(items[0].answeredAt).toBe("2026-06-01T00:00:00.000Z");
  });
});

// ── Honesty contract — copy claims only the in-app flag ─────────────────────
describe("re-check reminder copy honesty (UND-2)", () => {
  const KEYS = [
    "screen.recheck.btn",
    "screen.recheck.toast",
    "screen.recheck.dueOn",
    "screen.recheck.dueNow",
    "dev.watching.recheckDue",
  ] as const;

  it("all keys exist in EN and HE (no silent fallback)", () => {
    for (const k of KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
      expect(he[k], `he not translated for ${k}`).not.toBe(en[k]);
    }
  });

  it("the toast never promises an undelivered channel (push/email/SMS/'remind you')", () => {
    const forbidden = /remind you|notif|push|email|sms|text you|call you/i;
    expect(translate("en", "screen.recheck.toast")).not.toMatch(forbidden);
  });

  it("the toast claims the in-app flag that actually happens", () => {
    expect(translate("en", "screen.recheck.toast").toLowerCase()).toContain("flag it here");
  });
});

// ── Source contract — the button writes, the surfaces read ──────────────────
describe("re-check reminder source contract", () => {
  it("Screening.tsx no longer fires the lying 'We'll remind you' toast", () => {
    const src = readSrc("components/sections/Screening.tsx");
    expect(src).not.toContain("We'll remind you");
  });

  it("Screening.tsx persists recheckDueAt through the existing screenings upsert seam", () => {
    const src = readSrc("components/sections/Screening.tsx");
    expect(src).toContain("computeRecheckDueAt");
    expect(src).toContain("recheckDueAt");
    // Still the ONE existing collection — no new capture path.
    expect(src).toContain('useChildCollection<SavedScreening>(childProfile.id, "screenings")');
  });

  it("Screening.tsx intro last-check card surfaces the due state on re-entry", () => {
    const src = readSrc("components/sections/Screening.tsx");
    expect(src).toContain('data-testid="screen-recheck-due"');
    expect(src).toContain('t("screen.recheck.dueNow")');
    expect(src).toContain('t("screen.recheck.dueOn"');
  });

  it("DevelopmentTab.tsx pointer row surfaces 'Re-check due' once due", () => {
    const src = readSrc("components/tabs/DevelopmentTab.tsx");
    expect(src).toContain('data-testid="dev-recheck-due"');
    expect(src).toContain('t("dev.watching.recheckDue")');
    expect(src).toContain("latestRecheckDueAt");
    expect(src).toContain("isRecheckDue");
  });

  it("no raw hex literals in the new surfaces (tokens only)", () => {
    for (const rel of ["lib/screeningRecheck.ts"]) {
      const src = readSrc(rel);
      expect(src.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toHaveLength(0);
    }
  });
});
