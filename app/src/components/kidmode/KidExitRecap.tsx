/**
 * KID-12 — the parent strip on Kid Mode EXIT.
 *
 * Mounted by KidModeProvider ONLY while Kid Mode is open, so the practice
 * listeners exist for the length of the child's session and not a minute
 * longer. It renders nothing. On unmount — which is exactly the exit — it
 * diffs the practice ledgers against the moment Kid Mode opened and enqueues
 * ONE toast naming what the child did.
 *
 * WHY A TOAST: ToastContext already queues while the Kid Mode gate is active
 * and flushes on exit (KID-LOCK, LEAK 4), so the mechanism was free — the
 * parent strip could never paint over the child's surface even if the timing
 * slipped.
 *
 * ── REGISTER SEPARATION (binding) ───────────────────────────────────────────
 * This component is PARENT register. It renders nothing inside Kid Mode, uses
 * no kid.* copy, and is not part of KidModeOverlay's surface graph. The child
 * never sees it: by the time it speaks, the parent has completed the hold-exit
 * gate and the kid surface is gone.
 *
 * ── SAFETY ──────────────────────────────────────────────────────────────────
 * READ ONLY. No child-data write on enter or exit — the Kid Mode contract. The
 * line carries COUNTS of things the child did, never a score, rating or
 * correctness figure (those fields are not even accepted by kidExitRecapLine).
 *
 * ── LANGUAGE (binding) ──────────────────────────────────────────────────────
 * This toast is read by the PARENT, so it resolves in `uiLang` — the language
 * of the app's own chrome — exactly as the other `withChildSignals` call sites
 * do (JournalTab, StoryTimelineTab). It resolved in `aiLang` until 2026-09-04.
 * `getAiLanguage()` is independent of `uiLang`, so a parent reading a Hebrew UI
 * with the AI language left on English got ONE sentence in TWO languages: the
 * childsignals wrapper picked Hebrew phrasing while the count phrases came back
 * from `t()` in English. `aiLang` belongs to model output; nothing on this
 * surface is model output.
 */
import { useEffect, useRef } from "react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePracticeData } from "../../practice/usePracticeData";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { countsSince, kidExitRecapLine, type KidActivityLedgers } from "../../lib/kidExitRecap";

export default function KidExitRecap() {
  const { childProfile } = useArbor();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const practice = usePracticeData(childProfile.id);

  // The baseline: when this child's Kid Mode session began. Device-local, in
  // memory only — nothing is persisted.
  const openedAtRef = useRef<number>(Date.now());

  // The unmount cleanup runs with a stale closure, so the latest ledgers and
  // copy are mirrored into refs on every render.
  const ledgersRef = useRef<KidActivityLedgers>({});
  ledgersRef.current = {
    speech: practice.speech.items.map((x) => x.timestamp),
    mimic: practice.mimic.items.map((x) => x.timestamp),
    mission: practice.missions.items.map((x) => x.timestamp),
    adventure: practice.adventures.items.map((x) => x.timestamp),
    practice: practice.events.items.map((x) => x.timestamp),
  };
  const speakRef = useRef<() => void>(() => undefined);
  speakRef.current = () => {
    const counts = countsSince(ledgersRef.current, openedAtRef.current);
    const line = kidExitRecapLine(
      counts,
      withChildSignals(t, uiLang === "he"),
      (childProfile.name || "").split(" ")[0]
    );
    // Nothing happened → no strip. An empty toast is worse than silence.
    if (line) toast(line, "info");
  };

  useEffect(() => () => speakRef.current(), []);

  return null;
}
