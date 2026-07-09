/**
 * E11: FirstStepsRail — a dismissible 4-step start path for new accounts,
 * mounted once in Shell above the tab content (PARENT register only).
 *
 * Steps: add child → meet the coach → capture a moment → create the first
 * comic. Each step deep-links via setActiveTab; completion is auto-detected
 * from existing state where cheap (profiles, conversations, logs) and on-click
 * otherwise (comic). State lives in localStorage "arbor.firstSteps" — no
 * Firestore, no child-data write. Hidden once all four are done or dismissed;
 * accounts that already show real usage on first render are auto-dismissed so
 * the rail only ever greets genuinely new families.
 *
 * Kid dark-pattern ban: parent-side module, counts only ("2 of 4 done") — no
 * streaks, timers, urgency, or deficit framing. CLINICAL FIREWALL respected:
 * the only number is a plain progress count.
 *
 * Styling: token-only (var(--arbor-*) + PASTEL var strings), logical
 * properties for RTL, RTL-aware chevrons, 44px targets, entrance motion gated
 * on prefers-reduced-motion.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus, MessageCircle, Camera, BookOpen, Check, X, ChevronRight } from "lucide-react";
import { useArbor, type ActiveTab } from "../../context/ArborContext";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { PASTEL, type PastelKey } from "../../lib/tokens";
import { prefersReducedMotion } from "../../lib/devscore";

type StepId = "child" | "coach" | "capture" | "comic";

interface RailState {
  dismissed?: boolean;
  /** Steps completed by clicking (used where no cheap state signal exists). */
  clicked?: Partial<Record<StepId, boolean>>;
}

const LS_KEY = "arbor.firstSteps";

function readRailState(): RailState | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RailState;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeRailState(s: RailState): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — the rail simply won't persist */
  }
}

const STEPS: ReadonlyArray<{
  id: StepId;
  labelKey: string;
  tab: ActiveTab;
  tone: PastelKey;
  Glyph: typeof UserPlus;
}> = [
  { id: "child", labelKey: "elev.rail.step.child", tab: "profile", tone: "mint", Glyph: UserPlus },
  { id: "coach", labelKey: "elev.rail.step.coach", tab: "coach", tone: "lav", Glyph: MessageCircle },
  { id: "capture", labelKey: "elev.rail.step.capture", tab: "behaviors", tone: "sky", Glyph: Camera },
  { id: "comic", labelKey: "elev.rail.step.comic", tab: "comics", tone: "pink", Glyph: BookOpen },
];

export function FirstStepsRail() {
  const { setActiveTab, behaviorLogs, playLogs, conversations } = useArbor();
  const { needsOnboarding } = useProfile();
  const { t } = useLanguage();

  const [state, setState] = useState<RailState | null>(() => readRailState());

  // Cheap auto-detection from state the app already holds (O(1) reads).
  const childDone = !needsOnboarding;
  const coachDone = conversations.length > 0 || !!state?.clicked?.coach;
  const captureDone = behaviorLogs.length + playLogs.length > 0;
  const comicDone = !!state?.clicked?.comic;

  // An account that already shows real usage the first time the rail renders
  // is not a new account — dismiss silently, once, before ever showing.
  const established = state === null && childDone && coachDone && captureDone;
  useEffect(() => {
    if (established) {
      const next: RailState = { dismissed: true };
      writeRailState(next);
      setState(next);
    }
  }, [established]);

  const done: Record<StepId, boolean> = useMemo(
    () => ({ child: childDone, coach: coachDone, capture: captureDone, comic: comicDone }),
    [childDone, coachDone, captureDone, comicDone]
  );
  const doneCount = STEPS.filter((s) => done[s.id]).length;
  const allDone = doneCount === STEPS.length;

  // Entrance rise-fade — collapses to an instant render under reduced motion.
  const [entered, setEntered] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (entered) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [entered]);

  const dismiss = useCallback(() => {
    const next: RailState = { ...(state ?? {}), dismissed: true };
    writeRailState(next);
    setState(next);
  }, [state]);

  const openStep = useCallback(
    (id: StepId, tab: ActiveTab) => {
      // Click-completion for steps with no cheap state signal (coach doubles
      // up with auto-detection; comic is click-only).
      if (id === "coach" || id === "comic") {
        const next: RailState = {
          ...(state ?? {}),
          clicked: { ...(state?.clicked ?? {}), [id]: true },
        };
        writeRailState(next);
        setState(next);
      }
      setActiveTab(tab);
    },
    [state, setActiveTab]
  );

  if (state?.dismissed || allDone || established) return null;

  return (
    <section
      aria-labelledby="first-steps-title"
      className="rounded-[22px] p-4 md:p-5 mb-6 text-start"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        opacity: entered ? 1 : 0,
        transform: entered ? "none" : "translateY(10px)",
        transition: "opacity 0.45s ease, transform 0.45s ease",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2
            id="first-steps-title"
            className="text-[var(--t-md)] leading-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 900, color: "var(--arbor-ink)" }}
          >
            {t("elev.rail.title")}
          </h2>
          <p className="mt-0.5 text-[var(--t-xs)]" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.rail.sub")}{" "}
            <span className="font-bold tabular-nums" style={{ color: "var(--arbor-ink)" }}>
              {t("elev.rail.progress", { count: doneCount, total: STEPS.length })}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("elev.rail.dismiss")}
          className="flex items-center justify-center w-11 h-11 -mt-1 rounded-xl flex-shrink-0 transition"
          style={{ color: "var(--arbor-muted)", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <X aria-hidden="true" style={{ width: "18px", height: "18px" }} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const isDone = done[s.id];
          const p = PASTEL[s.tone];
          const label = t(s.labelKey);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => openStep(s.id, s.tab)}
              aria-label={isDone ? `${label} — ${t("elev.rail.stepDone")}` : label}
              className="flex items-center gap-2.5 min-h-[44px] rounded-2xl px-3 py-2.5 text-start transition cursor-pointer"
              style={{
                background: isDone ? p.soft : "var(--arbor-paper)",
                border: "1px solid var(--arbor-rule)",
              }}
            >
              <span
                aria-hidden="true"
                className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
                style={
                  isDone
                    ? { background: p.ink, color: "var(--arbor-on-accent)" }
                    : { background: p.soft, color: p.ink }
                }
              >
                {isDone ? (
                  <Check style={{ width: "14px", height: "14px" }} />
                ) : (
                  <s.Glyph style={{ width: "14px", height: "14px" }} />
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className="block text-[var(--t-xs)] font-extrabold uppercase"
                  style={{ color: p.ink, letterSpacing: "0.08em" }}
                >
                  {i + 1}
                </span>
                <span
                  className="block text-[var(--t-sm)] font-bold leading-tight truncate"
                  style={{ color: "var(--arbor-ink)" }}
                >
                  {label}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="flex-shrink-0 rtl:-scale-x-100"
                style={{ width: "16px", height: "16px", color: "var(--arbor-muted)" }}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default FirstStepsRail;
