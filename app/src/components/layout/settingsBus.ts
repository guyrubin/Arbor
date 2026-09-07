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

/** Ask the shell to open the Settings modal. Kid Mode is re-checked by the
 *  listener, exactly as it is for search — every path in passes one gate. */
export function requestOpenSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SETTINGS_OPEN_EVENT));
}
