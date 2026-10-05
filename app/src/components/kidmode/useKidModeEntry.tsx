import { useState, type ReactElement } from "react";
import { useKidMode, type KidModeTarget } from "./KidModeContext";
import { useArborOptional } from "../../context/ArborContext";
import { resolveHeroUrl } from "../ui/HeroAvatar";
import HeroFirstStep from "./HeroFirstStep";
import { markHeroStepOffered, shouldOfferHeroStep } from "./heroPromptGate";

/**
 * B-KID-11 — the ONE entry seam into Kid Mode.
 *
 * Every parent door that hands the device over (the topbar pill, the Practice
 * door and world tiles, the Feelings and Story Quest doors, Consult's "At home
 * while you wait") calls `request({ view, worldId })` from this hook and
 * renders its `step` beside the control. Hero-first runs here, once per
 * session per child, never as a block on the child; then Kid Mode opens on
 * the named surface/world instead of the home dashboard.
 *
 * `openKidMode(` is called only here (guard: kidModeEntry.seam.test.ts).
 */
export function useKidModeEntry(onBeforeOpen?: () => void): {
  request: (target?: KidModeTarget) => void;
  step: ReactElement | null;
} {
  const { openKidMode } = useKidMode();
  // Optional context so a door stays renderable outside ArborProvider (it
  // behaves exactly as before there — straight into Kid Mode).
  const arbor = useArborOptional();
  const child = arbor?.childProfile;
  // null = the step is closed; a target = the step is open for that door.
  const [stepFor, setStepOpen] = useState<KidModeTarget | null>(null);

  const request = (target: KidModeTarget = {}) => {
    // Hero-first: a child with no hero gets their parent one step first —
    // offered once per session per child, never a block on the child.
    // onBeforeOpen (e.g. a mobile sheet's close) is deliberately NOT fired
    // yet: it would unmount the control, and with it the step it is about to show.
    if (child && shouldOfferHeroStep({ childId: child.id, hasHero: Boolean(resolveHeroUrl(child)) })) {
      markHeroStepOffered(child.id);
      setStepOpen(target);
      return;
    }
    onBeforeOpen?.();
    openKidMode(target);
  };
  const enterKidMode = () => { const target = stepFor ?? {}; setStepOpen(null); onBeforeOpen?.(); openKidMode(target); };
  const step = child ? (
    <HeroFirstStep
      open={stepFor !== null}
      childId={child.id}
      childName={child.name}
      onEnterKidMode={enterKidMode}
      onClose={() => setStepOpen(null)}
    />
  ) : null;
  return { request, step };
}
