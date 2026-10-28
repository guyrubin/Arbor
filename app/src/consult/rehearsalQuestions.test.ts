import { describe, expect, it } from "vitest";
import { numberedQuestions, rehearsalQuestions, REHEARSAL_MAX_QUESTIONS } from "./rehearsalQuestions";

describe("B-VOICE-03 · a spoken rehearsal becomes numbered questions, in the parent's own words", () => {
  it("keeps the parent's questions and voiced worries, drops everything else (EN)", () => {
    const said = "We had a hard week. I'm worried that he only says ten words. How many words should he have at three? He loves trains. Should we try speech therapy at home";
    expect(rehearsalQuestions(said)).toEqual([
      "I'm worried that he only says ten words",
      "How many words should he have at three?",
      "Should we try speech therapy at home?",
    ]);
  });

  it("cuts an unpunctuated transcript at each question opener", () => {
    expect(rehearsalQuestions("what should we do at bedtime how long does it usually take is it normal to wake twice")).toEqual([
      "what should we do at bedtime?",
      "how long does it usually take?",
      "is it normal to wake twice?",
    ]);
  });

  it("Hebrew: questions and worries, with the question mark added", () => {
    expect(rehearsalQuestions("אני דואגת שהוא לא מדבר הרבה. מה אפשר לעשות בבית? היה לנו שבוע טוב. האם כדאי לבדוק שמיעה")).toEqual([
      "אני דואגת שהוא לא מדבר הרבה",
      "מה אפשר לעשות בבית?",
      "האם כדאי לבדוק שמיעה?",
    ]);
  });

  it("never invents: no question, no worry → nothing; dedupes; caps at the packet's ten", () => {
    expect(rehearsalQuestions("He played outside. We read two books.")).toEqual([]);
    expect(rehearsalQuestions("")).toEqual([]);
    expect(rehearsalQuestions("Is he okay? is he okay?")).toEqual(["Is he okay?"]);
    const many = Array.from({ length: 14 }, (_, i) => `Question number ${i}?`).join(" ");
    expect(rehearsalQuestions(many)).toHaveLength(REHEARSAL_MAX_QUESTIONS);
  });

  it("numbers them for the review", () => {
    expect(numberedQuestions(["What next?", "How long?"])).toEqual(["1. What next?", "2. How long?"]);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { translate } from "../lib/i18n";

describe("B-VOICE-03 · the visit page: rehearse, review numbered, keep only on Confirm", () => {
  const appts = readFileSync(path.resolve(__dirname, "..", "components", "sections", "Appointments.tsx"), "utf8");
  const card = appts.slice(appts.indexOf('data-module="appt-prepare"'), appts.indexOf("LC-09: \"prepare a summary\""));
  const rehearse = appts.slice(appts.indexOf("function RehearseQuestions"));

  it("lives inside the visit's questions card, the existing object (no new surface)", () => {
    expect(card).toContain('<RehearseQuestions lang={uiLang === "he" ? "he" : "en"} onKeep={keepRehearsal} />');
  });

  it("the transcript becomes a numbered draft for editing; nothing is written until Keep", () => {
    expect(rehearse).toContain("onResult: (text) => { if (turn === scope.current) setDraft(rehearsalQuestions(text)); }");
    expect(rehearse).toContain("numberedQuestions(draft).map(");
    expect(rehearse).not.toMatch(/questionsCol|\.upsert\(|api\./);
    expect(rehearse).toContain('const keep = () => { if (draft) { onKeep(draft); setDraft(null); } };');
    expect(rehearse).toContain('data-testid="appt-rehearse-keep" onClick={keep}');
    expect(rehearse).toContain('data-testid="appt-rehearse-discard" onClick={() => setDraft(null)}');
    const keepFn = appts.slice(appts.indexOf("const keepRehearsal = "), appts.indexOf("const addQ = () => {"));
    expect(keepFn).toContain("void questionsCol.upsert({ id: `q${stamp}-${String(i).padStart(2, \"0\")}`, text })");
    expect(keepFn).toContain(".slice(0, REHEARSAL_MAX_QUESTIONS)");
  });

  it("the open microphone shows the REC-01 indicator (B-STATUS-02) and a data-use line", () => {
    expect(rehearse).toContain("<RecordingIndicator ");
    expect(rehearse).toContain('t("elev.learnCare.appt.rehearse.dataUse")');
  });

  it("every new string exists in EN and HE, and they differ", () => {
    for (const key of ["hint", "dataUse", "none", "edit", "remove", "keep", "discard", "kept.one", "kept.many"]) {
      const k = `elev.learnCare.appt.rehearse.${key}`;
      expect(translate("en", k), k).not.toBe(k);
      expect(translate("he", k), k).not.toBe(k);
      expect(translate("he", k), k).not.toBe(translate("en", k));
    }
  });

  it("NEGATIVE CONTROL: the questions card before this row had no spoken door", () => {
    const pre = '<div className="flex gap-2">\n          <input value={q} onChange={(e) => setQ(e.target.value)} />\n        </div>';
    expect(pre).not.toContain("RehearseQuestions");
  });
});
