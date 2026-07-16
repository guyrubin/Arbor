import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SectionCard, TrustSafetyBar, cardCls, Chip, type PastelKey } from "../ui/kit";
import { PlayShell, PlayHeader, PlayButton, ChoiceTile, ProgressPips, Celebrate } from "../ui/playkit";
import { BAND_LABEL, SOUND_LIBRARY, type SoundEntry } from "../../practice/content";
import { CATEGORY_ROUNDS, EXPRESS_PROMPTS, VOCAB_SETS } from "../../practice/playContent";
import { matchResult, speechDose, ageAppropriateSoundIds, isSoundAgeAppropriate } from "../../practice/signals";
import { scoreUtterance } from "../../lib/speechScorer";
import { usePracticeData } from "../../practice/usePracticeData";
import type { PracticeEvent, SpeechAttempt, SpeechLevel } from "../../types";
import { track } from "../../lib/analytics";
import EarlyReadingTrack from "./EarlyReadingTrack";

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

const LADDER: { level: SpeechLevel; labelKey: string; hintKey: string }[] = [
  { level: "word", labelKey: "prac.speech.ladder.word", hintKey: "prac.speech.ladder.word.hint" },
  { level: "sentence", labelKey: "prac.speech.ladder.sentence", hintKey: "prac.speech.ladder.sentence.hint" },
  { level: "story", labelKey: "prac.speech.ladder.story", hintKey: "prac.speech.ladder.story.hint" },
];

export default function SpeechCoachTab() {
  const { childProfile, setActiveTab, seedCoach } = useArbor();
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
  // Fire the daily-dose Celebrate once per session, only on the transition into "met".
  const [doseCelebrated, setDoseCelebrated] = useState(false);
  const doseMetPrev = useRef(false);

  useEffect(() => { setItemIdx(0); }, [soundId, level]);

  useEffect(() => {
    if (dose.sessionMetToday && !doseMetPrev.current && !doseCelebrated) setDoseCelebrated(true);
    doseMetPrev.current = dose.sessionMetToday;
  }, [dose.sessionMetToday, doseCelebrated]);

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
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        setRecState("review");
        // Cloud upgrade: if a child-ASR provider (SoapBox/Whisper) is configured,
        // score the recording for a more accurate result. Otherwise the on-device
        // Web Speech transcript above remains the result; parent scoring is the floor.
        if (level !== "story") {
          try {
            const score = await scoreUtterance({ target, sound: sound.id, level, audioBlob: blob });
            if (score && score.source === "cloud") {
              setHeard(score.heard ?? null);
              setAutoResult(score.result);
            }
          } catch { /* keep the on-device result */ }
        }
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
      setMicError(t("prac.speech.micError"));
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

  const savePracticeEvent = (kind: PracticeEvent["kind"], correct?: boolean, meta?: string, score?: number) => {
    const event: PracticeEvent = {
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      domain: "language",
      correct,
      score,
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
    seedCoach({ prompt, source: "speech-coach" });
  };

  const RESULT_BTN: { result: SpeechAttempt["result"]; labelKey: string; tone: PastelKey }[] = [
    { result: "got", labelKey: "prac.speech.result.got", tone: "mint" },
    { result: "almost", labelKey: "prac.speech.result.almost", tone: "yellow" },
    { result: "missed", labelKey: "prac.speech.result.missed", tone: "pink" },
  ];

  return (
    <PlayShell>
      <PlayHeader
        title={t("prac.speech.title")}
        say={t("prac.speech.sub", { name: first })}
        mood="happy"
        action={
          <button onClick={() => setActiveTab("language")} className="inline-flex items-center gap-1.5 text-xs font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
            <Icon name="translate" size={14} /> {t("prac.speech.switchLangCta")}
          </button>
        }
      />

      <TrustSafetyBar
        risk="Low"
        note={t("prac.speech.safetyNote", { name: first })}
      />

      {/* ASHA dosage: practice little and often (≈50 reps/session, 2–3×/week) */}
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-extrabold flex items-center gap-2" style={{ color: "var(--arbor-ink)" }}>
            <Icon name="graphic_eq" size={16} style={{ color: "var(--arbor-green-ink)" }} /> {t("prac.speech.dose.eyebrow")}
          </p>
          <Chip tone={dose.sessionMetToday ? "mint" : "yellow"}>
            {dose.sessionMetToday ? t("prac.speech.dose.done") : t("prac.speech.dose.count", { done: dose.trialsToday, target: dose.perSessionTarget })}
          </Chip>
        </div>
        <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "var(--arbor-paper-deep)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((dose.trialsToday / dose.perSessionTarget) * 100))}%`, background: "var(--arbor-clay)" }} />
        </div>
        <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>
          {t("prac.speech.dose.explainer", { perSession: dose.perSessionTarget, perWeek: dose.weeklySessionTarget })}
          {" "}{t("prac.speech.dose.weekPrefix")} <b style={{ color: dose.weeklyMet ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{t("prac.speech.dose.weekCount", { done: dose.sessionsThisWeek, target: dose.weeklySessionTarget })}</b>{dose.weeklyMet ? ` ${t("prac.speech.dose.consistent")}` : "."}
        </p>
      </div>

      {/* Daily-dose win beat — fires once per session when the dose is first met. */}
      {doseCelebrated && (
        <Celebrate
          title={t("prac.speech.doseWin.title")}
          subtitle={t("prac.speech.doseWin.sub", { name: first, target: dose.perSessionTarget })}
        >
          <PlayButton onClick={() => setDoseCelebrated(false)} variant="soft" tone="mint" size="md">
            {t("prac.speech.doseWin.cta")}
          </PlayButton>
        </Celebrate>
      )}

      {/* Sound Studio (feature 1): age-banded sound picker */}
      <SectionCard title={t("prac.speech.studio.title")} icon={<Icon name="graphic_eq" size={20} />} tone="mint">
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
                      className="play-pressable min-w-[52px] h-[52px] px-3 rounded-2xl text-base font-extrabold transition inline-flex items-center justify-center gap-1"
                      style={on
                        ? { background: "var(--arbor-clay)", color: "#fff", boxShadow: "0 6px 16px rgba(88,166,255,0.28)" }
                        : { background: "#fff", color: "var(--arbor-ink)", border: "2px solid var(--arbor-rule)", opacity: appropriate ? 1 : 0.5 }}
                      title={appropriate ? t("prac.speech.sound.tip", { label: s.label, age: s.typicalAge }) : t("prac.speech.sound.tipLate", { label: s.label, age: s.typicalAge, name: first })}
                    >
                      {s.id.toUpperCase()}
                      {st && st.attempts > 0 && (
                        <span className="text-[11px] font-bold" style={{ color: on ? "#fff" : st.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-yellow-ink)" }}>{st.recentAccuracy}%</span>
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
      <SectionCard title={`${sound.label} · ${sound.ipa}`} icon={<Icon name="mic" size={20} />} tone="sky"
        action={<Chip tone="sky">{t("prac.speech.typicalAge", { age: sound.typicalAge })}</Chip>}>
        <p className="text-xs rounded-xl p-3 mb-4" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
          <b>{t("prac.speech.modelLabel")}</b> {sound.cue}
        </p>

        {/* Ladder */}
        <div role="tablist" aria-label={t("prac.speech.ladder.aria")} className="flex gap-2 mb-4">
          {LADDER.map((l) => {
            const on = l.level === level;
            return (
              <button key={l.level} role="tab" aria-selected={on} onClick={() => setLevel(l.level)}
                className="rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold transition"
                style={on ? { background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                {t(l.labelKey)}
              </button>
            );
          })}
          <span className="self-center text-[11px] ms-1" style={{ color: "var(--arbor-muted)" }}>{t(LADDER.find((l) => l.level === level)?.hintKey ?? "")}</span>
        </div>

        {/* Target — the big, friendly say-it-together card */}
        <div className="rounded-[var(--play-radius-lg)] p-7 text-center mb-4" style={{ background: "linear-gradient(135deg, var(--arbor-sky-soft), #ffffff 75%)", border: "2px solid var(--arbor-sky-soft)" }}>
          <p className="text-[11px] uppercase font-extrabold tracking-wider mb-3" style={{ color: "var(--arbor-sky-ink)" }}>
            {level === "story" ? t("prac.speech.target.story") : t("prac.speech.target.together", { current: itemIdx + 1, total: items.length })}
          </p>
          <p className="font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", fontSize: level === "word" ? "3.4rem" : "1.6rem" }}>
            {target}
          </p>
          {level !== "story" && (
            <div className="flex justify-center gap-2.5 mt-5">
              <button onClick={() => setItemIdx((i) => Math.max(0, i - 1))} disabled={itemIdx === 0}
                className="play-pressable text-[13px] font-extrabold px-5 min-h-[44px] rounded-full disabled:opacity-40" style={{ background: "#fff", color: "var(--arbor-sky-ink)", border: "2px solid var(--arbor-sky-soft)" }}>
                {t("prac.speech.back")}
              </button>
              <button onClick={() => setItemIdx((i) => Math.min(items.length - 1, i + 1))} disabled={itemIdx >= items.length - 1}
                className="play-pressable text-[13px] font-extrabold px-5 min-h-[44px] rounded-full inline-flex items-center gap-1 disabled:opacity-40 text-white" style={{ background: "var(--arbor-sky-ink)" }}>
                {t("prac.speech.next")} <Icon name="chevron_right" size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Record & Compare (feature 2) */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {recState !== "recording" ? (
            <PlayButton onClick={() => void startRecording()} tone="peach">
              <Icon name="mic" size={20} /> {t("prac.speech.record", { name: first })}
            </PlayButton>
          ) : (
            <PlayButton onClick={stopRecording} tone="pink" className="animate-pulse">
              <Icon name="stop" size={20} /> {t("prac.speech.stop")}
            </PlayButton>
          )}
          {audioUrl && recState === "review" && (
            <span className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>
              <Icon name="play_arrow" size={14} style={{ color: "var(--arbor-green-ink)" }} />
              <audio src={audioUrl} controls className="h-8" />
            </span>
          )}
          {!recognitionAvailable && (
            <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="mic_off" size={12} className="inline me-1" />{t("prac.speech.noAutoListen")}
            </span>
          )}
        </div>
        {micError && <p className="text-[11px] mb-3" style={{ color: "var(--arbor-pink-ink)" }}>{micError}</p>}

        {heard && (
          <div className="rounded-xl p-3 mb-3 text-xs flex items-center gap-2" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>
            <Icon name="hearing" size={16} className="flex-shrink-0" />
            <span>{t("prac.speech.heardPrefix")} <b>&ldquo;{heard}&rdquo;</b>{autoResult && <> — {t("prac.speech.heardLooksLike")} <b>{autoResult === "got" ? t("prac.speech.heard.match") : autoResult === "almost" ? t("prac.speech.heard.close") : t("prac.speech.heard.different")}</b></>}</span>
            {autoResult && (
              <button onClick={() => saveAttempt(autoResult, "auto")}
                className="ms-auto font-extrabold text-white rounded-full px-3 py-1" style={{ background: "var(--arbor-sky-ink)" }}>
                {t("prac.speech.saveScore")}
              </button>
            )}
          </div>
        )}

        {/* Parent scoring — the universal floor */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>{t("prac.speech.howDidItSound")}</span>
          {RESULT_BTN.map((b) => (
            <button key={b.result} onClick={() => saveAttempt(b.result, "parent")}
              className="text-xs font-extrabold px-3.5 py-2 rounded-xl transition"
              style={{ background: b.tone === "mint" ? "var(--arbor-green-soft)" : b.tone === "yellow" ? "var(--arbor-yellow-soft)" : "var(--arbor-pink-soft)", color: b.tone === "mint" ? "var(--arbor-green-ink)" : b.tone === "yellow" ? "var(--arbor-yellow-ink)" : "var(--arbor-pink-ink)" }}>
              {t(b.labelKey)}
            </button>
          ))}
          {lastSaved && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-clay)" }}>
              <Icon name="check" size={14} /> {t("prac.read.saved")}
            </span>
          )}
        </div>
      </SectionCard>

      {/* Vocabulary expansion + expressive language (Epic 3) */}
      <SectionCard title={t("prac.lang.title")} icon={<Icon name="menu_book" size={20} />} tone="mint"
        action={<Chip tone="mint">{t("prac.lang.chip")}</Chip>}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={`${cardCls} p-4`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Icon name="sell" size={16} style={{ color: "var(--arbor-green-ink)" }} />
                <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("prac.lang.naming.title")}</p>
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
              <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>{t("prac.lang.naming.ask", { name: first })}</p>
            </div>
            <button onClick={markNamed} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-clay)" }}>
              {languageSaved === "vocab-naming" ? <Icon name="check" size={14} /> : <Icon name="auto_awesome" size={14} />}
              {languageSaved === "vocab-naming" ? t("prac.read.saved") : t("prac.lang.naming.cta")}
            </button>
          </div>

          <div className={`${cardCls} p-4`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Icon name="sell" size={16} style={{ color: "var(--arbor-sky-ink)" }} />
                <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("prac.lang.category.title")}</p>
              </div>
              <Chip tone="sky">{t("prac.lang.category.count", { current: categoryIdx + 1, total: CATEGORY_ROUNDS.length })}</Chip>
            </div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{categoryRound.question}</p>
              <ProgressPips total={CATEGORY_ROUNDS.length} current={categoryIdx % CATEGORY_ROUNDS.length} tone="sky" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {categoryRound.options.map((option, idx) => {
                const picked = categoryPick === idx;
                // idle before a pick; after a pick: picked → correct/wrong,
                // the right answer → correct (reveal), everything else → dim.
                const state: "idle" | "correct" | "wrong" | "dim" =
                  categoryPick === null
                    ? "idle"
                    : picked
                      ? option.correct ? "correct" : "wrong"
                      : option.correct
                        ? "correct"
                        : "dim";
                return (
                  <ChoiceTile
                    key={`${categoryRound.id}-${option.word}`}
                    emoji={option.emoji}
                    label={option.word}
                    onClick={() => chooseCategory(idx)}
                    disabled={categoryPick !== null}
                    state={state}
                  />
                );
              })}
            </div>
            {categoryPick !== null && (
              <div className="mt-3 rounded-2xl p-3 flex items-center gap-3" style={{ background: categoryRound.options[categoryPick].correct ? "var(--arbor-green-soft)" : "var(--arbor-yellow-soft)" }}>
                <p className="text-[11px] flex-1" style={{ color: "var(--arbor-ink)" }}>
                  {categoryRound.options[categoryPick].correct ? t("prac.lang.category.correct") : t("prac.lang.category.wrong")}
                </p>
                <button onClick={nextCategory} className="text-[11px] font-extrabold px-3 py-1.5 rounded-xl text-white" style={{ background: "var(--arbor-sky-ink)" }}>
                  {t("prac.speech.next")}
                </button>
              </div>
            )}
          </div>

          <div className={`${cardCls} p-4`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Icon name="chat_bubble" size={16} style={{ color: "var(--arbor-peach-ink)" }} />
                <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("prac.lang.express.title")}</p>
              </div>
              <Chip tone="coral">{expressPrompt.kind.replace("-", " ")}</Chip>
            </div>
            <div className="rounded-2xl p-5" style={{ background: "var(--arbor-paper-deep)" }}>
              <p className="text-4xl">{expressPrompt.emoji}</p>
              <p className="text-base font-extrabold mt-3 leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {fillChild(expressPrompt.prompt)}
              </p>
              <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--arbor-muted)" }}><b>{t("prac.lang.express.tipLabel")}</b> {expressPrompt.parentTip}</p>
            </div>
            <button onClick={completeExpress} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-peach-ink)" }}>
              {languageSaved === "expressive" ? <Icon name="check" size={14} /> : <Icon name="auto_awesome" size={14} />}
              {languageSaved === "expressive" ? t("prac.read.saved") : t("prac.lang.express.cta")}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Early reading + letter tracing (Mission M7) — articulation → phonics →
          sight words → reading, age-gated, plus the finger letter-trace game. */}
      <EarlyReadingTrack age={childProfile.age} first={first} onLog={savePracticeEvent} />

      {/* Sound Progress Tracking (feature 3) */}
      <SectionCard title={t("prac.speech.progress.title", { name: first })} icon={<Icon name="trending_up" size={20} />} tone="lav"
        action={
          <button onClick={() => askCoach(t("prac.speech.progress.coachPrompt", { name: first, age: childProfile.age, sound: sound.label, score: statForActive?.recentAccuracy ?? 0, level }))}
            className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
            <Icon name="auto_awesome" size={14} /> {t("prac.speech.progress.coachCta")}
          </button>
        }>
        {data.stats.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>
            {t("prac.speech.progress.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.stats.map((s) => {
              const entry = SOUND_LIBRARY.find((x) => x.id === s.sound);
              const trendIconName = s.trend === "up" ? "trending_up" : s.trend === "down" ? "trending_down" : "remove";
              return (
                <div key={s.sound} className={`${cardCls} p-4 flex items-center gap-4`}>
                  <span className="text-xl font-extrabold w-10 text-center" style={{ color: "var(--arbor-lav-ink)" }}>{s.sound.toUpperCase()}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{entry?.label ?? s.sound}</p>
                    <div className="h-2 rounded-full mt-1.5" style={{ background: "rgba(41,51,63,0.08)" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${s.recentAccuracy}%`, background: s.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-yellow)" }} />
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "var(--arbor-muted)" }}>
                      {t("prac.speech.progress.stat", { tries: s.attempts, accuracy: s.recentAccuracy, level: s.levelReached })}
                    </p>
                  </div>
                  <Icon name={trendIconName} size={16} className="flex-shrink-0" style={{ color: s.trend === "up" ? "var(--arbor-clay)" : s.trend === "down" ? "var(--arbor-pink-ink)" : "var(--arbor-muted)" }} />
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] mt-4" style={{ color: "var(--arbor-muted)" }}>
          {t("prac.speech.progress.footer")}
        </p>
      </SectionCard>
    </PlayShell>
  );
}
