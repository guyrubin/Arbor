/**
 * BookReader — B-BOOK-04: the new kid book reader (lane C §2, §4, §6; RULINGS
 * BR3/BR6/BR8). It renders ONE resolved book with zero model calls:
 *
 *   cover (title as live text) → Open → pages → the decision page (three
 *   picture cards: tap = select + hear the label if a file exists, a second
 *   tap or "This one!" commits; no timer, no grade) → the chosen branch → a
 *   repair page holds until the child has tapped EVERY item (each tap answers,
 *   nothing can fail) → the rejoin page with the path's echo line → … → the
 *   last page with its echo and frame line → "The End" closes the book. No
 *   "Another way?" (BR3): reading again starts from the cover.
 *
 * - Wide (>= 900 px, landscape): an open book — "facing" pages put the whole
 *   plate on a paper art page beside the paper text page; "spread" pages show
 *   the whole plate large with the words on a soft paper panel in its calm
 *   zone. Hebrew puts the text page on the left and turns the other way; the
 *   art is not mirrored. Narrow / portrait: a 3:4 window of the plate on top,
 *   the words on a paper sheet below, a big next control, no scrolling.
 * - Page turn: the outgoing page folds toward the spine (a paper leaf, CSS
 *   transform + opacity only) while the new page fades in; reduced motion =
 *   a 200 ms cross-fade.
 * - Read-aloud: a pre-rendered whole-page FILE per (book, voice, language,
 *   gender, page, path) — narration.ts; the one per-child Sound control
 *   (KidSoundToggle, the kid audio mute) silences it. No file = silence.
 * - Keyboard: ← / → turn pages (mirrored in Hebrew), Space turns forward,
 *   Esc closes.
 * - A story choice lives only in this component's memory: nothing is written,
 *   nothing describes the child, no number is shown.
 */
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { KidToy } from "../kidmode/KidToy";
import { KidSoundToggle } from "../kidmode/kidReadAloud";
import { kidSfx, useKidReadAloudMuted } from "../kidmode/audio/kidAudio";
import { Icon } from "../ui/Icon";
import { BookPage, type BookPageItem, type BookPageOverlay } from "./BookPage";
import { useNarration } from "./useNarration";
import {
  bookFlowReducer,
  canTurnForward,
  COVER,
  currentPage,
  initialBookFlow,
  isDecision,
  isEnding,
  repairDone,
  repairedItems,
  type BookFlowState,
} from "../../lib/library/bookFlow";
import { computeBookPageLayout, type Box, type LayoutContent, type Rect } from "../../lib/library/bookPageLayout";
import { focusBackground, overlaySources, plateSources, type PlateTable } from "../../lib/library/bookPlates";
import { BOOK_PLATES } from "../../lib/library/books";
import { bookString } from "../../lib/library/bookStrings";
import { TURN_GLYPHS } from "../../lib/library/bookGlyphs";
import { heGender, heroDisplayName, heroParts, labelFor, pageParagraphs, paragraphChars } from "../../lib/library/bookText";
import { heroPrint, heroSpriteUrl, resolveHeroSheet, sheetAnchorOf, type HeroSheet } from "../../lib/library/heroSheet";
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
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const BAR_WIDE = 72;
const BAR_NARROW = 56;
const isWide = (w: number, h: number) => w >= 900 && w >= h;

function viewportBox(): Box {
  if (typeof window === "undefined") return { width: 1920, height: 1080 - BAR_WIDE };
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { width: w, height: h - (isWide(w, h) ? BAR_WIDE : BAR_NARROW) };
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;
const rectStyle = (r: Rect): CSSProperties => ({ left: px(r.x), top: px(r.y), width: px(r.w), height: px(r.h) });

function Words({ text, name }: { text: string; name: string }) {
  return (
    <>
      {heroParts(text, name).map((part, i) => (part.hero ? <bdi key={i} data-book-name="">{part.text}</bdi> : <Fragment key={i}>{part.text}</Fragment>))}
    </>
  );
}

export function BookReader({ book, lang, child, onClose, plates, dev = import.meta.env.DEV, narration = "probe", initialState, initialBox, sheet: sheetProp, prints = true, costume = null }: BookReaderProps) {
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
  const onCover = state.at === COVER;
  const page: Page = onCover ? book.cover : currentPage(book, state) ?? book.cover;
  const plate = plateTable[page.plateId];
  const done = repairedItems(onCover ? null : page, state);
  const repaired = repairDone(onCover ? null : page, state);
  const decision = !onCover && isDecision(book, state);
  const ending = !onCover && isEnding(book, state);
  const repair = !onCover ? page.repair : undefined;
  const singleTap = repair && repair.items.length === 1 && !!repair.items[0].label ? repair.items[0] : undefined;
  const pending = !!repair && !repaired;
  const doneOrder = useMemo(() => state.repaired.filter((k) => k.startsWith(`${page.id}:`)).map((k) => k.slice(page.id.length + 1)), [state.repaired, page.id]);
  const paras = onCover ? [] : pageParagraphs(page, { lang, gender, choiceId: state.choiceId, repaired: doneOrder });
  const baseSlot = (costume && page.heroAlt?.[costume]) || page.hero;
  const slot = repaired && repair?.heroAfter ? repair.heroAfter : baseSlot;

  const content: LayoutContent = onCover
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
  const pageSrc =
    narration === "off"
      ? null
      : repaired && repair
          ? declaredAudio(repair.audio, lang, gender) ?? (narration === "probe" ? narrationKey({ ...keyBase, pageId: `${page.id}-after` }, root) : null)
          : pageNarrationSrc(page, { ...keyBase, choiceId: state.choiceId }, { probe: narration === "probe", root });
  const revealAt = page.overlays?.find((o) => o.reveal === "afterNarration")?.revealAt;
  const showKey = `${state.at}|${repaired ? "after" : "before"}`;
  const voice = useNarration(pageSrc, { showKey, muted, enabled: narration !== "off", revealAt });
  const [tapReveal, setTapReveal] = useState<string | null>(null);
  const revealed = voice.revealed || tapReveal === state.at;

  // A print (the page's composite after the print pass) replaces plate +
  // sprite — unless a costume variant is shown, or the page's after-narration
  // overlay (p9's dust) has been revealed: then the live composite returns.
  const afterOverlay = (page.overlays ?? []).some((o) => o.reveal === "afterNarration");
  const print = prints && !(costume && page.heroAlt?.[costume]) && !(afterOverlay && revealed) ? heroPrint(sheet, page.id) : null;
  const layoutPlate = print && plate ? { ...plate, width: print.width, height: print.height } : plate;
  const layout = computeBookPageLayout(page, box, lang, { plate: layoutPlate, slot, content, anchorOf });
  const spread = layout.mode === "wide" && layout.pageType === "spread";

  // ── page-turn cue ──────────────────────────────────────────────────────────
  const lastAt = useRef(state.at);
  useEffect(() => {
    if (lastAt.current !== state.at && state.dir !== 0) kidSfx("pageTurn");
    lastAt.current = state.at;
  }, [state.at, state.dir]);

  // ── actions ────────────────────────────────────────────────────────────────
  const next = useCallback(() => dispatch({ type: "next" }), []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const tapItem = (id: string) => {
    if (done.has(id)) return;
    kidSfx("tap");
    const item = repair?.items.find((it) => it.id === id);
    // the item's own sound, else its spoken line (`<page>-<item>`), when a file exists
    voice.playClip(item?.sound ?? (narration === "probe" && item?.line ? narrationKey({ ...keyBase, pageId: `${page.id}-${id}` }, root) : null));
    dispatch({ type: "repair", itemId: id });
  };
  const choose = (choiceId: string) => {
    const c = book.decision.choices.find((x) => x.id === choiceId);
    if (state.selected !== choiceId) {
      voice.playClip(declaredAudio(c?.audio, lang, gender) ?? (narration === "probe" ? narrationKey({ ...keyBase, pageId: `${book.decision.pageId}-choice`, choiceId }, root) : null));
    }
    dispatch({ type: "choose", choiceId });
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
        dispatch({ type: forward ? "next" : "back" });
      } else if (e.key === " " && !(t && t.tagName === "BUTTON")) {
        e.preventDefault();
        dispatch({ type: "next" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dir, onClose]);

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
  const heroSrc = heroSpriteUrl(sheet, slot?.pose);
  const items: BookPageItem[] =
    repair && !singleTap
      ? repair.items.map((it) => ({ id: it.id, x: it.x, y: it.y, done: done.has(it.id), label: it.label ? labelFor(it.label, lang) : bookString("repair.tap", lang) }))
      : [];
  // On a print only the not-yet-revealed overlays draw (the rest are baked in).
  const overlays: BookPageOverlay[] = (page.overlays ?? [])
    .filter((o) => !print || o.reveal === "afterNarration")
    .map((o) => ({
      ...o,
      srcs: overlaySources(book.id, o, { dev }),
      hidden: (o.reveal === "afterNarration" && !revealed) || (!!o.showWhen && done.has(o.showWhen.item) !== o.showWhen.done),
      hop: !!o.showWhen?.done && done.has(o.showWhen.item),
    }));

  // ── the turn ───────────────────────────────────────────────────────────────
  const turnClass = state.dir === 1 ? "fwd" : state.dir === -1 ? "back" : "none";
  const leaf = layout.mode === "wide" && layout.pageType === "facing" && state.dir !== 0 ? leafFor(layout, state.dir) : null;

  // ── the text page ──────────────────────────────────────────────────────────
  const textStyle: CSSProperties = {
    ...rectStyle(layout.textPage),
    paddingInline: px(layout.pad.inline),
    paddingBlock: px(layout.pad.block),
  };
  const wordsStyle: CSSProperties = { fontSize: px(typePx), lineHeight: layout.lineHeight };
  const decisionPlate = plateTable[book.pages.find((p) => p.id === book.decision.pageId)?.plateId ?? ""];
  const cardGap = 12;
  const cardW = Math.max(60, (layout.text.w - 2 * cardGap) / 3);
  const cardPicH = Math.max(48, layout.cardsPx - 56);

  const forward = (() => {
    if (onCover) {
      return (
        <KidToy tone="go" size="l" glyph="auto_stories" data-book-open="" aria-label={bookString("open", lang)} onClick={() => dispatch({ type: "open" })} className="bk-wide-toy">
          {bookString("open", lang)}
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
    if (ending) {
      return (
        <KidToy tone="go" size="l" glyph="menu_book" data-book-end="" onClick={onClose}>
          {bookString("theEnd", lang)}
        </KidToy>
      );
    }
    if (pending) return null;
    if (!canTurnForward(book, state)) return null;
    return layout.mode === "wide" ? (
      <KidToy tone="go" size="l" shape="round" glyph={TURN_GLYPHS.next} data-book-next="" aria-label={bookString("next", lang)} onClick={next} />
    ) : (
      <KidToy tone="go" size="l" glyphEnd={TURN_GLYPHS.next} data-book-next="" aria-label={bookString("next", lang)} onClick={next} className="bk-grow" />
    );
  })();

  return (
    <div className="bk-reader" data-book-reader="" data-mode={layout.mode} data-page-type={layout.pageType} dir={dir} lang={lang} role="region" aria-label={bookString("reader.aria", lang, { title: book.title[lang] })}>
      <header className="bk-bar" style={{ blockSize: px(wide ? BAR_WIDE : BAR_NARROW) }}>
        <KidToy tone="paper" shape="round" size="s" glyph="menu_book" data-book-close="" aria-label={bookString("close", lang)} onClick={onClose} />
        <span className="bk-bar-fill" />
        <KidSoundToggle childId={child.id} lang={lang} />
      </header>
      <div className="bk-stage" ref={stageRef}>
        <div key={state.at} className="bk-turn" data-turn={turnClass} data-book-page={page.id}>
          {layout.mode === "wide" && <div className={spread ? "bk-frame" : "bk-book"} aria-hidden="true" style={rectStyle(layout.book)} />}
          {layout.mode === "wide" && !spread && <div className="bk-artpage" data-spine={layout.spine === "left" ? "right" : "left"} aria-hidden="true" style={rectStyle(layout.artPage)} />}
          <BookPage
            layout={layout}
            plateSrcs={plateSrcs}
            printed={!!print}
            tint={slot?.tint}
            occluders={page.occluders}
            fgSrc={plate?.fg}
            heroSrc={heroSrc}
            heroKey={`${page.id}|${slot?.pose ?? ""}`}
            overlays={overlays}
            items={items}
            onItem={tapItem}
            onArtTap={() => setTapReveal(state.at)}
            pictureLabel={bookString("picture", lang)}
          />
          <section className="bk-text" data-book-text="" data-kind={spread ? "panel" : layout.mode === "wide" ? "page" : "sheet"} data-spine={layout.spine} style={textStyle}>
            {onCover ? (
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
            ) : (
              <div className="bk-words" ref={wordsRef} style={wordsStyle}>
                {paras.map((p, i) => (
                  <p key={i} data-book-para={i}>
                    <Words text={p} name={name} />
                  </p>
                ))}
              </div>
            )}
            {decision && (
              <div className="bk-choices" role="group" aria-label={bookString("choices.aria", lang)} style={{ blockSize: px(layout.cardsPx), gap: px(cardGap) }}>
                {book.decision.choices.map((c, i) => {
                  const focus = decisionPlate?.focus?.[c.id];
                  const bg = focus && decisionPlate ? focusBackground(decisionPlate, focus, cardW, cardPicH) : null;
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
                      {bg ? (
                        <span
                          className="bk-card-pic"
                          aria-hidden="true"
                          style={{
                            blockSize: px(cardPicH),
                            backgroundImage: srcs.map((u) => `url("${u}")`).join(", "),
                            backgroundSize: srcs.map(() => bg.size).join(", "),
                            backgroundPosition: srcs.map(() => bg.position).join(", "),
                          }}
                        />
                      ) : (
                        <span className="bk-card-pic bk-card-icon" aria-hidden="true" style={{ blockSize: px(cardPicH) }}>
                          <Icon name={c.icon ?? "auto_stories"} size={Math.round(Math.min(cardPicH * 0.6, 64))} fill={1} />
                        </span>
                      )}
                      <span className="bk-card-label">{labelFor(c.label, lang)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {pending && singleTap && (
              <div className="bk-prompt-row">
                <KidToy tone="go" size="l" data-book-repair={singleTap.id} onClick={() => tapItem(singleTap.id)} className="bk-wide-toy">
                  {labelFor(singleTap.label!, lang)}
                </KidToy>
              </div>
            )}
            {pending && !singleTap && repair && (
              <div className="bk-prompt-row">
                <span className="bk-prompt" data-book-repair-prompt="">
                  {labelFor(repair.promptLabel, lang)}
                </span>
              </div>
            )}
            <nav className="bk-nav" style={{ minBlockSize: px(Math.min(layout.navPx, 96) - 8) }}>
              {!onCover ? <KidToy tone="paper" shape="round" glyph={TURN_GLYPHS.back} data-book-back="" aria-label={bookString("back", lang)} onClick={back} /> : <span />}
              {forward}
            </nav>
          </section>
          {leaf && <div className="bk-leaf" data-dir={state.dir === 1 ? "fwd" : "back"} aria-hidden="true" style={{ ...rectStyle(leaf.rect), transformOrigin: leaf.origin, "--leaf-rot": leaf.rot } as CSSProperties} />}
        </div>
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
