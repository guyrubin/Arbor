import { isNativePlatform, nativePlatform } from "./runtime";
import { isKidModeActive } from "./kidModeGate";
import { handleBack } from "./backStack";
import { appUrlToRoute } from "./publicOrigin";
import { captureAttribution } from "./attribution";

/**
 * Native-shell bootstrap (Capacitor). All imports are dynamic so the web bundle
 * never pulls native plugin code, and everything is a no-op on the web.
 */
export async function initNativeShell(): Promise<void> {
  if (!isNativePlatform) return;

  document.documentElement.dataset.platform = nativePlatform; // "ios" | "android"
  document.documentElement.classList.add("is-native", `is-${nativePlatform}`);

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Style.Light = "dark text for light backgrounds" (the plugin names the
    // BAR, not the icons) — dark icons on Arbor's light paper canvas. Must
    // match capacitor.config.ts StatusBar.style / SystemBars.style ("LIGHT");
    // pinned by nativeShellConfig.test.ts. The Android status-bar background
    // is set in capacitor.config.ts for API ≤ 34 (no effect on Android 15+,
    // where the app is edge-to-edge and SystemBars injects the insets).
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* status bar unavailable — non-fatal */
  }

  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
  } catch {
    /* keyboard plugin unavailable — non-fatal */
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    // MOB-24: launchAutoHide is OFF in capacitor.config.ts — this mount-driven
    // hide is the ONLY hide, so the splash never yields to a blank webview.
    await SplashScreen.hide();
  } catch {
    /* splash plugin unavailable — non-fatal */
  }

  // STORE-2: configure RevenueCat native billing (StoreKit / Play Billing).
  // No-op when the platform SDK key isn't shipped (pre-launch builds).
  try {
    const { configureNativeBilling } = await import("./nativeBilling");
    await configureNativeBilling();
  } catch {
    /* billing unavailable — purchase surfaces fall back to "coming soon" */
  }

  // Android hardware/gesture back: Kid-Mode gate → the open overlay / step
  // (lib/backStack, MOB-16) → previous tab (hash history) → exit at root.
  // iOS: WKWebView's allowsBackForwardNavigationGestures is OFF (Capacitor's
  // default, deliberately not enabled — pinned by nativeShellConfig.test.ts),
  // so iOS has NO system back-swipe; overlays close via the sheet handle /
  // scrim / Escape, and Kid Mode keeps its single parent-gated exit (MOB-29).
  try {
    const { App } = await import("@capacitor/app");
    void App.addListener("backButton", ({ canGoBack }) => {
      // KID-LOCK (W0.9, LEAK 2): while Kid Mode is open the hardware back
      // button must neither pop the parent hash history nor exit the app —
      // the parent gate (hold + challenge) is the only way out. No-op.
      if (isKidModeActive()) return;
      // MOB-16 / IA-05: an open modal, sheet or onboarding step owns Back.
      if (handleBack()) return;
      if (window.history.length > 1 && canGoBack) window.history.back();
      else void App.exitApp();
    });

    // MOB-17: universal / app links. A link on the public origin becomes the
    // in-app hash route; its query string is placed on the webview URL first
    // so first-touch attribution (`?ref=` / utm_*) is captured exactly as on
    // the web. Foreign URLs are ignored (appUrlToRoute → null).
    void App.addListener("appUrlOpen", ({ url }) => {
      const route = appUrlToRoute(url);
      if (!route) return;
      try {
        if (route.search) window.history.replaceState(null, "", `${window.location.pathname}${route.search}${window.location.hash}`);
      } catch {
        /* history unavailable — attribution simply stays first-touch */
      }
      if (route.hash) window.location.hash = route.hash;
      captureAttribution();
    });
  } catch {
    /* app plugin unavailable — non-fatal */
  }
}

/**
 * Light selection haptic for tactile feedback on tab/section changes. No-op on
 * web (gated on isNativePlatform; dynamic import keeps native code out of the
 * web bundle). Haptics ≠ motion, so prefers-reduced-motion does not gate this.
 */
export async function selectionHaptic(): Promise<void> {
  if (!isNativePlatform) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* haptics unavailable — non-fatal */
  }
}

/**
 * MOB-30: notification haptic for the moments the loop wants felt — capture
 * saved, milestone confirmed, a kid celebration. Never on error toasts (the
 * "error" type exists for a deliberate warning, not for failures). No-op on
 * the web; dynamic import keeps native code out of the web bundle.
 */
export async function notificationHaptic(type: "success" | "warning" | "error" = "success"): Promise<void> {
  if (!isNativePlatform) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error } as const;
    await Haptics.notification({ type: map[type] });
  } catch {
    /* haptics unavailable — non-fatal */
  }
}
