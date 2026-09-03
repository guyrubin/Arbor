/**
 * MOB-20 — what "About" shows: the app version (injected at build time by the
 * Vite `define` in vite.config.ts from package.json) and, inside a native
 * shell, the store build number via @capacitor/app getInfo() (dynamic import —
 * the plugin never enters the web bundle's static graph, same pattern as
 * lib/native.ts).
 */

declare const __APP_VERSION__: string | undefined;

/** package.json version at build time; "dev" when no define is applied (tests, plain node). */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === "string" && __APP_VERSION__ ? __APP_VERSION__ : "dev";

export interface BuildInfo {
  /** Marketing version — package.json on the web, CFBundleShortVersionString / versionName natively. */
  version: string;
  /** Store build number (CFBundleVersion / versionCode). Native shells only. */
  build?: string;
  native: boolean;
}

/** The synchronous starting point every About row can render before any plugin answers. */
export const webBuildInfo = (): BuildInfo => ({ version: APP_VERSION, native: false });

/**
 * Resolve the build info. Native → ask the shell (never throws: a plugin failure
 * falls back to the web info so the row is never blank). Web → the define.
 */
export async function readBuildInfo(deps: {
  isNative: boolean;
  getInfo?: () => Promise<{ version: string; build: string }>;
}): Promise<BuildInfo> {
  if (!deps.isNative) return webBuildInfo();
  try {
    const getInfo =
      deps.getInfo ??
      (async () => {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        return { version: info.version, build: info.build };
      });
    const info = await getInfo();
    return { version: info.version || APP_VERSION, build: info.build || undefined, native: true };
  } catch {
    return { ...webBuildInfo(), native: true };
  }
}
