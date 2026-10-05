import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SectionCard, TrustSafetyBar, cardCls } from "../ui/kit";
import { RegisterShell, Celebrate, ChoiceTile, MascotSay, PlayButton, PlayPanel, ProgressPips } from "../ui/playkit";
import { BREATHING_PATTERNS, CALM_TOOLS, EMOTION_SCENARIOS, EMOTIONS, type Emotion } from "../../practice/playContent";
import { usePracticeData } from "../../practice/usePracticeData";
import { EmotionAvatar } from "../ui/EmotionAvatar";
import { resolveHeroUrl } from "../ui/HeroAvatar";
import { ArborMascot } from "../ui/ArborMascot";
import type { PracticeEvent } from "../../types";

import { track } from "../../lib/analytics";
import { isKidModeActive, noteKidActivity, subscribeKidMode } from "../../lib/kidModeGate";
import { SpeakButton } from "../ui/SpeakButton";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
const HEBREW_EMOTION_LABELS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(EMOTION_SCENARIOS.map((scenario) => [scenario.answer, scenario.answerLabelHe])),
);

function emotionLabelFor(emotion: Emotion, uiLang: string): string {
  return uiLang === "he" ? HEBREW_EMOTION_LABELS[emotion.id] ?? emotion.label : emotion.label;
}

/** B-KID-29: one Mood Mountain climb = this many answers, then a finish. */
export const MOOD_CLIMB = 5;
const eventId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Each feeling gets a calm tone for the avatar's aura.
const EMOTION_TONE: Record<string, string> = {
  happy: "var(--arbor-yellow-ink)",
  excited: "var(--arbor-peach-ink)",
  sad: "var(--arbor-sky-ink)",
  afraid: "var(--arbor-lav-ink)",
  angry: "var(--arbor-pink-ink)",
  frustrated: "var(--arbor-pink-ink)",
};

export default function FeelingsLabTab() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const data = usePracticeData(childProfile.id);
  const first = childProfile.name.split(" ")[0];
  // M1 hero-first: the self-check companion is the HERO, never the raw upload.
  // The profile's stored photo used to be passed straight through here, so a
  // child with a real photo and `avatar: null` saw their own face mirrored back
  // as a game character — the exact case resolveHeroUrl exists to refuse. With
  // no hero the value is null and the companion falls back to Sprout (the same
  // fallback every other world uses) — never initials, never the photo. One
  // shared resolver, no local photo read.
  const heroUrl = resolveHeroUrl(childProfile);

  const [scenarioIdx, setScenarioIdx] = useState(0);
  // B-KID-29: Mood Mountain is a climb of MOOD_CLIMB answers, then it ends.
  const [kidStep, setKidStep] = useState(0);
  const [pickedEmotion, setPickedEmotion] = useState<string | null>(null);
  const [feltEmotion, setFeltEmotion] = useState<string | null>(null);
  const [talkedEmotion, setTalkedEmotion] = useState<string | null>(null);
  const [completedCalm, setCompletedCalm] = useState<string | null>(null);
  const scenario = EMOTION_SCENARIOS[scenarioIdx % EMOTION_SCENARIOS.length];
  const scenarioText = uiLang === "he" ? scenario.textHe : scenario.text;
  const answer = EMOTIONS.find((e) => e.id === scenario.answer) ?? EMOTIONS[0];
  const answerLabel = emotionLabelFor(answer, uiLang);
  const choiceIds = [scenario.answer, ...scenario.distractors];
  const choiceEmotions = useMemo(
    () => choiceIds.map((id) => EMOTIONS.find((e) => e.id === id)).filter(Boolean) as typeof EMOTIONS,
    [scenario.id]
  );

  const emotionRounds = data.events.items.filter((e) => e.kind === "emotion-id" || e.kind === "emotion-why").length;
  const calmRounds = data.events.items.filter((e) => e.kind === "calm").length;
  // KID-04/GP-20 clinical firewall: the middle tile used to be a "Recognition"
  // PERCENTAGE derived from which emotions the child got right. A parent surface
  // reports counts; a recognition rate is a graded verdict about the child.
  // (W2-SHELLPLAY r1: the separate "feelings named" count — a subset of the
  // rounds — left the line; one feelings-only count remains.)

  const record = (kind: PracticeEvent["kind"], correct?: boolean, meta?: string) => {
    const event: PracticeEvent = {
      id: eventId(kind),
      kind,
      domain: "emotional",
      correct,
      meta,
      timestamp: new Date().toISOString(),
    };
    void data.events.upsert(event);
    track("practice_event", { kind, domain: "emotional", correct });
  };

  const chooseEmotion = (id: string) => {
    if (pickedEmotion) return;
    setPickedEmotion(id);
    record("emotion-id", id === scenario.answer, scenario.id);
    // N1-01-R5: one completed kid activity, counted on the naming that landed.
    // A COUNT and nothing else — the emotion, the scenario and the child's
    // answer stay here. A no-op outside Kid Mode.
    if (id === scenario.answer) noteKidActivity();
  };

  // Self-check: the child says how THEY feel; their avatar mirrors it (A4).
  // B-KID-02: a feeling is not a correct answer. It is written as a
  // `mood-checkin` with no `correct` (never accuracy, never stars), and at most
  // ONE row per session — the avatar follows every tap, the ledger does not.
  const checkinRecorded = useRef(false);
  const feel = (id: string) => {
    if (id === feltEmotion) return;
    setFeltEmotion(id);
    if (checkinRecorded.current) return;
    checkinRecorded.current = true;
    const event: PracticeEvent = {
      id: eventId("mood-checkin"),
      kind: "mood-checkin",
      domain: "emotional",
      emotion: id,
      timestamp: new Date().toISOString(),
    };
    void data.events.upsert(event);
    track("practice_event", { kind: "mood-checkin", domain: "emotional" });
  };

  // The emotion the avatar should be wearing right now.
  const activeEmotion = EMOTIONS.find((e) => e.id === (feltEmotion ?? pickedEmotion)) ?? null;
  const activeColor = activeEmotion ? EMOTION_TONE[activeEmotion.id] ?? "var(--arbor-clay)" : "var(--arbor-clay)";

  const nextScenario = () => {
    setScenarioIdx((i) => (i + 1) % EMOTION_SCENARIOS.length);
    setPickedEmotion(null);
    setKidStep((n) => n + 1);
  };

  const markTalked = (id: string) => {
    setTalkedEmotion(id);
    record("emotion-why", true, id);
    window.setTimeout(() => setTalkedEmotion(null), 1400);
  };

  const completeCalm = (id: string) => {
    setCompletedCalm(id);
    record("calm", true, id);
    window.setTimeout(() => setCompletedCalm(null), 1400);
  };

  // KID-04: Kid Mode renders the kid subset only (self-check → scenario →
  // tiles → next). Stats, the safety note, the explainer cards and the
  // calm-tool logging are the parent register and stay in the !kidMode branch.
  const kidMode = useSyncExternalStore(subscribeKidMode, isKidModeActive, isKidModeActive);
  // B-KID-11: the parent door opens Mood Mountain through the ONE entry seam.
  const { request: requestKidMode, step: kidModeStep } = useKidModeEntry();

  const emotionTiles = choiceEmotions.map((emotion) => {
    const picked = pickedEmotion === emotion.id;
    const reveal = pickedEmotion !== null;
    const correct = emotion.id === scenario.answer;
    const state = picked ? (correct ? "correct" : "wrong") : reveal && !correct ? "dim" : "idle";
    return (
      <ChoiceTile
        key={emotion.id}
        emoji={emotion.emoji}
        label={emotionLabelFor(emotion, uiLang)}
        onClick={() => chooseEmotion(emotion.id)}
        disabled={!!pickedEmotion}
        state={state}
      />
    );
  });

  if (!kidMode) {
  return (
    <RegisterShell
      kidMode={false}
      title={t("prac.feelings.title")}
      subtitle={t("prac.feelings.sub", { name: first })}
    >

      {/* §3f row 2 — MODULE 1 of 2, and the surface's whole job: the scenario
          and its answer tiles, first. The three stat bubbles and the safety bar
          used to sit above them, so the first choice tile rendered at ~980 px
          on a 390 phone; the counts are now one quiet line UNDER the drill and
          the note is a page footer. */}
      <section data-module="feelings-practice" className="space-y-3">
      {/* W2-SHELLPLAY critic r2 (law 2, B-PLAY-08): the PARENT page is the
          co-play door. The scenario quiz, its graded answer tiles, the mascot
          and the kid PlayButton live only in Kid Mode (Mood Mountain, below);
          the parent gets one door into that world through the B-KID-11 seam
          and a two-line co-play tip. */}
      <div data-testid="feelings-door" className={`${cardCls} p-5`}>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid place-items-center w-10 h-10 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)" }}>
            <Icon name="mood" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="t-lg font-extrabold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              {t("elev.practice.feelings.door.title")}
            </h2>
            <p className="t-sm mt-1.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.practice.feelings.door.tip", { name: first })}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-primary-move="open-world-door"
            onClick={() => requestKidMode({ view: "arcade", worldId: "feelings" })}
            className="inline-flex items-center gap-1.5 t-sm font-extrabold rounded-xl px-4 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
            style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
          >
            <Icon name="sports_esports" size={16} /> {t("elev.practice.feelings.door.cta")}
          </button>
          {/* The counts that were three stat bubbles: one quiet line, plural-
              keyed, counts never verdicts (law 1), nothing when there is nothing. */}
          {(emotionRounds > 0 || calmRounds > 0) && (
            <p className="t-xs" style={{ color: "var(--arbor-muted)" }}>
              {[
                emotionRounds > 0 ? t(emotionRounds === 1 ? "elev.practice.feelings.count.rounds.one" : "elev.practice.feelings.count.rounds.many", { n: emotionRounds }) : "",
                calmRounds > 0 ? t(calmRounds === 1 ? "elev.practice.feelings.count.calm.one" : "elev.practice.feelings.count.calm.many", { n: calmRounds }) : "",
              ].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {kidModeStep}
      </div>
      </section>

      {/* §3f row 2 — MODULE 2 of 2. "Why feelings happen" (six explainer cards)
          and "Calm-down practice" (three breathing patterns + the calm tools)
          are separate capabilities, and reference material: you read them on a
          calm day, you do not do them mid-scenario. Demoted behind ONE
          disclosure — every card is still reachable (law 6), none of them
          competes with the move. */}
      <details data-module="feelings-toolkit" className={`${cardCls} p-0 overflow-hidden`}>
        <summary className="cursor-pointer list-none px-6 py-4 min-h-[44px] flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
            <Icon name="favorite" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block t-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.practice.feelings.toolkit")}</span>
            <span className="block t-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.practice.feelings.toolkit.sub")}</span>
          </span>
          <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
        </summary>
        <div className="px-4 pb-4 space-y-4">

      <SectionCard title={t("elev.practice.feelings.why.title")} icon={<Icon name="favorite" size={20} />} tone="pink">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EMOTIONS.map((emotion) => (
            <div key={emotion.id} className={`${cardCls} p-4`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{emotion.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{emotionLabelFor(emotion, uiLang)}</p>
                  <p className="t-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}><b>{t("elev.practice.feelings.why.label")}</b> {emotion.why}</p>
                  <p className="t-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}><b>{t("elev.practice.feelings.looksLike.label")}</b> {emotion.looksLike}</p>
                  <p className="t-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}><b>{t("elev.practice.feelings.helps.label")}</b> {emotion.helps}</p>
                  <button onClick={() => markTalked(emotion.id)} className="mt-3 inline-flex items-center gap-1.5 t-xs font-extrabold px-3 min-h-[44px] rounded-xl" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
                    {talkedEmotion === emotion.id ? <Icon name="check" size={14} /> : <Icon name="auto_awesome" size={14} />}
                    {talkedEmotion === emotion.id ? t("elev.practice.feelings.logged") : t("elev.practice.feelings.talked")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t("elev.practice.feelings.calm.title")} icon={<Icon name="air" size={20} />} tone="sky">
        <p className="text-xs mb-4" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.practice.feelings.calm.intro")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {BREATHING_PATTERNS.map((pattern) => (
            <div key={pattern.id} className={`${cardCls} p-4`}>
              <p className="text-3xl">{pattern.emoji}</p>
              <p className="text-sm font-extrabold mt-2" style={{ color: "var(--arbor-ink)" }}>{pattern.title}</p>
              <p className="t-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{pattern.script}</p>
              <p className="t-xs mt-2 font-bold" style={{ color: "var(--arbor-muted)" }}>
                {t("elev.practice.feelings.breath", { inhale: pattern.inhale, hold: pattern.hold, exhale: pattern.exhale, rounds: pattern.rounds })}
              </p>
              <button onClick={() => completeCalm(pattern.id)} className="mt-3 inline-flex items-center gap-1.5 t-xs font-extrabold px-3 min-h-[44px] rounded-xl" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>
                {completedCalm === pattern.id ? <Icon name="check" size={14} /> : <Icon name="replay" size={14} />}
                {completedCalm === pattern.id ? t("elev.practice.feelings.logged") : t("elev.practice.feelings.completeRound")}
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CALM_TOOLS.map((tool) => (
            <button key={tool.id} onClick={() => completeCalm(tool.id)} className={`${cardCls} p-4 text-start transition hover:shadow-md`}>
              <span className="text-2xl">{tool.emoji}</span>
              <span className="block text-sm font-extrabold mt-1" style={{ color: "var(--arbor-ink)" }}>{tool.title}</span>
              <span className="block t-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{tool.how}</span>
            </button>
          ))}
        </div>
      </SectionCard>
        </div>
      </details>

      {/* Page-level honesty note, not a module: it says what this surface IS,
          the way PracticeStudioTab's register note does. Last, and quiet. */}
      <TrustSafetyBar note={t("elev.practice.feelings.note")} />
    </RegisterShell>
  );
  }

  // KID-04: the KID register — Mood Mountain. Self-check → scenario → tiles →
  // next. Counts never verdicts: progress is pips, feedback is words.
  // B-KID-29: five answers, then a finish — the mountain ends.
  if (kidStep >= MOOD_CLIMB) {
    return (
      <RegisterShell kidMode title={t("elev.play.feelings.title")} mood="happy" worldId="feelings" headerVariant="compact">
        <Celebrate title={t("elev.kids.feelings.done.title", { name: first })} subtitle={t("elev.kids.feelings.done.sub")}>
          <PlayButton tone="yellow" onClick={() => setKidStep(0)}>{t("elev.kids.feelings.again")}</PlayButton>
        </Celebrate>
      </RegisterShell>
    );
  }
  return (
    <RegisterShell
      kidMode
      title={t("elev.play.feelings.title")}
      say={t("elev.play.feelings.say", { name: first })}
      mood="happy"
      worldId="feelings"
      headerVariant="compact"
      eyebrow={t("elev.kids.mission")}
    >

      <PlayPanel tone="yellow">
        <ProgressPips total={MOOD_CLIMB} current={kidStep} tone="yellow" />

        <div className="rounded-[var(--play-radius)] p-6 my-4" style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" }}>
          <p className="text-5xl mb-3">{scenario.emoji}</p>
          <p className="text-[1.35rem] font-extrabold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {scenarioText}
          </p>
          {/* KID-09: a child who cannot yet read the scenario can hear it. */}
          <SpeakButton
            text={scenarioText}
            lang={uiLang}
            label={t("elev.play.speak.label")}
            size="md"
            className="min-w-[44px] min-h-[44px] justify-center mt-3"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {emotionTiles}
        </div>
        {pickedEmotion && (
          <div className="mt-5">
            <MascotSay mood={pickedEmotion === scenario.answer ? "proud" : "think"} tone={pickedEmotion === scenario.answer ? "clay" : "yellow"}>
              {pickedEmotion === scenario.answer
                ? t("elev.kids.feelings.yes", { feeling: answerLabel.toLowerCase() })
                : t("elev.kids.feelings.retry", { feeling: answerLabel.toLowerCase() })}
            </MascotSay>
            <div className="mt-4">
              <PlayButton tone="yellow" onClick={nextScenario}>{t("elev.kids.feelings.next")} <Icon name="chevron_right" size={18} /></PlayButton>
            </div>
          </div>
        )}

        {/* The child can first notice the scene, listen, and choose. Their own
            feelings stay visible below as a separate self-check, not a clue or
            a result from the scenario. */}
        <div className="mt-5 flex items-center gap-4 rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)" }}>
          <EmotionAvatar
            name={first}
            photoURL={heroUrl}
            fallback={<ArborMascot size={64} mood="happy" />}
            emotionEmoji={activeEmotion?.emoji}
            emotionLabel={activeEmotion ? emotionLabelFor(activeEmotion, uiLang) : undefined}
            color={activeColor}
            size={64}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold mb-2" style={{ color: "var(--arbor-ink)" }}>{t("elev.kids.feelings.selfCheck", { name: first })}</p>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map((e) => {
                const on = feltEmotion === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => feel(e.id)}
                    aria-pressed={on}
                    aria-label={emotionLabelFor(e, uiLang)}
                    className="play-pressable rounded-full min-w-[48px] min-h-[48px] px-3 text-2xl transition"
                    style={on
                      ? { background: "var(--arbor-paper-elevated)", boxShadow: `0 0 0 3px ${EMOTION_TONE[e.id] ?? "var(--arbor-clay)"}` }
                      : { background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
                  >
                    {e.emoji}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PlayPanel>
    </RegisterShell>
  );
}
