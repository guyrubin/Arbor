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
import { readFileSync } from "node:fs";

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
import { allBooks } from "../../lib/library/books";
import { PLAN_FIXTURE_BOOKS } from "../../lib/library/plans/planBooks";
import { resetPlanPlateSources } from "../../lib/plans/planPlateSource";
import { allBookPages, bookChoices } from "../../lib/library/bookShape";
import type { AnyBook, BookReaderChild } from "../../lib/library/types";
import type { HeroSheet } from "../../lib/library/heroSheet";
import { bookNarrationFiles, isNameBearing, sharedNarrationUrls, SHARED_NARRATION_SETS, type VoiceFolder } from "../../lib/library/narrationFiles";
import type { NarrationManifests } from "../../lib/library/narrationManifest";

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
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

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

/** Read one path to The End through the reader's own controls. Returns the pages seen. */
async function readToEnd(book: AnyBook, choiceId: string | null, lang: "en" | "he", child: BookReaderChild, files: "every" | "none", assets?: { files: Record<string, string>; cues: Record<string, never> }) {
  const reader = harness(BookReader, {
    book, lang, child, onClose: () => {}, dev: false,
    sheet: files === "every" ? sheetFor(book) : null,
    assets: assets ?? (files === "every" ? everyFile : noFiles),
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

// ── B-BOOK-35 / B-BOOK-73 (CI half): the REAL files, as the kid door hands them ──
// read, not imported: a JSON import makes tsc type the whole register (fix round 2, lint at the default heap)
const MANIFEST = JSON.parse(readFileSync(new URL("../../content/narrationManifests.json", import.meta.url), "utf8")) as NarrationManifests;
/** The book's name-free files at their shared static URLs, the name-bearing ones
 *  as the child's private blob: URLs; every key the reader asks for and does
 *  not find is recorded (a page without its file). */
function realFiles(book: AnyBook, folder: VoiceFolder, misses: Set<string>) {
  const shared = sharedNarrationUrls(book, folder);
  const map: Record<string, string> = {};
  for (const f of bookNarrationFiles(book, folder)) {
    const url = isNameBearing(f) ? `blob:synthetic/name/${folder}/${f.file}` : shared[f.file];
    if (url) map[`${folder}/${f.file}`] = url;
  }
  const files = new Proxy(map, { get: (t, k) => { if (typeof k !== "string") return undefined; if (!(k in t) && /\.mp3$/.test(k)) misses.add(k); return t[k]; } });
  return { files, cues: {} as Record<string, never> };
}

describe("B-BOOK-35 / B-BOOK-73: a full read with the real narration files finds every file and never calls /api/tts", () => {
  const shelf = allBooks().filter((b) => Object.prototype.hasOwnProperty.call(SHARED_NARRATION_SETS, b.id) && MANIFEST.books[b.id]);
  it("the shelf books with a shared set are read (the proof book at least)", () => {
    expect(shelf.map((b) => b.id)).toContain("five-smooth-stones");
  });
  for (const book of shelf) {
    it(`${book.id}: every path, EN / HE-m / HE-f, plays only manifest files and the child's name files`, async () => {
      const paths: (string | null)[] = bookChoices(book).length ? bookChoices(book).map((c) => c.id) : [null];
      const misses = new Set<string>();
      for (const choiceId of paths) {
        for (const { lang, child } of READERS) {
          const folder: VoiceFolder = lang === "en" ? "en" : child.gender === "girl" ? "he-f" : "he-m";
          const seen = await readToEnd(book, choiceId, lang, child, "every", realFiles(book, folder, misses));
          expect(seen[seen.length - 1], `${choiceId} ${folder}`).toBe("end");
        }
      }
      expect(offences()).toEqual([]);
      expect(env.requests.filter((r) => r.url.includes("/api/tts"))).toEqual([]);
      expect([...misses].sort(), "a page asked for a file that does not exist").toEqual([]);
      const shipped = env.requests.filter((r) => r.via === "audio" && r.url.startsWith("/audio/books/"));
      expect(shipped.length).toBeGreaterThan(0);
      for (const r of shipped) {
        const [, , , id, set, folder, file] = r.url.split("/");
        expect(set, r.url).toBe(SHARED_NARRATION_SETS[id]);
        expect(MANIFEST.books[id]?.folders[folder as VoiceFolder]?.files[file], `${r.url} is a manifest file with its hash`).toMatch(/^[0-9a-f]{64}$/);
      }
      expect(env.requests.some((r) => r.via === "audio" && r.url.startsWith("blob:synthetic/name/"))).toBe(true);
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
