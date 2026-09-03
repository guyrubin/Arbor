/**
 * Hardware/OS back for full-screen flows (OnboardingFlow, WowOnboarding,
 * AvatarCreator) — a bridge onto lane N's `lib/backStack.pushBackHandler`.
 *
 * Lane N's module is not in this checkout yet, so the registration is a
 * try/catch dynamic import: when the module exists the handler is pushed and
 * the returned release pops it; when it does not, back falls through exactly
 * as before (no behaviour change). ONE-LINE FOLLOW-UP once lane N lands:
 * replace the dynamic import with `import { pushBackHandler } from "./backStack"`.
 */

/** Return true when the back press was consumed (the flow handled it). */
export type BackHandler = () => boolean | void;

type BackStackModule = { pushBackHandler?: (handler: BackHandler) => () => void };

const BACK_STACK_SPECIFIER = "./backStack"; // lane N (variable so an absent module is a runtime miss, not a build error)

export function pushBackHandler(handler: BackHandler): () => void {
  let release: (() => void) | null = null;
  let cancelled = false;
  void (async () => {
    try {
      const mod = (await import(/* @vite-ignore */ BACK_STACK_SPECIFIER)) as BackStackModule;
      if (cancelled || typeof mod.pushBackHandler !== "function") return;
      release = mod.pushBackHandler(handler);
    } catch {
      /* backStack not in this build — hardware back keeps its default behaviour */
    }
  })();
  return () => {
    cancelled = true;
    release?.();
    release = null;
  };
}
