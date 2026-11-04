/**
 * B-PROG-16 — the handback renders cover, tomorrow and ask-after in EN and HE.
 * Now mounts it only while the pilot flag is on.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { loopFirewallHits } from "../../lib/loop/firewall";
import { ProgramBookHandbackView, type HandbackLabels } from "./ProgramBookHandback";
import type { BookHandback } from "../../lib/programs/sharedObject";

const labels = (lang: "en" | "he"): HandbackLabels => lang === "he"
  ? {
    handback: "מהקריאה של אתמול", tomorrow: "דבר אחד למחר", ask: "שאלה שאפשר לשאול",
    dismiss: "לא עכשיו", save: "לשמור ביומן", words: "המילים שלכם",
    placeholder: "מה ששמתם לב אליו, במילים שלכם", saveError: "זה לא נשמר. אפשר לנסות שוב.",
  }
  : {
    handback: "From yesterday's reading", tomorrow: "One thing for tomorrow", ask: "A question you can ask",
    dismiss: "Not now", save: "Save in the journal", words: "Your words",
    placeholder: "What you noticed, in your words", saveError: "That didn’t save. Please try again.",
  };

const card = (lang: "en" | "he"): BookHandback => ({
  key: "plan-new-food:2026-10-28",
  objectId: "plan-new-food",
  title: lang === "he" ? "אוכל חדש" : "A new food",
  coverLine: lang === "he" ? "ארבעה צעדים קטנים" : "Four small steps",
  tomorrow: lang === "he" ? "מחר בערב, אותם ארבעה צעדים." : "Tomorrow evening, the same four steps.",
  askAfter: lang === "he" ? "מה השלבים שלנו?" : "What are our steps?",
});

describe("B-PROG-16 · the handback card", () => {
  it("shows cover, tomorrow and the question in English, and the journal door", () => {
    const html = renderToStaticMarkup(
      <ProgramBookHandbackView card={card("en")} lang="en" labels={labels("en")} onDismiss={() => {}} onSave={async () => true} />,
    );
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("From yesterday&#x27;s reading");
    expect(html).toContain("A new food");
    expect(html).toContain("Four small steps");
    expect(html).toContain("One thing for tomorrow");
    expect(html).toContain("Tomorrow evening, the same four steps.");
    expect(html).toContain("A question you can ask");
    expect(html).toContain("What are our steps?");
    expect(html).toContain("Save in the journal");
    expect(html).toContain("Not now");
    expect(html).toContain('disabled=""');
    expect(loopFirewallHits(html)).toEqual([]);
  });

  it("the same card in Hebrew is right to left and keeps the parent's words", () => {
    const html = renderToStaticMarkup(
      <ProgramBookHandbackView card={card("he")} lang="he" labels={labels("he")} onDismiss={() => {}} onSave={async () => true} />,
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("מהקריאה של אתמול");
    expect(html).toContain("אוכל חדש");
    expect(html).toContain("ארבעה צעדים קטנים");
    expect(html).toContain("דבר אחד למחר");
    expect(html).toContain("שאלה שאפשר לשאול");
    expect(html).toContain("לשמור ביומן");
    expect(loopFirewallHits(html)).toEqual([]);
  });

  it("Now shows the card only while the flag is on, and a save is the parent's sentence alone", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const now = readFileSync(path.join(here, "../companion/NowView.tsx"), "utf8");
    const view = readFileSync(path.join(here, "ProgramBookHandback.tsx"), "utf8");
    expect(now).toContain("{programSharedObjectOn() && <ProgramBookHandback />}");
    expect(view).toContain("addMoment(text, { callerShowsFailure: true })");
    expect(view).not.toMatch(/coRegulationScript|score|choice/);
  });
});
