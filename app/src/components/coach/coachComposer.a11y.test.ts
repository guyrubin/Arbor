/**
 * OBJ-ASK-01 / OBJ-ASK-04 / AI-04 — the Ask surface's composer and its chrome.
 *
 * OBJ-ASK-01: the one textarea a parent types their question into had NO
 * accessible name. A placeholder is not a name — it vanishes on the first
 * keystroke and axe reports "form elements must have labels" — so a screen
 * reader announced an unlabelled edit field as the surface's primary move.
 * Around it, the three capture chips rendered at 36 px, "New" at 29 and
 * delete-conversation at 12×23, all under the 44 px floor.
 *
 * OBJ-ASK-04: the five fast-start chips led with emoji glyphs — a register no
 * other parent surface uses, and one that renders differently on every
 * platform. They now use the same Material Symbols set as the rest of the app.
 *
 * AI-04 (verification, not a change): `ConversationProposalTray` IS mounted,
 * unconditionally, at CoachTab's root — the item's stated fix was already in
 * place. What is missing is upstream and is recorded in FOLLOW-UPS: the tray's
 * only feed, `deriveConversationProposals`, is called from the two VOICE paths
 * only, so a typed turn can never fill it. Wiring it would add a model call per
 * typed turn and duplicate the server-side memory proposal already surfaced in
 * Profile › Child Memory — a decision, not a silent edit. This test pins what
 * is true today so the next reader is not told a lie either way.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { coachContractText, en as ccEn, he as ccHe } from "../../lib/i18nElevation/coachcontract";

const SRC = path.resolve(__dirname, "..", "..");
const coach = readFileSync(path.join(SRC, "components/tabs/CoachTab.tsx"), "utf8");
const iconManifest = new Set(
  readFileSync(path.join(SRC, "..", "public/fonts/material-symbols-rounded-subset.icons.txt"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#")),
);

describe("OBJ-ASK-01 · the composer has an accessible name", () => {
  it("the textarea carries aria-label, in both locales", () => {
    const start = coach.indexOf("<textarea");
    const textarea = coach.slice(start, coach.indexOf("/>", start) + 2);
    expect(textarea).toContain("aria-label=");
    expect(textarea).toContain("elev.coachcontract.composer.aria");
    expect(ccEn["elev.coachcontract.composer.aria"]).toBeTruthy();
    expect(ccHe["elev.coachcontract.composer.aria"]).toMatch(/[֐-׿]/);
    expect(coachContractText("he", "elev.coachcontract.composer.aria")).toBe(
      ccHe["elev.coachcontract.composer.aria"],
    );
  });

  it("NEGATIVE CONTROL: the pre-fix textarea would fail this check", () => {
    const preFix = `<textarea
      value={chatInput}
      placeholder={t("coach.placeholder", { name: childFirst })}
    />`;
    expect(preFix.includes("aria-label=")).toBe(false);
  });

  it("the chips around it clear the 44 px floor", () => {
    // The three capture chips (photo / document / voice).
    expect(coach).not.toContain("min-h-[36px] px-3 rounded-full");
    expect((coach.match(/min-h-11 px-3 rounded-full text-\[11px\] font-bold/g) ?? []).length).toBe(3);
    // "New", the thread chip and the 12x23 delete.
    expect(coach).toContain('className="flex-shrink-0 flex min-h-11 items-center gap-1.5 text-[11px] font-extrabold');
    expect(coach).toContain('aria-label={t("aria.deleteConversation")} className="touch-target transition"');
  });
});

describe("OBJ-ASK-04 · the fast-start chips are on the parent register", () => {
  it("no emoji reaches the chip row, and every icon ships in the subset", () => {
    const scenarios = coach.slice(coach.indexOf("const SCENARIOS"), coach.indexOf("];", coach.indexOf("const SCENARIOS")));
    // Emoji live above the BMP or in the symbol blocks — none may remain.
    expect(scenarios).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(scenarios).not.toContain("emoji");
    const icons = [...scenarios.matchAll(/icon: "([a-z0-9_]+)"/g)].map((m) => m[1]);
    expect(icons).toHaveLength(5);
    for (const name of icons) {
      // An icon outside the shipped subset renders as its English word.
      expect(iconManifest.has(name), `${name} is not in the shipped font subset`).toBe(true);
    }
    expect(coach).toContain("<Icon name={s.icon}");
  });

  it("NEGATIVE CONTROL: the pre-fix scenario table is caught by the same scan", () => {
    const preFix = '{ emoji: "\u{1F305}", labelKey: "coach.scenario.morning", prompt: "..." }';
    expect(preFix).toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(preFix).toContain("emoji");
  });

  it("the labels are sentence case, not diagnosis-style Title Case", () => {
    const dict = readFileSync(path.join(SRC, "lib/i18n.ts"), "utf8");
    const labels = [...dict.matchAll(/"coach\.scenario\.[a-z]+": "([^"]+)"/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThanOrEqual(5);
    for (const label of labels) {
      // Every word after the first is lower case (proper nouns like "iPad"
      // start lower already; nothing here is a proper noun mid-phrase).
      const rest = label.split(" ").slice(1);
      for (const word of rest) {
        expect(/^[A-Z]/.test(word), `"${label}" reads as Title Case`).toBe(false);
      }
    }
  });
});

describe("AI-04 · what is actually wired for a typed turn", () => {
  it("the proposal tray is mounted unconditionally, not behind voice", () => {
    expect(coach).toContain("<ConversationProposalTray");
    // It is not inside a `voicePhase !== "off" &&` branch.
    const mount = coach.indexOf("<ConversationProposalTray");
    const voiceGate = coach.indexOf('{voicePhase !== "off" && (');
    expect(voiceGate).toBeGreaterThan(mount);
  });

  it("its only feed is still voice-only — pinned so the gap stays visible", () => {
    const calls = coach.match(/void deriveConversationProposals\(/g) ?? [];
    expect(calls).toHaveLength(2); // onTranscript + the live onUserTurn
    // If a typed-send path ever calls it, this count changes and the reader is
    // sent back to the FOLLOW-UP that explains the cost of doing so.
    const send = coach.slice(coach.indexOf("const handleChatSend"), coach.indexOf("const handleChatSend") + 2000);
    expect(send).not.toContain("deriveConversationProposals");
  });
});
