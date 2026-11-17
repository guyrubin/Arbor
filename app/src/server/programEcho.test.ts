import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildChatPrompt, PROMPT_VERSIONS } from "../ai/prompts";
import { programEcho, programPromptLine, type CompanionProgram } from "./companionContext";

/**
 * V77 ("What Arbor used") — the program echo changes NOTHING the model
 * receives. The /chat route builds the program input once, renders it into
 * buildChatPrompt, and echoes { id, week } from that same object only when a
 * program line was actually rendered. Synthetic fixtures only.
 */
const program = {
  id: "steady-nights",
  name: { en: "Steady Nights", he: "לילות רגועים" },
  shelf: "sleep",
  week: 2,
  skill: { en: "Same three steps every night, in the same order.", he: "אותם שלושה צעדים בכל ערב." },
  scripts: [],
  measures: {},
} as unknown as CompanionProgram;

const base = {
  developmentalFramework: "F", approvedMemory: "", knowledgeContext: "", childProfile: null,
  scholar: { name: "s", concept: "c", method: "m", defaultFrame: "f" }, message: "Bedtime takes an hour", languageDirective: "",
};

describe("program echo — prompt identity (no prompt or context change)", () => {
  for (const [label, prog] of [["with a program", program], ["without a program", null]] as const) {
    it(`${label}: buildChatPrompt is byte-identical before and after the echo`, () => {
      // Before: the route's previous form, an inline programPromptLine call.
      const before = buildChatPrompt({ ...base, activeProgram: programPromptLine(prog) });
      // After: the object built once, passed to the prompt, then echoed.
      const activeProgram = programPromptLine(prog);
      const after = buildChatPrompt({ ...base, activeProgram });
      const echo = programEcho(prog, activeProgram);
      const afterEcho = buildChatPrompt({ ...base, activeProgram });
      expect(after).toBe(before);
      expect(afterEcho).toBe(before);
      // the echo exists exactly when the prompt carries the program line
      expect(Boolean(echo)).toBe(before.includes("Active program:"));
    });
  }
  it("echoes the id and week of the program that was rendered", () => {
    const activeProgram = programPromptLine(program);
    expect(buildChatPrompt({ ...base, activeProgram })).toContain("Active program: Steady Nights, week 2:");
    expect(programEcho(program, activeProgram)).toEqual({ id: "steady-nights", week: 2 });
  });
  it("negative controls: no program → no echo; a program whose line renders empty → no echo", () => {
    expect(programEcho(null, programPromptLine(null))).toBeUndefined();
    const blank = { ...program, skill: { en: " ", he: " " } } as unknown as CompanionProgram;
    const activeProgram = programPromptLine(blank);
    expect(buildChatPrompt({ ...base, activeProgram })).not.toContain("Active program:");
    expect(programEcho(blank, activeProgram)).toBeUndefined();
  });
  it("the coach_chat prompt version is unchanged (no eval triggered)", () => {
    expect(PROMPT_VERSIONS.coach_chat.version).toBe("1.9.0");
  });
  it("the /chat route renders and echoes the SAME object (no second lookup)", () => {
    const src = readFileSync(new URL("../routes/api.ts", import.meta.url), "utf8");
    expect(src).toContain("const activeProgram = programPromptLine(companion.program);");
    expect(src).toContain("        activeProgram,\n");
    expect(src).toContain("const programUsed = programEcho(companion.program, activeProgram);");
    // negative control: the chat prompt no longer builds its own second copy
    const call = src.slice(src.indexOf("const prompt = buildChatPrompt({"), src.indexOf("}) + attachmentTurnPolicy("));
    expect(call).not.toContain("programPromptLine(");
  });
});
