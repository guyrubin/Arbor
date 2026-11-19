import React, { useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useHashQuery } from "../../hooks/useHashQuery";
import { routeHash } from "../../lib/routes";
import { kidModeOpenFor, TOGETHER_CARDS } from "../../lib/age/playGate";
import { genderedKey } from "../../lib/today/fromRecord";
import { SINCE_LAST_PLAY_FALLBACK_MS } from "../../lib/kidExitRecap";
import { lastKidSessionStartedAt } from "../../lib/kidModeGate";
import { trackPracticeStudioOpen, trackPracticeTogetherDid } from "../../lib/kpiEvents";
import { TOGETHER_ART } from "../../lib/parentArt";
import { usePracticeData } from "../../practice/usePracticeData";
import { parentDoorTarget } from "../kidmode/studioV2/studioCatalog";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
import { readParentPin } from "../kidmode/parentGate";
import { requestOpenSettings } from "../layout/settingsBus";
import { opensInKidMode, studioCountKey, studioCountsSince, studioWorldsForChild, worksInLanguage, type StudioWorld } from "../practice/studioWorlds";
import { OFFSCREEN_IDEAS, worldArtSrc } from "../companion/companionChoices";
import Icon from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import type { Composition } from "../../design/useComposition";
import { Token } from "../../design/primitives";
import { useObservations } from "../../hooks/useObservations";
import { recapWeekStartMs } from "../../hooks/useWeeklyRecap";
import { KID_ORIGINS } from "../../lib/weekGlance";
import { fmtDayV10 } from "../../lib/formatDate";
import { TOGETHER_COPY } from "./togetherCopy";
import "../companion/companionExperience.css";
import "./together.css";

/* ════════════════════════════════════════════════════════════════════════════
   Together › Play, the Kids Studio side (v10.1). These were Together's games,
   away-from-the-screen ideas and gate card before the in-page filter became
   the shell's pills; their behaviour is unchanged:
   - a game card opens its preview; "Start playing" hands over to Kids Studio
     through the existing entry seam (or opens the parent tool directly for a
     world that does not open in Kid Mode or this language);
   - the hand-over is the second way into Kid Mode (the top-bar pill stays the
     first), with "Set a PIN" when none is set;
   - an idea opens its preview, and "We already tried it" keeps one moment.
   Nothing here starts a camera or microphone or writes an activity because it
   is seen. Counts per world are counts of what was done, never how well.
   ════════════════════════════════════════════════════════════════════════════ */

type Preview = { kind: "world"; world: StudioWorld } | { kind: "offscreen"; id: string };

export function usePlayStudio() {
  const { childProfile, setActiveTab, saveMoment } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const { worlds } = studioWorldsForChild(lang, childProfile);
  const kidAvailable = kidModeOpenFor(childProfile);
  const { request: requestKidMode, step: heroStep } = useKidModeEntry();
  const practiceData = usePracticeData(childProfile.id);
  const playWindow = useMemo(() => ({ sinceMs: lastKidSessionStartedAt() ?? Date.now() - SINCE_LAST_PLAY_FALLBACK_MS }), [childProfile.id]);
  const counts = useMemo(
    () => studioCountsSince({ speech: practiceData.speech, mimic: practiceData.mimic, adventures: practiceData.adventures, events: practiceData.events }, playWindow.sinceMs),
    [practiceData.speech, practiceData.mimic, practiceData.adventures, practiceData.events, playWindow.sinceMs],
  );
  const playLoaded = [practiceData.speech, practiceData.mimic, practiceData.adventures, practiceData.events].every((c) => c.loaded);

  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const writing = useRef(false);
  const keptIds = useRef(new Set<string>());
  const previewVisit = useRef(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [previewState, setPreviewState] = useState<{ childId: string; value: Preview | null }>({ childId: childProfile.id, value: null });
  const preview = previewState.childId === childProfile.id ? previewState.value : null;
  const setPreview = (value: Preview | null) => {
    previewVisit.current += 1;
    setSaveError(false);
    setPreviewState({ childId: childProfile.id, value });
  };
  const [keptState, setKeptState] = useState<{ childId: string; ids: string[] }>({ childId: childProfile.id, ids: [] });
  const kept = keptState.childId === childProfile.id ? keptState.ids : [];
  useEffect(() => { setPreview(null); setKeptState({ childId: childProfile.id, ids: [] }); }, [childProfile.id]);

  // Routines' "Continue a favorite" opens the world's preview here by address (#/daily-play?world=<id>), once.
  const requestedWorld = useHashQuery().get("world");
  const handledWorld = useRef<string | null>(null);
  useEffect(() => {
    const world = worlds.find((w) => w.id === requestedWorld);
    if (!world || !kidAvailable) return;
    const key = `${childProfile.id}:${world.id}`;
    if (handledWorld.current === key) return;
    handledWorld.current = key;
    setPreview({ kind: "world", world });
    if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", `#${routeHash("daily-play")}`);
  }, [requestedWorld, worlds, kidAvailable, childProfile.id]);

  const openWorld = (world: StudioWorld) => {
    setPreview(null);
    const direct = (!opensInKidMode(world) || !worksInLanguage(world, lang)) && !!world.tab;
    trackPracticeStudioOpen(world.id, direct ? "direct" : "kidmode");
    if (direct && world.tab) setActiveTab(world.tab);
    else requestKidMode(parentDoorTarget(world.id));
  };
  const offlineIds: readonly string[] = kidAvailable ? OFFSCREEN_IDEAS.map((idea) => idea.id) : TOGETHER_CARDS;
  const offline = (id: string) => {
    const idea = OFFSCREEN_IDEAS.find((item) => item.id === id);
    return idea ? { title: idea.title[lang], detail: idea.detail[lang], say: idea.say[lang], icon: idea.icon }
      : { title: t(`elev.ages.together.${id}.title`), detail: t(`elev.ages.together.${id}.do`), say: t(`elev.ages.together.${id}.say`), icon: "favorite" };
  };
  const keepOffline = async (id: string) => {
    if (!active.current || keptIds.current.has(id) || writing.current) return;
    writing.current = true;
    const visit = previewVisit.current;
    const isCurrent = () => active.current;
    const samePreview = () => isCurrent() && previewVisit.current === visit;
    setSaving(true); setSaveError(false);
    const idea = offline(id);
    const moment = kidAvailable ? t("companion.together-view.we-tried-together", { value0: idea.title }) : t(`elev.ages.together.${id}.moment`);
    // The inline alert is this failure's one message; the seam stays quiet.
    try {
      const saved = await saveMoment(moment, { callerShowsFailure: true, requireAcknowledgement: true, retryKey: `together-offscreen:${id}`, isCurrent });
      if (!isCurrent()) return;
      if (saved) {
        keptIds.current.add(id);
        setKeptState({ childId: childProfile.id, ids: [...keptIds.current] });
        trackPracticeTogetherDid(id);
      } else if (samePreview()) setSaveError(true);
    } catch { if (samePreview()) setSaveError(true); }
    finally { writing.current = false; if (isCurrent()) setSaving(false); }
  };

  return { worlds, kidAvailable, counts, playLoaded, preview, setPreview, openWorld, offlineIds, offline, keepOffline, kept, saving, saveError, requestKidMode, heroStep };
}

export type PlayStudio = ReturnType<typeof usePlayStudio>;

/** The seven games (those listed for the child's age), each once. */
export function PlayGames({ studio, composition }: { studio: PlayStudio; composition: Composition }) {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const copy = TOGETHER_COPY[uiLang === "he" ? "he" : "en"];
  const phone = composition === "phone";
  const name = childProfile.name?.split(" ")[0] || t("companion.together-view.your-child");
  const { worlds, counts, playLoaded } = studio;
  const intro = (
    <div className="tg-stack" style={{ gap: 6, padding: phone ? "0 2px" : "4px 6px", justifyContent: "center" }}>
      <h2 className="pl-k" id="play-games-title" style={{ margin: 0 }}><span className="pl-ico"><Icon name="extension" size={17} /></span>{t("companion.together-view.little-invitations-to-play")}</h2>
      <span className="small" style={{ lineHeight: 1.35 }}>{t("companion.together-view.first-choose-then-play")} {copy.gamesIntro(name)}</span>
    </div>
  );
  return (
    <section className="vt pl-game" data-module="play-games" aria-labelledby="play-games-title" style={{ borderRadius: 18, gap: 8, padding: phone ? "12px 12px 14px" : "14px 16px 16px" }}>
      {worlds.length === 0 ? <>{intro}<p className="small">{t("companion.together-view.there-are-no-listed-screen-games-for-this")}</p></> : (
        <div style={phone ? { display: "flex", flexDirection: "column", gap: 8 } : { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px 10px" }}>
          {intro}
          {worlds.map((world) => {
            const n = counts.byWorld[world.id] ?? 0;
            const art = worldArtSrc(world.id);
            return (
              <button key={world.id} type="button" className={phone ? "pl-gm pl-game m" : "pl-gm pl-game c4"} data-world={world.id} aria-haspopup="dialog" onClick={() => studio.setPreview({ kind: "world", world })}>
                <span className="im"><img src={art.src480} srcSet={`${art.src480} 1x, ${art.src} 2x`} alt="" width="480" height="320" loading="lazy" decoding="async" /></span>
                <span className="nm">
                  {t(world.kidNameKey)}
                  {playLoaded && n > 0 && <span className="tg-rnd" style={{ marginInlineStart: 6 }} data-testid="together-world-count">{t(studioCountKey(world.unit, n), { n })}</span>}
                </span>
                <p>{t(`practice.world.${world.key}.skill`)}</p>
                <span className="go">{t("companion.together-view.preview-before-playing")}<Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" /></span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** The hand-over (Start playing · Set a PIN) and the grown-up gate drawn as a step. */
export function PlayHandOver({ studio, composition }: { studio: PlayStudio; composition: Composition }) {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const copy = TOGETHER_COPY[uiLang === "he" ? "he" : "en"];
  const name = childProfile.name?.split(" ")[0] || t("companion.together-view.your-child");
  const pinSet = Boolean(readParentPin());
  if (!studio.kidAvailable) {
    return (
      <div className="pl-st pl-gate" data-testid="together-gate" style={{ position: "static" }}>
        <p dir="auto" className="pl-p">{t(genderedKey("elev.ages.practice.fromThree", childProfile.gender), { name })}</p>
      </div>
    );
  }
  const phone = composition === "phone";
  return (
    <div className="pl-handover" style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1.3fr) minmax(0,1fr)", gap: 12 }}>
      <section className="pl-st pl-gate" data-testid="together-gate" aria-labelledby="play-handover-title" style={{ position: "static" }}>
        <h2 className="pl-k" id="play-handover-title" style={{ margin: 0 }}><span className="pl-ico"><Icon name="arrow_forward" size={17} className="rtl:-scale-x-100" /></span>{copy.handOver}</h2>
        <p className="pl-p">{pinSet ? t("companion.together-view.you-choose-when-to-enter-play-your-pin-pro") : t("companion.together-view.play-opens-in-the-child-area-set-a-pin-to")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "auto" }}>
          <button type="button" className="pl-btn ink" data-testid="together-start-playing" onClick={() => { trackPracticeStudioOpen("kidmode", "hero"); studio.requestKidMode(); }}><Icon name="play_arrow" size={18} />{t("companion.together-view.start-playing")}</button>
          {!pinSet && <button type="button" className="pl-btn ghost" data-testid="together-gate-pin" onClick={() => requestOpenSettings({ focus: "pin" })}><Icon name="lock" size={16} />{t("companion.together-view.set-a-pin")}</button>}
        </div>
      </section>
      <div className="pl-st pl-gate band" style={{ position: "static", flexDirection: "row", alignItems: "center", gap: 12, padding: "10px 14px" }}>
        <span className="pl-ico r" aria-hidden="true"><Icon name="lock" size={17} /></span>
        <div className="tg-stack" style={{ gap: 2 }}>
          <span className="pl-t" style={{ fontSize: 16 }}>{copy.gateTitle}</span>
          <span className="pl-p" style={{ fontSize: 12, lineHeight: 1.3 }}>{copy.gateSub}</span>
        </div>
      </div>
    </div>
  );
}

/** Something small to do together (the away-from-the-screen ideas) and the way to More ideas. */
export function PlayTogetherIdeas({ studio, onMoreIdeas }: { studio: PlayStudio; onMoreIdeas: () => void }) {
  const { t } = useLanguage();
  return (
    <section className="vt pl-idea" data-module="play-together-ideas" aria-labelledby="play-ideas-title" style={{ borderRadius: 18, gap: 8, padding: "14px 16px 16px" }}>
      <h2 className="pl-k" id="play-ideas-title" style={{ margin: 0 }}><span className="pl-ico"><Icon name="favorite" size={17} /></span>{t("companion.together-view.something-small-to-do-together")}</h2>
      <div className="tg-stack" style={{ gap: 7 }}>
        {studio.offlineIds.map((id) => {
          const idea = studio.offline(id);
          return (
            <button key={id} type="button" className="tg-ro" data-testid="together-idea" aria-haspopup="dialog" onClick={() => studio.setPreview({ kind: "offscreen", id })} style={{ gridTemplateColumns: "46px minmax(0, 1fr)", gap: "2px 10px", padding: "7px 12px 7px 7px", alignContent: "center" }}>
              <span className="mini" style={{ width: 46, height: 46, borderRadius: 11 }} aria-hidden="true"><Icon name={idea.icon} size={24} /></span>
              <span className="tg-stack" style={{ gap: 1, minWidth: 0 }}>
                <span className="ttl2" style={{ fontSize: 13 }}>{idea.title}</span>
                <span className="ds-said" dir="auto" style={{ fontSize: 14, lineHeight: 1.2 }}>“{idea.say}”</span>
                <span className="small" style={{ fontWeight: 600, color: "var(--sapphire-deep)", display: "inline-flex", alignItems: "center", gap: 2 }}>{t("companion.together-view.how-to-begin")}<Icon name="chevron_right" size={14} className="rtl:-scale-x-100" /></span>
              </span>
            </button>
          );
        })}
        <button type="button" className="tg-ro" data-together-return="more-ideas" onClick={onMoreIdeas} style={{ gridTemplateColumns: "minmax(0, 1fr) auto", padding: "10px 14px", alignContent: "center" }}>
          <span className="ttl2" style={{ fontSize: 14 }}>{t("companion.together-view.more-ideas")}</span>
          <span style={{ color: "var(--sapphire-deep)" }} aria-hidden="true"><Icon name="chevron_right" size={18} className="rtl:-scale-x-100" /></span>
        </button>
      </div>
    </section>
  );
}

/** The preview surface for a game or an idea (bottom sheet on compact widths). */
export function PlayPreview({ studio }: { studio: PlayStudio }) {
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const PreviewSurface = useCompactSurface() ? Sheet : Modal;
  const { preview } = studio;
  const title = preview?.kind === "world" ? t(preview.world.kidNameKey) : preview ? studio.offline(preview.id).title : "";
  return (
    <PreviewSurface open={preview !== null} onClose={() => studio.setPreview(null)} title={title}>
      {preview?.kind === "world" && <div className="companion-preview" dir={he ? "rtl" : "ltr"}>
        <img src={worldArtSrc(preview.world.id).src480} srcSet={`${worldArtSrc(preview.world.id).src480} 1x, ${worldArtSrc(preview.world.id).src} 2x`} width="480" height="320" alt="" decoding="async" />
        <p>{t(`practice.world.${preview.world.key}.skill`)}</p>
        <p className="companion-caption">{!worksInLanguage(preview.world, lang) ? t("companion.together-view.this-voice-game-is-currently-in-english-op") : opensInKidMode(preview.world) ? t("companion.together-view.when-you-are-ready-enter-the-child-area-yo") : t("companion.together-view.open-the-language-tools-in-the-parent-area")}</p>
        <button type="button" className="companion-primary" onClick={() => studio.openWorld(preview.world)}><Icon name="play_arrow" size={20} />{worksInLanguage(preview.world, lang) && opensInKidMode(preview.world) ? t("companion.together-view.start-playing") : t("companion.together-view.open")}</button>
      </div>}
      {preview?.kind === "offscreen" && <div className="companion-preview" dir={he ? "rtl" : "ltr"}>
        <img src={TOGETHER_ART.src} srcSet={TOGETHER_ART.srcSet} width={TOGETHER_ART.width} height={TOGETHER_ART.height} alt="" />
        <p>{studio.offline(preview.id).detail}</p><blockquote className="companion-say" dir="auto">{t("elev.loop.ms.quoted", { text: studio.offline(preview.id).say })}</blockquote>
        <p className="companion-caption">{t("companion.together-view.you-can-put-the-screen-down-and-try-it-the")}</p>
        <button type="button" className="companion-primary" onClick={() => studio.setPreview(null)}>{t("companion.together-view.let-s-give-it-a-try")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>
        <button type="button" className="companion-text-button" disabled={studio.saving || studio.kept.includes(preview.id)} onClick={() => void studio.keepOffline(preview.id)}><Icon name={studio.kept.includes(preview.id) ? "check" : "bookmark_add"} size={18} />{studio.kept.includes(preview.id) ? t("companion.together-view.a-moment-from-your-time-together-is-saved") : t("companion.together-view.we-already-tried-it-keep-the-moment")}</button>
      </div>}
      {studio.saveError && <p role="alert" className="companion-caption">{t("companion.together-view.the-moment-wasn-t-saved-please-try-again")}</p>}
    </PreviewSurface>
  );
}

/**
 * What <name> did there: the Kids Studio sessions this week and the latest day,
 * from the same observations Weekly counts as Kids Studio (KID_ORIGINS). Counts
 * of what was done, never how well; with none this week, the board's empty line.
 */
export function PlayDidThere({ composition }: { composition: Composition }) {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = TOGETHER_COPY[lang];
  const name = childProfile.name?.split(" ")[0] || t("companion.together-view.your-child");
  const observations = useObservations();
  const now = new Date();
  const weekStart = recapWeekStartMs(now);
  const kidAt = observations
    .filter((o) => KID_ORIGINS.has(o.origin))
    .map((o) => Date.parse(o.at))
    .filter((ms) => Number.isFinite(ms) && ms <= now.getTime());
  const thisWeek = kidAt.filter((ms) => ms >= weekStart).length;
  const latest = kidAt.length > 0 ? Math.max(...kidAt) : null;
  // "Last time": what was done on the latest Kids Studio day (the board's "5 things last time").
  const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
  const lastTime = latest === null ? 0 : kidAt.filter((ms) => sameDay(ms, latest)).length;
  const phone = composition === "phone";
  return (
    <section className="vt pl-game" data-testid="play-did-there" aria-labelledby="play-did-title" style={{ borderRadius: 18, gap: 8, padding: phone ? "12px 12px 14px" : "14px 20px" }}>
      <div className={phone ? "tg-stack" : "line between"} style={{ gap: phone ? 8 : 20, alignItems: phone ? undefined : "center" }}>
        <div className="tg-stack" style={{ gap: 6, minWidth: 0 }}>
          <h2 className="pl-k" id="play-did-title" style={{ margin: 0 }}><span className="pl-ico"><Icon name="check" size={17} /></span>{copy.didThere(name)}</h2>
          <p className="pl-p" dir="auto">
            {thisWeek === 0 && copy.didNone}
            {latest !== null && thisWeek > 0 && <> {copy.didLatest(fmtDayV10(latest, lang, now))}</>}
          </p>
        </div>
        {(thisWeek > 0 || lastTime > 0) && (
          <div className="line" style={{ gap: 14, flexWrap: "wrap" }}>
            {thisWeek > 0
              ? <div className="fig md"><b className="arbor-num">{thisWeek}</b><span>{copy.didUnit(thisWeek)}</span></div>
              : <div className="fig md"><b className="arbor-num">{lastTime}</b><span>{copy.didLastTime(lastTime)}{latest !== null && <small>{fmtDayV10(latest, lang, now)}</small>}</span></div>}
            <span className="pl-did-tok" aria-hidden="true">
              {Array.from({ length: Math.min(thisWeek > 0 ? thisWeek : lastTime, 7) }, (_, i) => <Token key={i} kind="kid" size="sm" label="" />)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
