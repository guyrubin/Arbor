import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { PlayHeader, MascotSay, ChoiceTile, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { PATTERN_PUZZLES, gradeStars } from "../../practice/newGames";
import { useLanguage } from "../../context/LanguageContext";

/* Pattern Power — continue the sequence. A logic/cognition game: read a
   repeating run of shapes, pick the glyph that comes next. Each pick logs a
   "pattern" event (domain: cognition) that feeds the development score. */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PatternPowerWorld() {
  const { first, log } = useArcadeLogger();
  const { t } = useLanguage();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);

  const puzzle = PATTERN_PUZZLES[idx];
  const options = useMemo(() => shuffle(puzzle.options), [puzzle.id]);
  const done = idx >= PATTERN_PUZZLES.length;

  if (done) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return (
      <Celebrate title={`Pattern master, ${first}!`} subtitle="You read the pattern and saw what comes next." stars={gradeStars(avg)} starsTotal={3}>
        <PlayButton onClick={() => { setIdx(0); setScores([]); setPicked(null); }}>Play again</PlayButton>
      </Celebrate>
    );
  }

  const choose = (opt: string) => {
    if (picked) return;
    const correct = opt === puzzle.answer;
    const score = correct ? 100 : 0;
    setPicked(opt);
    log("pattern", "cognition", { correct, score, meta: puzzle.id });
    window.setTimeout(() => {
      setScores((s) => [...s, score]);
      setPicked(null);
      setIdx((i) => i + 1);
    }, 1050);
  };

  return (
    <div className="space-y-6">
      <PlayHeader title="Pattern Power" say="What comes next? Tap the shape that finishes the pattern." mood="think" />
      <ProgressPips total={PATTERN_PUZZLES.length} current={idx} tone="lav" />

      <div className="flex flex-wrap items-center justify-center gap-3 py-2" role="img" aria-label={t("aria.patternToContinue")}>
        {puzzle.shown.map((g, i) => (
          <span key={i} className="text-[2.8rem] leading-none">{g}</span>
        ))}
        <span className="grid place-items-center text-[2rem] font-black rounded-2xl"
          style={{ width: 64, height: 64, background: "var(--arbor-lav-soft)", border: "3px dashed var(--arbor-lav-ink)", color: "var(--arbor-lav-ink)" }}>
          {picked ?? "?"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => (
          <ChoiceTile key={opt} emoji={opt} label=""
            state={!picked ? "idle" : opt === puzzle.answer ? "correct" : opt === picked ? "wrong" : "dim"}
            onClick={() => choose(opt)} disabled={!!picked} />
        ))}
      </div>

      {picked && (
        <MascotSay mood={picked === puzzle.answer ? "proud" : "happy"} tone={picked === puzzle.answer ? "clay" : "peach"}>
          {picked === puzzle.answer ? "Yes! You spotted the pattern." : `Good try — it was ${puzzle.answer}. Patterns repeat!`}
        </MascotSay>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="category" size={14} /> Logic &amp; sequencing
      </p>
    </div>
  );
}
