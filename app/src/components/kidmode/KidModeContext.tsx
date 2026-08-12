/**
 * AP-048: Kid Mode — lightweight context holding open/closed state.
 *
 * Scope: PURE UI state. No Firestore write, no child-data mutation.
 * Enter = sets isKidModeOpen true.
 * Exit  = sets isKidModeOpen false, restores nothing (no mutation was made).
 *
 * Placed as a standalone context so Shell, Topbar, and the overlay can all
 * read/write the flag without prop-drilling or touching ArborContext.
 *
 * KID-LOCK (W0.9):
 *  - LEAK 1: the open flag persists in localStorage (arbor.kidmode.active via
 *    lib/kidModeGate) and rehydrates SYNCHRONOUSLY in the useState initializer,
 *    so a reload/webview-kill lands the child back inside Kid Mode on first
 *    paint — never in the parent app.
 *  - This provider is the ONLY writer of the module-level kidModeGate
 *    singleton, which non-React modules (native.ts back button, ArborContext
 *    setActiveTab, ToastProvider, Shell hotkeys/modals) read to seal their own
 *    escape paths. open/close set the gate synchronously — guards are correct
 *    within the same tick as the click, before React re-renders.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { isKidModeActive, setKidModeActive, writeKidModeState } from "../../lib/kidModeGate";

interface KidModeContextValue {
  isKidModeOpen: boolean;
  openKidMode: () => void;
  closeKidMode: () => void;
}

const KidModeContext = createContext<KidModeContextValue>({
  isKidModeOpen: false,
  openKidMode: () => undefined,
  closeKidMode: () => undefined,
});

export function KidModeProvider({ children }: { children: React.ReactNode }) {
  // LEAK 1: the gate module already rehydrated from localStorage at load —
  // start from it so the overlay is up on the very first paint after reload.
  const [isKidModeOpen, setIsKidModeOpen] = useState<boolean>(isKidModeActive);

  const openKidMode = () => {
    setKidModeActive(true); // gate first — non-React guards see it this tick
    writeKidModeState({ open: true, view: "home" });
    setIsKidModeOpen(true);
  };
  // Exit makes no Firestore call and mutates no child record.
  const closeKidMode = () => {
    setKidModeActive(false);
    writeKidModeState({ open: false });
    setIsKidModeOpen(false);
  };

  // Keep the module gate in lockstep with React state (covers StrictMode
  // remounts, where effects re-run but initializers don't).
  useEffect(() => {
    setKidModeActive(isKidModeOpen);
  }, [isKidModeOpen]);

  return (
    <KidModeContext.Provider value={{ isKidModeOpen, openKidMode, closeKidMode }}>
      {children}
    </KidModeContext.Provider>
  );
}

export function useKidMode(): KidModeContextValue {
  return useContext(KidModeContext);
}
