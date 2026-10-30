import { useLanguage } from "../../context/LanguageContext";
import type { SituationMoment } from "../../lib/trialEntry";
import { landingExampleFact } from "../../lib/situationExample";

export type ExamplePhase = "loading" | "pending" | "unavailable";
export type SituationShellState = {
  pastSituation: boolean;
  exampleSettled: boolean;
  phase: ExamplePhase;
  memoryId: string | null;
  busy: boolean;
};

/** Local shell flags. useSyncExternalStore so a direct render (tests) and React agree. */
export function createSituationShell(pastSituation: boolean) {
  let state: SituationShellState = { pastSituation, exampleSettled: false, phase: "loading", memoryId: null, busy: false };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    patch: (next: Partial<SituationShellState>) => { state = { ...state, ...next }; listeners.forEach(fn => fn()); },
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}

/** The landing situation, before any question. The useful step is the first thing. */
export function SituationFirst({ moment, kept, onContinue }: {
  moment: SituationMoment; kept: boolean; onContinue: () => void;
}) {
  const { t, uiLang } = useLanguage();
  return <section className="first-run-step" data-testid="onboarding-situation">
    <p className="first-run-hint">{t(`elev.situation.${moment}.kicker`)}</p>
    <h1>{t(`elev.situation.${moment}.title`)}</h1>
    <div className="first-run-authored-card">
      <p className="first-run-notice" dir="auto">{t(`elev.situation.${moment}.step`)}</p>
      <p className="first-run-say" dir="auto">{t(`elev.situation.${moment}.words`)}</p>
    </div>
    {kept && <div data-testid="onboarding-situation-example">
      <p className="first-run-hint">{t("elev.situation.example.preview")}</p>
      <p className="first-run-say" dir="auto">{landingExampleFact(moment, uiLang === "he" ? "he" : "en")}</p>
    </div>}
    <div className="first-run-footer">
      <button type="button" className="first-run-primary" onClick={onContinue}>{t("elev.situation.continue")}</button>
    </div>
  </section>;
}

/** Chosen moment, directly above the sign-in buttons. */
export function SignInSituation({ moment, kept }: { moment: SituationMoment; kept?: boolean }) {
  const { t } = useLanguage();
  return <div data-testid="signin-situation" className="w-full rounded-2xl px-4 py-3 text-start space-y-1" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
    <p className="text-sm font-semibold">{t(`elev.situation.signin.${moment}`)}</p>
    {kept && <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.situation.signin.kept")}</p>}
  </div>;
}

/** The kept illustration, on the parent memory-review register. */
export function SituationExampleReview({ name, moment, phase, busy, onRemember, onLeave, onContinue }: {
  name: string;
  moment: SituationMoment;
  phase: "loading" | "pending" | "unavailable";
  busy: boolean;
  onRemember: () => void;
  onLeave: () => void;
  onContinue: () => void;
}) {
  const { t, uiLang } = useLanguage();
  return <section className="first-run-step" data-testid="onboarding-example-review">
    <h1>{t("elev.situation.example.title")}</h1>
    <p className="first-run-hint">{t("elev.situation.example.hint", { name: name.trim() })}</p>
    <div className="first-run-authored-card">
      <p className="first-run-notice" dir="auto">{landingExampleFact(moment, uiLang === "he" ? "he" : "en")}</p>
    </div>
    {phase === "loading" && <p className="first-run-hint" role="status">{t("elev.situation.example.preparing")}</p>}
    {phase === "unavailable" && <p className="first-run-hint" role="status">{t("elev.situation.example.failed")}</p>}
    <div className="first-run-footer">
      {phase === "pending" && <>
        <button type="button" className="first-run-skip" data-testid="onboarding-example-leave" onClick={onLeave} disabled={busy}>{t("companion.about.memory.not")}</button>
        <button type="button" className="first-run-primary" data-testid="onboarding-example-remember" onClick={onRemember} disabled={busy}>{t("companion.about.memory.remember")}</button>
      </>}
      {phase === "unavailable" && <button type="button" className="first-run-primary" data-testid="onboarding-example-continue" onClick={onContinue}>{t("elev.situation.example.continue")}</button>}
    </div>
  </section>;
}
