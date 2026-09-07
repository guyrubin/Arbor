import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SectionCard, TrustSafetyBar, cardCls } from "../ui/kit";
import { RegisterShell, ChoiceTile, MascotSay, PlayButton, PlayPanel, ProgressPips } from "../ui/playkit";
import { BREATHING_PATTERNS, CALM_TOOLS, EMOTION_SCENARIOS, EMOTIONS } from "../../practice/playContent";
import { usePracticeData } from "../../practice/usePracticeData";
import { EmotionAvatar } from "../ui/EmotionAvatar";
import type { PracticeEvent } from "../../types";
import { track } from "../../lib/analytics";
import { isKidModeActive, subscribeKidMode } from "../../lib/kidModeGate";
import { SpeakButton } from "../ui/SpeakButton";

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

  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [pickedEmotion, setPickedEmotion] = useState<string | null>(null);
  const [feltEmotion, setFeltEmotion] = useState<string | null>(null);
  const [talkedEmotion, setTalkedEmotion] = useState<string | null>(null);
  const [completedCalm, setCompletedCalm] = useState<string | null>(null);
  const scenario = EMOTION_SCENARIOS[scenarioIdx % EMOTION_SCENARIOS.length];
  const answer = EMOTIONS.find((e) => e.id === scenario.answer) ?? EMOTIONS[0];
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
  const feelingsNamed = data.events.items.filter((e) => e.kind === "emotion-id").length;

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
  };

  // Self-check: the child says how THEY feel; their avatar mirrors it (A4).
  const feel = (id: string) => {
    if (id === feltEmotion) return;
    setFeltEmotion(id);
    record("emotion-why", true, `self:${id}`);
  };

  // The emotion the avatar should be wearing right now.
  const activeEmotion = EMOTIONS.find((e) => e.id === (feltEmotion ?? pickedEmotion)) ?? null;
  const activeColor = activeEmotion ? EMOTION_TONE[activeEmotion.id] ?? "var(--arbor-clay)" : "var(--arbor-clay)";

  const nextScenario = () => {
    setScenarioIdx((i) => (i + 1) % EMOTION_SCENARIOS.length);
    setPickedEmotion(null);
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

  const emotionTiles = choiceEmotions.map((emotion) => {
    const picked = pickedEmotion === emotion.id;
    const reveal = pickedEmotion !== null;
    const correct = emotion.id === scenario.answer;
    const state = picked ? (correct ? "correct" : "wrong") : reveal && !correct ? "dim" : "idle";
    return (
      <ChoiceTile
        key={emotion.id}
        emoji={emotion.emoji}
        label={emotion.label}
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
      <SectionCard
        title={t("elev.practice.feelings.match.title")}
        icon={<Icon name="mood" size={20} />}
        tone="yellow"
        action={
          <span className="rounded-full px-3 py-1.5 text-[12px] font-extrabold" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-yellow-ink)" }}>{scenarioIdx + 1} of {EMOTION_SCENARIOS.length}</span>
        }
      >
        <div className="rounded-[var(--play-radius)] p-6 mb-4 bg-white shadow-[0_2px_12px_rgba(41,51,63,0.05)]">
          <p className="text-5xl mb-3">{scenario.emoji}</p>
          <p className="text-[1.35rem] font-extrabold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {scenario.text}
          </p>
        </div>
        {/* The declared primaryMove for #/feelings ("complete-feelings-scenario"):
            the answer tiles. Stamped once, on the control group the acceptance
            measures. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-primary-move="complete-feelings-scenario">
          {emotionTiles}
        </div>
        {pickedEmotion && (
          <div className="mt-5">
            <MascotSay mood={pickedEmotion === scenario.answer ? "proud" : "think"} tone={pickedEmotion === scenario.answer ? "clay" : "yellow"}>
              {pickedEmotion === scenario.answer
                ? `Yes. This sounds like ${answer.label.toLowerCase()}. Ask: where do you feel that in your body?`
                : `Warm retry: it might look more like ${answer.label.toLowerCase()}. Try making that face together.`}
            </MascotSay>
            <div className="mt-4">
              <PlayButton tone="yellow" onClick={nextScenario}>Next feeling →</PlayButton>
            </div>
          </div>
        )}
        {/* A4: the child's own avatar mirrors how they feel right now */}
        <div className="flex items-center gap-4 rounded-2xl p-4 mt-5" style={{ background: "var(--arbor-paper-deep)" }}>
          <EmotionAvatar
            name={first}
            photoURL={childProfile.photoUrl}
            emotionEmoji={activeEmotion?.emoji}
            emotionLabel={activeEmotion?.label}
            color={activeColor}
            size={64}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold mb-2" style={{ color: "var(--arbor-ink)" }}>How are you feeling right now, {first}?</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONS.map((e) => {
                const on = feltEmotion === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => feel(e.id)}
                    aria-pressed={on}
                    title={e.label}
                    className="rounded-full px-2.5 py-1.5 text-base transition"
                    style={on ? { background: "#fff", boxShadow: `0 0 0 2px ${EMOTION_TONE[e.id] ?? "var(--arbor-clay)"}` } : { background: "#fff", border: "1px solid var(--arbor-rule)" }}
                  >
                    {e.emoji}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </SectionCard>

      {/* The counts that were three stat bubbles at the top of the page. A
          quiet line: counts, never verdicts (law 1), and never before the move. */}
      <p className="text-[11.5px] px-1" style={{ color: "var(--arbor-muted)" }}>
        {t("elev.practice.feelings.counts", { rounds: emotionRounds, calm: calmRounds })}
        {feelingsNamed > 0 && <> · {feelingsNamed} {t("elev.practice.feelings.named")}</>}
      </p>
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
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.practice.feelings.toolkit")}</span>
            <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.practice.feelings.toolkit.sub")}</span>
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
                  <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{emotion.label}</p>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}><b>Why:</b> {emotion.why}</p>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}><b>Looks like:</b> {emotion.looksLike}</p>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}><b>Helps:</b> {emotion.helps}</p>
                  <button onClick={() => markTalked(emotion.id)} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-xl" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
                    {talkedEmotion === emotion.id ? <Icon name="check" size={14} /> : <Icon name="auto_awesome" size={14} />}
                    {talkedEmotion === emotion.id ? "Logged" : "We talked this through"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t("elev.practice.feelings.calm.title")} icon={<Icon name="air" size={20} />} tone="sky">
        <p className="text-xs mb-4" style={{ color: "var(--arbor-muted)" }}>
          Practice these during calm moments. That is when the body learns the route back.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {BREATHING_PATTERNS.map((pattern) => (
            <div key={pattern.id} className={`${cardCls} p-4`}>
              <p className="text-3xl">{pattern.emoji}</p>
              <p className="text-sm font-extrabold mt-2" style={{ color: "var(--arbor-ink)" }}>{pattern.title}</p>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{pattern.script}</p>
              <p className="text-[10px] mt-2 font-bold" style={{ color: "var(--arbor-muted)" }}>
                In {pattern.inhale}s, hold {pattern.hold}s, out {pattern.exhale}s x {pattern.rounds}
              </p>
              <button onClick={() => completeCalm(pattern.id)} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-xl" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>
                {completedCalm === pattern.id ? <Icon name="check" size={14} /> : <Icon name="replay" size={14} />}
                {completedCalm === pattern.id ? "Logged" : "Complete one round"}
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CALM_TOOLS.map((tool) => (
            <button key={tool.id} onClick={() => completeCalm(tool.id)} className={`${cardCls} p-4 text-start transition hover:shadow-md`}>
              <span className="text-2xl">{tool.emoji}</span>
              <span className="block text-sm font-extrabold mt-1" style={{ color: "var(--arbor-ink)" }}>{tool.title}</span>
              <span className="block text-[11px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{tool.how}</span>
            </button>
          ))}
        </div>
      </SectionCard>
        </div>
      </details>

      {/* Page-level honesty note, not a module: it says what this surface IS,
          the way PracticeStudioTab's register note does. Last, and quiet. */}
      <TrustSafetyBar
        note="This is coaching and practice, not mental-health diagnosis. Patterns worth discussing are surfaced gently in the Development Dashboard."
      />
    </RegisterShell>
  );
  }

  // KID-04: the KID register — Mood Mountain. Self-check → scenario → tiles →
  // next. Counts never verdicts: progress is pips, feedback is words.
  return (
    <RegisterShell
      kidMode
      title={t("elev.play.feelings.title")}
      say={t("elev.play.feelings.say", { name: first })}
      mood="happy"
    >

      <PlayPanel tone="yellow">
        <div className="flex items-center gap-4 rounded-2xl p-4 mb-4" style={{ background: "var(--arbor-paper-deep)" }}>
          <EmotionAvatar
            name={first}
            photoURL={childProfile.photoUrl}
            emotionEmoji={activeEmotion?.emoji}
            emotionLabel={activeEmotion?.label}
            color={activeColor}
            size={64}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold mb-2" style={{ color: "var(--arbor-ink)" }}>{t("elev.play.feelings.selfCheck", { name: first })}</p>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map((e) => {
                const on = feltEmotion === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => feel(e.id)}
                    aria-pressed={on}
                    aria-label={e.label}
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

        <ProgressPips total={EMOTION_SCENARIOS.length} current={scenarioIdx % EMOTION_SCENARIOS.length} tone="yellow" />

        <div className="rounded-[var(--play-radius)] p-6 my-4" style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" }}>
          <p className="text-5xl mb-3">{scenario.emoji}</p>
          <p className="text-[1.35rem] font-extrabold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {scenario.text}
          </p>
          {/* KID-09: a child who cannot yet read the scenario can hear it. */}
          <SpeakButton
            text={scenario.text}
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
                ? t("elev.play.feelings.yes", { feeling: answer.label.toLowerCase() })
                : t("elev.play.feelings.retry", { feeling: answer.label.toLowerCase() })}
            </MascotSay>
            <div className="mt-4">
              <PlayButton tone="yellow" onClick={nextScenario}>{t("elev.play.feelings.next")} <Icon name="chevron_right" size={18} /></PlayButton>
            </div>
          </div>
        )}
      </PlayPanel>
    </RegisterShell>
  );
}
