import React, { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, BookOpen, Check, ChevronRight, Ear, Languages, MessageCircle, Mic, MicOff, Play, Sparkles, Square, Tags, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SectionCard, TrustSafetyBar, cardCls, Chip, type PastelKey } from "../ui/kit";
import { PlayShell, PlayHeader, PlayButton } from "../ui/playkit";
import { BAND_LABEL, SOUND_LIBRARY, type SoundEntry } from "../../practice/content";
import { CATEGORY_ROUNDS, EXPRESS_PROMPTS, VOCAB_SETS } from "../../practice/playContent";
import { matchResult, speechDose, ageAppropriateSoundIds, isSoundAgeAppropriate } from "../../practice/signals";
import { usePracticeData } from "../../practice/usePracticeData";
import type { PracticeEvent, SpeechAttempt, SpeechLevel } from "../../types";
import { track } from "../../lib/analytics";

/* Minimal typing for the (vendor-prefixed) Web Speech API. */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as new () => SpeechRecognitionLike) || (w.webkitSpeechRecognition as new () => SpeechRecognitionLike) || null;
}

const LADDER: { level: SpeechLevel; label: string; hint: string }[] = [
  { level: "word", label: "Words", hint: "One word at a time — the foundation." },
  { level: "sentence", label: "Sentences", hint: "The sound inside real sentences." },
  { level: "story", label: "Story", hint: "Carry the sound through free talk." },
];

export default function SpeechCoachTab() {
  const { childProfile, setChatInput, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const data = usePracticeData(childProfile.id);
  const first = childProfile.name.split(" ")[0];

  // Default sound: the first age-appropriate sound (ASHA-gated) not yet strong.
  const defaultSound = useMemo(() => {
    const appropriate = new Set(ageAppropriateSoundIds(SOUND_LIBRARY, childProfile.age));
    const practiced = new Map(data.stats.map((s) => [s.sound, s]));
    const candidates = SOUND_LIBRARY.filter((s) => appropriate.has(s.id));
    const unfinished = candidates.find((s) => (practiced.get(s.id)?.recentAccuracy ?? 0) < 80);
    return (unfinished ?? candidates[0] ?? SOUND_LIBRARY[0]).id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.age]);

  // ASHA dosage: ~50 production trials/session, 2–3 sessions/week.
  const dose = useMemo(() => speechDose(data.speech.items, data.today), [data.speech.items, data.today]);

  const [soundId, setSoundId] = useState<string>(defaultSound);
  const sound: SoundEntry = SOUND_LIBRARY.find((s) => s.id === soundId) ?? SOUND_LIBRARY[0];
  const [level, setLevel] = useState<SpeechLevel>("word");
  const [itemIdx, setItemIdx] = useState(0);
  const [vocabSetId, setVocabSetId] = useState(VOCAB_SETS[0].id);
  const [vocabIdx, setVocabIdx] = useState(0);
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [categoryPick, setCategoryPick] = useState<number | null>(null);
  const [expressIdx, setExpressIdx] = useState(0);
  const [languageSaved, setLanguageSaved] = useState<string | null>(null);

  useEffect(() => { setItemIdx(0); }, [soundId, level]);

  const items = level === "word" ? sound.words : level === "sentence" ? sound.sentences : [sound.storyPrompt];
  const target = items[Math.min(itemIdx, items.length - 1)];
  const vocabSet = VOCAB_SETS.find((s) => s.id === vocabSetId) ?? VOCAB_SETS[0];
  const vocabItem = vocabSet.items[vocabIdx % vocabSet.items.length];
  const categoryRound = CATEGORY_ROUNDS[categoryIdx % CATEGORY_ROUNDS.length];
  const expressPrompt = EXPRESS_PROMPTS[expressIdx % EXPRESS_PROMPTS.length];
  const fillChild = (text: string) => text.replace(/\{name\}/g, first);

  // ---- Record & Compare (feature 2). Audio stays on-device; only scores persist. ----
  const [recState, setRecState] = useState<"idle" | "recording" | "review">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [autoResult, setAutoResult] = useState<SpeechAttempt["result"] | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<SpeechAttempt["result"] | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionAvailable = useMemo(() => getRecognitionCtor() !== null, []);

  const cleanupAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  };

  useEffect(() => () => {
    // Unmount: stop any live capture and free the blob URL.
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    recogRef.current?.abort();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    setMicError(null);
    setHeard(null);
    setAutoResult(null);
    setLastSaved(null);
    cleanupAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        setRecState("review");
      };
      mediaRef.current = rec;
      rec.start();
      setRecState("recording");

      const Ctor = getRecognitionCtor();
      if (Ctor && level !== "story") {
        const recog = new Ctor();
        recog.lang = "en-US";
        recog.interimResults = false;
        recog.maxAlternatives = 1;
        recog.onresult = (e) => {
          const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i][0]?.transcript ?? "").join(" ").trim();
          if (transcript) {
            setHeard(transcript);
            setAutoResult(matchResult(target, transcript).result);
          }
        };
        recog.onerror = () => { /* recognition is best-effort; parent scoring is the floor */ };
        recog.onend = () => { recogRef.current = null; };
        recogRef.current = recog;
        recog.start();
      }
    } catch {
      setMicError("Microphone unavailable. You can still practice out loud and score it yourself below.");
      setRecState("idle");
    }
  };

  const stopRecording = () => {
    recogRef.current?.stop();
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
    else setRecState("idle");
  };

  const saveAttempt = (result: SpeechAttempt["result"], method: SpeechAttempt["method"]) => {
    const attempt: SpeechAttempt = {
      id: `sp-${Date.now()}`,
      sound: sound.id,
      level,
      target,
      result,
      method,
      heard: method === "auto" && heard ? heard : undefined,
      timestamp: new Date().toISOString(),
    };
    void data.speech.upsert(attempt);
    setLastSaved(result);
    setRecState("idle");
    setHeard(null);
    setAutoResult(null);
    cleanupAudio();
    track("speech_attempt", { sound: sound.id, level, result, method });
    if (result === "got" && itemIdx < items.length - 1) setItemIdx((i) => i + 1);
  };

  const savePracticeEvent = (kind: PracticeEvent["kind"], correct?: boolean, meta?: string) => {
    const event: PracticeEvent = {
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      domain: "language",
      correct,
      meta,
      timestamp: new Date().toISOString(),
    };
    void data.events.upsert(event);
    setLanguageSaved(kind);
    window.setTimeout(() => setLanguageSaved(null), 1400);
    track("practice_event", { kind, domain: "language", correct });
  };

  const markNamed = () => {
    savePracticeEvent("vocab-naming", true, `${vocabSet.id}:${vocabItem.word}`);
    setVocabIdx((i) => (i + 1) % vocabSet.items.length);
  };

  const chooseCategory = (idx: number) => {
    if (categoryPick !== null) return;
    setCategoryPick(idx);
    const option = categoryRound.options[idx];
    savePracticeEvent("vocab-category", option.correct, categoryRound.id);
  };

  const nextCategory = () => {
    setCategoryIdx((i) => (i + 1) % CATEGORY_ROUNDS.length);
    setCategoryPick(null);
  };

  const completeExpress = () => {
    savePracticeEvent("expressive", true, expressPrompt.id);
    setExpressIdx((i) => (i + 1) % EXPRESS_PROMPTS.length);
  };

  // ---- Per-sound progress (feature 3) ----
  const statForActive = data.stats.find((s) => s.sound === sound.id);
  const bands: SoundEntry["band"][] = ["early", "middle", "late"];

  const askCoach = (prompt: string) => {
    setChatInput(prompt);
    setActiveTab("coach");
  };

  const RESULT_BTN: { result: SpeechAttempt["result"]; label: string; tone: PastelKey }[] = [
    { result: "got", label: "Got it!", tone: "mint" },
    { result: "almost", label: "Almost", tone: "yellow" },
    { result: "missed", label: "Try again later", tone: "pink" },
  ];

  return (
    <PlayShell>
      <PlayHeader
        title={t("prac.speech.title")}
        say={t("prac.speech.sub", { name: first })}
        mood="happy"
        action={
          <button onClick={() => setActiveTab("language")} className="inline-flex items-center gap-1.5 text-xs font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
            <Languages className="w-3.5 h-3.5" /> Multiple languages? Language &amp; Communication
          </button>
        }
      />

      <TrustSafetyBar
        risk="Low"
        note={`Sound ages are typical ranges, not deadlines. If you're concerned about ${first}'s speech, the right next step is a speech-language professional — Arbor can prepare the report.`}
      />

      {/* ASHA dosage: practice little and often (≈50 reps/session, 2–3×/week) */}
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--arbor-ink)" }}>
            <AudioLines className="w-4 h-4" style={{ color: "var(--arbor-green-ink)" }} /> Today&apos;s practice dose
          </p>
          <Chip tone={dose.sessionMetToday ? "mint" : "yellow"}>
            {dose.sessionMetToday ? "Today's dose done 🎉" : `${dose.trialsToday}/${dose.perSessionTarget} reps`}
          </Chip>
        </div>
        <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "var(--arbor-paper-deep)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((dose.trialsToday / dose.perSessionTarget) * 100))}%`, background: "var(--arbor-clay)" }} />
        </div>
        <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>
          Speech practice works best little and often — about {dose.perSessionTarget} gentle repetitions a session, {dose.weeklySessionTarget}× a week (ASHA guidance).
          {" "}This week: <b style={{ color: dose.weeklyMet ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{dose.sessionsThisWeek}/{dose.weeklySessionTarget} sessions</b>{dose.weeklyMet ? " — nicely consistent." : "."}
        </p>
      </div>

      {/* Sound Studio (feature 1): age-banded sound picker */}
      <SectionCard title="Pick today's sound" icon={<AudioLines className="w-5 h-5" />} tone="mint">
        <div className="space-y-4">
          {bands.map((band) => (
            <div key={band}>
              <p className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--arbor-muted)" }}>{BAND_LABEL[band]}</p>
              <div className="flex flex-wrap gap-2">
                {SOUND_LIBRARY.filter((s) => s.band === band).map((s) => {
                  const on = s.id === soundId;
                  const st = data.stats.find((x) => x.sound === s.id);
                  const appropriate = isSoundAgeAppropriate(s.band, childProfile.age);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSoundId(s.id)}
                      className="rounded-2xl px-3 py-2 text-xs font-extrabold transition"
                      style={on
                        ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-clay)" }
                        : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)", opacity: appropriate ? 1 : 0.5 }}
                      title={appropriate ? `${s.label} · typical ${s.typicalAge}` : `${s.label} · typically emerges ${s.typicalAge} — usually later than ${first}'s age, so go gently`}
                    >
                      {s.id.toUpperCase()}
                      {!appropriate && <span className="ml-1" aria-hidden="true">·</span>}
                      {st && st.attempts > 0 && (
                        <span className="ml-1.5 font-bold" style={{ color: st.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-yellow-ink)" }}>{st.recentAccuracy}%</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Practice card: ladder + record & compare */}
      <SectionCard title={`${sound.label} · ${sound.ipa}`} icon={<Mic className="w-5 h-5" />} tone="sky"
        action={<Chip tone="sky">Typical {sound.typicalAge}</Chip>}>
        <p className="text-xs rounded-xl p-3 mb-4" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
          <b>How to model it:</b> {sound.cue}
        </p>

        {/* Ladder */}
        <div role="tablist" aria-label="Practice level" className="flex gap-2 mb-4">
          {LADDER.map((l) => {
            const on = l.level === level;
            return (
              <button key={l.level} role="tab" aria-selected={on} onClick={() => setLevel(l.level)}
                className="rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold transition"
                style={on ? { background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                {l.label}
              </button>
            );
          })}
          <span className="self-center text-[11px] ml-1" style={{ color: "var(--arbor-muted)" }}>{LADDER.find((l) => l.level === level)?.hint}</span>
        </div>

        {/* Target */}
        <div className={`${cardCls} p-6 text-center mb-4`} style={{ background: "var(--arbor-paper-deep)" }}>
          <p className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--arbor-muted)" }}>
            {level === "story" ? "Story time" : `Say it together — ${itemIdx + 1} of ${items.length}`}
          </p>
          <p className="font-extrabold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", fontSize: level === "word" ? "2.2rem" : "1.25rem" }}>
            {target}
          </p>
          {level !== "story" && (
            <div className="flex justify-center gap-2 mt-3">
              <button onClick={() => setItemIdx((i) => Math.max(0, i - 1))} disabled={itemIdx === 0}
                className="text-[11px] font-bold px-3 py-1.5 rounded-xl disabled:opacity-40" style={{ background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                Back
              </button>
              <button onClick={() => setItemIdx((i) => Math.min(items.length - 1, i + 1))} disabled={itemIdx >= items.length - 1}
                className="text-[11px] font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1 disabled:opacity-40" style={{ background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Record & Compare (feature 2) */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {recState !== "recording" ? (
            <PlayButton onClick={() => void startRecording()} tone="peach">
              <Mic className="w-5 h-5" /> Record {first}
            </PlayButton>
          ) : (
            <PlayButton onClick={stopRecording} tone="pink" className="animate-pulse">
              <Square className="w-5 h-5" /> Stop
            </PlayButton>
          )}
          {audioUrl && recState === "review" && (
            <span className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>
              <Play className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} />
              <audio src={audioUrl} controls className="h-8" />
            </span>
          )}
          {!recognitionAvailable && (
            <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>
              <MicOff className="w-3 h-3 inline mr-1" />Auto-listening isn't supported in this browser — you be the judge below.
            </span>
          )}
        </div>
        {micError && <p className="text-[11px] mb-3" style={{ color: "var(--arbor-pink-ink)" }}>{micError}</p>}

        {heard && (
          <div className="rounded-xl p-3 mb-3 text-xs flex items-center gap-2" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>
            <Ear className="w-4 h-4 flex-shrink-0" />
            <span>Arbor heard: <b>&ldquo;{heard}&rdquo;</b>{autoResult && <> — looks like <b>{autoResult === "got" ? "a match!" : autoResult === "almost" ? "a close try" : "a different word"}</b></>}</span>
            {autoResult && (
              <button onClick={() => saveAttempt(autoResult, "auto")}
                className="ml-auto font-extrabold text-white rounded-full px-3 py-1" style={{ background: "var(--arbor-sky-ink)" }}>
                Save this score
              </button>
            )}
          </div>
        )}

        {/* Parent scoring — the universal floor */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>How did it sound?</span>
          {RESULT_BTN.map((b) => (
            <button key={b.result} onClick={() => saveAttempt(b.result, "parent")}
              className="text-xs font-extrabold px-3.5 py-2 rounded-xl transition"
              style={{ background: b.tone === "mint" ? "var(--arbor-green-soft)" : b.tone === "yellow" ? "var(--arbor-yellow-soft)" : "var(--arbor-pink-soft)", color: b.tone === "mint" ? "var(--arbor-green-ink)" : b.tone === "yellow" ? "var(--arbor-yellow-ink)" : "var(--arbor-pink-ink)" }}>
              {b.label}
            </button>
          ))}
          {lastSaved && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-clay)" }}>
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
      </SectionCard>

      {/* Vocabulary expansion + expressive language (Epic 3) */}
      <SectionCard title="Words & Express" icon={<BookOpen className="w-5 h-5" />} tone="mint"
        action={<Chip tone="mint">Language practice</Chip>}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={`${cardCls} p-4`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Tags className="w-4 h-4" style={{ color: "var(--arbor-green-ink)" }} />
                <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>Object naming</p>
              </div>
              <Chip tone="mint">{vocabSet.category}</Chip>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {VOCAB_SETS.map((set) => (
                <button
                  key={set.id}
                  onClick={() => { setVocabSetId(set.id); setVocabIdx(0); }}
                  className="rounded-full px-3 py-1.5 text-[11px] font-extrabold"
                  style={set.id === vocabSetId ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
                >
                  {set.emoji} {set.category}
                </button>
              ))}
            </div>
            <div className="rounded-2xl p-5 text-center" style={{ background: "var(--arbor-paper-deep)" }}>
              <p className="text-5xl">{vocabItem.emoji}</p>
              <p className="text-xl font-extrabold mt-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{vocabItem.word}</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Ask {first}: "What is this?" Then expand one word into a short sentence.</p>
            </div>
            <button onClick={markNamed} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-clay)" }}>
              {languageSaved === "vocab-naming" ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {languageSaved === "vocab-naming" ? "Saved" : "Named it"}
            </button>
          </div>

          <div className={`${cardCls} p-4`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Tags className="w-4 h-4" style={{ color: "var(--arbor-sky-ink)" }} />
                <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>Category pick</p>
              </div>
              <Chip tone="sky">{categoryIdx + 1} of {CATEGORY_ROUNDS.length}</Chip>
            </div>
            <p className="text-sm font-extrabold mb-3" style={{ color: "var(--arbor-ink)" }}>{categoryRound.question}</p>
            <div className="grid grid-cols-3 gap-2">
              {categoryRound.options.map((option, idx) => {
                const picked = categoryPick === idx;
                return (
                  <button
                    key={`${categoryRound.id}-${option.word}`}
                    onClick={() => chooseCategory(idx)}
                    disabled={categoryPick !== null}
                    className={`${cardCls} p-3 text-center transition`}
                    style={{ border: picked ? `2px solid ${option.correct ? "var(--arbor-clay)" : "var(--arbor-pink-ink)"}` : "1px solid rgba(41,51,63,0.06)" }}
                  >
                    <span className="text-3xl block">{option.emoji}</span>
                    <span className="text-[11px] font-bold block mt-1" style={{ color: "var(--arbor-ink)" }}>{option.word}</span>
                  </button>
                );
              })}
            </div>
            {categoryPick !== null && (
              <div className="mt-3 rounded-2xl p-3 flex items-center gap-3" style={{ background: categoryRound.options[categoryPick].correct ? "var(--arbor-green-soft)" : "var(--arbor-yellow-soft)" }}>
                <p className="text-[11px] flex-1" style={{ color: "var(--arbor-ink)" }}>
                  {categoryRound.options[categoryPick].correct ? "Nice sorting. Name one more thing in that category." : "Warm retry: talk through why the correct one belongs."}
                </p>
                <button onClick={nextCategory} className="text-[11px] font-extrabold px-3 py-1.5 rounded-xl text-white" style={{ background: "var(--arbor-sky-ink)" }}>
                  Next
                </button>
              </div>
            )}
          </div>

          <div className={`${cardCls} p-4`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" style={{ color: "var(--arbor-peach-ink)" }} />
                <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>Express mode</p>
              </div>
              <Chip tone="coral">{expressPrompt.kind.replace("-", " ")}</Chip>
            </div>
            <div className="rounded-2xl p-5" style={{ background: "var(--arbor-paper-deep)" }}>
              <p className="text-4xl">{expressPrompt.emoji}</p>
              <p className="text-base font-extrabold mt-3 leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {fillChild(expressPrompt.prompt)}
              </p>
              <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--arbor-muted)" }}><b>Parent tip:</b> {expressPrompt.parentTip}</p>
            </div>
            <button onClick={completeExpress} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-peach-ink)" }}>
              {languageSaved === "expressive" ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {languageSaved === "expressive" ? "Saved" : "We answered it"}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Sound Progress Tracking (feature 3) */}
      <SectionCard title={`${first}'s sound progress`} icon={<TrendingUp className="w-5 h-5" />} tone="lav"
        action={
          <button onClick={() => askCoach(`${first} (age ${childProfile.age}) is practicing the ${sound.label} sound and currently scores ${statForActive?.recentAccuracy ?? 0}% on recent tries at the ${level} level. Give me one playful way to practice it during daily routines this week, and what 'normal progress' looks like.`)}
            className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
            <Sparkles className="w-3.5 h-3.5" /> Coach me on this sound
          </button>
        }>
        {data.stats.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>
            No practice yet — every scored try lands here, builds the trend, and feeds the report you can share with a speech professional.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.stats.map((s) => {
              const entry = SOUND_LIBRARY.find((x) => x.id === s.sound);
              const TrendIcon = s.trend === "up" ? TrendingUp : s.trend === "down" ? TrendingDown : Minus;
              return (
                <div key={s.sound} className={`${cardCls} p-4 flex items-center gap-4`}>
                  <span className="text-xl font-extrabold w-10 text-center" style={{ color: "var(--arbor-lav-ink)" }}>{s.sound.toUpperCase()}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{entry?.label ?? s.sound}</p>
                    <div className="h-2 rounded-full mt-1.5" style={{ background: "rgba(41,51,63,0.08)" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${s.recentAccuracy}%`, background: s.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-yellow)" }} />
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "var(--arbor-muted)" }}>
                      {s.attempts} tries · recent {s.recentAccuracy}% · reached {s.levelReached} level
                    </p>
                  </div>
                  <TrendIcon className="w-4 h-4 flex-shrink-0" style={{ color: s.trend === "up" ? "var(--arbor-clay)" : s.trend === "down" ? "var(--arbor-pink-ink)" : "var(--arbor-muted)" }} />
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] mt-4" style={{ color: "var(--arbor-muted)" }}>
          This trend is included in professional reports (Care Network → Reports &amp; Handoffs) so a speech-language professional sees real between-session data.
        </p>
      </SectionCard>
    </PlayShell>
  );
}
