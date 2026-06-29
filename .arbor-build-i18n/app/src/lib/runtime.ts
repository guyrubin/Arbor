import { Capacitor } from "@capacitor/core";

/**
 * Runtime platform + API-base resolution.
 *
 * On the web the app is served from the same origin as its API, so relative
 * `/api/*` calls just work. Inside a Capacitor native shell the webview origin
 * is `capacitor://localhost` (iOS) / `https://localhost` (Android), so those
 * relative calls would hit the local bundle, not the backend. We rewrite them
 * to an absolute base.
 *
 * Base resolution order:
 *   1. `VITE_API_BASE` (explicit build-time override — what CI sets for native)
 *   2. native default: the prod hosting origin
 *   3. web: empty string (relative, same-origin)
 */
export const isNativePlatform = Capacitor.isNativePlatform();
export const nativePlatform = Capacitor.getPlatform(); // "ios" | "android" | "web"

const PROD_API_ORIGIN = "https://arborprd-westeu.web.app";

export const API_BASE = (
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (isNativePlatform ? PROD_API_ORIGIN : "")
).replace(/\/+$/, "");

/** Absolute URL for an API path. No-op (returns `path`) when API_BASE is empty. */
export function apiUrl(path: string): string {
  if (!API_BASE) return path;
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

/**
 * Install a one-time global `fetch` shim that rewrites same-origin `/api/*`
 * requests to the absolute API base. Only does anything when `API_BASE` is set
 * (i.e. native builds), so web behaviour is byte-for-byte unchanged. This keeps
 * the ~10 existing relative call sites working without threading a base through
 * each one, and covers any future call site automatically.
 */
export function installApiBaseShim(): void {
  if (!API_BASE || typeof window === "undefined") return;
  const w = window as typeof window & { __arborFetchShimmed?: boolean };
  if (w.__arborFetchShimmed) return;
  w.__arborFetchShimmed = true;

  const originalFetch = window.fetch.bind(window);
  const localOrigin = window.location.origin; // capacitor://localhost or https://localhost
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return originalFetch(apiUrl(input), init);
    }
    // A relative Request gets resolved against the local webview origin; catch
    // those (`<localOrigin>/api/*`) and re-point them at the remote API.
    if (input instanceof Request && input.url.startsWith(`${localOrigin}/api/`)) {
      const rewritten = apiUrl(input.url.slice(localOrigin.length));
      return originalFetch(new Request(rewritten, input), init);
    }
    return originalFetch(input, init);
  };
}
