import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Brain, RotateCcw, Sparkles } from "lucide-react";
import { SectionCard, cardCls, Chip } from "../ui/kit";
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
    <SectionCard title="Memory Match" icon={<Brain className="w-5 h-5" />} tone="lav"
      action={<Chip tone="lav">{pairs} pairs · adapts to skill</Chip>}>
      <p className="text-[11px] mb-4" style={{ color: "var(--arbor-muted)" }}>
        Flip two cards to find a pair. The grid grows as {""}working memory gets stronger and eases back after a tricky round — no settings to fiddle with.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {MEMORY_EMOJI_SETS.map((s, i) => {
          const on = i === setIdx;
          return (
            <button key={s.id} onClick={() => { setSetIdx(i); reset(size, i); }}
              className="rounded-full px-3 py-1.5 text-[11px] font-extrabold transition"
              style={on ? { background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
              {s.title}
            </button>
          );
        })}
        <span className="text-[11px] ml-auto" style={{ color: "var(--arbor-muted)" }}>Moves: <b style={{ color: "var(--arbor-ink)" }}>{moves}</b> · Found {matchedCount}/{pairs}</span>
      </div>

      {won ? (
        <div className="text-center py-8">
          <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="text-5xl block">🧠</motion.span>
          <p className="text-lg font-extrabold mt-3" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>All pairs found!</p>
          <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>
            Solved in {moves} moves{lastScore.current !== null && ` · score ${lastScore.current}`}. {recommendedSize > size ? "Next round gets a little bigger!" : recommendedSize < size ? "We'll keep it comfy next round." : "Nicely done."}
          </p>
          <button onClick={() => reset()} className="mt-4 inline-flex items-center gap-2 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl" style={{ background: "var(--arbor-lav-ink)" }}>
            <Sparkles className="w-3.5 h-3.5" /> Play again
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-2.5 mx-auto" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: 420 }}>
            {deck.map((c) => (
              <button key={c.uid} onClick={() => flip(c.uid)} aria-label={c.flipped || c.matched ? c.emoji : "hidden card"}
                className="aspect-square rounded-2xl flex items-center justify-center text-3xl transition"
                style={{
                  background: c.matched ? "var(--arbor-green-soft)" : c.flipped ? "#fff" : "var(--arbor-lav-soft)",
                  border: c.matched ? "2px solid var(--arbor-clay)" : "1px solid rgba(41,51,63,0.08)",
                  cursor: c.matched ? "default" : "pointer",
                }}>
                {(c.flipped || c.matched) ? c.emoji : <span style={{ color: "var(--arbor-lav-ink)", fontSize: 20 }}>?</span>}
              </button>
            ))}
          </div>
          <div className="text-center mt-4">
            <button onClick={() => reset()} className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
              <RotateCcw className="w-3 h-3" /> Shuffle &amp; restart
            </button>
          </div>
        </>
      )}
    </SectionCard>
  );
}
