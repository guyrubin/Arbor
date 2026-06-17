import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, Heart, RotateCcw, Smile, Sparkles, Wind } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { PageHeader, SectionCard, TrustSafetyBar, cardCls, Chip } from "../ui/kit";
import { BREATHING_PATTERNS, CALM_TOOLS, EMOTION_SCENARIOS, EMOTIONS } from "../../practice/playContent";
import { usePracticeData } from "../../practice/usePracticeData";
import { EmotionAvatar } from "../ui/EmotionAvatar";
import type { PracticeEvent } from "../../types";
import { track } from "../../lib/analytics";

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
  const { t } = useLanguage();
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
  const emotionAccuracy = useMemo(() => {
    const graded = data.events.items.filter((e) => e.kind === "emotion-id" && e.correct !== undefined);
    if (graded.length === 0) return null;
    return Math.round((graded.filter((e) => e.correct).length / graded.length) * 100);
  }, [data.events.items]);

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

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Practice Studio"
        title={t("prac.feelings.title")}
        subtitle={t("prac.feelings.sub", { name: first })}
      />

      <TrustSafetyBar
        risk="Low"
        note="This is coaching and practice, not mental-health diagnosis. Patterns worth discussing are surfaced gently in the Development Dashboard."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{emotionRounds}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Emotion rounds completed</p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{emotionAccuracy === null ? "-" : `${emotionAccuracy}%`}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Recognition accuracy, parent-observed</p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{calmRounds}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>Calm-down practices logged</p>
        </div>
      </div>

      <SectionCard title="Emotion match" icon={<Smile className="w-5 h-5" />} tone="yellow"
        action={<Chip tone="yellow">{scenarioIdx + 1} of {EMOTION_SCENARIOS.length}</Chip>}>
        {/* A4: the child's own avatar mirrors how they feel right now */}
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

        <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--arbor-paper-deep)" }}>
          <p className="text-4xl mb-3">{scenario.emoji}</p>
          <p className="text-lg font-extrabold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {scenario.text}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {choiceEmotions.map((emotion) => {
            const picked = pickedEmotion === emotion.id;
            const reveal = pickedEmotion !== null;
            const correct = emotion.id === scenario.answer;
            return (
              <button
                key={emotion.id}
                onClick={() => chooseEmotion(emotion.id)}
                disabled={!!pickedEmotion}
                className={`${cardCls} p-4 text-center transition`}
                style={{
                  border: picked ? `2px solid ${correct ? "var(--arbor-clay)" : "var(--arbor-pink-ink)"}` : "1px solid rgba(41,51,63,0.06)",
                  opacity: reveal && !picked && !correct ? 0.58 : 1,
                }}
              >
                <span className="text-3xl block">{emotion.emoji}</span>
                <span className="text-sm font-extrabold block mt-2" style={{ color: "var(--arbor-ink)" }}>{emotion.label}</span>
              </button>
            );
          })}
        </div>
        {pickedEmotion && (
          <div className="mt-4 rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: pickedEmotion === scenario.answer ? "var(--arbor-green-soft)" : "var(--arbor-yellow-soft)" }}>
            <p className="text-sm flex-1 min-w-[220px]" style={{ color: "var(--arbor-ink)" }}>
              {pickedEmotion === scenario.answer
                ? `Yes. This sounds like ${answer.label.toLowerCase()}. Ask: where do you feel that in your body?`
                : `Warm retry: it might look more like ${answer.label.toLowerCase()}. Try making that face together.`}
            </p>
            <button onClick={nextScenario} className="inline-flex items-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-yellow-ink)" }}>
              Next feeling
            </button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Why feelings happen" icon={<Heart className="w-5 h-5" />} tone="pink">
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
                    {talkedEmotion === emotion.id ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {talkedEmotion === emotion.id ? "Logged" : "We talked this through"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Calm-down practice" icon={<Wind className="w-5 h-5" />} tone="sky">
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
                {completedCalm === pattern.id ? <Check className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                {completedCalm === pattern.id ? "Logged" : "Complete one round"}
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CALM_TOOLS.map((tool) => (
            <button key={tool.id} onClick={() => completeCalm(tool.id)} className={`${cardCls} p-4 text-left transition hover:shadow-md`}>
              <span className="text-2xl">{tool.emoji}</span>
              <span className="block text-sm font-extrabold mt-1" style={{ color: "var(--arbor-ink)" }}>{tool.title}</span>
              <span className="block text-[11px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{tool.how}</span>
            </button>
          ))}
        </div>
      </SectionCard>
    </motion.div>
  );
}
