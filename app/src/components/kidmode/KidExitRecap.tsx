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
import { useAuth } from "../../context/AuthContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { HeroJourneyRun } from "../../types";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePracticeData } from "../../practice/usePracticeData";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { countsSince, kidActivityLedgers, kidExitRecapWithBook, makeKidExitRecapScopeGuard, type KidActivityLedgers } from "../../lib/kidExitRecap";
import { offerSneakHandBack, reachedTheCatToday } from "./games/sneakFreeze/handBack";
import { BOOK_READS, lastReadSince, type BookRead } from "../../lib/bookReads";
import { bookAskAfter } from "../../lib/bookAskAfter";

export default function KidExitRecap() {
  const { childProfile, addMoment } = useArbor();
  const { user, firebaseEnabled, loading } = useAuth();
  // Fail closed if this mounted session ever observes another account/child.
  // A→B→A is still a changed session: do not offer a stale Keep action.
  const scope = firebaseEnabled && loading ? null : JSON.stringify([firebaseEnabled ? user?.uid ?? "signed-out" : "local-sandbox", childProfile.id]);
  const recapScopeRef = useRef(makeKidExitRecapScopeGuard(scope));
  recapScopeRef.current.observe(scope);
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const practice = usePracticeData(childProfile.id);
  // B-SHELL-04: hero stories are a ledger of their own (heroRuns), not part of
  // usePracticeData — read here so a finished hero story is named on exit.
  const heroRuns = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");
  // B-BOOK-47: the one read ledger (B-BOOK-51) — the last book finished in this
  // session is named with its AUTHORED ask-after question (never the path the
  // child chose: the ledger holds none).
  const bookReads = useChildCollection<BookRead>(childProfile.id, BOOK_READS);
  const readsRef = useRef<BookRead[]>([]);
  readsRef.current = bookReads.items;

  // The baseline: when this child's Kid Mode session began. Device-local, in
  // memory only — nothing is persisted.
  const openedAtRef = useRef<number>(Date.now());

  // The unmount cleanup runs with a stale closure, so the latest ledgers and
  // copy are mirrored into refs on every render.
  const ledgersRef = useRef<KidActivityLedgers>({});
  // B-KID-31: the shared builder — no check-ins as rounds, no unfinished stories.
  ledgersRef.current = kidActivityLedgers(practice, heroRuns.items);
  const speakRef = useRef<() => void>(() => undefined);
  speakRef.current = () => {
    if (!recapScopeRef.current.mayOffer() || (firebaseEnabled && !user)) return;
    const counts = countsSince(ledgersRef.current, openedAtRef.current);
    const firstName = (childProfile.name || "").split(" ")[0];
    const lang = uiLang === "he" ? "he" : "en";
    const lastRead = lastReadSince(readsRef.current, openedAtRef.current);
    const book = lastRead ? bookAskAfter(lastRead.bookId, lang, childProfile.gender, firstName) : null;
    const line = kidExitRecapWithBook(counts, withChildSignals(t, uiLang === "he"), firstName, book);
    // Nothing happened → no strip. An empty toast is worse than silence.
    // B-SHELL-04: the toast carries a Keep action, so it stays until the
    // parent keeps it or dismisses it (ToastContext never auto-removes an
    // action toast). The toast is queued while Kid Mode is active, so Keep can
    // only be pressed by the parent after exit; it writes ONE parent moment.
    // B-GAME-10: after a finished Sneak & Freeze sitting today, the hand-back
    // CARD carries this moment (statue picture, one count line, Keep) instead
    // of the strip. Memory only: the card's Keep is the same one parent moment.
    const reached = reachedTheCatToday(practice.events?.items ?? [], new Date());
    if (reached > 0) {
      offerSneakHandBack({ childId: childProfile.id, name: (childProfile.name || "").split(" ")[0], gender: childProfile.gender, reached, keepLine: line || null });
      return;
    }
    // A failed Keep re-offers the line as an error toast that says it was not
    // kept and carries Keep again. That toast is the failure's one message, so
    // addMoment's own failure toast stays quiet.
    if (line) {
      const kept = line;
      const offerKeep = (retry: boolean) => toast(
        retry ? t("elev.learnCare.kidExit.keepFailed", { line }) : line,
        retry ? "error" : "info",
        {
          label: t("elev.learnCare.kidExit.keep"),
          onClick: async () => { if (!await addMoment(kept, { callerShowsFailure: true })) offerKeep(true); },
        },
      );
      offerKeep(false);
    }
  };

  useEffect(() => () => speakRef.current(), []);

  return null;
}
