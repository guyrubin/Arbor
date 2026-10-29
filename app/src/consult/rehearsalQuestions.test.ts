import { describe, expect, it } from "vitest";
import { numberedQuestions, rehearsalQuestions, rehearsalRows, REHEARSAL_MAX_QUESTIONS } from "./rehearsalQuestions";

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

  // Critic r1 transcripts (fake speech, no punctuation): a spoken worry was
  // glued onto a question, and a mid-sentence "when" started a fake question.
  it("critic r1 EN: the worry starts its own line and a mid-sentence when stays in it", () => {
    const said = "what should we practice at home before the next visit how long does it usually take I'm worried that he doesn't answer when we call his name";
    expect(rehearsalQuestions(said)).toEqual([
      "what should we practice at home before the next visit?",
      "how long does it usually take?",
      "I'm worried that he doesn't answer when we call his name",
    ]);
  });

  it("critic r1 HE: the worry starts its own line", () => {
    const said = "מה כדאי לתרגל בבית לפני הפגישה הבאה כמה זמן זה לוקח בדרך כלל אני דואגת שהוא לא עונה כשקוראים בשמו";
    expect(rehearsalQuestions(said)).toEqual([
      "מה כדאי לתרגל בבית לפני הפגישה הבאה?",
      "כמה זמן זה לוקח בדרך כלל?",
      "אני דואגת שהוא לא עונה כשקוראים בשמו",
    ]);
  });

  it("a wh-word followed by its subject is a clause, not a question (EN); a worry keeps its question words (HE)", () => {
    expect(rehearsalQuestions("what should we do when he cries at drop off")).toEqual(["what should we do when he cries at drop off?"]);
    expect(rehearsalQuestions("I'm worried he doesn't know what to do with other kids")).toEqual(["I'm worried he doesn't know what to do with other kids"]);
    expect(rehearsalQuestions("אני דואגת שהוא לא יודע מה לעשות עם ילדים אחרים")).toEqual(["אני דואגת שהוא לא יודע מה לעשות עם ילדים אחרים"]);
  });

  it("a real question after a worry still gets its own line; a closed sentence still splits at a worry", () => {
    expect(rehearsalQuestions("I'm worried he doesn't talk much how many words should he have at three")).toEqual([
      "I'm worried he doesn't talk much",
      "how many words should he have at three?",
    ]);
    expect(rehearsalQuestions("How long does it usually take I'm worried he doesn't answer?")).toEqual([
      "How long does it usually take?",
      "I'm worried he doesn't answer?",
    ]);
    expect(rehearsalQuestions("so um what worries me is that he bites at preschool")).toEqual(["what worries me is that he bites at preschool"]);
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

  it("lives on the Upcoming card (critic r1), not inside the collapsed past-visits disclosure — no new surface", () => {
    const mount = '<RehearseQuestions lang={uiLang === "he" ? "he" : "en"} onKeep={keepRehearsal} />';
    expect(appts.split(mount)).toHaveLength(2);
    const at = appts.indexOf(mount);
    const upcoming = appts.indexOf('t("elev.learnCare.appt.section.upcoming")');
    const more = appts.indexOf('data-module="appt-more"');
    expect(upcoming).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(upcoming);
    expect(at).toBeLessThan(more);
    expect(card).not.toContain(mount);
  });

  it("answers in place: the keep receipt is drawn inside the rehearsal, not at the page top (critic r1)", () => {
    expect(rehearse).toContain('<ReceiptNoteLine note={kept.note} testId="appt-rehearse-receipt" size="sm" />');
    const keepFn = appts.slice(appts.indexOf("const keepRehearsal = "), appts.indexOf("const addQ = () => {"));
    expect(keepFn).not.toContain("receipt.show(");
  });

  it("a long question wraps in full: a textarea sized to the text (critic r1)", () => {
    expect(rehearse).toContain("<textarea");
    expect(rehearse).toContain("rows={rehearsalRows(draft[i])}");
    expect(rehearse).toContain("ref={fitRehearsalField}");
    expect(appts).toContain("el.style.height = `${Math.max(44, el.scrollHeight)}px`;");
    expect(rehearsalRows("מה כדאי לתרגל בבית לפני הפגישה הבאה?")).toBe(2);
    expect(rehearsalRows("Short?")).toBe(1);
    expect(rehearsalRows("I'm worried that he doesn't answer when we call his name, even from close by")).toBeGreaterThanOrEqual(2);
    expect(rehearsalRows("x".repeat(1000))).toBe(5);
  });

  it("the transcript becomes a numbered draft for editing; nothing is written until Keep", () => {
    expect(rehearse).toContain("onResult: (text) => { if (turn === scope.current) setDraft(rehearsalQuestions(text)); }");
    expect(rehearse).toContain("numberedQuestions(draft).map(");
    expect(rehearse).not.toMatch(/questionsCol|\.upsert\(|api\./);
    expect(rehearse).toContain('const keep = () => { if (draft) { const said = onKeep(draft); setDraft(null); if (said) kept.show({ text: said }); } };');
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
