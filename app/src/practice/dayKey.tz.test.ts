import { describe, it, expect } from "vitest";
import { dayKey, weeklyActivity, speechDose } from "./signals";
import type { SpeechAttempt } from "../types";

/* OBJ-KID-01 / OBJ-TODAY-03 (the bug under RUN-21) — practice/signals.ts read
   the UTC date off a stored timestamp with `iso.slice(0, 10)` and compared it
   with `today`, which every caller derives from the LOCAL clock. Any family
   east of UTC loses the first hours of their day: an event at 22:30 Z on the
   6th is local 00:30 on the 7th in Brussels and 01:30 in Jerusalem, so it fell
   outside "today" and outside the 7-day window — the arcade panel read
   "0 days practiced" nine minutes after a session, and weeklyActivity's
   activeDays double-counted a single local evening as two days.

   This file covers the signals.ts half. kidGreeting.ts and actionLoop/model.ts
   carry the same defect and belong to other builders.

   The item asks for Europe/Brussels and Asia/Jerusalem. A zone cannot be
   re-set inside a running Node process (the ICU zone is bound at first use),
   so instead of pretending to pin two zones the fixture is built FROM the
   ambient offset: a timestamp whose UTC date and local date always differ,
   whichever zone the runner is in. That covers Brussels (+2) and Jerusalem
   (+3) and every other non-UTC zone, and it fails on the pre-fix code in all
   of them. Under UTC itself the drift is zero and the strict-inequality case
   is skipped, which is stated rather than hidden. */

/** Minutes east of UTC for the fixture's instant. */
const OFFSET_MIN = -new Date("2026-09-06T12:00:00.000Z").getTimezoneOffset();
/** East of UTC: 30 min before UTC midnight, so local is already the next day.
 *  West of UTC: 30 min after, so local is still the previous day. */
const EVENING_UTC = OFFSET_MIN >= 0 ? "2026-09-06T23:30:00.000Z" : "2026-09-06T00:30:00.000Z";
const UTC_DATE = EVENING_UTC.slice(0, 10);

const attempt = (timestamp: string): SpeechAttempt =>
  ({ id: `a-${timestamp}`, sound: "s", target: "sun", heard: "sun", result: "got", level: "word", timestamp }) as unknown as SpeechAttempt;

describe("OBJ-KID-01 — day keys come from the local calendar date", () => {
  it("dayKey() reads the local date, and a UTC-evening event can belong to the next local day", () => {
    const d = new Date(EVENING_UTC);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(dayKey(d)).toBe(expected);
    // Whatever the runner's zone (UTC excepted), the local key is NOT the ISO
    // slice — which is exactly what the pre-fix code compared against `today`.
    if (OFFSET_MIN !== 0) expect(dayKey(d)).not.toBe(UTC_DATE);
  });

  it("weeklyActivity counts the evening session on its LOCAL day", () => {
    const today = dayKey(new Date(EVENING_UTC));
    const wk = weeklyActivity([attempt(EVENING_UTC)], [], [], [], today);
    expect(wk.sessions).toBe(1);
    expect(wk.activeDays).toBe(1);
    expect(wk.domainsTouched).toEqual(["speech"]);
  });

  it("speechDose counts the evening trials as today's", () => {
    const today = dayKey(new Date(EVENING_UTC));
    const dose = speechDose([attempt(EVENING_UTC), attempt(EVENING_UTC)], today);
    expect(dose.trialsToday).toBe(2);
    expect(dose.sessionsThisWeek).toBe(1);
  });

  it("no signals.ts day key is derived from an ISO slice any more", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.join(__dirname, "signals.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/\.slice\(0,\s*10\)/);
    expect(src).not.toMatch(/toISOString\(\)\.slice/);
  });

  it("NEGATIVE CONTROL — the pre-fix comparison drops the evening session", () => {
    const preFixKey = (iso: string) => iso.slice(0, 10);
    const today = dayKey(new Date(EVENING_UTC));
    expect(preFixKey(EVENING_UTC)).toBe(UTC_DATE);
    if (OFFSET_MIN === 0) return; // no drift to observe under UTC itself
    expect(preFixKey(EVENING_UTC)).not.toBe(today);
    // …so the pre-fix `trialsToday` filter on `=== today` counted zero,
    // and the pre-fix `inLastDays` dropped the session out of the week.
    expect([EVENING_UTC].filter((t) => preFixKey(t) === today)).toHaveLength(0);
    const preFixInLastDays = (iso: string, todayKey: string, n: number) => {
      const d = new Date(`${todayKey}T12:00:00`);
      d.setDate(d.getDate() - n);
      return preFixKey(iso) > dayKey(d) && preFixKey(iso) <= todayKey;
    };
    expect(preFixInLastDays(EVENING_UTC, today, 0)).toBe(false);
  });
});
