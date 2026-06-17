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
 * NOTE: `appId` is a placeholder reverse-DNS bundle id. Set it to the id you
 * register in App Store Connect / Google Play before first submission — it
 * cannot be changed after a store listing exists.
 */
const config: CapacitorConfig = {
  appId: "app.arbor.family",
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
      style: "DARK", // dark icons on Arbor's light "Soft Daylight" canvas
      backgroundColor: "#eef2efff",
      overlaysWebView: false,
    },
    // Keyboard resize is configured at runtime in src/lib/native.ts.
  },
};

export default config;
