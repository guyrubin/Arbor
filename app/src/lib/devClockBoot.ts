/**
 * B-LOOP-17 — the fake clock's boot (lib/devClock.ts). Imported FIRST by
 * main.tsx so the shifted clock is in place before any module reads the time.
 * `import.meta.env.DEV` is false in production builds: the call is dropped and
 * `?now=` does nothing there.
 */
import { installDevClock } from "./devClock";

if (import.meta.env.DEV && typeof window !== "undefined") installDevClock({ dev: true, search: window.location.search });
