import React, { createContext, useContext, useMemo } from "react";
import type { StudioCreation } from '../studioV2/studioCreations';

/** Optional child-play boundary. Unprovided legacy/parent routes retain their
 * recording behavior; V2 keeps round answers only in the active game. */
interface GameSession {
  playOnly: true;
  /** Deliberate replays in this mounted Studio visit; never a saved score. */
  replay: number;
  onComplete: (creation?: StudioCreation) => void;
}
const GameSessionContext = createContext<GameSession | null>(null);

export function GameCompletionProvider({ onComplete, replay = 0, children }: { onComplete: (creation?: StudioCreation) => void; replay?: number; children: React.ReactNode }) {
  const value = useMemo<GameSession>(() => ({ playOnly: true, replay, onComplete }), [replay, onComplete]);
  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession(): GameSession | null {
  return useContext(GameSessionContext);
}
