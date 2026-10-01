/**
 * B-INF-05 · the build identity the About row shows.
 *
 * The hosting build (GitHub Actions) has GITHUB_SHA in its environment;
 * `vite.config.ts` folds it through `formatBuildVersion` into the
 * `__APP_VERSION__` define. A local build, a dev server and the test runner
 * have no SHA, so the About row says "dev" rather than a fake semver.
 */
export function formatBuildVersion(sha: string | null | undefined): string {
  const s = (sha ?? "").trim().toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(s) ? s.slice(0, 7) : "dev";
}

declare const __APP_VERSION__: string | undefined;

/** "9252c9c" in a deployed build; "dev" everywhere else. */
export const APP_BUILD: string =
  typeof __APP_VERSION__ === "string" ? formatBuildVersion(__APP_VERSION__) : "dev";
