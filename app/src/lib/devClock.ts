/**
 * B-LOOP-17 — THE SWEEP'S FAKE CLOCK, DEV SERVER ONLY.
 *
 * The loop's named sweep states need a time of day: `loop-morning` is Today at
 * 07:30 (practice pending), `loop-tonight` is Today at 21:00 (the evening door
 * open, Tonight's flow at step 1). `?now=` on the page URL (before the hash:
 * `/?now=07:30#/overview`) shifts the page's clock:
 *   · "HH:MM"              → today at that LOCAL time (the seed's own day);
 *   · a full ISO date-time → that instant ("2026-10-07T21:00:00+02:00").
 * The shifted clock ticks; only "now" moves (`new Date()`, `Date.now()`,
 * `Date()`); every explicit date (`new Date(iso)`, `Date.parse`, `Date.UTC`)
 * is untouched, and `instanceof Date` still holds.
 *
 * NEVER IN PRODUCTION: the only caller is lib/devClockBoot.ts behind
 * `import.meta.env.DEV` — false in every production build (the branch and
 * this module are dropped), true only under the Vite dev server the sandbox
 * runs (server/start.ts middleware mode, `MODEL_PROVIDER=mock`). Pinned in
 * devClock.test.ts.
 */
export const DEV_NOW_PARAM = "now";

/** The instant `?now=` asks for, or null (absent, malformed, out of range). */
export function parseDevNow(search: string, realNow: number): number | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get(DEV_NOW_PARAM);
  } catch {
    return null;
  }
  const value = raw?.trim();
  if (!value) return null;
  const hm = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    if (h > 23 || m > 59) return null;
    const d = new Date(realNow);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** A Date constructor whose "now" runs `offsetMs` ahead (or behind) of the real clock. */
export function shiftedDate(RealDate: DateConstructor, offsetMs: number): DateConstructor {
  const now = () => RealDate.now() + offsetMs;
  return new Proxy(RealDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length === 0 ? [now()] : args, newTarget);
    },
    apply() {
      return new RealDate(now()).toString();
    },
    get(target, prop, receiver) {
      return prop === "now" ? now : Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Install the shifted clock on `target` (default globalThis) when `dev` is
 * true and `?now=` parses. Returns the offset in ms, or null (nothing changed).
 */
export function installDevClock({
  dev,
  search,
  target = globalThis as unknown as { Date: DateConstructor },
}: {
  dev: boolean;
  search: string;
  target?: { Date: DateConstructor };
}): number | null {
  if (!dev) return null;
  const RealDate = target.Date;
  const at = parseDevNow(search, RealDate.now());
  if (at === null) return null;
  const offset = at - RealDate.now();
  target.Date = shiftedDate(RealDate, offset);
  return offset;
}
