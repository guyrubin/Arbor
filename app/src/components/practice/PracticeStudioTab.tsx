/**
 * Practice Studio — the PARENT-register launcher for the practice suite
 * (IA fix: the ten skill worlds existed but had no parent door; the kid-register
 * Hero Arcade stays in Kid Mode via PracticeHubTab, this surface replaces it on
 * the parent #/practice route).
 *
 * Register rules: calm/clinical parent framing, tokens only, counts never
 * verdicts. Each world says what skill it nurtures, shows the count of its
 * own records in its own unit (B-PLAY-02), and names its Kid Mode world so parent and child share a vocabulary.
 * Worlds with a standalone route open directly (parent hands the device over);
 * arcade-only worlds launch Kid Mode (parent-locked).
 */
import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { cardCls } from "../ui/kit";
import { PASTEL } from "../../lib/tokens";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
import { markPinNudgeShown, readParentPin, shouldNudgeForPin } from "../kidmode/parentGate";
import { usePracticeData } from "../../practice/usePracticeData";
import { opensInKidMode, studioCountKey, studioCountsSince, studioWorldsForChild, worksInLanguage, type StudioWorld } from "./studioWorlds";
import { track } from "../../lib/analytics";
import { requestOpenSettings } from "../layout/settingsBus";
import { useChildCollection } from "../../hooks/useChildCollection";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { SINCE_LAST_PLAY_FALLBACK_MS, doorSinceSentence, doorWindowLabel, kidActivityLedgers } from "../../lib/kidExitRecap";
import { runTitle } from "../../lib/heroJourneys";
import { lastKidSessionStartedAt } from "../../lib/kidModeGate";
import type { HeroJourneyRun } from "../../types";
import { kidModeOpenFor, TOGETHER_CARDS } from "../../lib/age/playGate";
import { genderedKey } from "../../lib/today/fromRecord";

// B-PLAY-02: the world list and each tile's count + unit live in the pure
// components/practice/studioWorlds module (fixture-testable without React).

export default function PracticeStudioTab() {
  const { childProfile, setActiveTab, addMoment } = useArbor();
  const { t, uiLang } = useLanguage();
  // B-KID-11: the ONE entry seam — hero-first once per session, then Kid Mode
  // opens on the world the parent tapped (never the home dashboard).
  const { request: requestKidMode, step: heroStep } = useKidModeEntry();
  const isRtl = uiLang === "he";
  const firstName = (childProfile.name || "").split(" ")[0];
  const data = usePracticeData(childProfile.id);
  const heroRuns = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");

  // B-PLAY-05 + W2-SHELLPLAY critic r1: ONE sentence inside the Kid Mode door
  // (no new module): what the child played since the latest Kid Mode session
  // began (the last 7 days when this tab has seen none), in ONE unit (rounds)
  // with the window named, plus one finished story — its title resolved in
  // the UI language. Hidden when nothing happened. The phone hub line is
  // quiet on #/practice (Shell HUB_LINE_QUIET_TABS), so this is the screen's
  // only count of play.
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  // W2-SHELLPLAY critic r2: ONE window and ONE counter for the door and the
  // tiles. The door's number is the sum of the tile chips (studioCountsSince),
  // so a ledger row no world claims is counted by neither.
  const playWindow = React.useMemo(() => {
    const known = lastKidSessionStartedAt();
    return { sinceMs: known ?? Date.now() - SINCE_LAST_PLAY_FALLBACK_MS, isFallback: known == null };
  }, []);
  const counts = React.useMemo(
    () => studioCountsSince({ speech: data.speech, mimic: data.mimic, adventures: data.adventures, events: data.events }, playWindow.sinceMs),
    [data.speech, data.mimic, data.adventures, data.events, playWindow.sinceMs],
  );
  const windowLabel = doorWindowLabel({ sinceMs: playWindow.sinceMs, sinceIsFallback: playWindow.isFallback, nowMs: Date.now(), uiLang: lang, t });
  const since = React.useMemo(() => {
    const sinceMs = playWindow.sinceMs;
    return doorSinceSentence({
      // B-KID-31: the same ledger builder as the exit recap (check-ins are not
      // rounds); stories are reported by title through `stories` below.
      ledgers: kidActivityLedgers(data),
      stories: heroRuns.items.map((r) => ({ title: runTitle(r, lang), completedAt: r.completedAt })),
      sinceMs,
      sinceIsFallback: playWindow.isFallback,
      nowMs: Date.now(),
      total: counts.total,
      uiLang: lang,
      gender: childProfile.gender,
      t: withChildSignals(t, uiLang === "he"),
      childName: firstName,
    });
  }, [data.speech.items, data.mimic.items, data.missions.items, data.adventures.items, data.events.items, heroRuns.items, t, lang, firstName, childProfile.gender, playWindow, counts.total]);

  // B-SHELL-NEW-1b: the door sentence can be kept as ONE parent moment, through
  // the same addMoment path as the exit strip's Keep (B-SHELL-04). Once per
  // sentence: the kept text is remembered, so a second tap writes nothing.
  const [keptLine, setKeptLine] = React.useState<string | null>(null);
  const sinceText = since ? `${since.before}${since.title ?? ""}${since.after}` : "";
  const keepSince = () => {
    if (!sinceText || keptLine === sinceText) return;
    if (addMoment(sinceText)) setKeptLine(sinceText);
  };

  // KID-21: this session's parent area was reached by answering the math
  // question, and no PIN is set. Say so ONCE, here on the parent door next to
  // the Kid Mode entrance — never in front of the child, never twice.
  const [nudgePin] = React.useState(() => shouldNudgeForPin());
  React.useEffect(() => {
    if (nudgePin) markPinNudgeShown();
  }, [nudgePin]);

  // W2-SHELLPLAY critic r2 (G0): the trust line says what the exit gate does.
  // Without a PIN it is a hold + a grown-up question (parentGate.ts: "a
  // friction barrier, not a security boundary") — "Parent locked" and the
  // can't-exit clause render only once a PIN is set.
  const pinSet = Boolean(readParentPin());

  // B-KID-11 / B-PLAY-03: every kid-capable tile opens ITS world in Kid Mode
  // through the seam; Word World (no Kid Mode seat) is the only parent-tab tile.
  // SHIP-FIX (W2-SHELLPLAY r3 P1-1): a world that cannot keep its promise in
  // the UI language (Sound Lab in Hebrew — an English drill) never sends the
  // child into Kid Mode; it opens its parent tab, where SpeechCoachTab's
  // honest Hebrew door explains, and its tile says so.
  const kidOpens = (world: StudioWorld) => opensInKidMode(world) && worksInLanguage(world, lang);
  const openWorld = (world: StudioWorld) => {
    const kid = kidOpens(world);
    try { track("practice_studio_open", { world: world.id, via: kid ? "kidmode" : "direct" }); } catch { /* noop */ }
    if (!kid && world.tab) setActiveTab(world.tab);
    else requestKidMode({ view: "arcade", worldId: world.id });
  };
  // The start-world stamp sits on the first world that works in the UI
  // language AND opens a world the child plays, and that world is tile 1 in
  // every language (orderedStudioWorlds) — the move sits at the same height
  // in EN and HE, never under the bottom nav.
  // B-PLAY-24: only the worlds whose band tags fit the child (lib/age/playGate,
  // reading the Kids sessions' tags). Under three the page leads with three
  // parent-led "together" cards and the Kid Mode door stays hidden. The
  // start-world stamp sits on the first FITTING world that works in the UI
  // language and opens in Kid Mode (stampWorldId when it fits), tile 1.
  const { worlds, stampId } = studioWorldsForChild(lang, childProfile);
  const kidModeOpen = kidModeOpenFor(childProfile);
  const [togetherKept, setTogetherKept] = React.useState<string[]>([]);
  const keepTogether = (id: string) => {
    if (togetherKept.includes(id)) return;
    try { track("practice_together_did", { card: id }); } catch { /* noop */ }
    if (addMoment(t(`elev.ages.together.${id}.moment`))) setTogetherKept((k) => [...k, id]);
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 max-w-[980px]">
      {/* Header */}
      <div>
        <h1 className="t-2xl leading-tight tracking-tight" style={{ color: "var(--arbor-ink)" }}>
          {t("practice.studio.title")}
        </h1>
        <p className="t-sm mt-1 max-w-[62ch]" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.practice.studio.subtitle", { name: firstName || t("learn.yourChild") })}
        </p>
      </div>

      {!kidModeOpen && (
        /* B-PLAY-24: under three the Kid Mode door is hidden (not removed) —
           one quiet line says when it opens. */
        <p data-testid="practice-kidmode-from-three" className="t-sm" dir="auto" style={{ color: "var(--arbor-muted)" }}>
          {t(genderedKey("elev.ages.practice.fromThree", childProfile.gender), { name: firstName || t("learn.yourChild") })}
        </p>
      )}
      {kidModeOpen && (<>
      {/* Kid Mode — the safe play space. W2-SHELLPLAY critic r1: a flat
          paper-deep door whose CTA is SECONDARY (outline): the page's declared
          move is start-world, stamped on the first world tile below. At phone
          width the icon sits inline before the title (40 px) and the copy,
          chips and CTA share ONE start edge. */}
      <section
        data-module="practice-kidmode-door"
        className="rounded-[22px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
        style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
        aria-label={t("practice.studio.kidmode.title")}
      >
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2.5 t-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-clay-deep)", width: 40, height: 40, boxShadow: "var(--shadow-xs)" }}
            >
              <Icon name="sports_esports" size={22} />
            </span>
            {t("practice.studio.kidmode.title")}
          </h2>
          <p data-testid="practice-kidmode-sub" className="t-sm mt-1.5" style={{ color: "var(--arbor-ink-soft)" }}>
            {t(pinSet ? "practice.studio.kidmode.subLocked" : "practice.studio.kidmode.sub")}
          </p>
          {since && (
            <p data-testid="practice-since-last-play" className="t-sm mt-1.5 leading-snug" style={{ color: "var(--arbor-ink)" }} dir="auto">
              {since.before}
              {since.title && (
                <i style={{ fontFamily: "var(--font-editorial)", fontWeight: lang === "he" ? 600 : undefined }}>
                  <bdi>{since.title}</bdi>
                </i>
              )}
              {since.after}
            </p>
          )}
          {since && (
            <button
              type="button"
              data-testid="practice-since-keep"
              onClick={keepSince}
              disabled={keptLine === sinceText}
              className="inline-flex min-h-11 items-center gap-1 t-xs font-bold underline-offset-2 hover:underline disabled:no-underline"
              style={{ color: "var(--arbor-muted)" }}
            >
              <Icon name={keptLine === sinceText ? "check" : "bookmark_add"} size={14} />
              {keptLine === sinceText ? t("elev.practice.door.kept") : t("elev.practice.door.keep")}
            </button>
          )}
          {/* KID-20 / RUN-04: the three reassurance chips are PARENT copy, so
              they live here on the door — not in the child's first viewport. */}
          <ul aria-label={t("elev.practice.door.aria")} className="flex flex-wrap gap-1.5 mt-2 list-none p-0 m-0">
            {([pinSet ? "elev.practice.door.locked" : "elev.practice.door.gated", "elev.practice.door.private", "elev.practice.door.stars"] as const).map((key) => (
              <li
                key={key}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 t-xs font-bold"
                style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}
              >
                <Icon name="verified_user" size={12} style={{ color: "var(--arbor-green-ink)" }} />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        {heroStep}
        <button
          onClick={() => {
            try { track("practice_studio_open", { world: "kidmode", via: "hero" }); } catch { /* noop */ }
            requestKidMode();
          }}
          className="self-start sm:self-center inline-flex items-center gap-1.5 font-bold t-sm rounded-xl px-4 py-2.5 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="play_arrow" size={18} fill={1} />
          {t("practice.studio.kidmode.cta")}
        </button>
      </section>
      </>)}

      {/* B-PLAY-06: the PIN nudge is a 44 px button that opens Settings with
          the PIN row in view (was a static "… · Settings" line). Removed again
          when lane-X B-KID-14 carries "Set PIN once". */}
      {nudgePin && (
        <button
          type="button"
          data-testid="gate-pin-nudge"
          onClick={() => requestOpenSettings({ focus: "pin" })}
          className="w-full min-h-11 rounded-2xl px-4 py-3 text-start t-sm leading-relaxed transition focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}
        >
          <span className="flex items-center gap-3">
            <Icon name="lock" size={18} />
            <span className="min-w-0 flex-1">
              <b style={{ color: "var(--arbor-ink)" }}>{t("elev.gate.set.title")}</b>{" "}
              {t("elev.gate.set.sub")}
            </span>
            <span className="font-extrabold flex-shrink-0" style={{ color: "var(--arbor-ink)" }}>{t("elev.gate.set.cta")}</span>
          </span>
        </button>
      )}

      {/* The worlds module (#/practice moduleBudget 2: the door + this). Under
          three it holds the three parent-led "together" cards instead of game
          tiles (B-PLAY-24); from three, the band-fitting world grid. */}
      <section data-module="practice-worlds" aria-label={kidModeOpen ? t("practice.studio.worlds") : t("elev.ages.together.title")}>
      {!kidModeOpen ? (
        /* B-PLAY-24: the under-three page — three parent-led cards. The words
           to say are the largest text on each card; one action writes a moment. */
        <>
          <h2 className="t-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.ages.together.title")}</h2>
          <p className="t-sm mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.ages.together.sub", { name: firstName || t("learn.yourChild") })}</p>
          <div className="mt-3 grid sm:grid-cols-3 gap-4">
            {TOGETHER_CARDS.map((id, i) => {
              const kept = togetherKept.includes(id);
              return (
                <article key={id} data-together-card={id} className="rounded-[20px] p-4 flex flex-col gap-2" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
                  <h3 className="t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t(`elev.ages.together.${id}.title`)}</h3>
                  <p data-together-say className="leading-snug" dir="auto" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-xl)" }}>
                    “{t(`elev.ages.together.${id}.say`)}”
                  </p>
                  <p className="t-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t(`elev.ages.together.${id}.do`)}</p>
                  <button
                    type="button"
                    /* the page's ONE start-world stamp under three (the tiles carry none then) */
                    {...(i === 0 ? { "data-primary-move": "start-world" } : {})}
                    onClick={() => keepTogether(id)}
                    disabled={kept}
                    className="mt-auto self-start inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 t-sm font-semibold transition active:scale-[0.98]"
                    style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}
                  >
                    <Icon name={kept ? "check" : "favorite"} size={16} />
                    {kept ? t("elev.ages.together.kept") : t("elev.ages.together.did")}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      ) : (
      <>
        <div className="flex items-baseline justify-between mb-2.5">
          <h2 className="t-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>
            {t("practice.studio.worlds")}
          </h2>
          {/* The chips count ONE window — the door's — and say which. */}
          <span data-testid="practice-count-window" className="t-xs font-bold" style={{ color: "var(--arbor-muted)" }}>
            {counts.total > 0
              ? t("elev.practice.studio.window", { when: windowLabel })
              : t("practice.studio.count", { n: worlds.length })}
          </span>
        </div>
        {/* The declared primaryMove for #/practice ("start-world"). W2-SHELLPLAY
            critic r1: stamped on ONE control — the first world tile — not on
            the grid container (a 1373 px region is not a move). */}
        <div className="grid sm:grid-cols-2 gap-4">
          {worlds.map((world, i) => {
            const tone = PASTEL[world.tone];
            const sessions = counts.byWorld[world.id] ?? 0;
            const kid = kidOpens(world);
            const inLang = worksInLanguage(world, lang);
            return (
              <motion.button
                key={world.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.24) }}
                onClick={() => openWorld(world)}
                data-primary-move={world.id === stampId ? "start-world" : undefined}
                className={`${cardCls} w-full flex items-start gap-3.5 p-4 text-start transition motion-safe:hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none focus-visible:ring-2`}
              >
                <span
                  className="inline-flex items-center justify-center rounded-2xl flex-shrink-0 mt-0.5"
                  style={{ background: tone.soft, color: tone.ink, width: 44, height: 44 }}
                >
                  <Icon name={world.msIcon} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="t-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>
                      {t(`practice.world.${world.key}.name`)}
                    </span>
                    {sessions > 0 && (
                      <span
                        className="rounded-full px-2 py-0.5 t-xs font-bold"
                        style={{ background: tone.soft, color: tone.ink }}
                      >
                        {t(studioCountKey(world.unit, sessions), { n: sessions })}
                      </span>
                    )}
                  </span>
                  <span className="block t-sm leading-relaxed mt-0.5" style={{ color: "var(--arbor-muted)" }}>
                    {t(`practice.world.${world.key}.skill`)}
                  </span>
                  {/* One label pattern in one ink. With the B-KID-11 seam a
                      kid-capable tile names the world the tap really opens. */}
                  <span className="mt-1.5 flex items-center gap-1 t-xs font-bold" style={{ color: inLang ? "var(--arbor-clay-deep)" : "var(--arbor-muted)" }}>
                    {/* CR-13: the arrow used `rtl:-scale-x-100`, a variant this
                        build never emitted — the glyph pointed right on a
                        right-to-left page, i.e. backwards. `isRtl` is already
                        resolved above from the UI language, so mirror inline
                        where nothing can drop the rule. */}
                    <Icon
                      name={kid ? "sports_esports" : "arrow_forward"}
                      size={13}
                      style={!kid && isRtl ? { transform: "scaleX(-1)" } : undefined}
                    />
                    {kid
                      ? t("elev.practice.studio.opensWorld", { world: t(world.kidNameKey) })
                      : !inLang && world.fallbackTabNameKey
                      ? t("elev.practice.studio.notInLanguage", { tab: t(world.fallbackTabNameKey) })
                      : world.tabNameKey
                      ? t("practice.studio.openIn", { tab: t(world.tabNameKey) })
                      : t("practice.studio.openDirect")}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </>
      )}
      </section>

      {/* OBJ-PRACTICE-01: a three-pill "related parent spines" row (Language,
          Daily Play, Development Check) used to sit here. #/practice declares a
          moduleBudget of 2 and a single primary move ("start-world"); a row of
          three sideways doors under the world grid is a third module and three
          competing moves, and every one of those destinations already has its
          own hub door in the sidebar and the More sheet. Deleted, not hidden —
          nothing became unreachable (routeReachability.test.ts). */}
      {/* Register note — what practice is and is not */}
      <p className="t-xs" style={{ color: "var(--arbor-faint)" }}>
        {t("practice.studio.note")}
      </p>
    </div>
  );
}
