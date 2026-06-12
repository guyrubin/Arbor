import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { AudioLines, Check, ChevronRight, Ear, Mic, MicOff, Play, Sparkles, Square, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { PageHeader, SectionCard, TrustSafetyBar, cardCls, Chip, type PastelKey } from "../ui/kit";
import { BAND_LABEL, SOUND_LIBRARY, type SoundEntry } from "../../practice/content";
import { matchResult } from "../../practice/signals";
import { usePracticeData } from "../../practice/usePracticeData";
import type { SpeechAttempt, SpeechLevel } from "../../types";
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
  const data = usePracticeData(childProfile.id);
  const first = childProfile.name.split(" ")[0];

  // Default sound: the band matching the child's age, first sound not yet strong.
  const defaultSound = useMemo(() => {
    const band = childProfile.age <= 3 ? "early" : childProfile.age <= 4 ? "middle" : "late";
    const practiced = new Map(data.stats.map((s) => [s.sound, s]));
    const candidates = SOUND_LIBRARY.filter((s) => s.band === band);
    const unfinished = candidates.find((s) => (practiced.get(s.id)?.recentAccuracy ?? 0) < 80);
    return (unfinished ?? candidates[0] ?? SOUND_LIBRARY[0]).id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.age]);

  const [soundId, setSoundId] = useState<string>(defaultSound);
  const sound: SoundEntry = SOUND_LIBRARY.find((s) => s.id === soundId) ?? SOUND_LIBRARY[0];
  const [level, setLevel] = useState<SpeechLevel>("word");
  const [itemIdx, setItemIdx] = useState(0);

  useEffect(() => { setItemIdx(0); }, [soundId, level]);

  const items = level === "word" ? sound.words : level === "sentence" ? sound.sentences : [sound.storyPrompt];
  const target = items[Math.min(itemIdx, items.length - 1)];

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
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Practice Studio"
        title="Speech Coach"
        subtitle={`Playful articulation practice for ${first} — one sound, a few minutes, from single words up to stories. Recordings never leave this device.`}
      />

      <TrustSafetyBar
        risk="Low"
        note={`Sound ages are typical ranges, not deadlines. If you're concerned about ${first}'s speech, the right next step is a speech-language professional — Arbor can prepare the report.`}
      />

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
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSoundId(s.id)}
                      className="rounded-2xl px-3 py-2 text-xs font-extrabold transition"
                      style={on ? { background: "#e4f4ec", color: "#1f8a5a", border: "1px solid #34b277" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                      title={`${s.label} · typical ${s.typicalAge}`}
                    >
                      {s.id.toUpperCase()}
                      {st && st.attempts > 0 && (
                        <span className="ml-1.5 font-bold" style={{ color: st.recentAccuracy >= 70 ? "#34b277" : "#a9780f" }}>{st.recentAccuracy}%</span>
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
                style={on ? { background: "#e5f0fb", color: "#2f7bbf" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
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
            <button onClick={() => void startRecording()}
              className="inline-flex items-center gap-2 font-extrabold text-xs px-4 py-2.5 rounded-xl text-white transition"
              style={{ background: "#cf6f37" }}>
              <Mic className="w-4 h-4" /> Record {first}
            </button>
          ) : (
            <button onClick={stopRecording}
              className="inline-flex items-center gap-2 font-extrabold text-xs px-4 py-2.5 rounded-xl text-white animate-pulse"
              style={{ background: "#bd4f74" }}>
              <Square className="w-4 h-4" /> Stop
            </button>
          )}
          {audioUrl && recState === "review" && (
            <span className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>
              <Play className="w-3.5 h-3.5" style={{ color: "#1f8a5a" }} />
              <audio src={audioUrl} controls className="h-8" />
            </span>
          )}
          {!recognitionAvailable && (
            <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>
              <MicOff className="w-3 h-3 inline mr-1" />Auto-listening isn't supported in this browser — you be the judge below.
            </span>
          )}
        </div>
        {micError && <p className="text-[11px] mb-3" style={{ color: "#bd4f74" }}>{micError}</p>}

        {heard && (
          <div className="rounded-xl p-3 mb-3 text-xs flex items-center gap-2" style={{ background: "#e5f0fb", color: "#2f7bbf" }}>
            <Ear className="w-4 h-4 flex-shrink-0" />
            <span>Arbor heard: <b>&ldquo;{heard}&rdquo;</b>{autoResult && <> — looks like <b>{autoResult === "got" ? "a match!" : autoResult === "almost" ? "a close try" : "a different word"}</b></>}</span>
            {autoResult && (
              <button onClick={() => saveAttempt(autoResult, "auto")}
                className="ml-auto font-extrabold text-white rounded-full px-3 py-1" style={{ background: "#2f7bbf" }}>
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
              style={{ background: b.tone === "mint" ? "#e4f4ec" : b.tone === "yellow" ? "#fbf1d4" : "#fce2ec", color: b.tone === "mint" ? "#1f8a5a" : b.tone === "yellow" ? "#a9780f" : "#bd4f74" }}>
              {b.label}
            </button>
          ))}
          {lastSaved && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "#34b277" }}>
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
      </SectionCard>

      {/* Sound Progress Tracking (feature 3) */}
      <SectionCard title={`${first}'s sound progress`} icon={<TrendingUp className="w-5 h-5" />} tone="lav"
        action={
          <button onClick={() => askCoach(`${first} (age ${childProfile.age}) is practicing the ${sound.label} sound and currently scores ${statForActive?.recentAccuracy ?? 0}% on recent tries at the ${level} level. Give me one playful way to practice it during daily routines this week, and what 'normal progress' looks like.`)}
            className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition" style={{ background: "#ece9fb", color: "#6354c4" }}>
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
                  <span className="text-xl font-extrabold w-10 text-center" style={{ color: "#6354c4" }}>{s.sound.toUpperCase()}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{entry?.label ?? s.sound}</p>
                    <div className="h-2 rounded-full mt-1.5" style={{ background: "rgba(41,51,63,0.08)" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${s.recentAccuracy}%`, background: s.recentAccuracy >= 70 ? "#34b277" : "#d7aa55" }} />
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "var(--arbor-muted)" }}>
                      {s.attempts} tries · recent {s.recentAccuracy}% · reached {s.levelReached} level
                    </p>
                  </div>
                  <TrendIcon className="w-4 h-4 flex-shrink-0" style={{ color: s.trend === "up" ? "#34b277" : s.trend === "down" ? "#bd4f74" : "var(--arbor-muted)" }} />
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] mt-4" style={{ color: "var(--arbor-muted)" }}>
          This trend is included in professional reports (Care Network → Reports &amp; Handoffs) so a speech-language professional sees real between-session data.
        </p>
      </SectionCard>
    </motion.div>
  );
}
