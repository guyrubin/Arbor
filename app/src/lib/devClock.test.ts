/**
 * B-LOOP-17 — the sweep's fake clock (`?now=`), dev server only.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { installDevClock, parseDevNow, shiftedDate } from "./devClock";

const REAL = Date.parse("2026-10-07T10:15:00.000Z");

describe("parseDevNow", () => {
  it('"HH:MM" is today at that LOCAL time', () => {
    const t = parseDevNow("?now=07:30", REAL)!;
    const d = new Date(t);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([7, 30, 0]);
    const real = new Date(REAL);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([real.getFullYear(), real.getMonth(), real.getDate()]);
    expect(new Date(parseDevNow("?cb=3&now=21:00", REAL)!).getHours()).toBe(21);
  });

  it("a full ISO date-time is that instant", () => {
    expect(parseDevNow("?now=2026-10-07T21:00:00.000Z", REAL)).toBe(Date.parse("2026-10-07T21:00:00.000Z"));
    expect(parseDevNow(`?now=${encodeURIComponent("2026-10-07T21:00:00+02:00")}`, REAL)).toBe(Date.parse("2026-10-07T19:00:00.000Z"));
  });

  it("absent, empty, malformed or out-of-range → null", () => {
    for (const s of ["", "?cb=1", "?now=", "?now=tonight", "?now=25:00", "?now=07:75", "?now=2026-10-07", "?now=2026-13-45T99:99"]) {
      expect(parseDevNow(s, REAL), s).toBeNull();
    }
  });
});

describe("shiftedDate", () => {
  const offset = 3 * 3_600_000;
  const Shifted = shiftedDate(Date, offset);

  it("moves only now: new Date(), Date.now(), Date()", () => {
    expect(Math.abs(Shifted.now() - (Date.now() + offset))).toBeLessThan(1_000);
    expect(Math.abs(new Shifted().getTime() - (Date.now() + offset))).toBeLessThan(1_000);
    expect(typeof (Shifted as unknown as () => string)()).toBe("string");
  });

  it("leaves every explicit date alone and stays a Date", () => {
    expect(new Shifted("2026-10-07T21:00:00.000Z").toISOString()).toBe("2026-10-07T21:00:00.000Z");
    expect(new Shifted(0).getTime()).toBe(0);
    expect(new Shifted(2026, 9, 7).getDate()).toBe(7);
    expect(Shifted.parse("2026-10-07T00:00:00.000Z")).toBe(Date.parse("2026-10-07T00:00:00.000Z"));
    expect(Shifted.UTC(2026, 9, 7)).toBe(Date.UTC(2026, 9, 7));
    expect(new Shifted()).toBeInstanceOf(Date);
    expect(new Date(5) instanceof Shifted).toBe(true);
  });
});

describe("installDevClock", () => {
  it("does nothing outside the dev server", () => {
    const target = { Date };
    expect(installDevClock({ dev: false, search: "?now=21:00", target })).toBeNull();
    expect(target.Date).toBe(Date);
  });

  it("does nothing without ?now=", () => {
    const target = { Date };
    expect(installDevClock({ dev: true, search: "?cb=4", target })).toBeNull();
    expect(target.Date).toBe(Date);
  });

  it("on the dev server, ?now=21:00 makes the page's now 21:00 today", () => {
    const target = { Date };
    expect(installDevClock({ dev: true, search: "?now=21:00", target })).not.toBeNull();
    expect(target.Date).not.toBe(Date);
    const now = new target.Date();
    expect([now.getHours(), now.getMinutes()]).toEqual([21, 0]);
    expect(globalThis.Date).toBe(Date); // only the given target moved
  });

  it("the boot is DEV-only and main.tsx imports it before anything else", () => {
    const src = path.resolve(__dirname, "..");
    const boot = readFileSync(path.join(src, "lib", "devClockBoot.ts"), "utf8");
    expect(boot).toMatch(/if \(import\.meta\.env\.DEV && typeof window !== "undefined"\) installDevClock\(\{ dev: true, search: window\.location\.search \}\);/);
    const main = readFileSync(path.join(src, "main.tsx"), "utf8");
    const firstImport = main.split(/\r?\n/).find((l) => /^import\s/.test(l));
    expect(firstImport).toBe("import './lib/devClockBoot';");
  });
});
