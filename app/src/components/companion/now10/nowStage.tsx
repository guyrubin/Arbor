import { createContext, useContext, type ReactNode } from "react";

/**
 * The v10.1 stage (N-Now › stop 1): every lead's face — its tag, its say line,
 * its title, its meta — is laid over the day arc instead of the old art panel.
 * NowView provides how the arc is drawn; NowPlanFrame (also when a lead such
 * as the recommendation frames itself) asks for it here. Without a provider
 * the frame keeps its own two-panel card.
 */
export interface NowStage {
  /** Draws the day arc with `face` laid over its bowl. `art` is the question's guide picture, when one has shipped. */
  renderArc: (face: ReactNode, art: { src: string; srcSet?: string } | null) => ReactNode;
}

export const NowStageContext = createContext<NowStage | null>(null);

export function useNowStage(): NowStage | null {
  return useContext(NowStageContext);
}
