/**
 * IA-03 / MOB-26 — the mobile Settings door moves into the More sheet.
 *
 * Settings' open state lives in Shell (and, on desktop, in Sidebar's account
 * popover). MobileNav renders the More sheet, so it needs a way to ask for
 * Settings without owning the state and without importing Shell — which would
 * be a cycle, since Shell renders MobileNav.
 *
 * This is the SAME seam SearchModal already ships (SEARCH_OPEN_EVENT +
 * requestOpenSearch, consumed by Shell's window listener); it is only lifted
 * into its own module because the search seam could live inside the modal it
 * opens and this one cannot. No state, no store — one window event.
 */
export const SETTINGS_OPEN_EVENT = "arbor:open-settings";

/** A Settings row a caller can ask to land on (B-PLAY-06). */
export type SettingsFocus = "pin" | "data";

/** The anchor each focus scrolls into view — a data-testid inside SettingsModal. */
export const SETTINGS_FOCUS_ANCHOR: Record<SettingsFocus, string> = {
  pin: "settings-pin-row",
  // B-CAREPRO-24/35: "Export or delete" (The Science, Sharing, the profile
  // drawer) lands on the data row AND opens the Your-data sheet.
  data: "settings-data-row",
};

let pendingFocus: SettingsFocus | null = null;

/** Ask the shell to open the Settings modal. Kid Mode is re-checked by the
 *  listener, exactly as it is for search — every path in passes one gate.
 *  B-PLAY-06: `focus` names the row the sheet should scroll to; it is held
 *  here (one module-level slot, no store) until SettingsModal consumes it. */
export function requestOpenSettings(opts?: { focus?: SettingsFocus }): void {
  if (typeof window === "undefined") return;
  pendingFocus = opts?.focus ?? null;
  window.dispatchEvent(new CustomEvent(SETTINGS_OPEN_EVENT));
}

/** Read-and-clear the pending focus (SettingsModal calls this on open). */
export function consumeSettingsFocus(): SettingsFocus | null {
  const f = pendingFocus;
  pendingFocus = null;
  return f;
}
