/**
 * B-ASKJB-45 (deterministic half) — where the parent's stated wishes reach a
 * prompt, and where they do not yet.
 *
 * B-SHELL-39 put the parent's focus and preferences ("Don't push reading")
 * under PARENT_WISHES_RULE into the typed coach and Today's focus only. Every
 * other place a child profile meets a prompt goes through `promptProfile`,
 * which drops the wishes unless the builder opts in. This guard finds every
 * such call site and requires it to be classified:
 *   - "wishes":  opts in ({ parentWishes: true }) and renders the rule;
 *   - "pending": an answer route that should carry them, owned by a named row
 *                (shrink-only: the parked prompt bump empties it);
 *   - "outside": not an answer to the parent (extraction, analysis of counts,
 *                a restatement), with the reason.
 * A new call site fails until someone decides which it is.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildChatPrompt, buildCouncilSynthesisPrompt, buildGeneratePlanPrompt, buildTodaysFocusPrompt, buildVoiceReplyPrompt, PARENT_WISHES_RULE, withParentWishes, promptProfile } from "./prompts";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["ai/prompts.ts", "routes/api.ts", "server/companionContext.ts"];

type Coverage = { kind: "wishes" } | { kind: "pending"; row: string; parked: string } | { kind: "outside"; why: string };
const PARKED = "claude/askjb45-prompt-bump-2026-10-28 (voice_reply 1.11.0 · council_synthesis 1.5.0 · generate_plan 1.3.0; ships after the three live suites run)";

/** Every promptProfile site, by file and the builder or route around it. */
const PARENT_WISHES_COVERAGE: Readonly<Record<string, Coverage>> = {
  "ai/prompts.ts:buildChatPrompt": { kind: "wishes" },
  "ai/prompts.ts:buildTodaysFocusPrompt": { kind: "wishes" },
  // B-ASKJB-45 (council_synthesis 1.5.0 · voice_reply 1.11.0 · generate_plan 1.3.0).
  "ai/prompts.ts:buildCouncilSynthesisPrompt": { kind: "wishes" },
  "ai/prompts.ts:buildVoiceReplyPrompt": { kind: "wishes" },
  "ai/prompts.ts:buildGeneratePlanPrompt": { kind: "wishes" },
  "ai/prompts.ts:buildExtractLogPrompt": { kind: "outside", why: "turns the parent's description into one log; no advice" },
  "ai/prompts.ts:buildAnalyzeBehaviorPrompt": { kind: "outside", why: "\"Find a pattern\" over the moments already kept (counts); not an answer route of B-ASKJB-45" },
  "routes/api.ts:/council": { kind: "outside", why: "the scholars' lens takes; the council synthesis is the answer the parent reads" },
  "routes/api.ts:/describe-child": { kind: "outside", why: "reads only the age label" },
  "routes/api.ts:/explain": { kind: "outside", why: "explains a catalogue milestone" },
  "routes/api.ts:/vision": { kind: "outside", why: "describes a photo or document the parent sent" },
  "routes/api.ts:/generate-handoff": { kind: "outside", why: "a note for a teacher restating what the parent reported (B-ASKJB-44)" },
  "routes/api.ts:/digest": { kind: "outside", why: "the weekly recap from the week's counts" },
  "server/companionContext.ts:assembleCompanionContext": { kind: "outside", why: "the spoken context's profile; the Live instruction keeps its own bytes and /voice adds the wishes at the route (withParentWishes)" },
};

const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/.*$/gm, (m, p1) => p1 + " ".repeat(m.length - p1.length));

/** file:owner for every `promptProfile(` call (the definition excluded). */
function sites(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const rel of FILES) {
    const lines = strip(readFileSync(path.join(SRC, rel), "utf8")).split("\n");
    let owner = "";
    lines.forEach((line, i) => {
      const builder = /^export const (build[A-Za-z]+) = /.exec(line);
      const route = /router\.(?:post|get|put|patch|delete)\(\s*"([^"]+)"/.exec(line);
      const fn = /^(?:export )?(?:async )?(?:function|const) (assemble[A-Za-z]+)/.exec(line);
      if (builder) owner = builder[1];
      else if (route) owner = route[1];
      else if (fn) owner = fn[1];
      if (!/\bpromptProfile\(/.test(line) || /export const promptProfile/.test(line)) return;
      const key = `${rel}:${owner}`;
      out.set(key, [...(out.get(key) ?? []), `${rel}:${i + 1}: ${line.trim().slice(0, 90)}`]);
    });
  }
  return out;
}

describe("B-ASKJB-45 · every prompt that meets a child profile is classified for the parent's wishes", () => {
  const found = sites();

  it("the scan is real", () => {
    expect(found.size).toBeGreaterThan(8);
    for (const known of ["ai/prompts.ts:buildChatPrompt", "ai/prompts.ts:buildVoiceReplyPrompt", "routes/api.ts:/digest"]) expect(found.has(known), known).toBe(true);
  });

  it("no unclassified call site, and no stale classification", () => {
    const unclassified = [...found.keys()].filter((k) => !(k in PARENT_WISHES_COVERAGE));
    expect(unclassified, `classify in PARENT_WISHES_COVERAGE: ${unclassified.map((k) => found.get(k)!.join(" | ")).join("; ")}`).toEqual([]);
    expect(Object.keys(PARENT_WISHES_COVERAGE).filter((k) => !found.has(k))).toEqual([]);
  });

  it("a builder classified \"wishes\" opts in and renders PARENT_WISHES_RULE; a \"pending\" one does not yet", () => {
    const prompts = strip(readFileSync(path.join(SRC, "ai/prompts.ts"), "utf8"));
    const body = (name: string) => prompts.slice(prompts.indexOf(`export const ${name} = `), prompts.indexOf("\nexport ", prompts.indexOf(`export const ${name} = `) + 10));
    for (const [key, c] of Object.entries(PARENT_WISHES_COVERAGE)) {
      if (!key.startsWith("ai/prompts.ts:")) continue;
      const fn = body(key.slice("ai/prompts.ts:".length));
      const optsIn = /promptProfile\([^)]*\{ parentWishes: true \}\)/.test(fn) && /renderParentWishes(?:Rule|Line)\(/.test(fn);
      if (c.kind === "wishes") expect(optsIn, key).toBe(true);
      if (c.kind === "pending") expect(optsIn, `${key} opts in: move it to "wishes" (the pending list only shrinks)`).toBe(false);
    }
  });

  it("the pending list only shrinks: B-ASKJB-45 emptied it", () => {
    const pending = Object.entries(PARENT_WISHES_COVERAGE).filter(([, c]) => c.kind === "pending").map(([k]) => k).sort();
    expect(pending).toEqual([]);
    for (const k of pending) expect(["ai/prompts.ts:buildCouncilSynthesisPrompt", "ai/prompts.ts:buildGeneratePlanPrompt", "ai/prompts.ts:buildVoiceReplyPrompt"]).toContain(k);
  });

  it("the opted-in builders really carry the words and the rule (and a profile without wishes keeps its bytes)", () => {
    const wishful = { id: "c", name: "N", age: 4, parentPreferences: [{ words: "Don't push reading" }], focusAreas: [{ words: "Calmer mornings", domainId: "feelings" }] };
    const chat = buildChatPrompt({ developmentalFramework: "F", approvedMemory: "", knowledgeContext: "", childProfile: wishful, scholar: { name: "s", concept: "c", method: "m", defaultFrame: "f" }, message: "m", languageDirective: "" });
    expect(chat).toContain("Don't push reading");
    expect(chat).toContain(PARENT_WISHES_RULE);
    const focus = buildTodaysFocusPrompt({ childProfile: wishful, count: 0, triggerSent: "", lastActionRecommendation: "", lastActionOutcome: "", languageDirective: "" });
    expect(focus).toContain("Calmer mornings");
    const plain = buildChatPrompt({ developmentalFramework: "F", approvedMemory: "", knowledgeContext: "", childProfile: { id: "c", name: "N", age: 4 }, scholar: { name: "s", concept: "c", method: "m", defaultFrame: "f" }, message: "m", languageDirective: "" });
    expect(plain).not.toContain(PARENT_WISHES_RULE);
  });

  it("B-ASKJB-45: voice, council and plans carry the words and the rule; without wishes no rule renders", () => {
    const wishful = { id: "c", name: "N", age: 4, parentPreferences: [{ words: "Don't push reading" }], focusAreas: [{ words: "Calmer mornings", domainId: "feelings" }] };
    const plainProfile = { id: "c", name: "N", age: 4 };
    const council = (childProfile: unknown) => buildCouncilSynthesisPrompt({ developmentalFramework: "F", approvedMemory: "", knowledgeContext: "", childProfile, councilTakes: "T", message: "m", languageDirective: "" });
    const voice = (childProfile: unknown) => buildVoiceReplyPrompt({ persona: "P", scholar: { name: "s", method: "m" }, childProfile, message: "m", languageDirective: "" });
    const plan = (childProfile: unknown) => buildGeneratePlanPrompt({ developmentalFramework: "F", childProfile, challengeTopic: "mornings" });
    for (const build of [council, voice, plan]) {
      const withWishes = build(wishful);
      expect(withWishes).toContain("Don't push reading");
      expect(withWishes).toContain("Calmer mornings");
      expect(withWishes).toContain(PARENT_WISHES_RULE);
      expect(build(plainProfile)).not.toContain(PARENT_WISHES_RULE);
    }
    // /voice: the projected spoken profile gains the request's wishes; no profile stays none.
    const spoken = withParentWishes(promptProfile(plainProfile), wishful);
    expect(voice(spoken)).toContain("Don't push reading");
    expect(withParentWishes(null, wishful)).toBeNull();
    expect(withParentWishes(promptProfile(plainProfile), plainProfile)).toEqual(promptProfile(plainProfile));
  });

  it("the rule keeps safety above the wishes", () => {
    expect(PARENT_WISHES_RULE).toMatch(/never override the non-diagnostic rules, the escalation guidance or urgent-help guidance/);
  });

  it("negative control: an unclassified site is found", () => {
    const fake = "export const buildNewThingPrompt = ({ childProfile }) => `${JSON.stringify(promptProfile(childProfile))}`;";
    expect(/\bpromptProfile\(/.test(fake) && !/export const promptProfile/.test(fake)).toBe(true);
    expect("ai/prompts.ts:buildNewThingPrompt" in PARENT_WISHES_COVERAGE).toBe(false);
  });
});
