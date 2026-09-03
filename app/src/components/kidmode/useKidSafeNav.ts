/**
 * useKidSafeNav — KID-05 (lane K): parent-shell navigation from a kid surface.
 *
 * ArborContext.setActiveTab is FROZEN while Kid Mode is active (LEAK 3) — a
 * blocked call is a silent no-op that tracks `kidlock_blocked_nav`. A big
 * yellow CTA that does nothing teaches a child "buttons are broken", so kid
 * surfaces must not render such a control at all while locked.
 *
 * Returns the navigator when the parent shell is reachable, `null` while the
 * gate is active. Render the CTA only when non-null:
 *
 *   const nav = useKidSafeNav();
 *   {nav && <PlayButton onClick={() => nav("comics")}>…</PlayButton>}
 *
 * The scanner (lib/kidRegisterScan.test.ts) bans a bare `setActiveTab(` in
 * kid-surface files outside parent-only branches — this hook is the seam.
 */
import { useSyncExternalStore } from "react";
import { useArbor } from "../../context/ArborContext";
import { isKidModeActive, subscribeKidMode } from "../../lib/kidModeGate";

type Navigate = ReturnType<typeof useArbor>["setActiveTab"];

export function useKidSafeNav(): Navigate | null {
  const { setActiveTab } = useArbor();
  const kidMode = useSyncExternalStore(subscribeKidMode, isKidModeActive, isKidModeActive);
  return kidMode ? null : setActiveTab;
}
