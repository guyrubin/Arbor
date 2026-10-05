import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { PlayHeader, MascotSay, ChoiceTile, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { patternRound, selectPatternSession, type PatternPuzzle } from "../../practice/newGames";
import { dayKey } from "../../practice/signals";
import { noteKidActivity } from "../../lib/kidModeGate";
import { SpeakButton } from "../ui/SpeakButton";
import { useLanguage } from "../../context/LanguageContext";

/* Pattern Power — continue the sequence. A logic/cognition game: read a
   repeating run of shapes, pick the glyph that comes next. Each pick logs a
   "pattern" event (domain: cognition).

   KID-01: the round is read through `patternRound(idx)` (clamped) — never a
   bare `PATTERN_PUZZLES[idx]` — so the render after the LAST answer can never
   dereference `undefined`. The stateless views below are exported so the node
   harness (patternPower.test.ts) can render every round + the win screen
   without a DOM. */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** KID-07: the ENDING. The old screen said "Play again" and restarted puzzle
 *  1 of the same six — a loop with no finish line, which is the shape of a
 *  pressure mechanic even when nothing is counted. This one says the set is
 *  complete and names what is waiting; the replay is an offer, not the only
 *  way out, and it is honestly labelled as the same set. No "tomorrow", no
 *  streak, no missed-day framing (law 3). */
export function PatternDoneView({
  first,
  onReplay,
  title,
  subtitle,
  againLabel,
}: {
  first: string;
  onReplay: () => void;
  title: string;
  subtitle: string;
  againLabel: string;
}) {
  return (
    // B-KID-04 (law 3): a finished set earns all three stars — 0/6 included.
    <Celebrate title={title} subtitle={subtitle} stars={3} starsTotal={3}>
      <PlayButton onClick={onReplay}>{againLabel}</PlayButton>
    </Celebrate>
  );
}

/** One round: the shown run, the missing slot, and the option tiles. */
export function PatternRoundView({
  puzzle,
  idx,
  options,
  picked,
  onChoose,
  patternAria,
  title,
  say,
  speakLabel,
  lang,
  total,
  correctFeedback,
  retryFeedback,
  supportLabel,
  missed = [],
  revealed = false,
  tryAnotherFeedback = "",
}: {
  puzzle: PatternPuzzle;
  idx: number;
  options: string[];
  picked: string | null;
  /** B-KID-50: wrong picks this round (the round stays open after the first). */
  missed?: readonly string[];
  /** B-KID-50: after a second miss the answer is shown as a pulse, no text. */
  revealed?: boolean;
  tryAnotherFeedback?: string;
  onChoose: (opt: string) => void;
  patternAria: string;
  title: string;
  say: string;
  speakLabel: string;
  lang: string;
  total: number;
  correctFeedback: string;
  retryFeedback: string;
  supportLabel: string;
}) {
  return (
    <div className="space-y-6">
      <PlayHeader
        title={title}
        say={say}
        mood="think"
        worldId="pattern"
        variant="compact"
        action={<SpeakButton text={say} lang={lang} label={speakLabel} size="md" className="min-w-[44px] min-h-[44px] justify-center" />}
      />
      <ProgressPips total={total} current={idx} tone="lav" />

      <div className="pattern-sequence" role="img" aria-label={patternAria}>
        {puzzle.shown.map((g, i) => (
          <span key={i} className="pattern-sequence-glyph">{g}</span>
        ))}
        <span className="pattern-sequence-missing grid place-items-center text-[2rem] font-black rounded-2xl"
          style={{ background: "var(--arbor-lav-soft)", border: "3px dashed var(--arbor-lav-ink)", color: "var(--arbor-lav-ink)" }}>
          {picked ?? "?"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => (
          <ChoiceTile key={opt} emoji={opt} label=""
            state={!picked ? (missed.includes(opt) ? "wrong" : "idle") : opt === puzzle.answer ? "correct" : opt === picked || missed.includes(opt) ? "wrong" : "dim"}
            onClick={() => onChoose(opt)} disabled={!!picked || missed.includes(opt)} />
        ))}
      </div>

      {/* B-KID-50: one miss leaves the round open with a nudge line. */}
      {!picked && missed.length > 0 && tryAnotherFeedback && (
        <MascotSay mood="happy" tone="peach">{tryAnotherFeedback}</MascotSay>
      )}

      {picked && !revealed && (
        <MascotSay mood={picked === puzzle.answer ? "proud" : "happy"} tone={picked === puzzle.answer ? "clay" : "peach"}>
          {picked === puzzle.answer ? correctFeedback : retryFeedback.replace("{answer}", puzzle.answer)}
        </MascotSay>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="category" size={14} /> {supportLabel}
      </p>
    </div>
  );
}

export default function PatternPowerWorld() {
  const { first, log } = useArcadeLogger();
  const { t, uiLang } = useLanguage();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  // B-KID-50 (KC-06): a wrong pick nudges and leaves the round open; a second
  // miss reveals the answer as a pulse (no sentence); only the FIRST try is logged.
  const [missed, setMissed] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [sessionSeed, setSessionSeed] = useState(0);
  const advanceTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
  }, []);

  // KID-08: each bounded sitting stays stable under the child's finger. Asking
  // for six more advances the seed so the next completed set reaches different
  // material without lengthening the required session.
  const puzzles = useMemo(
    () => selectPatternSession(`${dayKey(new Date())}:${sessionSeed}`),
    [sessionSeed],
  );

  // KID-01: clamped read — `puzzle` is always real, `done` is the separate signal.
  const { done, puzzle } = patternRound(idx, puzzles);
  const options = useMemo(() => shuffle(puzzle.options), [puzzle.id]);

  if (done) {
    return (
      <PatternDoneView
        first={first}
        title={t("elev.play.pattern.done.title", { name: first })}
        subtitle={t("elev.play.pattern.done.sub")}
        againLabel={t("elev.play.pattern.done.again")}
        onReplay={() => { setSessionSeed((seed) => seed + 1); setIdx(0); setScores([]); setPicked(null); setMissed([]); setRevealed(false); }}
      />
    );
  }

  const choose = (opt: string) => {
    if (picked || missed.includes(opt)) return;
    const correct = opt === puzzle.answer;
    const firstTry = missed.length === 0;
    // B-KID-50: one row per round — the FIRST try is what is logged.
    if (firstTry) log("pattern", "cognition", { correct, score: correct ? 100 : 0, meta: puzzle.id });
    if (!correct && firstTry) { setMissed([opt]); return; }
    const score = correct && firstTry ? 100 : 0;
    // A second miss reveals the answer (pulse on its tile, the slot fills).
    if (!correct) setRevealed(true);
    setPicked(correct ? opt : puzzle.answer);
    // N1-01-R5: one completed kid activity. A COUNT and nothing else —
    // a no-op outside Kid Mode, so a parent using this screen cannot inflate it.
    noteKidActivity();
    advanceTimerRef.current = window.setTimeout(() => {
      setScores((s) => [...s, score]);
      setPicked(null);
      setMissed([]);
      setRevealed(false);
      setIdx((i) => i + 1);
    }, correct ? 1050 : 1600);
  };

  return (
    <PatternRoundView
      puzzle={puzzle}
      idx={idx}
      options={options}
      picked={picked}
      onChoose={choose}
      patternAria={t("aria.patternToContinue")}
      title={t("elev.play.pattern.title")}
      say={t("elev.play.pattern.say")}
      speakLabel={t("elev.play.speak.label")}
      lang={uiLang}
      total={puzzles.length}
      correctFeedback={t("elev.kids.pattern.feedback.yes")}
      retryFeedback={t("elev.kids.pattern.feedback.retry", { answer: "{answer}" })}
      missed={missed}
      revealed={revealed}
      tryAnotherFeedback={t("elev.kids.pattern.feedback.tryAnother")}
      supportLabel={t("elev.kids.pattern.support")}
    />
  );
}
