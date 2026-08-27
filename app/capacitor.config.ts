import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native (iOS + Google Play) shell config for Arbor.
 *
 * The native apps bundle the built web frontend (`dist/`) and call the
 * remote Arbor API. Because the webview origin is `capacitor://localhost`
 * (iOS) / `https://localhost` (Android), the relative `/api/*` calls in the
 * web app are rewritten to an absolute base at build time — see
 * `src/lib/runtime.ts` (`VITE_API_BASE`). The prod backend must allow the
 * native origins in `CORS_ORIGINS` (see `cloudbuild.prod.yaml`).
 *
 * `appId` is the ratified bundle id (2026-08-27), tied to the owned domain. It
 * is NOT yet registered on either store, so it can still be changed here (then
 * `npx cap sync` + the `IOS_BUNDLE_ID` repo variable). Once a listing exists it
 * is permanent — register whatever this line says, never a value copied from
 * prose elsewhere.
 */
const config: CapacitorConfig = {
  appId: "com.arborparenting.app",
  appName: "Arbor",
  webDir: "dist",
  backgroundColor: "#eef2efff",
  ios: {
    contentInset: "always",
    backgroundColor: "#eef2efff",
  },
  android: {
    backgroundColor: "#eef2efff",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#eef2efff",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashImmersive: false,
    },
    StatusBar: {
      // Style.Dark = dark icons (light "Soft Daylight" canvas). Must match native.ts StatusBar.setStyle.
      style: "DARK", // dark icons on Arbor's light "Soft Daylight" canvas
      backgroundColor: "#eef2efff",
      overlaysWebView: false,
    },
    // Keyboard resize is configured at runtime in src/lib/native.ts.
  },
};

export default config;
