import React, { useEffect, useMemo, useRef, useState } from "react";
import { Brain, RotateCcw } from "lucide-react";
import { PlayPanel, PlayButton, Celebrate } from "../ui/playkit";
import { MEMORY_EMOJI_SETS } from "../../practice/playContent";
import { memoryGridSize, memoryMaxCards, memorySetIndexForAge } from "../../practice/signals";
import type { PracticeData } from "../../practice/usePracticeData";
import type { PracticeEvent } from "../../types";
import { track } from "../../lib/analytics";

interface Card {
  uid: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function buildDeck(size: 6 | 8 | 12, setIdx: number): Card[] {
  const set = MEMORY_EMOJI_SETS[setIdx % MEMORY_EMOJI_SETS.length];
  const pairs = size / 2;
  const chosen = set.emojis.slice(0, pairs);
  const deck = [...chosen, ...chosen].map((emoji, i) => ({ uid: i, emoji, flipped: false, matched: false }));
  // Fisher-Yates shuffle.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.map((c, i) => ({ ...c, uid: i }));
}

/**
 * Memory Match (Epic 8) — a pairs game that quietly measures working memory.
 * Difficulty adapts: the grid grows after sustained success and eases back
 * after a hard round (see memoryGridSize). Each completed round logs a
 * `memory` practiceEvent scored on efficiency, feeding the cognition band.
 */
export default function MemoryMatch({ data, childAge }: { data: PracticeData; childAge?: number }) {
  // Past round scores drive the adaptive grid size, bounded by an age-appropriate ceiling.
  const pastScores = useMemo(
    () => data.events.items.filter((e) => e.kind === "memory" && e.score !== undefined).map((e) => e.score as number).reverse(),
    [data.events.items]
  );
  const maxCards = memoryMaxCards(childAge);
  const recommendedSize = memoryGridSize(pastScores, maxCards);

  const [setIdx, setSetIdx] = useState(() => memorySetIndexForAge(childAge, MEMORY_EMOJI_SETS.length));
  const [size, setSize] = useState<6 | 8 | 12>(recommendedSize);
  const [deck, setDeck] = useState<Card[]>(() => buildDeck(recommendedSize, memorySetIndexForAge(childAge, MEMORY_EMOJI_SETS.length)));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);
  const [won, setWon] = useState(false);
  const lastScore = useRef<number | null>(null);

  const pairs = size / 2;
  const matchedCount = deck.filter((c) => c.matched).length / 2;

  const reset = (nextSize = recommendedSize, nextSet = setIdx) => {
    setSize(nextSize);
    setDeck(buildDeck(nextSize, nextSet));
    setFlipped([]);
    setMoves(0);
    setLock(false);
    setWon(false);
    lastScore.current = null;
  };

  // When recommendation changes (after logging a score) and the board is idle, adopt it.
  useEffect(() => {
    if (won) return;
    if (moves === 0 && flipped.length === 0 && size !== recommendedSize) reset(recommendedSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendedSize]);

  const flip = (uid: number) => {
    if (lock || won) return;
    const card = deck.find((c) => c.uid === uid);
    if (!card || card.flipped || card.matched) return;
    const nextFlipped = [...flipped, uid];
    setDeck((d) => d.map((c) => (c.uid === uid ? { ...c, flipped: true } : c)));
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves((m) => m + 1);
      setLock(true);
      const firstEmoji = deck.find((c) => c.uid === nextFlipped[0])!.emoji;
      const matched = card.emoji === firstEmoji;
      window.setTimeout(() => {
        setDeck((d) =>
          d.map((c) =>
            nextFlipped.includes(c.uid)
              ? matched
                ? { ...c, matched: true, flipped: true }
                : { ...c, flipped: false }
              : c
          )
        );
        setFlipped([]);
        setLock(false);
      }, matched ? 320 : 720);
    }
  };

  // Win detection + scoring.
  useEffect(() => {
    if (won) return;
    if (deck.length > 0 && deck.every((c) => c.matched)) {
      setWon(true);
      // Efficiency: perfect = pairs moves. Score scales down with extra moves.
      const perfect = pairs;
      const score = moves > 0 ? Math.max(20, Math.round((perfect / moves) * 100)) : 100;
      lastScore.current = score;
      const event: PracticeEvent = {
        id: `pe-mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: "memory",
        domain: "cognition",
        score,
        meta: `grid${size}`,
        timestamp: new Date().toISOString(),
      };
      void data.events.upsert(event);
      track("memory_round", { size, moves, score });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  const cols = size === 6 ? 3 : size === 8 ? 4 : 4;

  return (
    <PlayPanel>
      <div className="flex items-center gap-3 mb-2">
        <span className="grid place-items-center w-12 h-12 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
          <Brain className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Memory Match</h2>
          <p className="text-[12px] font-semibold" style={{ color: "var(--arbor-muted)" }}>Find the matching pairs — the board grows as you get stronger.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5 mt-3">
        {MEMORY_EMOJI_SETS.map((s, i) => {
          const on = i === setIdx;
          return (
            <button key={s.id} onClick={() => { setSetIdx(i); reset(size, i); }}
              className="play-pressable rounded-full px-4 py-2 text-[13px] font-extrabold"
              style={on ? { background: "var(--arbor-lav-ink)", color: "#fff" } : { background: "#fff", color: "var(--arbor-muted)", border: "1.5px solid var(--arbor-rule)" }}>
              {s.title}
            </button>
          );
        })}
        <span className="text-[13px] font-bold ms-auto" style={{ color: "var(--arbor-muted)" }}>Moves: <b style={{ color: "var(--arbor-ink)" }}>{moves}</b> · Found {matchedCount}/{pairs}</span>
      </div>

      {won ? (
        <Celebrate
          title="All pairs found!"
          stars={lastScore.current !== null ? Math.max(1, Math.round((lastScore.current / 100) * 3)) : 3}
          starsTotal={3}
          subtitle={`Solved in ${moves} moves. ${recommendedSize > size ? "Next round gets a little bigger!" : recommendedSize < size ? "We'll keep it comfy next round." : "Nicely done."}`}
        >
          <PlayButton tone="lav" onClick={() => reset()}>
            <RotateCcw className="w-4 h-4" /> Play again
          </PlayButton>
        </Celebrate>
      ) : (
        <>
          <div className="grid gap-3 mx-auto" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: 460 }}>
            {deck.map((c) => {
              const face = c.flipped || c.matched;
              return (
                <button key={c.uid} onClick={() => flip(c.uid)} aria-label={face ? c.emoji : "hidden card"}
                  className={`play-pressable aspect-square rounded-[var(--play-radius)] flex items-center justify-center text-[2.4rem] ${c.matched ? "play-correct" : ""}`}
                  style={{
                    background: c.matched ? "var(--arbor-green-soft)" : face ? "#fff" : "var(--arbor-lav-soft)",
                    border: c.matched ? "2.5px solid var(--arbor-clay)" : face ? "2.5px solid var(--arbor-lav-ink)" : "2.5px solid transparent",
                    cursor: c.matched ? "default" : "pointer",
                    boxShadow: "0 4px 14px rgba(41,51,63,0.07)",
                  }}>
                  {face ? c.emoji : <span style={{ color: "var(--arbor-lav-ink)", fontSize: 28, fontWeight: 800 }}>?</span>}
                </button>
              );
            })}
          </div>
          <div className="text-center mt-5">
            <PlayButton variant="ghost" size="md" onClick={() => reset()}>
              <RotateCcw className="w-4 h-4" /> Shuffle &amp; restart
            </PlayButton>
          </div>
        </>
      )}
    </PlayPanel>
  );
}
