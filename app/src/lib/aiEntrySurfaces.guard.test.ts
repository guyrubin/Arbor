/**
 * B-GA-11 — every enabled AI entry surface shows the approved Art. 50 line at
 * the first interaction, in EN and HE, and there is never a second wording.
 *
 *  1. The scan finds every client call to a model route (lib/api.ts AI
 *     methods, the stream helpers, the direct routes) and the set must equal
 *     AI_CALLERS (lib/aiEntrySurfaces.ts): a new AI call fails until it is
 *     classified.
 *  2. Each "interaction" surface renders its approved line: Talk through
 *     CompanionComposer's foot, the surfaces outside Talk through
 *     AiDisclosureLine (the same key and class), or their own approved key.
 *  3. Every approved key has an English and a Hebrew wording that says AI.
 *  4. Every string in the dictionaries that mentions AI is an approved
 *     disclosure or a listed non-disclosure mention: a second disclosure
 *     wording cannot slip in.
 * Negative controls prove each check can fail.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he, translate } from "./i18n";
import { elevationEn, elevationHe } from "./i18nElevation";
import { PLAN_STRINGS } from "./plans/planStrings";
import { AI_CALLERS, AI_CLIENT_METHODS, AI_DIRECT_ROUTES, AI_DISCLOSURE_KEYS, AI_MENTIONS, AI_STREAM_HELPERS, type AiSurface } from "./aiEntrySurfaces";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_SIDE = /^(server|routes|ai|eval|memory|sharing|families|services|safety|knowledge|config|contracts|actionLoop|consult|schoolBrief|growth|learn|playbank|practice|types)\//;

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, acc);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const code = (text: string) => text.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const read = (rel: string) => code(readFileSync(path.join(SRC, rel), "utf8"));

/** file → the AI endpoints it calls. */
function scanCalls(files: { rel: string; src: string }[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const { rel, src } of files) {
    if (rel === "lib/api.ts" || rel === "lib/aiEntrySurfaces.ts") continue;
    if (SERVER_SIDE.test(rel) && !rel.startsWith("practice/") && !rel.startsWith("consult/")) continue;
    const hits = new Set<string>();
    for (const m of AI_CLIENT_METHODS) if (new RegExp(`\\bapi\\s*\\.\\s*${m}\\b`).test(src)) hits.add(`api.${m}`);
    for (const s of AI_STREAM_HELPERS) if (new RegExp(`\\b${s}\\s*\\(`).test(src)) hits.add(s);
    for (const r of AI_DIRECT_ROUTES) if (src.includes(`"${r}"`) || src.includes(`\`${r}`) || src.includes(`${r}\``)) hits.add(r);
    if (hits.size) out.set(rel, hits);
  }
  return out;
}

const FILES = sourceFiles(SRC).map((f) => ({ rel: path.relative(SRC, f).split(path.sep).join("/"), src: code(readFileSync(f, "utf8")) }));
const CALLS = scanCalls(FILES);

describe("1 · every client call to a model is classified", () => {
  it("the scan is real", () => {
    expect(FILES.length).toBeGreaterThan(300);
    for (const known of ["components/tabs/CoachTab.tsx", "context/ArborContext.tsx", "lib/describeChildClient.ts", "lib/heroComics.ts"]) expect(CALLS.has(known), known).toBe(true);
  });

  it("the callers and their endpoints are exactly the registered ones", () => {
    const found = Object.fromEntries([...CALLS].map(([f, s]) => [f, [...s].sort()]));
    const registered = Object.fromEntries(Object.entries(AI_CALLERS).map(([f, c]) => [f, [...c.endpoints].sort()]));
    expect(found, "classify the new AI call in AI_CALLERS (lib/aiEntrySurfaces.ts)").toEqual(registered);
  });

  it("negative control: an unregistered AI call is found", () => {
    const fake = scanCalls([{ rel: "components/new/NewAiThing.tsx", src: "await api\n  .generatePlan({});" }]);
    expect(fake.get("components/new/NewAiThing.tsx")).toEqual(new Set(["api.generatePlan"]));
    expect("components/new/NewAiThing.tsx" in AI_CALLERS).toBe(false);
  });

  it("every surface file exists", () => {
    for (const c of Object.values(AI_CALLERS)) for (const s of c.surfaces) expect(existsSync(path.join(SRC, s.file)), s.file).toBe(true);
  });
});

/** Does the surface's source render its approved line? */
function renders(surface: Extract<AiSurface, { kind: "interaction" }>, src: string): boolean {
  if (surface.via === "CompanionComposer") return /<CompanionComposer\b/.test(src);
  if (surface.via === "AiDisclosureLine") return /<AiDisclosureLine\s+language=\{/.test(src);
  return src.includes(`"${surface.disclosure}"`);
}

describe("2 · each interaction surface shows its approved line at the input", () => {
  const interactions = Object.values(AI_CALLERS).flatMap((c) => c.surfaces).filter((s): s is Extract<AiSurface, { kind: "interaction" }> => s.kind === "interaction");

  it("there are interaction surfaces to check", () => {
    expect(interactions.length).toBeGreaterThanOrEqual(8);
  });

  it.each(interactions.map((s) => [`${s.file} → ${s.via ?? s.disclosure}`, s] as const))("%s", (_label, surface) => {
    expect(renders(surface, read(surface.file))).toBe(true);
  });

  it("negative control: a surface without its line is caught", () => {
    expect(renders({ file: "x", kind: "interaction", disclosure: "companion.input.foot", via: "AiDisclosureLine" }, "<p>{t(\"x\")}</p>")).toBe(false);
  });

  it("Talk's composer foot is the line, and AiDisclosureLine repeats it exactly (same key, same class)", () => {
    const composer = read("components/companion/CompanionComposer.tsx");
    expect(composer).toContain('<p className="companion-composer-foot">{inputText(language, "companion.input.foot")}</p>');
    const line = read("components/companion/AiDisclosureLine.tsx");
    expect(line).toContain('className="companion-composer-foot"');
    expect(line).toContain('translate(language, "companion.input.foot")');
    expect(line).toContain('import "./companionComposer.css";');
  });

  it("the line is rendered where the input is, not behind a sheet or a modal of its own", () => {
    const line = read("components/companion/AiDisclosureLine.tsx");
    expect(line).not.toMatch(/Modal|Surface|role="dialog"/);
  });
});

describe("3 · every approved wording is AI-explicit in English and Hebrew", () => {
  const planEn = PLAN_STRINGS.en as Record<string, string>;
  const planHe = PLAN_STRINGS.he as Record<string, string>;
  it.each(Object.keys(AI_DISCLOSURE_KEYS))("%s", (key) => {
    const enText = planEn[key] ?? translate("en", key);
    const heText = planHe[key] ?? translate("he", key);
    expect(enText, "English").not.toBe(key);
    expect(heText, "Hebrew").not.toBe(key);
    expect(enText).toMatch(/\bAI\b/);
    expect(heText).toMatch(/[֐-׿]/);
    expect(heText).toMatch(/בינה\s+ה?מלאכותית|\bAI\b/);
    expect(heText).not.toBe(enText);
  });
});

describe("4 · never a second disclosure wording", () => {
  const dicts: Record<string, string>[] = [{ ...elevationEn, ...en }, { ...elevationHe, ...he }, PLAN_STRINGS.en as Record<string, string>];
  const mentions = (d: Record<string, string>) => Object.entries(d).filter(([, v]) => /\bAI\b|artificial intelligence/i.test(v)).map(([k]) => k);
  const known = (k: string) => k in AI_DISCLOSURE_KEYS || k in AI_MENTIONS;

  it("every string that mentions AI is an approved disclosure or a listed mention", () => {
    const found = new Set(dicts.flatMap(mentions));
    expect(found.size).toBeGreaterThan(10);
    expect([...found].filter((k) => !known(k)).sort(), "a new AI wording must be an approved disclosure (AI_DISCLOSURE_KEYS) or a listed mention").toEqual([]);
  });

  it("negative control: a new disclosure-like wording is flagged", () => {
    expect(mentions({ "elev.new.aiLine": "This answer was written by AI." }).filter((k) => !known(k))).toEqual(["elev.new.aiLine"]);
  });

  it("no registration is stale", () => {
    const all = { ...elevationEn, ...en, ...(PLAN_STRINGS.en as Record<string, string>) } as Record<string, string>;
    for (const k of [...Object.keys(AI_DISCLOSURE_KEYS), ...Object.keys(AI_MENTIONS)]) expect(all[k], k).toBeTruthy();
  });
});
