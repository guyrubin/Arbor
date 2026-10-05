/**
 * BookReader — B-BOOK-04/12: the new kid book reader (lane C §2, §4, §6;
 * RULINGS BR3/BR6/BR8; fix round 1 of the rendered pass). It renders ONE
 * resolved book with zero model calls:
 *
 *   cover (the book's front: title in the plate's calm band, ONE Open toy;
 *   tap the picture to hear the title) → pages → the decision page (three
 *   LARGE picture cards on the text page: a tap selects + speaks the card,
 *   "This one!" commits; no timer, no grade) → the chosen branch → a repair
 *   page holds until the child has tapped each piece, in order where the book
 *   says so (only the next piece glows; nothing can fail) → the rejoin page
 *   with the path's echo line → p9's fall (ordered ART STATES, v2: the dust
 *   on the narration cue, then "the soldiers rise" ~2 s later; a Next press
 *   brings the next state; 1.5 s of stillness after the last) → the last
 *   page → Next → the END screen ("The End", the frame line, Read again /
 *   close, the grown-up's panel behind a small control). No "Another way?".
 *
 * - Wide (>= 900 px, landscape): an open book — every story page is FACING
 *   (the whole plate on a paper art page beside the paper text page); a
 *   spread is honoured only when its words fit the plate's calm rect. Hebrew
 *   puts the text page on the left and turns the other way; the art is not
 *   mirrored. Narrow / portrait: a 3:4 window (>= 300 px wide) on top, the
 *   words on a paper sheet below, a big next control.
 * - Page turn: a paper leaf folds toward the spine (transform + opacity only);
 *   reduced motion = a 200 ms cross-fade.
 * - Read-aloud: pre-rendered whole-page FILES (narration.ts); the one
 *   per-child Sound toggle silences them. No file = silence, never TTS.
 * - Keyboard: ← / → turn pages (mirrored in Hebrew), Space turns forward,
 *   Esc closes.
 * - A story choice lives only in this component's memory: nothing is written,
 *   nothing describes the child, no number is shown.
 */
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { KidToy } from "../kidmode/KidToy";
import { kidSfx, useKidReadAloudMuted } from "../kidmode/audio/kidAudio";
import { Icon } from "../ui/Icon";
import { BookPage, type BookPageItem, type BookPageOverlay } from "./BookPage";
import { BookEnd, BookSoundToggle, PointingHand } from "./BookParts";
import { useNarration } from "./useNarration";
import { ART_STATE_HOLD_MS, nextIntent, nextStateDelay, overlayHiddenAt, pageArtStates, stagedOverlayIds, statePlateAt } from "../../lib/library/bookArtStates";
import {
  bookFlowReducer,
  canTurnForward,
  COVER,
  currentPage,
  END,
  initialBookFlow,
  isDecision,
  isEnding,
  nextRepairItem,
  readPath,
  repairDone,
  repairedItems,
  type BookFlowState,
} from "../../lib/library/bookFlow";
import { computeBookPageLayout, type Box, type LayoutContent, type Rect } from "../../lib/library/bookPageLayout";
import { focusBackground, overlaySources, plateSources, type PlateTable } from "../../lib/library/bookPlates";
import { BOOK_PLATES } from "../../lib/library/books";
import { bookString } from "../../lib/library/bookStrings";
import { TURN_GLYPHS } from "../../lib/library/bookGlyphs";
import { heGender, heroDisplayName, heroParts, labelFor, lineFor, pageParagraphs, paragraphChars } from "../../lib/library/bookText";
import { choicePictureSources, heroPrint, heroSpriteUrl, resolveHeroSheet, sheetAnchorOf, type HeroSheet } from "../../lib/library/heroSheet";
import { declaredAudio, DEV_NARRATION_ROOT, NARRATION_ROOT, narrationKey, pageNarrationSrc } from "../../lib/library/narration";
import type { Book, BookLang, BookReaderChild, Page } from "../../lib/library/types";
import "./bookReader.css";

export interface BookReaderProps {
  book: Book;
  lang: BookLang;
  child: BookReaderChild;
  /** Close returns to wherever the reader was opened. */
  onClose: () => void;
  /** The book's plate table (default: the registry's). */
  plates?: PlateTable;
  /** DEV placeholders + DEV hero sheets + DEV narration root. */
  dev?: boolean;
  /** "probe" = try the conventional file path; "declared" = only files the
   *  book names; "off" = silent (tests). */
  narration?: "probe" | "declared" | "off";
  /** Test / resume seam. */
  initialState?: BookFlowState;
  /** Test seam: the stage size before it is measured. */
  initialBox?: Box;
  /** The child's hero sheet with its manifest read (loadHeroSheet); default =
   *  the sync resolver (no manifest: no anchors, no prints). */
  sheet?: HeroSheet | null;
  /** Show the sheet's printed pages where it has them (default on). */
  prints?: boolean;
  /** A costume variant for pages that author one (`heroAlt`, e.g. "tunic"). */
  costume?: string | null;
  /** Test seam: the page opens at this art stage (true = every state shown). */
  initialRevealed?: boolean | number;
  /** Test seam: the decision page opens in its cards state. */
  initialChoosing?: boolean;
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const BAR_WIDE = 72;
const BAR_NARROW = 56;
const isWide = (w: number, h: number) => w >= 900 && w >= h;
/** After the last art state: stillness before Next is enabled (ruling 5). */
export const AFTER_REVEAL_HOLD_MS = ART_STATE_HOLD_MS;
export { nextIntent };

function viewportBox(): Box {
  if (typeof window === "undefined") return { width: 1920, height: 1080 - BAR_WIDE };
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { width: w, height: h - (isWide(w, h) ? BAR_WIDE : BAR_NARROW) };
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;
const rectStyle = (r: Rect): CSSProperties => ({ left: px(r.x), top: px(r.y), width: px(r.w), height: px(r.h) });

/** A choice card's picture (fix round 2, ruling 2): the dedicated 4:3 files
 *  (the child's own first, then the book's scene picture); when none loads,
 *  the plate's focus crop (or the icon). */
function CardPicture({ srcs, fallback }: { srcs: readonly string[]; fallback: ReactNode }) {
  const [i, setI] = useState(0);
  const key = srcs.join("|");
  useEffect(() => setI(0), [key]);
  if (i >= srcs.length) return <>{fallback}</>;
  return (
    <span className="bk-card-pic" aria-hidden="true" data-card-art="">
      <img key={srcs[i]} src={srcs[i]} alt="" draggable={false} decoding="async" onError={() => setI(i + 1)} />
    </span>
  );
}

function Words({ text, name }: { text: string; name: string }) {
  return (
    <>
      {heroParts(text, name).map((part, i) => (part.hero ? <bdi key={i} data-book-name="">{part.text}</bdi> : <Fragment key={i}>{part.text}</Fragment>))}
    </>
  );
}

export function BookReader({
  book,
  lang,
  child,
  onClose,
  plates,
  dev = import.meta.env.DEV,
  narration = "probe",
  initialState,
  initialBox,
  sheet: sheetProp,
  prints = true,
  costume = null,
  initialRevealed = false,
  initialChoosing = false,
}: BookReaderProps) {
  const plateTable = plates ?? BOOK_PLATES[book.id] ?? {};
  const [state, dispatch] = useReducer((s: BookFlowState, a: Parameters<typeof bookFlowReducer>[2]) => bookFlowReducer(book, s, a), initialState ?? initialBookFlow());
  const gender = heGender(child.gender);
  const name = heroDisplayName(child) || bookString(gender === "f" ? "name.fallback.f" : "name.fallback.m", lang);
  const resolved = useMemo(() => resolveHeroSheet(child, { dev }), [child, dev]);
  const sheet = sheetProp !== undefined ? sheetProp : resolved;
  const anchorOf = useMemo(() => sheetAnchorOf(sheet), [sheet]);
  const muted = useKidReadAloudMuted(child.id);
  const dir = lang === "he" ? "rtl" : "ltr";

  // ── the stage box ──────────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Box>(() => initialBox ?? viewportBox());
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox((b) => (Math.abs(b.width - r.width) < 1 && Math.abs(b.height - r.height) < 1 ? b : { width: r.width, height: r.height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = isWide(box.width, box.height);

  // ── what is on screen ──────────────────────────────────────────────────────
  const atEnd = state.at === END;
  const onCover = state.at === COVER;
  // The END screen is the book's LAST page (fix round 2): the last story
  // page's art on the art page, "The End" on the paper page.
  const lastPage = readPath(book, state.choiceId).slice(-1)[0] ?? book.pages[book.pages.length - 1];
  const page: Page = onCover ? book.cover : atEnd ? lastPage : currentPage(book, state) ?? book.cover;
  const story = !onCover && !atEnd;
  const plate = plateTable[page.plateId];
  const done = repairedItems(story ? page : null, state);
  const repaired = repairDone(story ? page : null, state);
  const decision = story && isDecision(book, state);
  const ending = story && isEnding(book, state);
  const repair = story ? page.repair : undefined;
  const pending = !!repair && !repaired;
  const nextItem = story ? nextRepairItem(page, state) : null;
  const doneOrder = useMemo(() => state.repaired.filter((k) => k.startsWith(`${page.id}:`)).map((k) => k.slice(page.id.length + 1)), [state.repaired, page.id]);
  const paras = story ? pageParagraphs(page, { lang, gender, choiceId: state.choiceId, repaired: doneOrder }) : [];
  const baseSlot = (costume && page.heroAlt?.[costume]) || page.hero;
  const slot = repaired && repair?.heroAfter ? repair.heroAfter : baseSlot;

  const endFrame = atEnd && lastPage.closing ? lineFor(lastPage.closing, lang, gender) : "";
  const content: LayoutContent = atEnd
    ? { paras: [endFrame.length || 1], title: bookString("theEnd", lang).length }
    : onCover
    ? {
        paras: [book.coverLine[lang].length, ...(book.coverNameLine ? [book.coverNameLine[lang].length + name.length] : [])],
        title: book.title[lang].length,
      }
    : {
        paras: paragraphChars(paras, name),
        choices: decision ? book.decision.choices.length : undefined,
        prompt: pending,
      };

  // ── narration ──────────────────────────────────────────────────────────────
  const voiceKey = child.heroSheetId?.trim() || child.id;
  const root = dev ? DEV_NARRATION_ROOT : NARRATION_ROOT;
  const keyBase = { bookId: book.id, lang, gender, voiceKey };
  const probe = narration === "probe";
  // The cover is read only when the child taps the picture (ruling 9).
  const pageSrc =
    narration === "off" || !story
      ? null
      : repaired && repair
        ? declaredAudio(repair.audio, lang, gender) ?? (probe ? narrationKey({ ...keyBase, pageId: `${page.id}-after` }, root) : null)
        : pageNarrationSrc(page, { ...keyBase, choiceId: state.choiceId }, { probe, root });
  const revealAt = page.overlays?.find((o) => o.reveal === "afterNarration")?.revealAt;
  const showKey = `${state.at}|${repaired ? "after" : "before"}`;
  const voice = useNarration(pageSrc, { showKey, muted, enabled: narration !== "off", revealAt });

  // ── art states (v2, engine 1): stage 0 = the page as authored ─────────────
  const artStates = useMemo(() => (story ? pageArtStates(page, (id) => !!plateTable[id]) : []), [story, page, plateTable]);
  const staged = artStates.length > 0;
  const [stageRec, setStageRec] = useState<{ at: string; n: number }>(() => ({
    at: (initialState ?? initialBookFlow()).at,
    n: initialRevealed === true ? Number.MAX_SAFE_INTEGER : typeof initialRevealed === "number" ? initialRevealed : 0,
  }));
  const stage = stageRec.at === state.at ? Math.min(stageRec.n, artStates.length) : 0;
  const allShown = staged && stage >= artStates.length;
  const advance = useCallback((to: number) => setStageRec((r) => ({ at: state.at, n: Math.max(r.at === state.at ? r.n : 0, to) })), [state.at]);
  // the first state on the narration's reveal moment
  useEffect(() => {
    if (staged && voice.revealed && artStates[0].trigger === "narration") advance(1);
  }, [staged, voice.revealed, artStates, advance]);
  // a timed state after the previous one (silent timings when nothing played)
  const silent = !voice.heard;
  useEffect(() => {
    const d = nextStateDelay(artStates, stage, silent);
    if (d == null) return;
    const t = setTimeout(() => advance(stage + 1), d);
    return () => clearTimeout(t);
  }, [artStates, stage, silent, advance]);
  // after the last state: stillness before Next (ruling 5)
  const [holdUntil, setHoldUntil] = useState(0);
  const [, setTick] = useState(0);
  const skipHold = useRef(initialRevealed !== false && initialRevealed !== 0);
  useEffect(() => {
    if (!allShown) return;
    if (skipHold.current) {
      skipHold.current = false;
      return;
    }
    setHoldUntil(Date.now() + AFTER_REVEAL_HOLD_MS);
    const t = setTimeout(() => setTick((n) => n + 1), AFTER_REVEAL_HOLD_MS + 20);
    return () => clearTimeout(t);
  }, [allShown, state.at]);
  const holding = allShown && Date.now() < holdUntil;

  // Repair prompt (`<page>-prompt`) once the page is ready (ruling 9).
  const prompted = useRef<string | null>(null);
  useEffect(() => {
    if (!pending || !voice.settled || prompted.current === state.at || !probe) return;
    prompted.current = state.at;
    voice.playClip(narrationKey({ ...keyBase, pageId: `${page.id}-prompt` }, root));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, voice.settled, state.at]);

  // A print replaces plate + sprite — unless a costume variant is shown or an
  // art state has come (the live composite returns under the dust / the
  // state plate). The layout ALWAYS uses the plate's own size: no frame jump.
  const print = story || onCover || atEnd ? (prints && !(costume && page.heroAlt?.[costume]) && !(staged && stage > 0) ? heroPrint(sheet, page.id) : null) : null;
  const layout = computeBookPageLayout(page, box, lang, { plate, slot, content, anchorOf, cover: onCover });
  const coverFront = onCover && layout.mode === "wide" && layout.pageType === "cover";

  // ── the decision page (fix round 2): the same book as every page; its cards
  // sit below the words ("below") or fill the text page in a second state
  // ("second": the words first with a Choose toy, then the cards) ───────────
  const plan = decision ? layout.choicePlan : null;
  const twoState = plan?.mode === "second";
  const [choosingAt, setChoosingAt] = useState<string | null>(() => (initialChoosing || (decision && state.selected) ? state.at : null));
  const choosing = twoState && choosingAt === state.at;
  // coming back to the decision page with a choice made: show the cards
  useEffect(() => {
    if (decision && state.selected && twoState) setChoosingAt(state.at);
  }, [decision, state.at, state.selected, twoState]);
  const showCards = !!plan && (!twoState || choosing);
  const showWords = !choosing;

  // ── page-turn cue ──────────────────────────────────────────────────────────
  const lastAt = useRef(state.at);
  useEffect(() => {
    if (lastAt.current !== state.at && state.dir !== 0) kidSfx("pageTurn");
    lastAt.current = state.at;
  }, [state.at, state.dir]);

  // ── actions ────────────────────────────────────────────────────────────────
  /** Next: while an art state is still to come, a press brings it; while the
   *  stillness after the last holds, nothing. */
  const next = useCallback(() => {
    if (twoState && !choosing) {
      setChoosingAt(state.at);
      return;
    }
    const intent = nextIntent(staged, allShown, holding);
    if (intent === "reveal") advance(stage + 1);
    else if (intent === "turn") dispatch({ type: "next" });
  }, [staged, allShown, holding, stage, advance, state.at, twoState, choosing]);
  /** Back from the cards state returns to the words of the same page. */
  const back = useCallback(() => {
    if (choosing) setChoosingAt(null);
    else dispatch({ type: "back" });
  }, [choosing]);
  const tapItem = (id: string) => {
    if (done.has(id) || (nextItem && nextItem !== id)) return;
    kidSfx("tap");
    const item = repair?.items.find((it) => it.id === id);
    voice.playClip(item?.sound ?? (probe && item?.line ? narrationKey({ ...keyBase, pageId: `${page.id}-${id}` }, root) : null));
    dispatch({ type: "repair", itemId: id });
  };
  const choose = (choiceId: string) => {
    const c = book.decision.choices.find((x) => x.id === choiceId);
    voice.playClip(declaredAudio(c?.audio, lang, gender) ?? (probe ? narrationKey({ ...keyBase, pageId: `${book.decision.pageId}-choice`, choiceId }, root) : null));
    // a tap selects (and speaks); "This one!" commits (ruling 2)
    if (state.selected !== choiceId) dispatch({ type: "choose", choiceId });
  };
  const hearCover = () => {
    if (narration === "off") return;
    voice.playClip(declaredAudio(book.cover.audio, lang, gender) ?? (probe ? narrationKey({ ...keyBase, pageId: "cover" }, root) : null));
  };

  // ── keyboard: arrows (mirrored in HE), Space, Esc ──────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const forward = (e.key === "ArrowRight") === (dir === "ltr");
        if (forward) next();
        else back();
      } else if (e.key === " " && !(t && t.tagName === "BUTTON")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dir, onClose, next, back]);

  // ── the words fit (DOM safety net over the layout's estimate) ──────────────
  const wordsRef = useRef<HTMLDivElement | null>(null);
  const fitKey = `${state.at}|${box.width}x${box.height}|${paras.join("|")}`;
  const [fit, setFit] = useState({ key: fitKey, shrink: 0 });
  const shrink = fit.key === fitKey ? fit.shrink : 0;
  const typePx = Math.max(16, layout.typePx - shrink);
  useIsoLayoutEffect(() => {
    const el = wordsRef.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 1 && typePx > 16) setFit({ key: fitKey, shrink: shrink + 1 });
  });

  // ── art inputs ─────────────────────────────────────────────────────────────
  const plateSrcs = print ? [print.url] : plate ? plateSources(plate, { dev }) : [];
  const statePlateId = staged ? statePlateAt(artStates, stage) : null;
  const statePlate = statePlateId ? plateTable[statePlateId] : undefined;
  const statePlateSrcs = statePlate ? plateSources(statePlate, { dev }) : null;
  const heroSrc = heroSpriteUrl(sheet, slot?.pose);
  // Only the next piece glows and can be tapped (ordered repairs, ruling 4).
  const items: BookPageItem[] = pending && repair
    ? repair.items
        .filter((it) => !done.has(it.id) && (!nextItem || it.id === nextItem))
        .map((it) => ({ id: it.id, x: it.x, y: it.y, done: false, label: it.label ? labelFor(it.label, lang) : bookString("repair.tap", lang) }))
    : [];
  // On a print only the staged overlays draw (the rest are baked in).
  const stagedIds = stagedOverlayIds(artStates);
  const overlays: BookPageOverlay[] = (story ? page.overlays ?? [] : [])
    .filter((o) => !print || stagedIds.has(o.id))
    .map((o) => ({
      ...o,
      srcs: overlaySources(book.id, o, { dev }),
      hidden: overlayHiddenAt(artStates, stage, o.id) || (!!o.showWhen && done.has(o.showWhen.item) !== o.showWhen.done),
      hop: !!o.showWhen?.done && done.has(o.showWhen.item),
    }));

  // ── the turn ───────────────────────────────────────────────────────────────
  const turnClass = state.dir === 1 ? "fwd" : state.dir === -1 ? "back" : "none";
  const leaf = layout.mode === "wide" && layout.pageType === "facing" && state.dir !== 0 && !atEnd ? leafFor(layout, state.dir) : null;

  // ── the text page ──────────────────────────────────────────────────────────
  const pad = choosing && plan?.pad ? plan.pad : layout.pad;
  const textStyle: CSSProperties = {
    ...rectStyle(layout.textPage),
    paddingInline: px(pad.inline),
    paddingBlock: px(pad.block),
  };
  const wordsStyle: CSSProperties = { fontSize: px(typePx), lineHeight: layout.lineHeight };
  const decisionPlate = plateTable[book.pages.find((p) => p.id === book.decision.pageId)?.plateId ?? ""];

  const forward = (() => {
    if (onCover) {
      return (
        <KidToy tone="go" size="l" glyph="auto_stories" data-book-open="" aria-label={bookString("open", lang)} onClick={() => dispatch({ type: "open" })} className="bk-wide-toy">
          {bookString("open", lang)}
        </KidToy>
      );
    }
    if (decision && twoState && !choosing) {
      return (
        <KidToy tone="go" size="l" glyphEnd={TURN_GLYPHS.next} data-book-choose="" onClick={() => setChoosingAt(state.at)} className={layout.mode === "wide" ? undefined : "bk-grow"}>
          {bookString("choose", lang)}
        </KidToy>
      );
    }
    if (decision) {
      return (
        <KidToy tone="go" size="l" glyph="check" data-book-go="" disabled={!state.selected} onClick={() => dispatch({ type: "go" })}>
          {bookString("go", lang)}
        </KidToy>
      );
    }
    if (pending) return null;
    if (!canTurnForward(book, state) && !ending) return null;
    const label = bookString("next", lang);
    return layout.mode === "wide" ? (
      <KidToy tone="go" size="l" shape="round" glyph={TURN_GLYPHS.next} data-book-next="" data-holding={holding ? "" : undefined} disabled={holding} aria-label={label} onClick={next} />
    ) : (
      <KidToy tone="go" size="l" glyphEnd={TURN_GLYPHS.next} data-book-next="" data-holding={holding ? "" : undefined} disabled={holding} aria-label={label} onClick={next} className="bk-grow" />
    );
  })();

  const cards = showCards && plan && (
    <div
      className="bk-choices"
      role="group"
      aria-label={bookString("choices.aria", lang)}
      data-arrangement={plan.arrangement}
      data-plan={plan.mode}
      style={{ gap: px(plan.gap), "--card-w": px(plan.cardW), "--pic-w": px(plan.picW), "--pic-h": px(plan.picH) } as CSSProperties}
    >
      {book.decision.choices.map((c, i) => {
        const focus = decisionPlate?.focus?.[c.id];
        const bg = focus && decisionPlate ? focusBackground(decisionPlate, focus, plan.picW, plan.picH) : null;
        const srcs = decisionPlate ? plateSources(decisionPlate, { dev }) : [];
        const selected = state.selected === c.id;
        return (
          <button
            key={c.id}
            type="button"
            className="bk-card"
            data-choice-card={c.id}
            data-tone={i % 3}
            data-selected={selected ? "" : undefined}
            data-dimmed={state.selected && !selected ? "" : undefined}
            aria-pressed={selected}
            onClick={() => choose(c.id)}
          >
            <CardPicture
              srcs={choicePictureSources(sheet, book.decision.choiceArt, c.id)}
              fallback={
                bg ? (
                  <span
                    className="bk-card-pic"
                    aria-hidden="true"
                    style={{
                      backgroundImage: srcs.map((u) => `url("${u}")`).join(", "),
                      backgroundSize: srcs.map(() => bg.size).join(", "),
                      backgroundPosition: srcs.map(() => bg.position).join(", "),
                    }}
                  />
                ) : (
                  <span className="bk-card-pic bk-card-icon" aria-hidden="true">
                    <Icon name={c.icon ?? "auto_stories"} size={Math.round(Math.min(plan.picH * 0.6, 72))} fill={1} />
                  </span>
                )
              }
            />
            <span className="bk-card-label">{labelFor(c.label, lang)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="bk-reader" data-book-reader="" data-mode={layout.mode} data-page-type={atEnd ? "end" : layout.pageType} dir={dir} lang={lang} role="region" aria-label={bookString("reader.aria", lang, { title: book.title[lang] })}>
      <header className="bk-bar" style={{ blockSize: px(wide ? BAR_WIDE : BAR_NARROW) }}>
        <KidToy tone="paper" shape="round" size="s" glyph="close" data-book-close="" aria-label={bookString("close", lang)} onClick={onClose} />
        <span className="bk-bar-fill" />
        <BookSoundToggle childId={child.id} lang={lang} />
      </header>
      <div className="bk-stage" ref={stageRef}>
        {(
          <div key={state.at} className="bk-turn" data-turn={turnClass} data-book-page={atEnd ? "end" : page.id}>
            {layout.mode === "wide" && <div className={coverFront ? "bk-frame" : "bk-book"} aria-hidden="true" style={rectStyle(layout.book)} />}
            {layout.mode === "wide" && !coverFront && <div className="bk-artpage" aria-hidden="true" style={rectStyle(layout.artPage)} />}
            <BookPage
              layout={layout}
              plateSrcs={plateSrcs}
              printed={!!print}
              statePlateSrcs={statePlateSrcs}
              statePlateKey={statePlateId ?? undefined}
              tint={slot?.tint}
              occluders={page.occluders}
              fgSrc={plate?.fg}
              heroSrc={heroSrc}
              heroKey={`${page.id}|${slot?.pose ?? ""}`}
              overlays={overlays}
              items={items}
              onItem={tapItem}
              onArtTap={onCover ? hearCover : staged && !allShown ? () => advance(stage + 1) : undefined}
              pictureLabel={onCover ? bookString("hearTitle", lang) : bookString("picture", lang)}
            />
            {coverFront ? (
              <>
                <div className="bk-cover-title" data-book-text="" data-kind="cover" style={{ ...rectStyle(layout.textPage), padding: px(layout.pad.block) }}>
                  <h1 className="bk-title" style={{ fontSize: px(layout.titlePx) }}>
                    {book.title[lang]}
                  </h1>
                  {book.coverNameLine && (
                    <p className="bk-name-line" style={{ fontSize: px(Math.round(layout.titlePx * 0.5)) }}>
                      <Words text={book.coverNameLine[lang]} name={name} />
                    </p>
                  )}
                  <p className="bk-cover-line" style={{ fontSize: px(layout.typePx) }}>
                    {book.coverLine[lang]}
                  </p>
                </div>
                {layout.openRect && (
                  <div className="bk-open-row" style={rectStyle(layout.openRect)}>
                    {forward}
                  </div>
                )}
              </>
            ) : (
              <section
                className="bk-text"
                data-book-text=""
                data-end={atEnd ? "" : undefined}
                data-kind={layout.pageType === "spread" ? "panel" : layout.mode === "wide" ? "page" : "sheet"}
                data-choosing={choosing ? "" : undefined}
                data-spine={layout.spine}
                style={textStyle}
              >
                {atEnd ? (
                  <BookEnd book={book} lang={lang} gender={gender} name={name} titlePx={layout.titlePx} typePx={typePx} onReadAgain={() => dispatch({ type: "toCover" })} onClose={onClose} />
                ) : onCover ? (
                  <div className="bk-cover-words" ref={wordsRef}>
                    <h1 className="bk-title" style={{ fontSize: px(layout.titlePx) }}>
                      {book.title[lang]}
                    </h1>
                    {book.coverNameLine && (
                      <p className="bk-name-line" style={{ fontSize: px(Math.round(typePx * 1.1)) }}>
                        <Words text={book.coverNameLine[lang]} name={name} />
                      </p>
                    )}
                    <p className="bk-cover-line" style={wordsStyle}>
                      {book.coverLine[lang]}
                    </p>
                  </div>
                ) : showWords ? (
                  <div className="bk-words" ref={wordsRef} style={wordsStyle}>
                    {paras.map((p, i) => (
                      <p key={i} data-book-para={i}>
                        <Words text={p} name={name} />
                      </p>
                    ))}
                  </div>
                ) : null}
                {cards}
                {pending && repair && (
                  <p className="bk-hint" data-book-repair-prompt="">
                    <PointingHand />
                    <span>{labelFor(repair.promptLabel, lang)}</span>
                  </p>
                )}
                {!atEnd && <nav className="bk-nav" style={{ minBlockSize: px(Math.min(layout.navPx, 96) - 8) }}>
                  {!onCover ? <KidToy tone="paper" shape="round" glyph={TURN_GLYPHS.back} data-book-back="" aria-label={bookString("back", lang)} onClick={back} /> : <span />}
                  {forward}
                </nav>}
              </section>
            )}
            {leaf && <div className="bk-leaf" data-dir={state.dir === 1 ? "fwd" : "back"} aria-hidden="true" style={{ ...rectStyle(leaf.rect), transformOrigin: leaf.origin, "--leaf-rot": leaf.rot } as CSSProperties} />}
          </div>
        )}
      </div>
    </div>
  );
}

/** The paper leaf of a facing turn: forward = the text page folds toward the
 *  spine; back = the art page folds toward it. */
function leafFor(layout: ReturnType<typeof computeBookPageLayout>, d: 1 | -1): { rect: Rect; origin: string; rot: string } {
  const textSpine = layout.spine; // the text page's spine side
  const artSpine = textSpine === "left" ? "right" : "left";
  const rect = d === 1 ? layout.textPage : layout.artPage;
  const side = d === 1 ? textSpine : artSpine;
  return { rect, origin: `${side} center`, rot: side === "left" ? "-92deg" : "92deg" };
}

export default BookReader;
