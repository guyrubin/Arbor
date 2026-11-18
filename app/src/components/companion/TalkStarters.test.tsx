import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TalkStarters from "./TalkStarters";

vi.mock("../ui/Icon", () => ({ Icon: ({ name }: { name: string }) => <i data-icon={name} /> }));

const now = new Date();
const iso = (daysAgo: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 9).toISOString();
const starters = [
  { id: "b", kind: "kept" as const, words: "Sang his bath song", at: iso(1) },
  { id: "c", kind: "hard" as const, words: "Tablet turned off", at: iso(2) },
];
const strip = (s: string) => s.replace(/[⁦-⁩]/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("TalkStarters (V77, empty state)", () => {
  it("EN: each card is the parent's words, its kind and its day (day-first), then Something else", () => {
    const html = renderToStaticMarkup(<TalkStarters starters={starters} lang="en" onPick={() => {}} onElse={() => {}} />);
    const text = strip(html);
    expect(text).toContain("Sang his bath song");
    expect(text).toMatch(/You kept this · [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}/);
    expect(text).toMatch(/A hard moment · /);
    expect(text).toContain("Something else In your own words");
    expect(html).toContain('data-kind="hard"');
    expect(html).toContain("k-hard");
    // negative control: never month-first
    expect(text).not.toMatch(/You kept this · [A-Z][a-z]{2} \d{1,2},/);
  });
  it("HE: Hebrew labels; the parent's words keep their own direction", () => {
    const text = strip(renderToStaticMarkup(<TalkStarters starters={starters} lang="he" onPick={() => {}} onElse={() => {}} />));
    expect(text).toContain("שמרתם את זה");
    expect(text).toContain("רגע קשה");
    expect(text).toContain("משהו אחר");
    expect(text).not.toContain("You kept this");
  });
});

describe("CoachTab wiring", () => {
  const src = readFileSync(new URL("../tabs/CoachTab.tsx", import.meta.url), "utf8");
  it("a starter fills the composer (the family-question path) and never sends", () => {
    const block = src.slice(src.indexOf("<TalkStarters"), src.indexOf("/>", src.indexOf("<TalkStarters")));
    expect(block).toContain("onPick={(from, words) => continueWithTopic(from, words)}");
    expect(block).toContain("onElse={(from) => focusComposer(from)}");
    // negative control: no send from a starter
    expect(block).not.toContain("handleChatSend");
  });
  it("the fixed scenarios and the echo chip stay when the parent has no records", () => {
    expect(src).toContain("{recordStarters.length === 0 && SCENARIOS.slice(0, staticShown).map(");
    expect(src).toContain("{recordStarters.length === 0 && echoScenario && (");
  });
});
