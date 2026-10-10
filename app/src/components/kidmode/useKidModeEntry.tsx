import { useEffect, useRef, useState, type ReactElement } from "react";
import { useKidMode, type KidModeTarget } from "./KidModeContext";
import { useArborOptional } from "../../context/ArborContext";
import { resolveHeroUrl } from "../ui/HeroAvatar";
import HeroFirstStep from "./HeroFirstStep";
import { markHeroStepOffered, shouldOfferHeroStep } from "./heroPromptGate";
import { kidModeOpenFor } from "../../lib/age/playGate";
import { isKidModeActive, subscribeKidMode } from "../../lib/kidModeGate";

type EntryScope = { childId: string | undefined; eligible: boolean; active: boolean };
type PendingEntry = { scope: EntryScope; target: KidModeTarget };

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
  // A door remains renderable outside ArborProvider, but cannot hand over
  // until an eligible child is in scope.
  const arbor = useArborOptional();
  const child = arbor?.childProfile;
  const eligible = Boolean(child?.id) && kidModeOpenFor(child);
  const childRef = useRef(child);
  childRef.current = child;
  const scopeRef = useRef<EntryScope | null>(null);
  // Retire during render, before effect cleanup, and never revive A's old
  // callbacks when the selected child goes A → B → A.
  if (!scopeRef.current || scopeRef.current.childId !== child?.id || scopeRef.current.eligible !== eligible) {
    if (scopeRef.current) scopeRef.current.active = false;
    scopeRef.current = { childId: child?.id, eligible, active: true };
  }
  const scope = scopeRef.current;
  const pendingRef = useRef<PendingEntry | null>(null);
  const [stepState, setStepState] = useState<PendingEntry | null>(null);
  if (pendingRef.current?.scope !== scope) pendingRef.current = null;
  const current = () => scope.active && scopeRef.current === scope && scope.eligible
    && childRef.current?.id === scope.childId && kidModeOpenFor(childRef.current) && !isKidModeActive();
  const setStepOpen = (target: KidModeTarget) => {
    const pending = { scope, target: { ...target } };
    pendingRef.current = pending;
    setStepState(pending);
  };
  const dismiss = (pending: PendingEntry) => {
    if (pendingRef.current !== pending) return;
    pendingRef.current = null;
    setStepState(null);
  };
  useEffect(() => {
    scope.active = true;
    const retireStep = () => {
      if (pendingRef.current?.scope === scope) dismiss(pendingRef.current);
    };
    // Another existing door may lock Kid Mode while this parent step waits.
    // Latch that transition even if it unlocks before our next render.
    const unsubscribe = subscribeKidMode(locked => { if (locked) retireStep(); });
    if (isKidModeActive()) retireStep();
    return () => {
      scope.active = false;
      if (pendingRef.current?.scope === scope) pendingRef.current = null;
      unsubscribe();
    };
  }, [scope]);

  const request = (target: KidModeTarget = {}) => {
    if (!current() || pendingRef.current) return;
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
  const pending = stepState && pendingRef.current === stepState && current() ? stepState : null;
  const enterKidMode = () => {
    if (!pending || pendingRef.current !== pending || !current()) return;
    const target = pending.target;
    dismiss(pending); // Consume before closing a mobile sheet or opening Kid Mode.
    onBeforeOpen?.();
    openKidMode(target);
  };
  // Unmount the whole step, including its nested creator, when it retires.
  const step = child && pending ? (
    <HeroFirstStep
      open
      childId={child.id}
      childName={child.name}
      onEnterKidMode={enterKidMode}
      onClose={() => dismiss(pending)}
    />
  ) : null;
  return { request, step };
}
