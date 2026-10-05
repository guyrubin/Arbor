import React, { useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ADVENTURE_SCENARIOS, fillTemplate, scenariosForAge, type AdventureScenario } from "../../practice/content";
import { usePracticeData } from "../../practice/usePracticeData";
import type { AdventureResult } from "../../types";
import { api } from "../../lib/api";
import { track } from "../../lib/analytics";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { RegisterShell, PlayButton, PlayPanel, ChoiceTile, ProgressPips, MascotSay, Celebrate } from "../ui/playkit";
import { SpeakButton } from "../ui/SpeakButton";
import { useKidSafeNav } from "../kidmode/useKidSafeNav";
import { isKidModeActive, subscribeKidMode } from "../../lib/kidModeGate";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
import { cardCls } from "../ui/kit";

/** W2-SHELLPLAY critic r1 (law 8): the skill chip is keyed (was English). */
const SKILL_KEY: Record<string, string> = {
  vocabulary: "elev.practice.adventures.skill.vocabulary",
  logic: "elev.practice.adventures.skill.logic",
  sequencing: "elev.practice.adventures.skill.sequencing",
  instructions: "elev.practice.adventures.skill.instructions",
  abstract: "elev.practice.adventures.skill.abstract",
};

/** W2-SHELLPLAY critic r1: the curated scenarios' titles and their PARENT-
 *  register lines, keyed by id (the stored intro addresses the child — law 2 —
 *  so the parent picker never shows it). A generated scenario has no key and
 *  keeps the title it was made with. */
const CURATED_IDS: ReadonlySet<string> = new Set(ADVENTURE_SCENARIOS.map((s) => s.id));

/**
 * Cognitive Adventures — MITA-style comprehension play wrapped in stories.
 * The child only ever experiences a story with choices; under the hood each
 * choice quietly logs an instruction/logic/sequencing/vocabulary signal.
 * Wrong answers get warm scaffolding and a retry — there is no "fail" state.
 */
export default function AdventuresTab() {
  const { childProfile, openPaywall } = useArbor();
  const { t, uiLang } = useLanguage();
  const isRtl = uiLang === "he";
  // KID-05: the comic CTA on the win screen needs the parent shell; null in Kid Mode → not rendered.
  const nav = useKidSafeNav();
  // OBJ-KID-04 / OBJ-KID-03: the child sees a kid-register answer; the parent
  // keeps the diagnostic string. Branch here, never inside ToastContext.
  const kidMode = useSyncExternalStore(subscribeKidMode, isKidModeActive, isKidModeActive);
  const data = usePracticeData(childProfile.id);
  const first = childProfile.name.split(" ")[0];
  // B-PLAY-09 / B-KID-11: the parent door opens Story Quest through the ONE seam.
  const { request: requestKidMode, step: kidModeStep } = useKidModeEntry();
  const vars = { name: first, age: childProfile.age };
  const scenarioTitle = (s: AdventureScenario) =>
    CURATED_IDS.has(s.id) ? t(`elev.practice.adventures.title.${s.id}`) : s.title;

  const ageScenarios = useMemo(() => scenariosForAge(childProfile.age), [childProfile.age]);
  // Generated adventures (this session) sit alongside the curated ones.
  const [generated, setGenerated] = useState<AdventureScenario[]>([]);
  const scenarios = useMemo(() => [...generated, ...ageScenarios], [generated, ageScenarios]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scenario: AdventureScenario | null = scenarios.find((s) => s.id === activeId) ?? null;

  // M4: loading + friendly error + start/success/error analytics ("adventure_create_*").
  // A 402 opens the paywall (conversion moment) instead of an inline error.
  const adventureGen = useAsyncAction(
    "adventure_create",
    () => api.generateAdventure({ childProfile }),
    {
      fallbackError: t("gen.adventure.fail"),
      onPaywall: (err) => openPaywall(err.feature || "adventureGenerate", err.plan),
    },
  );
  const generating = adventureGen.loading;
  const genError = adventureGen.error;

  const createAdventure = async () => {
    const adv = await adventureGen.run();
    if (!adv) return;
    setGenerated((prev) => [adv, ...prev]);
    track("adventure_generated", { id: adv.id });
    openScenario(adv.id);
  };

  const [sceneIdx, setSceneIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  const openScenario = (id: string) => {
    setActiveId(id);
    setSceneIdx(0);
    setPicked(null);
    setFinished(false);
    setSessionCorrect(0);
    track("adventure_start", { scenario: id });
  };

  const scene = scenario?.scenes[sceneIdx] ?? null;
  const pickedChoice = scene?.choices.find((c) => c.id === picked) ?? null;

  const choose = (choiceId: string) => {
    if (!scenario || !scene || picked === choiceId) return;
    const choice = scene.choices.find((c) => c.id === choiceId);
    if (!choice) return;
    setPicked(choiceId);
    // First pick per scene is the recorded signal; retries are just play.
    if (picked === null) {
      const result: AdventureResult = {
        id: `adv-${Date.now()}`,
        scenarioId: scenario.id,
        sceneId: scene.id,
        skill: scene.skill,
        correct: choice.correct,
        timestamp: new Date().toISOString(),
      };
      void data.adventures.upsert(result);
      if (choice.correct) setSessionCorrect((n) => n + 1);
    }
  };

  const next = () => {
    if (!scenario) return;
    if (sceneIdx < scenario.scenes.length - 1) {
      setSceneIdx((i) => i + 1);
      setPicked(null);
    } else {
      setFinished(true);
      track("adventure_done", { scenario: scenario.id, correct: sessionCorrect, scenes: scenario.scenes.length });
    }
  };

  const playedCount = (s: AdventureScenario) =>
    new Set(data.adventures.items.filter((r) => r.scenarioId === s.id).map((r) => r.sceneId)).size;

  // OBJ-KID-03 (law 2): the sub is a PARENT explainer — "…quietly practices
  // logic, sequencing and word power. It never feels like a test." A child does
  // not need to be told what the game is measuring. Kid register gets its own
  // `say` line (the elev.play.soundlab.say pattern); the parent door is
  // unchanged. Assigned in an `if (!kidMode)` block, not a ternary, so the
  // kid-register scanner can see that the parent copy is parent-only.
  let headerSay = t("elev.play.adventures.say", { name: first });
  if (!kidMode) { headerSay = t("prac.adventures.sub", { name: first }); }

  // W2-SHELLPLAY critic r2 (B-PLAY-09, laws 2 + 7): the PARENT page is ONE
  // door into Kid Mode Story Quest. The scene (graded ChoiceTiles, MascotSay,
  // Celebrate) and the model-call generator run only inside Kid Mode; the
  // parent reads one line from adventureResults as a scene count, never right
  // or wrong (law 1).
  if (!kidMode) {
    const latest = [...data.adventures.items].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0];
    const lastStory = latest ? scenarios.find((s) => s.id === latest.scenarioId) ?? null : null;
    const lastScenes = lastStory ? playedCount(lastStory) : 0;
    const firstPick = ageScenarios[0] ?? null;
    return (
      <RegisterShell kidMode={false} title={t("prac.adventures.title")} subtitle={headerSay}>
        <section data-module="adventures-door" className={`${cardCls} p-5`}>
          <p className="t-lg font-extrabold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("elev.practice.adventures.door.title", { name: first })}
          </p>
          {(lastStory || firstPick) && (
            <p data-testid="adventures-door-line" className="t-sm mt-3 rounded-[var(--r)] p-3" dir="auto" style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-ink)" }}>
              {lastStory
                ? t(lastScenes === 1 ? "elev.practice.adventures.door.last.one" : "elev.practice.adventures.door.last", { name: first, title: scenarioTitle(lastStory), n: lastScenes })
                : t("elev.practice.adventures.door.pick", { name: first, title: scenarioTitle(firstPick!) })}
            </p>
          )}
          <button
            type="button"
            data-primary-move="open-story-quest"
            onClick={() => requestKidMode({ view: "arcade", worldId: "adventures" })}
            className="mt-4 inline-flex items-center gap-1.5 t-sm font-extrabold rounded-xl px-4 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
            style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
          >
            <Icon name="sports_esports" size={16} /> {t("elev.practice.adventures.door.cta", { world: t("elev.practice.world.kid.adventures") })}
          </button>
          {kidModeStep}
          {/* The stories Story Quest holds, as a quiet list (no in-page scene). */}
          <ul className="mt-5 list-none p-0 m-0 border-t" style={{ borderColor: "var(--arbor-rule)" }}>
            {ageScenarios.map((s) => (
              <li key={s.id} className="py-3 border-b flex items-start gap-3" style={{ borderColor: "var(--arbor-rule)" }}>
                <span aria-hidden="true" className="t-lg leading-none">{s.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block t-sm font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>{scenarioTitle(s)}</span>
                  {CURATED_IDS.has(s.id) && (
                    <span className="block t-xs mt-0.5" dir="auto" style={{ color: "var(--arbor-muted)" }}>{t(`elev.practice.adventures.parent.${s.id}`, { name: first })}</span>
                  )}
                </span>
                <span className="t-xs font-bold flex-shrink-0" style={{ color: "var(--arbor-muted)" }}>
                  {t("elev.practice.adventures.ages", { range: `${s.ageBand[0]}–${s.ageBand[1]}` })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </RegisterShell>
    );
  }

  // IA-08 / RUN-12: one route, two registers — the play wash mounts under Kid
  // Mode only; the parent door is kit chrome (PageHeader + tokens).
  return (
    <RegisterShell
      kidMode={kidMode}
      title={kidMode ? t("elev.kids.adventures.title") : t("prac.adventures.title")}
      say={headerSay}
      subtitle={headerSay}
      mood="wave"
      worldId="adventures"
      headerVariant="compact"
      eyebrow={kidMode ? t("elev.kids.mission") : undefined}
    >

      {/* Make-a-new-adventure CTA */}
      {!scenario && (
        <PlayPanel tone="lav" className="flex flex-wrap items-center gap-4">
          <span className="grid place-items-center w-14 h-14 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
            <Icon name="auto_fix_high" size={28} />
          </span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("elev.practice.adventures.gen.title")}</p>
            <p className="text-[13px] font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("elev.practice.adventures.gen.sub", { name: first })}</p>
          </div>
          {/* W2-SHELLPLAY critic r1: on the parent page the generator is a soft
              secondary — never the page's dominant control. */}
          <PlayButton onClick={createAdventure} disabled={generating} tone="lav" variant={kidMode ? "primary" : "soft"}>
            <Icon name="auto_awesome" size={16} /> {generating ? t("elev.practice.adventures.gen.creating") : t("elev.practice.adventures.gen.create")}
          </PlayButton>
          {genError &&
            (kidMode ? (
              /* OBJ-KID-04: no error code, no "AI", no "try again later" — the
                 adventure is simply napping, and the four curated stories below
                 are still one tap away. */
              <div role="status" aria-live="polite" className="w-full">
                <MascotSay mood="think" tone="yellow">{t("elev.play.adventures.napping")}</MascotSay>
              </div>
            ) : (
              <p className="w-full text-[13px] font-semibold" style={{ color: "var(--arbor-pink-ink)" }}>{genError}</p>
            ))}
        </PlayPanel>
      )}

      {/* item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (counted against the route's
          moduleBudget); `data-primary-move` marks the ONE control the
          contract declares. Playkit primitives take no data-* props, so the
          stamp goes on a wrapping <section> that adds no box of its own. */}
      {/* Scenario picker */}
      {!scenario && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scenarios.map((s) => {
            const played = playedCount(s) > 0;
            return (
              <button
                key={s.id}
                onClick={() => openScenario(s.id)}
                className="play-pressable rounded-[var(--play-radius-lg)] p-5 text-start flex items-start gap-4"
                style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}
              >
                <span className="grid place-items-center w-16 h-16 rounded-2xl text-4xl flex-shrink-0" style={{ background: "var(--arbor-lav-soft)" }}>{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-extrabold leading-tight" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{scenarioTitle(s)}</p>
                  {/* Law 2: the child-addressed intro is the KID register's; the
                      parent reads one line ABOUT the story (curated only). */}
                  {kidMode ? (
                    <p className="text-[13px] mt-1 leading-relaxed font-medium" style={{ color: "var(--arbor-muted)" }}>{fillTemplate(s.intro, vars)}</p>
                  ) : CURATED_IDS.has(s.id) ? (
                    <p className="text-[13px] mt-1 leading-relaxed font-medium" dir="auto" style={{ color: "var(--arbor-muted)" }}>{t(`elev.practice.adventures.parent.${s.id}`, { name: first })}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <PlayPill tone="sky">{t("elev.practice.adventures.ages", { range: `${s.ageBand[0]}–${s.ageBand[1]}` })}</PlayPill>
                    <PlayPill tone="lav">{t(s.scenes.length === 1 ? "elev.practice.adventures.choices.one" : "elev.practice.adventures.choices.many", { n: s.scenes.length })}</PlayPill>
                    {played && <PlayPill tone="clay">{t("elev.practice.adventures.played")}</PlayPill>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* OBJ-KID-05: a full MemoryMatch board used to sit here, below the story
          cards — the SAME game Mind Vault is, mounted a second time inside a
          world that is about stories. Mind Vault keeps it; Story Quest is only
          stories now. */}

      {/* Active scene */}
      {scenario && !finished && scene && (
        <section>
        <PlayPanel>
          <div className="flex items-center justify-between mb-5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl">{scenario.emoji}</span>
              <p className="text-lg font-extrabold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{scenario.title}</p>
            </div>
            {/* KID-14: this measured 20 px tall — the only way back out of an
                open adventure, under the touch floor. */}
            <button
              onClick={() => setActiveId(null)}
              className="inline-flex items-center gap-1 text-[13px] font-bold flex-shrink-0 px-3 min-h-[44px] rounded-xl"
              style={{ color: "var(--arbor-muted)" }}
            >
              <Icon name="arrow_back" size={16} style={isRtl ? { transform: "scaleX(-1)" } : undefined} /> {t("elev.play.arcade.allWorlds")}
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <ProgressPips total={scenario.scenes.length} current={sceneIdx} tone="lav" />
            <span className="text-[12px] font-extrabold" style={{ color: "var(--arbor-lav-ink)" }}>{SKILL_KEY[scene.skill] ? t(SKILL_KEY[scene.skill]) : ""}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={scene.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
              <div className="flex items-start gap-2 mb-5">
                <p className="text-[1.4rem] font-extrabold leading-snug max-w-2xl" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                  {fillTemplate(scene.prompt, vars)}
                </p>
                {/* KID-09: every scenario prompt gets the read-aloud control. */}
                <SpeakButton
                  text={fillTemplate(scene.prompt, vars)}
                  lang={uiLang}
                  label={t("elev.play.speak.label")}
                  size="md"
                  className="min-w-[44px] min-h-[44px] justify-center flex-shrink-0"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {scene.choices.map((c) => {
                  const isPicked = picked === c.id;
                  const reveal = picked !== null;
                  const tileState = isPicked ? (c.correct ? "correct" : "wrong") : reveal && pickedChoice?.correct ? "dim" : "idle";
                  return (
                    <ChoiceTile
                      key={c.id}
                      emoji={c.emoji}
                      label={c.text}
                      onClick={() => choose(c.id)}
                      disabled={pickedChoice?.correct === true}
                      state={tileState}
                    />
                  );
                })}
              </div>

              {pickedChoice && (
                <div className="mt-5">
                  <MascotSay mood={pickedChoice.correct ? "proud" : "think"} tone={pickedChoice.correct ? "clay" : "yellow"}>
                    {fillTemplate(pickedChoice.feedback, vars)}
                  </MascotSay>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {pickedChoice.correct ? (
                      <PlayButton onClick={next} tone="clay">
                        {sceneIdx < scenario.scenes.length - 1 ? t("elev.practice.adventures.keepGoing") : t("elev.practice.adventures.finish")}
                      </PlayButton>
                    ) : (
                      <span className="text-[13px] font-bold" style={{ color: "var(--arbor-yellow-ink)" }}>{t("elev.practice.adventures.tryAnother")}</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </PlayPanel>
        </section>
      )}

      {/* Finished */}
      {scenario && finished && (
        <PlayPanel>
          <Celebrate
            title={t("elev.practice.adventures.done.title", { name: first, title: scenarioTitle(scenario) })}
            // B-KID-04 (law 3): finishing the story lights every star.
            stars={scenario.scenes.length}
            starsTotal={scenario.scenes.length}
            // KID-29 + B-KID-26 (law 3): kid-register finish — the child is never
            // told they were measured: the line counts scenes finished, never right answers.
            subtitle={t("elev.play.adventures.done.sub", { n: scenario.scenes.length })}
          >
            <PlayButton variant="soft" tone="lav" onClick={() => openScenario(scenario.id)}>
              <Icon name="replay" size={16} /> {t("elev.practice.adventures.playAgain")}
            </PlayButton>
            <PlayButton variant="soft" tone="clay" onClick={() => setActiveId(null)}>
              <Icon name="explore" size={16} /> {t("elev.practice.adventures.more")}
            </PlayButton>
            {nav && (
              <PlayButton tone="lav" onClick={() => nav("comics")}>
                <Icon name="auto_awesome" size={16} /> {t("elev.practice.adventures.comic")}
              </PlayButton>
            )}
          </Celebrate>
        </PlayPanel>
      )}
    </RegisterShell>
  );
}

/** Small rounded label used on scenario cards. */
function PlayPill({ tone, children }: { tone: "sky" | "lav" | "clay"; children: React.ReactNode }) {
  const map = {
    sky: ["var(--arbor-sky-soft)", "var(--arbor-sky-ink)"],
    lav: ["var(--arbor-lav-soft)", "var(--arbor-lav-ink)"],
    clay: ["var(--arbor-green-soft)", "var(--arbor-green-ink)"],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}
