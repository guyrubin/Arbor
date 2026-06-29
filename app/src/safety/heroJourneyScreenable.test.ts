import { describe, expect, it } from "vitest";
import { assembleHeroJourneyScreenable } from "./heroJourneyScreenable";
import { screenModelOutputLexical } from "./outputScreen";

/** A clean, warm, non-diagnostic render (the happy path). */
const cleanRender = () => ({
  scenes: [
    {
      beatId: "call",
      title: "The Brave Start",
      narration: "Mia stood at the edge of the bright forest and took a big breath.",
      imagePrompt: "A child hero standing tall at a glowing forest edge, hopeful pose.",
      sfx: ["WHOOSH!", "TWINKLE!"],
      dialogue: "I can do this!",
    },
    {
      beatId: "fear",
      title: "The Tall Shadow",
      narration: "The giant looked very big, but Mia remembered she was brave.",
      imagePrompt: "A gentle giant shadow over a small determined hero.",
      sfx: ["BOOM!", "AHH…"],
      dialogue: "I am not afraid!",
    },
  ],
  choices: [
    { id: "a", label: "I tiptoe closer to look", consequence: "Mia learns the giant is gentle and kind." },
    { id: "b", label: "I wave hello first", consequence: "The giant smiles and waves back warmly." },
  ],
  reflection: {
    practiced: ["courage", "trying new things"],
    questions: ["What helped Mia feel brave?"],
  },
});

describe("assembleHeroJourneyScreenable", () => {
  it("includes every model-authored span and excludes server-fixed fields", () => {
    const s = assembleHeroJourneyScreenable(cleanRender());
    // model-authored spans present
    for (const span of [
      "The Brave Start", "took a big breath", "glowing forest edge", "I can do this!",
      "WHOOSH!", "TWINKLE!", "The Tall Shadow", "I am not afraid!", "BOOM!", "AHH…",
      "I tiptoe closer to look", "the giant is gentle", "I wave hello first", "smiles and waves back",
      "courage", "trying new things", "What helped Mia feel brave?",
    ]) {
      expect(s).toContain(span);
    }
    // server-fixed fields excluded
    expect(s).not.toContain("call");
    expect(s).not.toContain("fear");
  });

  it("never throws on malformed / partial renders", () => {
    expect(assembleHeroJourneyScreenable(null)).toBe("");
    expect(assembleHeroJourneyScreenable("nope")).toBe("");
    expect(assembleHeroJourneyScreenable({})).toBe("");
    expect(assembleHeroJourneyScreenable({ scenes: [null, { title: 7 }, { narration: "ok" }] })).toContain("ok");
    expect(assembleHeroJourneyScreenable({ scenes: "x", choices: 3, reflection: 9 })).toBe("");
  });

  it("clean output is not flagged by the lexical screen", () => {
    const verdict = screenModelOutputLexical(assembleHeroJourneyScreenable(cleanRender()));
    expect(verdict.flagged).toBe(false);
  });
});

describe("hero-journey output screen catches a flagged span in ANY model-authored field", () => {
  // A diagnostic phrase the lexical floor catches. NOTE: the shared screen keys on
  // pronoun/"your child"/[child] subjects, not bare first names — so we use the
  // pronoun form here. (The name-based gap is a pre-existing limitation of the
  // shared screen, tracked separately; out of scope for this assembler test.)
  const DIAG = "she is autistic";
  const cases: Array<{ field: string; mutate: (r: ReturnType<typeof cleanRender>) => void }> = [
    { field: "scenes[].narration", mutate: (r) => { r.scenes[0].narration = DIAG; } },
    { field: "scenes[].title", mutate: (r) => { r.scenes[0].title = DIAG; } },
    { field: "scenes[].dialogue", mutate: (r) => { r.scenes[1].dialogue = DIAG; } },
    { field: "scenes[].imagePrompt", mutate: (r) => { r.scenes[1].imagePrompt = DIAG; } },
    { field: "scenes[].sfx[]", mutate: (r) => { r.scenes[0].sfx.push(DIAG); } },
    { field: "choices[].label", mutate: (r) => { r.choices[0].label = DIAG; } },
    { field: "choices[].consequence", mutate: (r) => { r.choices[1].consequence = DIAG; } },
    { field: "reflection.practiced[]", mutate: (r) => { r.reflection.practiced.push(DIAG); } },
    { field: "reflection.questions[]", mutate: (r) => { r.reflection.questions.push(DIAG); } },
  ];
  it.each(cases)("flags a diagnostic span in $field", ({ mutate }) => {
    const r = cleanRender();
    mutate(r);
    const verdict = screenModelOutputLexical(assembleHeroJourneyScreenable(r));
    expect(verdict.flagged).toBe(true);
    expect(verdict.category).toBe("diagnosis");
  });

  it("flags medication dosing hidden in a scene", () => {
    const r = cleanRender();
    r.scenes[0].narration = "The wizard said to give 3 mg of melatonin before bed.";
    const verdict = screenModelOutputLexical(assembleHeroJourneyScreenable(r));
    expect(verdict.flagged).toBe(true);
    expect(verdict.category).toBe("medication");
  });

  it("flags a start/stop-treatment directive in a choice", () => {
    const r = cleanRender();
    r.choices[0].consequence = "We decide to stop the medication right away.";
    const verdict = screenModelOutputLexical(assembleHeroJourneyScreenable(r));
    expect(verdict.flagged).toBe(true);
    expect(verdict.category).toBe("treatment_directive");
  });
});
