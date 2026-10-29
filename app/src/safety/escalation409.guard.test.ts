/**
 * B-ASKJB-49 — after a crisis 409, every screened parent surface shows the helplines.
 *
 * The server's crisis screen (safety/escalation.ts screenForImmediateEscalation)
 * answers 409 + escalationCategory on the routes below. This guard keeps the
 * client honest about that contract, in three steps:
 *
 *  1. It reads the server source and lists every route that runs the screen.
 *     Each one must be in SCREENED_409 (it answers 409, by `res.status(409)`
 *     or through a `refuse(res, 409, …)` helper) or in IN_BAND (it answers
 *     200 with the escalation payload and never 409): a new screened route
 *     fails here until it is classified and its client call sites are too.
 *     A screen call outside any route handler fails as well.
 *  2. It scans the client source for every call to those routes (the lib/api
 *     method, or the route string for a direct fetch). The files found must
 *     equal the sites registered for the route: a new call site fails here.
 *  3. Each site proves its handling:
 *     - "card": the file that catches the 409 has the named branch, and the
 *       file that renders it mounts the shared crisis card (UrgentSupport, the
 *       card Talk's composer, Now and onboarding already show) with
 *       `requestLang` (Safety's own line selection for the request's
 *       language: tel: links, EN and HE) right after the named condition.
 *     - "kid": kid mode. The screened text is the app's own catalogue (story
 *       themes, scene prompts), never a parent's or child's words, and the
 *       parent register (helplines) never renders in kid mode. Cross-checked
 *       against the AI-disclosure registry's own "kid" classification.
 *     - "fixed": the request carries only the app's fixed copy; the test runs
 *       that copy through the screen in EN and HE to prove no 409 can fire.
 *
 * Routes that answer a crisis in-band (200 with the escalation payload, the
 * chat crisis render) are listed in IN_BAND and never answer 409.
 * Negative controls prove each check can fail. Synthetic text only.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { screenForImmediateEscalation } from "./escalation";
import { AI_CALLERS } from "../lib/aiEntrySurfaces";
import { STORY_COMIC } from "../lib/heroComics";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = (text: string) => text.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const read = (rel: string) => code(readFileSync(path.join(SRC, rel), "utf8"));
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, acc);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const FILES = sourceFiles(SRC).map((f) => ({ rel: path.relative(SRC, f).split(path.sep).join("/"), src: code(readFileSync(f, "utf8")) }));

/* ── 1 · the server's screened 409 routes ──────────────────────────────── */

const SERVER_FILE = /^(routes|server)\//;
/** A route registration; its path in double quotes, single quotes or a template literal (wave 4). */
const ROUTE_START = /router\.(?:get|post|put|patch|delete)\(\s*(["'`])([^"'`]+)\1/g;
const SCREEN_CALL = /\bscreenForImmediateEscalation\(/g;
/** A 409 answer, direct or through a local `refuse(res, 409, …)`-style helper. */
const ANSWERS_409 = /\.status\(\s*409\s*\)|\b\w+\(\s*res\s*,\s*409\b/;

/** route → { screens, answers409 } for every router handler in the given sources. */
function serverRoutes(files: { rel: string; src: string }[]): Map<string, { screens: boolean; answers409: boolean }> {
  const out = new Map<string, { screens: boolean; answers409: boolean }>();
  for (const { rel, src } of files) {
    if (!SERVER_FILE.test(rel)) continue;
    const starts = [...src.matchAll(ROUTE_START)];
    starts.forEach((m, i) => {
      const body = src.slice(m.index!, starts[i + 1]?.index ?? src.length);
      const prev = out.get(m[2]) ?? { screens: false, answers409: false };
      out.set(m[2], {
        screens: prev.screens || body.includes("screenForImmediateEscalation("),
        answers409: prev.answers409 || ANSWERS_409.test(body),
      });
    });
  }
  return out;
}
const screened409 = (files: { rel: string; src: string }[]) =>
  [...serverRoutes(files)].filter(([, r]) => r.screens && r.answers409).map(([route]) => route).sort();
const screenedAll = (files: { rel: string; src: string }[]) =>
  [...serverRoutes(files)].filter(([, r]) => r.screens).map(([route]) => route).sort();

/** Screen calls in server files that sit outside every route handler. */
function strayScreens(files: { rel: string; src: string }[]): string[] {
  const out: string[] = [];
  for (const { rel, src } of files) {
    if (!SERVER_FILE.test(rel)) continue;
    const first = src.search(ROUTE_START);
    for (const m of src.matchAll(SCREEN_CALL)) if (first < 0 || m.index! < first) out.push(rel);
  }
  return [...new Set(out)].sort();
}

/* ── 2 · the registry ─────────────────────────────────────────────────── */

type Site =
  /** branch: file → code that turns the 409 into the card's state.
   *  render: file → the condition the card renders under (UrgentSupport with
   *  requestLang must follow it). */
  | { handling: "card"; branch: Readonly<Record<string, string>>; render: Readonly<Record<string, string>> }
  | { handling: "kid"; why: string }
  | { handling: "fixed"; why: string };

/** Every screened 409 route → its client calls and their sites. */
const SCREENED_409: Readonly<Record<string, { calls: readonly string[]; sites: Readonly<Record<string, Site>> }>> = {
  "/extract-log": { calls: ["api.extractLog"], sites: {
    "components/overview/QuickLogModal.tsx": { handling: "card",
      branch: {
        "components/overview/QuickLogModal.tsx": "if (err instanceof EscalationRequiredError) {",
        "lib/milestones/captureMatch.ts": "if (err instanceof EscalationRequiredError) throw err;",
      },
      render: {
        "components/overview/QuickLogModal.tsx": 'data-testid="quicklog-escalation"',
      } },
  } },
  "/describe-child": { calls: ["api.describeChild"], sites: {
    "lib/describeChildClient.ts": { handling: "card",
      branch: { "lib/describeChild.ts": 'error: crisis ? "crisis" : "model"' },
      render: {
        "components/describe/TellArborMore.tsx": 'state.error === "crisis" &&',
        "components/describe/DescribeThread.tsx": 'state.error === "crisis" &&',
      } },
  } },
  "/conversation/proposals": { calls: ["api.extractConversationProposals"], sites: {
    "components/tabs/CoachTab.tsx": { handling: "card",
      branch: { "components/tabs/CoachTab.tsx": "if (error instanceof EscalationRequiredError) setProposalCrisis(true);" },
      render: { "components/tabs/CoachTab.tsx": "{proposalCrisis &&" } },
  } },
  "/explain": { calls: ['"/api/explain"'], sites: {
    "context/ArborContext.tsx": { handling: "card",
      branch: { "context/ArborContext.tsx": "err instanceof EscalationRequiredError ? { explanation: \"\", tryToday: \"\", escalation: true }" },
      render: { "components/journal/JournalMomentDetails.tsx": "{inlineCoRegulationScripts[log.id]?.escalation &&" } },
    "components/tabs/MilestonesTab.tsx": { handling: "card",
      branch: { "components/tabs/MilestonesTab.tsx": "if (res.status === 409) {" },
      render: { "components/tabs/MilestonesTab.tsx": "{explanations[item.id]?.escalation ?" } },
  } },
  "/vision": { calls: ["api.importHomeRecommendations", "api.vision"], sites: {
    "components/program/HomeProgramImport.tsx": { handling: "card",
      branch: { "components/program/HomeProgramImport.tsx": "if (e instanceof EscalationRequiredError) { setCrisis(true); return; }" },
      render: { "components/program/HomeProgramImport.tsx": "{crisis &&" } },
  } },
  "/generate-avatar": { calls: ["api.generateAvatar"], sites: {
    "components/profile/AvatarCreator.tsx": { handling: "card",
      branch: { "components/profile/AvatarCreator.tsx": "if (err instanceof EscalationRequiredError) { setCrisis(true); return null; }" },
      render: { "components/profile/AvatarCreator.tsx": "{crisis ?" } },
  } },
  "/generate-plan": { calls: ["api.generatePlan"], sites: {
    "context/ArborContext.tsx": { handling: "card",
      branch: { "context/ArborContext.tsx": 'if (err instanceof EscalationRequiredError) setEscalatedSurface("plans");' },
      render: { "components/tabs/PlansTab.tsx": '{escalatedSurface === "plans" &&' } },
  } },
  "/analyze-behavior": { calls: ["api.analyzeBehavior"], sites: {
    "context/ArborContext.tsx": { handling: "card",
      branch: { "context/ArborContext.tsx": 'if (err instanceof EscalationRequiredError) setEscalatedSurface("behaviors");' },
      render: { "components/tabs/BehaviorsTab.tsx": '{escalatedSurface === "behaviors" &&' } },
  } },
  "/generate-bedtime-story": { calls: ["api.generateBedtimeStory"], sites: {
    "components/tabs/BedtimeStoriesTab.tsx": { handling: "card",
      branch: { "components/tabs/BedtimeStoriesTab.tsx": "err instanceof EscalationRequiredError ||" },
      render: { "components/tabs/BedtimeStoriesTab.tsx": 'data-testid="bedtime-escalation"' } },
  } },
  "/generate-handoff": { calls: ["api.generateBrief"], sites: {
    "components/sections/SchoolBrief.tsx": { handling: "card",
      branch: { "components/sections/SchoolBrief.tsx": "if (err instanceof EscalationRequiredError) setEscalationBlocked(true);" },
      render: { "components/sections/SchoolBrief.tsx": "{escalationBlocked &&" } },
  } },
  "/plans/phrase": { calls: ['"/api/plans/phrase"'], sites: {
    "lib/plans/planApi.ts": { handling: "card",
      branch: { "components/plans/PlanComposer.tsx": "if (e instanceof PlanApiError && e.status === 409) { setCrisis(true); return; }" },
      render: { "components/plans/PlanComposer.tsx": 'data-plan-own-crisis=""' } },
  } },
  "/generate-comic": { calls: ["api.generateComic"], sites: {
    "lib/heroComics.ts": { handling: "kid", why: "kid shelf comic pages: the screened theme and dialogue are the book's own catalogue text" },
    "lib/firstComic.ts": { handling: "fixed", why: "the first-run wow's page: the fixed first-story theme and line, never the parent's words" },
  } },
  "/generate-scene": { calls: ["api.generateScene"], sites: {
    "components/practice/WorldScene.tsx": { handling: "kid", why: "world scene art from the app's own scene prompts" },
  } },
  "/generate-hero-journey": { calls: ["api.generateHeroJourney"], sites: {
    "components/tabs/HeroJourneyTab.tsx": { handling: "kid", why: "the catalogue story's theme, personalised with the child's name only" },
  } },
  "/generate-adventure": { calls: ["api.generateAdventure"], sites: {} },
};

/** Screened routes that answer a crisis in-band (200 + the escalation
 *  payload): the chat crisis render, never a 409. */
const IN_BAND = ["/chat", "/council", "/voice", "/live/turn"] as const;

/** Client files: everything but the server side (the AI-disclosure guard's rule). */
const SERVER_SIDE = /^(server|routes|ai|eval|memory|sharing|families|services|safety|knowledge|config|contracts|actionLoop|consult|schoolBrief|growth|learn|playbank|practice|types)\//;
const isClient = (rel: string) => !(SERVER_SIDE.test(rel) && !rel.startsWith("practice/") && !rel.startsWith("consult/"));

/** call token → the client files that use it (lib/api.ts defines the methods).
 *  A path token ("/api/x") is found in double quotes, single quotes or a
 *  template literal (wave 4). */
function callSites(files: { rel: string; src: string }[], token: string): string[] {
  const re = token.startsWith('"')
    ? null
    : new RegExp(`\\b${token.replace(".", "\\s*\\.\\s*")}\\b`);
  const path = token.slice(1, -1);
  return files
    .filter(({ rel }) => isClient(rel) && rel !== "lib/api.ts" && rel !== "lib/aiEntrySurfaces.ts")
    .filter(({ src }) => (re ? re.test(src) : src.includes(token) || src.includes(`'${path}'`) || src.includes(`\`${path}`)))
    .map(({ rel }) => rel)
    .sort();
}
/** Whether lib/api.ts's `method` posts to `route` (any of the three quotes). */
const apiMethodPosts = (api: string, method: string, route: string) =>
  new RegExp(`\\b${method}: \\([\\s\\S]{0,900}?["'\`]/api${route.replace(/\//g, "\\/")}["'\`]`).test(api);

/** The UrgentSupport element that follows `condition` in `src`, or null. */
function cardAfter(src: string, condition: string): string | null {
  const at = src.indexOf(condition);
  if (at < 0) return null;
  const card = src.indexOf("<UrgentSupport", at);
  if (card < 0 || card - at > 1200) return null;
  const end = src.indexOf("/>", card);
  return end < 0 ? null : src.slice(card, end + 2);
}

describe("1 · the server's screened 409 routes are exactly the registered ones", () => {
  it("the scan is real", () => {
    const routes = serverRoutes(FILES);
    expect(routes.size).toBeGreaterThan(40);
    for (const r of ["/chat", "/extract-log", "/plans/phrase"]) expect(routes.has(r), r).toBe(true);
  });

  it("every route that screens and answers 409 is registered, and every registered route still does", () => {
    expect(screened409(FILES), "a screened 409 route needs its client call sites classified in SCREENED_409").toEqual(Object.keys(SCREENED_409).sort());
  });

  it("every route that calls the screen is either a registered 409 route or an in-band crisis route", () => {
    expect(screenedAll(FILES), "classify the screened route: SCREENED_409 (answers 409) or IN_BAND (answers in-band)").toEqual([...Object.keys(SCREENED_409), ...IN_BAND].sort());
    expect(strayScreens(FILES), "a screen call outside a route handler cannot be classified").toEqual([]);
  });

  it("the in-band crisis routes screen and never answer 409", () => {
    const routes = serverRoutes(FILES);
    for (const r of IN_BAND) {
      expect(routes.get(r)?.screens, r).toBe(true);
      expect(routes.get(r)?.answers409, r).toBe(false);
    }
  });

  it("negative control: a new screened route is found", () => {
    const fake = [...FILES, { rel: "routes/newThing.ts", src: 'router.post("/new-thing", (req, res) => { if (screenForImmediateEscalation({ note })) { res.status(409).json({}); return; } });' }];
    expect(screened409(fake)).toContain("/new-thing");
    expect("/new-thing" in SCREENED_409).toBe(false);
  });

  it("probe: a screened route registered in single quotes or a template literal is found (the double-quoted read was the only one)", () => {
    const single = [...FILES, { rel: "routes/singleQuoted.ts", src: "router.post('/single-quoted', (req, res) => { if (screenForImmediateEscalation({ note })) { res.status(409).json({}); return; } });" }];
    expect(screened409(single)).toContain("/single-quoted");
    const template = [...FILES, { rel: "server/templated.ts", src: "router.post(`/templated`, (req, res) => { if (screenForImmediateEscalation({ note })) { return refuse(res, 409, 'crisis', 'x'); } });" }];
    expect(screened409(template)).toContain("/templated");
    // Mixed quotes never close a path.
    const mixed = [...FILES, { rel: "server/mixed.ts", src: "router.post(\"/mixed', (req, res) => { if (screenForImmediateEscalation({ note })) { res.status(409).json({}); } });" }];
    expect(screened409(mixed)).not.toContain("/mixed");
  });

  it("probe: a screened route answering through refuse(res, 409, …) is found, and one that never answers 409 is still classified", () => {
    const viaRefuse = [...FILES, { rel: "server/newBook.ts", src: 'const refuse = (res, status, code, error) => res.status(status).json({ error, code });\nexport function mount(router) {\n  router.post("/new-book", (req, res) => {\n    const match = screenForImmediateEscalation({ note: req.body.note });\n    if (match) return refuse(res, 409, "crisis", "Professional support recommended");\n  });\n}' }];
    expect(screened409(viaRefuse)).toContain("/new-book");
    expect(screenedAll(viaRefuse)).toContain("/new-book");
    const silent = [...FILES, { rel: "server/newQuiet.ts", src: 'router.post("/new-quiet", (req, res) => { screenForImmediateEscalation({ note: req.body.note }); res.json({}); });' }];
    expect(screened409(silent)).not.toContain("/new-quiet");
    expect(screenedAll(silent)).toContain("/new-quiet");
    const stray = [...FILES, { rel: "server/helper.ts", src: "export const pre = (t) => screenForImmediateEscalation({ note: t });" }];
    expect(strayScreens(stray)).toEqual(["server/helper.ts"]);
  });
});

describe("2 · every client call site of a screened route is registered", () => {
  it("each lib/api method posts to its route", () => {
    const api = read("lib/api.ts");
    for (const [route, { calls }] of Object.entries(SCREENED_409)) {
      for (const call of calls.filter((c) => c.startsWith("api."))) {
        expect(apiMethodPosts(api, call.slice(4), route), `${call} → ${route}`).toBe(true);
      }
    }
  });

  it("the files that call each route are exactly its registered sites", () => {
    for (const [route, { calls, sites }] of Object.entries(SCREENED_409)) {
      const found = [...new Set(calls.flatMap((c) => callSites(FILES, c)))].sort();
      expect(found, `${route}: classify the new call site in SCREENED_409`).toEqual(Object.keys(sites).sort());
    }
  });

  it("no client file calls a screened route by its path except the registered direct calls", () => {
    for (const route of Object.keys(SCREENED_409)) {
      const direct = SCREENED_409[route].calls.filter((c) => c.startsWith('"'));
      const hits = callSites(FILES, `"/api${route}"`);
      expect(hits, route).toEqual(direct.length ? Object.keys(SCREENED_409[route].sites).sort() : []);
    }
  });

  it("probe: a direct call in single quotes or a template literal is found, and an api method in either quote posts", () => {
    const single = [...FILES, { rel: "components/new/SingleQuoted.tsx", src: "await fetch('/api/extract-log', { method: 'POST' });" }];
    expect(callSites(single, '"/api/extract-log"')).toContain("components/new/SingleQuoted.tsx");
    const template = [...FILES, { rel: "components/new/Templated.tsx", src: "await fetch(`/api/extract-log`, { method: 'POST' });" }];
    expect(callSites(template, '"/api/extract-log"')).toContain("components/new/Templated.tsx");
    expect(apiMethodPosts("extractLog: (body) => post('/api/extract-log', body),", "extractLog", "/extract-log")).toBe(true);
    expect(apiMethodPosts("extractLog: (body) => post(`/api/extract-log`, body),", "extractLog", "/extract-log")).toBe(true);
    expect(apiMethodPosts('extractLog: (body) => post("/api/extract-log", body),', "extractLog", "/extract-log")).toBe(true);
    // Negative control: another route never matches.
    expect(apiMethodPosts("extractLog: (body) => post('/api/extract-logs', body),", "extractLog", "/extract-log")).toBe(false);
  });

  it("negative control: a new call site is found", () => {
    const fake = [...FILES, { rel: "components/new/NewSurface.tsx", src: "await api\n  .generatePlan({});" }];
    expect(callSites(fake, "api.generatePlan")).toContain("components/new/NewSurface.tsx");
    expect(Object.keys(SCREENED_409["/generate-plan"].sites)).not.toContain("components/new/NewSurface.tsx");
  });
});

describe("3 · each site handles the 409 shape", () => {
  const sites = Object.entries(SCREENED_409).flatMap(([route, { sites }]) => Object.entries(sites).map(([file, site]) => ({ route, file, site })));

  it.each(sites.filter((s) => s.site.handling === "card").map((s) => [`${s.route} · ${s.file}`, s.site] as const))(
    "%s: the 409 branch is there and the crisis card renders with the request's language",
    (_name, site) => {
      if (site.handling !== "card") return;
      for (const [file, branch] of Object.entries(site.branch)) {
        const src = read(file);
        expect(src, `${file}: ${branch}`).toContain(branch);
        // A 409 is the crisis screen answering, never an application error.
        const at = src.indexOf(branch);
        const opened = src.lastIndexOf("catch", at);
        if (opened >= 0 && at - opened < 400) expect(src.slice(opened, at), `${file}: logs before the 409 branch`).not.toMatch(/console\.error\(/);
      }
      for (const [file, condition] of Object.entries(site.render)) {
        const card = cardAfter(read(file), condition);
        expect(card, `${file}: UrgentSupport after ${condition}`).not.toBeNull();
        expect(card!, file).toMatch(/\brequestLang=\{/);
        // No microphone from the card: it never starts listening.
        expect(card!, file).not.toMatch(/listen|startVoice|toggleVoice|startDictation/i);
      }
    },
  );

  it("the Everyday Plans composer keeps its door to Help and safety beside the lines", () => {
    const src = read("components/plans/PlanComposer.tsx");
    expect(src).toContain('s("stage.steps.ownCrisisDoor")');
    expect(cardAfter(src, 'data-plan-own-crisis=""')!).toMatch(/requestLang=\{lang\}/);
  });

  it("every kid site is a kid surface in the AI-disclosure registry (two registers)", () => {
    for (const { file, site } of sites) {
      if (site.handling !== "kid") continue;
      const kinds = (AI_CALLERS[file]?.surfaces ?? []).map((s) => s.kind);
      expect(kinds.length, file).toBeGreaterThan(0);
      expect(kinds.every((k) => k === "kid"), `${file} is not only a kid surface: it needs the crisis card`).toBe(true);
    }
  });

  it("the fixed first comic cannot trip the screen, in either language", () => {
    const first = STORY_COMIC["david-and-goliath"];
    for (const [theme, dialogue] of [[first.theme, first.dialogue], [first.themeHe, first.dialogueHe]]) {
      expect(screenForImmediateEscalation({ note: `${theme} ${dialogue}` }), theme).toBeNull();
    }
    expect(read("lib/firstComic.ts")).toContain('const FIRST_STORY_COMIC = STORY_COMIC["david-and-goliath"];');
  });

  it("negative control: a card without the request's language, or a missing card, fails", () => {
    expect(cardAfter('{crisis && <UrgentSupport testId="x" />}', "{crisis &&")).not.toMatch(/\brequestLang=\{/);
    expect(cardAfter("{crisis && <p>Something went wrong</p>}", "{crisis &&")).toBeNull();
  });
});
