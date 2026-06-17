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
    // Dark icons over Arbor's light "Soft Daylight" canvas.
    await StatusBar.setStyle({ style: Style.Light });
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
}
