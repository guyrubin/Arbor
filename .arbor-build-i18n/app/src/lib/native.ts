import { isNativePlatform, nativePlatform } from "./runtime";

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
    // Style.Dark = dark icons (light "Soft Daylight" canvas). Must match capacitor.config.ts StatusBar.style.
    await StatusBar.setStyle({ style: Style.Dark });
    if (nativePlatform === "android") {
      await StatusBar.setBackgroundColor({ color: "#eef2ef" });
    }
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
    // The web shell is interactive; hide the splash once React has mounted.
    await SplashScreen.hide();
  } catch {
    /* splash plugin unavailable — non-fatal */
  }

  // Android hardware/gesture back → previous tab (hash history), exit at root.
  // iOS interactive edge-swipe-back is the webview system default and is left
  // unblocked (no left-edge gesture handlers anywhere). Non-fatal if absent.
  try {
    const { App } = await import("@capacitor/app");
    void App.addListener("backButton", ({ canGoBack }) => {
      if (window.history.length > 1 && canGoBack) window.history.back();
      else void App.exitApp();
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
