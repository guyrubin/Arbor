/**
 * AP-048: Kid Mode — lightweight context holding open/closed state.
 *
 * Scope: PURE UI state. No Firestore write, no child-data mutation.
 * Enter = sets isKidModeOpen true.
 * Exit  = sets isKidModeOpen false, restores nothing (no mutation was made).
 *
 * Placed as a standalone context so Shell, Topbar, and the overlay can all
 * read/write the flag without prop-drilling or touching ArborContext.
 */
import React, { createContext, useContext, useState } from "react";

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
  const [isKidModeOpen, setIsKidModeOpen] = useState(false);

  const openKidMode = () => setIsKidModeOpen(true);
  // Exit makes no Firestore call and mutates no child record.
  const closeKidMode = () => setIsKidModeOpen(false);

  return (
    <KidModeContext.Provider value={{ isKidModeOpen, openKidMode, closeKidMode }}>
      {children}
    </KidModeContext.Provider>
  );
}

export function useKidMode(): KidModeContextValue {
  return useContext(KidModeContext);
}
