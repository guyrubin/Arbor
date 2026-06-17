import React, { useMemo, useRef, useState } from "react";
import { BookOpen, Check, PenLine, Sparkles, Volume2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { SectionCard, cardCls, Chip } from "../ui/kit";
import { ProgressPips, celebrateBurst } from "../ui/playkit";
import { speak } from "../../lib/tts";
import {
  PHONICS_LETTERS,
  READING_LINES,
  READING_STAGES,
  SIGHT_WORDS,
  TRACE_LETTERS,
  evaluateTrace,
  isReadingStageAppropriate,
  strokeToSvgPath,
  traceStars,
  type ReadingStage,
  type TraceLetter,
  type TracePoint,
} from "../../practice/literacy";
import type { PracticeEvent } from "../../types";

/* ════════════════════════════════════════════════════════════════════════════
   Early Reading track + Letter Trace mini-game (Mission M7).
   Layers an articulation → phonics → sight words → reading ladder, plus a
   finger letter-tracing game, into the child register. All scoped to .arbor-play
   via PlayKit. No dark patterns: short, self-paced, effort-celebrated rounds.
   ════════════════════════════════════════════════════════════════════════════ */

type LogEvent = (kind: PracticeEvent["kind"], correct?: boolean, meta?: string, score?: number) => void;

/** Read a short string aloud if the device supports it (best-effort, optional). */
function sayAloud(text: string) {
  try {
    speak(text);
  } catch {
    /* TTS is a nice-to-have; the parent can always model the sound. */
  }
}

/* ───────────────────────── Letter Trace mini-game ───────────────────────── */

const TRACE_SIZE = 280; // px box

function LetterTrace({ onLog }: { onLog: LogEvent }) {
  const { t } = useLanguage();
  const [idx, setIdx] = useState(0);
  const [strokeIdx, setStrokeIdx] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [path, setPath] = useState<TracePoint[]>([]);
  const [coverage, setCoverage] = useState(0);
  const [done, setDone] = useState<{ stars: 0 | 1 | 2 | 3 } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const letter: TraceLetter = TRACE_LETTERS[idx % TRACE_LETTERS.length];
  const totalStrokes = letter.strokes.length;
  const guide = letter.strokes[Math.min(strokeIdx, totalStrokes - 1)];

  const toNorm = (e: React.PointerEvent): TracePoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const reset = (nextStroke = strokeIdx) => {
    setDrawing(false);
    setPath([]);
    setCoverage(0);
    setStrokeIdx(nextStroke);
  };

  const start = (e: React.PointerEvent) => {
    if (done) return;
    const p = toNorm(e);
    if (!p) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrawing(true);
    setPath([p]);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing) return;
    const p = toNorm(e);
    if (!p) return;
    setPath((prev) => {
      const next = [...prev, p];
      setCoverage(evaluateTrace(guide, next).coverage);
      return next;
    });
  };

  const finishStroke = () => {
    if (!drawing) return;
    setDrawing(false);
    const evaluation = evaluateTrace(guide, path);
    if (!evaluation.passed) {
      // Gentle retry — keep the coverage visible so progress feels real.
      return;
    }
    if (strokeIdx + 1 < totalStrokes) {
      reset(strokeIdx + 1);
      return;
    }
    // Whole letter complete — average coverage across the stroke set isn't tracked
    // per-stroke; use the final stroke's coverage as the celebration score, which
    // is forgiving and always ≥ the pass threshold here.
    const stars = traceStars(evaluation.coverage);
    setDone({ stars });
    celebrateBurst();
    onLog("letter-trace", true, `trace:${letter.id}`, Math.round(evaluation.coverage * 100));
  };

  const nextLetter = () => {
    setDone(null);
    setIdx((i) => (i + 1) % TRACE_LETTERS.length);
    reset(0);
  };

  const guidePathD = strokeToSvgPath(guide, TRACE_SIZE);
  const tracedPathD = path.length > 0 ? strokeToSvgPath(path, TRACE_SIZE) : "";
  const allStrokesD = letter.strokes.map((s) => strokeToSvgPath(s, TRACE_SIZE));

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4" style={{ color: "var(--arbor-lav-ink)" }} />
          <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("prac.read.trace.title")}</p>
        </div>
        <Chip tone="lav">{letter.letter} · {letter.sound}</Chip>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="flex-shrink-0">
          <svg
            ref={svgRef}
            width={TRACE_SIZE}
            height={TRACE_SIZE}
            viewBox={`0 0 ${TRACE_SIZE} ${TRACE_SIZE}`}
            role="img"
            aria-label={`Trace the letter ${letter.letter}`}
            className="rounded-[var(--play-radius-lg)] touch-none select-none"
            style={{ background: "var(--arbor-paper-deep)", border: "2px solid var(--arbor-lav-soft)", cursor: done ? "default" : "crosshair" }}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={finishStroke}
            onPointerLeave={finishStroke}
            onPointerCancel={finishStroke}
          >
            {/* Faint full-letter ghost for orientation */}
            {allStrokesD.map((d, i) => (
              <path key={`ghost-${i}`} d={d} fill="none" stroke="rgba(41,51,63,0.10)" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {/* Active stroke guide (dashed) */}
            <path d={guidePathD} fill="none" stroke="var(--arbor-lav-ink)" strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" opacity={0.6} />
            {/* Start dot */}
            <circle cx={guide[0].x * TRACE_SIZE} cy={guide[0].y * TRACE_SIZE} r={12} fill="var(--arbor-clay)" />
            {/* What the child has drawn */}
            {tracedPathD && (
              <path d={tracedPathD} fill="none" stroke="var(--arbor-clay)" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
            )}
          </svg>
        </div>

        <div className="flex-1 min-w-0 w-full">
          {done ? (
            <div className="text-center sm:text-left play-pop-in">
              <div className="flex justify-center sm:justify-start gap-1 mb-2" aria-label={`${done.stars} of 3 stars`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="text-2xl" style={{ filter: i < done.stars ? "none" : "grayscale(1)", opacity: i < done.stars ? 1 : 0.35 }}>⭐</span>
                ))}
              </div>
              <p className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                You traced {letter.letter}! It says “{letter.sound}”.
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                <button onClick={() => sayAloud(letter.sound)} className="play-pressable inline-flex items-center gap-1.5 text-xs font-extrabold px-4 min-h-[44px] rounded-full" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
                  <Volume2 className="w-4 h-4" /> Hear it
                </button>
                <button onClick={nextLetter} className="play-pressable inline-flex items-center gap-1.5 text-xs font-extrabold px-5 min-h-[44px] rounded-full text-white" style={{ background: "var(--arbor-clay)" }}>
                  Next letter
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[13px] font-bold mb-2" style={{ color: "var(--arbor-ink-soft)" }}>
                {t("prac.read.trace.start")}
              </p>
              <p className="text-[11px] mb-3" style={{ color: "var(--arbor-muted)" }}>
                Stroke {Math.min(strokeIdx + 1, totalStrokes)} of {totalStrokes}
              </p>
              <div className="h-2.5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(41,51,63,0.08)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(coverage * 100)}%`, background: "var(--arbor-clay)" }} />
              </div>
              {totalStrokes > 1 && <ProgressPips total={totalStrokes} current={Math.min(strokeIdx, totalStrokes - 1)} tone="lav" />}
              <div className="flex flex-wrap gap-2 mt-4">
                <button onClick={() => sayAloud(letter.sound)} className="play-pressable inline-flex items-center gap-1.5 text-xs font-extrabold px-4 min-h-[44px] rounded-full" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
                  <Volume2 className="w-4 h-4" /> {t("prac.read.trace.hear")}
                </button>
                <button onClick={() => reset(strokeIdx)} className="play-pressable text-xs font-extrabold px-4 min-h-[44px] rounded-full" style={{ background: "#fff", color: "var(--arbor-muted)", border: "2px solid var(--arbor-rule)" }}>
                  Start this stroke over
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Early Reading ladder ───────────────────────── */

const STAGE_LABEL_KEY: Record<ReadingStage, string> = {
  phonics: "prac.read.stage.phonics",
  "sight-words": "prac.read.stage.sight",
  reading: "prac.read.stage.reading",
};

export default function EarlyReadingTrack({ age, first, onLog }: { age: number; first: string; onLog: LogEvent }) {
  const { t } = useLanguage();
  const available = useMemo<ReadingStage[]>(
    () => READING_STAGES.map((s) => s.stage).filter((s) => isReadingStageAppropriate(s, age)),
    [age]
  );
  const [stage, setStage] = useState<ReadingStage>(available[available.length - 1] ?? "phonics");
  const [phonicsIdx, setPhonicsIdx] = useState(0);
  const [sightIdx, setSightIdx] = useState(0);
  const [readIdx, setReadIdx] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);

  const flash = (key: string) => {
    setSaved(key);
    window.setTimeout(() => setSaved((s) => (s === key ? null : s)), 1400);
  };

  const phonics = PHONICS_LETTERS[phonicsIdx % PHONICS_LETTERS.length];
  const sight = SIGHT_WORDS[sightIdx % SIGHT_WORDS.length];
  const line = READING_LINES[readIdx % READING_LINES.length];

  const heardPhonics = () => {
    onLog("phonics", true, `letter:${phonics.id}`);
    flash("phonics");
    setPhonicsIdx((i) => (i + 1) % PHONICS_LETTERS.length);
  };
  const readSight = () => {
    onLog("sight-word", true, `sight:${sight.id}`);
    flash("sight");
    setSightIdx((i) => (i + 1) % SIGHT_WORDS.length);
  };
  const readLine = () => {
    onLog("sight-word", true, `read:${line.id}`);
    flash("read");
    setReadIdx((i) => (i + 1) % READING_LINES.length);
  };

  const activeStage = READING_STAGES.find((s) => s.stage === stage) ?? READING_STAGES[0];

  return (
    <SectionCard title={t("prac.read.title")} icon={<BookOpen className="w-5 h-5" />} tone="lav"
      action={<Chip tone="lav">{t("prac.read.tag")}</Chip>}>
      <p className="text-xs rounded-xl p-3 mb-4" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
        After the sounds come the symbols. We build reading the gentle way — letter sounds first, then a handful of sight words, then blending them into a short sentence. Letters appear as {first} grows into them.
      </p>

      {/* Stage selector — only stages appropriate to the age are offered */}
      <div role="tablist" aria-label="Reading stage" className="flex flex-wrap gap-2 mb-4">
        {READING_STAGES.map((s) => {
          const on = s.stage === stage;
          const ready = available.includes(s.stage);
          return (
            <button key={s.stage} role="tab" aria-selected={on} disabled={!ready}
              onClick={() => ready && setStage(s.stage)}
              className="rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold transition disabled:opacity-40 disabled:cursor-not-allowed"
              title={ready ? s.hint : `Usually a little later than ${first}'s age — it'll unlock as ${first} grows.`}
              style={on ? { background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
              {t(STAGE_LABEL_KEY[s.stage])}
            </button>
          );
        })}
        <span className="self-center text-[11px] ml-1" style={{ color: "var(--arbor-muted)" }}>{activeStage.hint}</span>
      </div>

      {stage === "phonics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-[var(--play-radius-lg)] p-7 text-center" style={{ background: "linear-gradient(135deg, var(--arbor-lav-soft), #ffffff 75%)", border: "2px solid var(--arbor-lav-soft)" }}>
            <p className="text-[64px] leading-none font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{phonics.letter}</p>
            <p className="text-2xl mt-2">{phonics.emoji}</p>
            <p className="text-base font-extrabold mt-1" style={{ color: "var(--arbor-ink)" }}>
              {phonics.letter} says “{phonics.sound}” — like <b>{phonics.keyword}</b>
            </p>
            <button onClick={() => sayAloud(phonics.sound)} className="mt-3 play-pressable inline-flex items-center gap-1.5 text-xs font-extrabold px-4 min-h-[44px] rounded-full" style={{ background: "#fff", color: "var(--arbor-lav-ink)", border: "2px solid var(--arbor-lav-soft)" }}>
              <Volume2 className="w-4 h-4" /> Hear the sound
            </button>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[13px] rounded-xl p-3 mb-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }}>
              <b>Model it:</b> {phonics.cue}
            </p>
            <button onClick={heardPhonics} className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-4 py-3 rounded-xl text-white" style={{ background: "var(--arbor-clay)" }}>
              {saved === "phonics" ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {saved === "phonics" ? "Saved" : `${first} said the sound`}
            </button>
          </div>
        </div>
      )}

      {stage === "sight-words" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-[var(--play-radius-lg)] p-8 text-center" style={{ background: "var(--arbor-sky-soft)", border: "2px solid var(--arbor-sky-soft)" }}>
            <p className="text-[56px] leading-none font-extrabold lowercase" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-sky-ink)" }}>{sight.word}</p>
            <p className="text-sm mt-4 font-bold" style={{ color: "var(--arbor-ink)" }}>“{sight.sentence}”</p>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[13px] rounded-xl p-3 mb-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }}>
              Sight words don't sound out — we just know them. Point to it, say it together a few times, then find it in the little sentence.
            </p>
            <button onClick={readSight} className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-4 py-3 rounded-xl text-white" style={{ background: "var(--arbor-sky-ink)" }}>
              {saved === "sight" ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {saved === "sight" ? "Saved" : `${first} read it`}
            </button>
          </div>
        </div>
      )}

      {stage === "reading" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-[var(--play-radius-lg)] p-8 text-center flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--arbor-green-soft), #ffffff 75%)", border: "2px solid var(--arbor-green-soft)" }}>
            <p className="text-[28px] leading-tight font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{line.text}</p>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[13px] rounded-xl p-3 mb-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }}>
              <b>Read together:</b> {line.tip}
            </p>
            <button onClick={readLine} className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-4 py-3 rounded-xl text-white" style={{ background: "var(--arbor-clay)" }}>
              {saved === "read" ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {saved === "read" ? "Saved" : "We read the sentence"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <LetterTrace onLog={onLog} />
      </div>

      <p className="text-[11px] mt-4" style={{ color: "var(--arbor-muted)" }}>
        Every sound said, word read and letter traced is logged to {first}'s record — it feeds the development trend and the report you can share with a professional. Reading ranges are typical, never deadlines.
      </p>
    </SectionCard>
  );
}
