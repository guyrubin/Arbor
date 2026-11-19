/**
 * B-BOOK-27 — "CI fails if any library book makes a model, image or TTS
 * request on a full read", run over EVERY book of the current registry: the
 * library books, the engine fixture and each Everyday Plans pattern's book.
 *
 * The real BookReader runs with its real hooks and effects (narration,
 * bookmarks, plan-plate reads, art-state timers): React's hooks are routed
 * through a small commit harness (no DOM in this repo; the legacy shelf's
 * B-BOOK-28 test uses the same pattern), and the reader is driven by its own
 * controls — Open, Choose, a card, Go, every repair item, Next — along every
 * path to The End, in EN, HE-m and HE-f, once with the child's private files
 * (blob: URLs, as the kid door hands them) and once with none yet.
 *
 * Every network and voice primitive is a trap: fetch, XMLHttpRequest,
 * WebSocket, EventSource, sendBeacon, speechSynthesis, and every Audio /
 * Image source. A request passes only if it is local (blob:/data:) or a
 * same-origin static file (/visuals, /audio, /fonts) or the shared plan-plate
 * read (GET /api/plans/plates/<pattern>/<plate>); anything else — a generate,
 * image or TTS route, another host — fails the build. Negative controls
 * prove the traps bite.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  hook: null as any,
  requests: [] as { via: string; url: string }[],
  plays: 0,
}));

vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const hooks = {
    useState: (...args: any[]) => env.hook.state(...args),
    useReducer: (...args: any[]) => env.hook.reducer(...args),
    useRef: (...args: any[]) => env.hook.ref(...args),
    useMemo: (compute: () => unknown) => compute(),
    useCallback: (fn: unknown) => fn,
    useEffect: (...args: any[]) => env.hook.effect(...args),
    useLayoutEffect: (...args: any[]) => env.hook.effect(...args),
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  };
  return { ...real, ...hooks, default: { ...real, ...hooks } };
});
// The synthesized UI sounds (a page swish) are oscillators, not requests.
vi.mock("../kidmode/audio/kidAudio", async (original) => ({
  ...(await original<typeof import("../kidmode/audio/kidAudio")>()),
  kidSfx: () => {},
  pageHasUserGesture: () => true,
  useKidReadAloudMuted: () => false,
}));

import { BookReader } from "./BookReader";
import { BookPage } from "./BookPage";
import { BookEnd } from "./BookParts";
import { initialBookFlow } from "../../lib/library/bookFlow";
import { allBooks } from "../../lib/library/books";
import { PLAN_FIXTURE_BOOKS } from "../../lib/library/plans/planBooks";
import { loadPlanPlateUrl, resetPlanPlateSources } from "../../lib/plans/planPlateSource";
import { setAuthTokenProvider } from "../../lib/api";
import type { BookPageLayout } from "../../lib/library/bookPageLayout";
import { allBookPages, bookChoices } from "../../lib/library/bookShape";
import type { AnyBook, BookReaderChild } from "../../lib/library/types";
import type { HeroSheet } from "../../lib/library/heroSheet";

// ── the request policy ──────────────────────────────────────────────────────
const STATIC = /^\/(?:visuals|audio|fonts)\/[A-Za-z0-9_\-/.]+$/;
const PLAN_PLATE_READ = /^\/api\/plans\/plates\/[a-z0-9-]+\/[A-Za-z0-9_-]+$/;
/** Why a request breaks the zero-call rule, or null when it is a static read. */
export function requestOffence(url: string): string | null {
  if (/^(?:blob|data):/.test(url)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return `another host or scheme: ${url}`;
  if (url.includes("..")) return `a path escape: ${url}`;
  const p = url.split(/[?#]/)[0];
  if (PLAN_PLATE_READ.test(p)) return null;
  if (p.startsWith("/api/")) return `an API route: ${url}`;
  if (!STATIC.test(p)) return `not a static file: ${url}`;
  return null;
}

// ── traps for every network and voice primitive ─────────────────────────────
const record = (via: string) => (url: unknown) => env.requests.push({ via, url: String(url) });
class FakeAudio {
  private s = "";
  preload = "";
  paused = true;
  ended = false;
  currentTime = 0;
  duration = 2;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  constructor(src?: string) { if (src) this.src = src; }
  set src(v: string) { this.s = v; record("audio")(v); }
  get src() { return this.s; }
  setAttribute() {}
  addEventListener() {}
  removeEventListener() {}
  load() {}
  pause() { this.paused = true; }
  play() {
    this.paused = false;
    env.plays++;
    const me = this;
    setTimeout(() => { if (!me.paused) { me.ended = true; me.onended?.(); } }, 1800);
    return Promise.resolve();
  }
}
class FakeImage { set src(v: string) { record("image")(v); } }
class Trap { constructor(url: unknown) { record(this.constructor.name)(url); } close() {} send() {} addEventListener() {} }
class FakeXhr { open(_m: string, url: string) { record("XMLHttpRequest")(url); } send() {} setRequestHeader() {} addEventListener() {} }

beforeEach(() => {
  vi.useFakeTimers();
  env.requests = [];
  env.plays = 0;
  resetPlanPlateSources();
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => { record("fetch")(url); return new Response("", { status: 404 }); }));
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  vi.stubGlobal("WebSocket", class WebSocket extends Trap {});
  vi.stubGlobal("EventSource", class EventSource extends Trap {});
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("speechSynthesis", { speak: (u: { text?: string }) => record("speechSynthesis")(`speak:${u?.text ?? ""}`), cancel() {}, getVoices: () => [] });
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
  vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true }, sendBeacon: (url: string) => { record("sendBeacon")(url); return true; } });
  vi.stubGlobal("window", { innerWidth: 390, innerHeight: 844, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); setAuthTokenProvider(async () => null); });

// ── the commit harness (production components and callbacks unmodified) ──────
function harness<P>(component: (props: P) => React.ReactNode, props: P) {
  const slots: any[] = [];
  let index = 0, dirty = true, jobs: (() => void)[] = [], tree: React.ReactNode;
  const set = (slot: number) => (next: any) => {
    const value = typeof next === "function" ? next(slots[slot]) : next;
    if (!Object.is(slots[slot], value)) { slots[slot] = value; dirty = true; }
  };
  const hook = {
    state(initial: any) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], set(slot)];
    },
    reducer(reducer: (s: any, a: any) => any, initial: any) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], (action: any) => set(slot)((s: any) => reducer(s, action))];
    },
    ref(initial: any) { const slot = index++; return slots[slot] ??= { current: initial }; },
    effect(setup: () => void | (() => void), deps?: unknown[]) {
      const slot = index++, previous = slots[slot];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        const state = { deps, cleanup: undefined as void | (() => void) };
        slots[slot] = state;
        jobs.push(() => { previous?.cleanup?.(); state.cleanup = setup(); });
      }
    },
  };
  const commit = () => {
    dirty = true;
    for (let tries = 0; dirty; tries++) {
      if (tries > 40) throw new Error("Unsettled hook render");
      dirty = false; index = 0; jobs = []; env.hook = hook;
      tree = component(props);
      jobs.forEach((run) => run());
    }
    return tree;
  };
  commit();
  return { commit, get tree() { return tree; }, unmount() { slots.forEach((slot) => slot?.cleanup?.()); } };
}
type El = React.ReactElement<Record<string, any>>;
function elements(node: unknown): El[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const el = node as El;
  const nested = Object.entries(el.props).filter(([k]) => k !== "children").flatMap(([, v]) => (Array.isArray(v) || React.isValidElement(v) ? elements(v) : []));
  return [el, ...elements(el.props.children), ...nested];
}
const find = (tree: React.ReactNode, match: (el: El) => boolean) => elements(tree).find(match);
const URL_PROP = /src|file|url|href|poster/i;
const LOOKS_LIKE_URL = /^(?:\/|blob:|data:|[a-z][a-z0-9+.-]*:\/\/)/i;
/** Every image / audio source the reader hands its page parts (each is a
 *  request the device makes once the part paints): URL-named props and CSS
 *  url(...) values, on every element of the tree. */
function renderedSources(tree: React.ReactNode): string[] {
  const out: string[] = [];
  const take = (v: unknown) => { if (typeof v === "string" && LOOKS_LIKE_URL.test(v)) out.push(v); };
  for (const el of elements(tree)) {
    for (const [k, v] of Object.entries(el.props)) {
      if (URL_PROP.test(k)) (Array.isArray(v) ? v : [v]).forEach(take);
      if (k === "style" && v && typeof v === "object") for (const css of Object.values(v)) if (typeof css === "string") for (const m of css.matchAll(/url\("?([^")]+)"?\)/g)) take(m[1]);
    }
  }
  return out;
}
const has = (name: string) => (el: El) => el.props[name] !== undefined;

// ── the synthetic child and private files (no real child, no likeness) ─────
function sheetFor(book: AnyBook): HeroSheet {
  const poses: Record<string, string> = {};
  for (const page of allBookPages(book)) for (const s of [page.hero, page.repair?.heroAfter, ...Object.values(page.heroAlt ?? {})]) if (s) poses[s.pose] = `blob:synthetic/pose/${s.pose}`;
  for (const to of Object.values((book as { poseFallbacks?: Record<string, string> }).poseFallbacks ?? {})) poses[to] = `blob:synthetic/pose/${to}`;
  return { id: "synthetic-sheet", poses };
}
/** The child's own narration, as the kid door hands it: every key resolves to a blob: URL. */
const everyFile = { files: new Proxy({} as Record<string, string>, { get: (_t, k) => (typeof k === "string" ? `blob:synthetic/narration/${k}` : undefined) }), cues: {} };
const noFiles = { files: {} as Record<string, string>, cues: {} };

const READERS: { lang: "en" | "he"; child: BookReaderChild }[] = [
  { lang: "en", child: { id: "synthetic-child-en", name: "Test Hero", gender: "boy", heroSheetId: "synthetic-sheet" } },
  { lang: "he", child: { id: "synthetic-child-he-m", name: "נועם", gender: "boy", heroSheetId: "synthetic-sheet" } },
  { lang: "he", child: { id: "synthetic-child-he-f", name: "דנה", gender: "girl", heroSheetId: "synthetic-sheet" } },
];

describe("the DOM reading floor on a short paper page", () => {
  it("keeps every word, pose and navigation action when measured text needs the whole sheet to scroll", () => {
    const book = allBooks().find(book => book.id === "five-smooth-stones")!;
    const child = { ...READERS[0].child, name: "Alexander" };
    const reader = harness(BookReader, { book, lang: "en", child, onClose: () => {}, dev: false, narration: "off", sheet: sheetFor(book), assets: noFiles,
      initialState: { ...initialBookFlow(), at: "p10", choiceId: "b" }, initialBox: { width: 375, height: 667 - 56 },
    } as Parameters<typeof BookReader>[0]);
    const words = () => find(reader.tree, el => el.props.className === "bk-words")!;
    const before = elements(words().props.children).filter(has("data-book-para")).map(el => el.props.children.props.text);
    const art = find(reader.tree, el => el.type === BookPage)!.props.layout;
    // A real DOM overflow report after font/line measurement. The hook must
    // allocate reachable paper at 18px rather than keep shrinking to16px.
    words().props.ref.current = { scrollHeight: 270, clientHeight: 110 };
    reader.commit();
    expect(words().props.style.fontSize).toBe("18px");
    expect(find(reader.tree, has("data-reading-scroll"))).toBeDefined();
    expect(elements(words().props.children).filter(has("data-book-para")).map(el => el.props.children.props.text)).toEqual(before);
    expect(before).toHaveLength(3);
    expect(find(reader.tree, el => el.type === BookPage)!.props.layout).toEqual(art);
    expect(find(reader.tree, has("data-book-back"))).toBeDefined();
    const next = find(reader.tree, has("data-book-next"))!;
    expect(next.props.disabled).toBe(false);
    words().props.ref.current = null;
    next.props.onClick(); reader.commit();
    expect(find(reader.tree, el => el.type === BookEnd)).toBeDefined();
    expect(env.requests.filter(request => requestOffence(request.url))).toEqual([]);
    reader.unmount();
  });
});

/** Read one path to The End through the reader's own controls. Returns the pages seen. */
async function readToEnd(book: AnyBook, choiceId: string | null, lang: "en" | "he", child: BookReaderChild, files: "every" | "none") {
  const reader = harness(BookReader, {
    book, lang, child, onClose: () => {}, dev: false,
    sheet: files === "every" ? sheetFor(book) : null,
    assets: files === "every" ? everyFile : noFiles,
    initialBox: { width: 390, height: 756 },
  } as Parameters<typeof BookReader>[0]);
  const seen: string[] = [];
  const tapped = new Set<string>();
  const click = (el: El | undefined) => { if (!el || el.props.disabled) return false; el.props.onClick?.({ preventDefault() {}, stopPropagation() {} }); reader.commit(); return true; };
  for (let step = 0; step < 400; step++) {
    await vi.advanceTimersByTimeAsync(400);
    reader.commit();
    for (const src of renderedSources(reader.tree)) record("render")(src);
    const at = find(reader.tree, has("data-book-page"))?.props["data-book-page"] as string | undefined;
    if (at && seen[seen.length - 1] !== at) seen.push(at);
    if (at === "end") break;
    if (click(find(reader.tree, has("data-book-open")))) continue;
    if (click(find(reader.tree, has("data-book-choose")))) continue;
    const card = choiceId ? find(reader.tree, (el) => el.props["data-choice-card"] === choiceId) : undefined;
    if (card) {
      click(card);
      click(find(reader.tree, has("data-book-go")));
      continue;
    }
    const page = find(reader.tree, (el) => typeof el.props.onItem === "function" && Array.isArray(el.props.items));
    const pageData = at ? allBookPages(book).find((p) => p.id === at) : undefined;
    const pending = pageData?.repair?.items.map((it) => it.id).filter((id) => !tapped.has(`${at}:${id}`)) ?? [];
    if (page && pending.length) {
      tapped.add(`${at}:${pending[0]}`);
      page.props.onItem(pending[0]);
      reader.commit();
      continue;
    }
    if (!click(find(reader.tree, (el) => el.props["data-book-next"] !== undefined && !el.props.disabled))) await vi.advanceTimersByTimeAsync(1500);
  }
  await vi.advanceTimersByTimeAsync(5000);
  reader.commit();
  reader.unmount();
  return seen;
}

const BOOKS: AnyBook[] = [...allBooks(), ...Object.values(PLAN_FIXTURE_BOOKS)];
const offences = () => env.requests.map((r) => [r.via, r.url, requestOffence(r.url)] as const).filter(([via, , why]) => why !== null || via === "speechSynthesis" || via === "sendBeacon" || via === "WebSocket" || via === "EventSource" || via === "XMLHttpRequest");

describe("a fresh read starts the decision with its authored question", () => {
  it.each(READERS)("$lang/$child.gender: Read again clears the previous cards state", async ({ lang, child }) => {
    const book = BOOKS.find(book => book.id === "five-smooth-stones")!;
    const reader = harness(BookReader, { book, lang, child, onClose: () => {}, dev: false, narration: "off", sheet: null, assets: noFiles, initialBox: { width: 390, height: 756 }, initialState: { ...initialBookFlow(), at: "p5" } } as Parameters<typeof BookReader>[0]);
    const click = (name: string) => {
      const control = find(reader.tree, has(name));
      expect(control, name).toBeDefined();
      expect(control!.props.disabled, name).not.toBe(true);
      control!.props.onClick();
      reader.commit();
    };
    expect(find(reader.tree, has("data-book-para"))).toBeDefined();
    click("data-book-choose");
    find(reader.tree, el => el.props["data-choice-card"] === "a")!.props.onClick(); reader.commit();
    click("data-book-go");
    for (let steps = 0; steps < 20 && !find(reader.tree, el => el.type === BookEnd); steps++) {
      await vi.advanceTimersByTimeAsync(5000); reader.commit();
      if (find(reader.tree, has("data-book-next"))?.props.disabled) continue;
      click("data-book-next");
    }
    const ending = find(reader.tree, el => el.type === BookEnd);
    expect(ending).toBeDefined();
    ending!.props.onReadAgain(); reader.commit();
    click("data-book-open");
    for (let steps = 0; steps < 7; steps++) click("data-book-next");
    expect(find(reader.tree, has("data-book-page"))?.props["data-book-page"]).toBe("p5");
    expect(find(reader.tree, has("data-book-para"))).toBeDefined();
    expect(find(reader.tree, has("data-book-choose"))).toBeDefined();
    expect(find(reader.tree, has("data-choice-card"))).toBeUndefined();
    click("data-book-choose");
    find(reader.tree, el => el.props["data-choice-card"] === "a")!.props.onClick(); reader.commit();
    click("data-book-go");
    click("data-book-next");
    click("data-book-next");
    expect(find(reader.tree, has("data-book-page"))?.props["data-book-page"]).toBe("p9");
    expect(find(reader.tree, el => el.type === BookPage)?.props.statePlateKey).toBeUndefined();
    expect(offences()).toEqual([]);
    reader.unmount();
  });
});

describe("a missing book picture can recover without restarting the read", () => {
  it("does not offer an impossible image retry when no plate or print is declared", () => {
    const book = PLAN_FIXTURE_BOOKS["plan-poo-sit--demo"];
    const reader = harness(BookReader, { book, lang: "en", child: READERS[0].child, onClose: () => {}, dev: false, plates: {}, sheet: null, assets: noFiles, initialBox: { width: 390, height: 756 } } as Parameters<typeof BookReader>[0]);
    expect(find(reader.tree, (el) => el.type === BookPage)!.props.pictureRecovery).toBeUndefined();
    expect(find(reader.tree, has("data-book-page"))?.props["data-book-page"]).toBe("cover");
    const open = find(reader.tree, has("data-book-open"));
    expect(open).toBeDefined();
    open!.props.onClick();
    reader.commit();
    expect(find(reader.tree, has("data-book-page"))?.props["data-book-page"]).toBe("p1");
    expect(find(reader.tree, (el) => el.type === BookPage)!.props.pictureRecovery).toBeUndefined();
    expect(find(reader.tree, has("data-book-next"))).toBeDefined();
    expect(env.requests).toEqual([]);
    reader.unmount();
  });

  it.each(["en", "he"] as const)("%s: retries only the current authenticated image and preserves the page and other cached pictures", async (lang) => {
    setAuthTokenProvider(async () => "synthetic-token");
    const url = "/api/plans/plates/plan-poo-sit/PP1";
    const other = "/api/plans/plates/plan-poo-sit/PP8";
    let available = false;
    const fetchMock = vi.fn(async (source: string, init?: RequestInit) => {
      record("fetch")(source);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer synthetic-token");
      return source === other || available
        ? new Response(new Blob([new Uint8Array([1, 2])], { type: "image/webp" }))
        : new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    let blob = 0;
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: () => `blob:synthetic/picture-${++blob}` }));
    expect(await loadPlanPlateUrl(other)).toBe("blob:synthetic/picture-1");
    const completed = vi.fn();
    const book = PLAN_FIXTURE_BOOKS["plan-poo-sit--demo"];
    const reader = harness(BookReader, { book, lang, child: READERS[0].child, onClose: () => {}, onComplete: completed, dev: false, sheet: null, assets: noFiles, initialBox: { width: 390, height: 756 } } as Parameters<typeof BookReader>[0]);
    const picture = () => find(reader.tree, (el) => el.type === BookPage)!;
    await vi.advanceTimersByTimeAsync(0); reader.commit();
    expect(picture().props.plateSrcs).toEqual([]);
    expect(picture().props.pictureRecovery.pending).toBe(false);
    expect(picture().props.pictureRecovery.retryLabel).toBe(lang === "he" ? "לנסות שוב את התמונה" : "Try the picture again");
    expect(renderedSources(reader.tree)).not.toContain(url);
    expect(fetchMock.mock.calls.filter(([source]) => source === url)).toHaveLength(1);
    available = true;
    picture().props.pictureRecovery.onRetry(); reader.commit();
    expect(picture().props.pictureRecovery.pending).toBe(true);
    // Join the request already started by the hook. A real Response.blob()
    // settles on the stream microtask, independently of our fake timers.
    expect(await loadPlanPlateUrl(url)).toBe("blob:synthetic/picture-2");
    await Promise.resolve(); reader.commit();
    expect(picture().props.plateSrcs).toEqual(["blob:synthetic/picture-2"]);
    expect(picture().props.pictureRecovery.pending).toBe(false);
    expect(fetchMock.mock.calls.filter(([source]) => source === url)).toHaveLength(2);
    expect(await loadPlanPlateUrl(other)).toBe("blob:synthetic/picture-1");
    expect(fetchMock.mock.calls.filter(([source]) => source === other)).toHaveLength(1);
    expect(find(reader.tree, has("data-book-page"))?.props["data-book-page"]).toBe("cover");
    expect(completed).not.toHaveBeenCalled();
    expect(offences()).toEqual([]);
    reader.unmount();
  });

  it("shows a real retry after all static sources fail, stops art-tap bubbling and clears the failure for a new source", () => {
    const art = { x: 0, y: 0, w: 300, h: 360 };
    const retry = vi.fn();
    const props: Parameters<typeof BookPage>[0] = { layout: { art, plate: art, hero: null, shadow: null } as BookPageLayout, plateSrcs: ["/visuals/missing.webp"], heroSrc: null, heroKey: "synthetic", pictureLabel: "Picture", pictureRecovery: { pending: false, attempt: 0, unavailableLabel: "We couldn’t open this picture.", retryLabel: "Try the picture again", onRetry: retry } };
    const page = harness(BookPage, props);
    expect(find(page.tree, has("data-book-picture-retry"))).toBeUndefined();
    find(page.tree, (el) => typeof el.props.onAllFailed === "function")!.props.onAllFailed(); page.commit();
    const control = find(page.tree, has("data-book-picture-retry"))!;
    const stopPropagation = vi.fn();
    control.props.onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
    props.plateSrcs = ["/visuals/recovered.webp"]; page.commit();
    expect(find(page.tree, has("data-book-picture-retry"))).toBeUndefined();
    page.unmount();
  });
});

describe("B-BOOK-27: a full read of every book in the registry makes zero model, image or TTS requests", () => {
  it("the registry is real: the library book, the engine fixture and every plan pattern's book", () => {
    const ids = BOOKS.map((b) => b.id);
    expect(ids).toContain("five-smooth-stones");
    expect(ids).toContain("abrams-long-road");
    expect(ids.filter((id) => id.endsWith("--demo")).length).toBe(Object.keys(PLAN_FIXTURE_BOOKS).length);
    expect(Object.keys(PLAN_FIXTURE_BOOKS).length).toBeGreaterThanOrEqual(8);
  });

  for (const book of BOOKS) {
    const paths: (string | null)[] = bookChoices(book).length ? bookChoices(book).map((c) => c.id) : [null];
    it(`${book.id}: every path to The End, EN / HE-m / HE-f, with and without the child's files`, async () => {
      for (const choiceId of paths) {
        for (const { lang, child } of READERS) {
          for (const files of ["every", "none"] as const) {
            const seen = await readToEnd(book, choiceId, lang, child, files);
            expect(seen[0], `${choiceId} ${lang} ${files}`).toBe("cover");
            expect(seen[seen.length - 1], `${choiceId} ${lang} ${files} reached The End (${seen.join(" ")})`).toBe("end");
            if (choiceId) {
              const branch = bookChoices(book).find((c) => c.id === choiceId)!.branch.map((p) => p.id);
              for (const id of branch) expect(seen, `${choiceId} reads its branch`).toContain(id);
            }
          }
        }
      }
      expect(offences()).toEqual([]);
      // the files were really asked for (narration played from the child's own blob: URLs)
      expect(env.plays).toBeGreaterThan(0);
      expect(env.requests.some((r) => r.via === "audio" && r.url.startsWith("blob:synthetic/narration/"))).toBe(true);
    }, 120_000);
  }
});

describe("B-BOOK-27: negative controls — the traps and the policy bite", () => {
  it("model, image and TTS routes, other hosts and path escapes are offences; static files and the shared plate read are not", () => {
    for (const bad of ["/api/generate-scene", "/api/tts", "/api/voice/live", "/api/generate/hero-journey", "https://example.com/x.webp", "//cdn.example/x.mp3", "/visuals/../api/tts", "/index.html"]) expect(requestOffence(bad), bad).not.toBeNull();
    for (const ok of ["/visuals/books/five-smooth-stones/PL1.webp", "/audio/books/five-smooth-stones/shared-v3/en/p2.mp3", "/api/plans/plates/plan-poo-sit/PP1", "blob:synthetic/x", "data:audio/wav;base64,AA"]) expect(requestOffence(ok), ok).toBeNull();
  });

  it("a book whose plate points at a generate route is caught on the read", async () => {
    const book = allBooks().find((b) => b.id === "five-smooth-stones")!;
    const { BOOK_PLATES } = await import("../../lib/library/books");
    const plates = Object.fromEntries(Object.entries(BOOK_PLATES[book.id]).map(([id, p]) => [id, { ...p, file: `/api/generate-scene?plate=${id}` }]));
    const reader = harness(BookReader, { book, lang: "en", child: READERS[0].child, onClose: () => {}, dev: false, plates, sheet: null, assets: noFiles, initialBox: { width: 390, height: 756 } } as Parameters<typeof BookReader>[0]);
    // the plate sources the cover hands its <img> are what the device would request
    const srcs = renderedSources(reader.tree);
    reader.unmount();
    expect(srcs.filter((u) => u.startsWith("/api/generate-scene")).length).toBeGreaterThan(0);
    expect(srcs.filter((u) => requestOffence(u) !== null)).toEqual(srcs.filter((u) => u.startsWith("/api/generate-scene")));
  });

  it("each trap records: fetch, XHR, sockets, beacons, speech and media sources", async () => {
    await fetch("/api/tts");
    new XMLHttpRequest().open("POST", "/api/generate");
    new WebSocket("wss://live.example");
    new EventSource("/api/stream");
    navigator.sendBeacon("/api/x");
    speechSynthesis.speak(new SpeechSynthesisUtterance("hi"));
    new Audio("/api/tts?x=1");
    new Image().src = "/api/generate-scene";
    expect(env.requests.map((r) => r.via)).toEqual(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "speechSynthesis", "audio", "image"]);
    expect(offences().length).toBe(8);
  });
});
