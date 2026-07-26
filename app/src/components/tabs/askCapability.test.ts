import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { translate } from "../../lib/i18n";
import { appendChatUser } from "../../lib/chatStream";
import type { ChatMessage } from "../../context/ArborContext";

/**
 * ask-capability (ASK-4, ASK-5, ASK-6) — house source-guard tests (the
 * askJourneyUx.test.ts pattern; the vitest env is node-only, so surface-level
 * acceptance is pinned structurally + via the pure reducers):
 *
 *  ASK-4  anticipation — follow-up chips render the answer's OWN
 *         contract.followUps (static trio = fallback only); Council with an
 *         empty composer re-asks the last user question and is disabled with
 *         an honest hint only when no prior turn exists.
 *  ASK-5  language honesty — the user bubble shows the localized label the
 *         parent actually tapped (displayText) while the canonical EN prompt
 *         goes to the model; the 402 bubble is t()-localized; zero English
 *         literals remain in the injected-message paths.
 *  ASK-6  felt memory — counts-only footer + review chip (rendering is pinned
 *         in CoachAnswerCards.test.ts; here: key hygiene + firewall wording).
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const coachRaw = read("components/tabs/CoachTab.tsx");
const coach = stripComments(coachRaw);
const ctx = stripComments(read("context/ArborContext.tsx"));
const cards = stripComments(read("components/coach/CoachAnswerCards.tsx"));
const contracts = stripComments(read("contracts/coach.ts"));

describe("ASK-4 — anticipated follow-ups", () => {
  it("the chips render contract.followUps with the static trio as FALLBACK only", () => {
    expect(coach).toContain("lastMessage?.contract?.followUps");
    // Fallback order: anticipated leads, FOLLOW_UPS only when absent.
    const chipsBlock = /const anticipated =[\s\S]*?FOLLOW_UPS\.map/.exec(coach)?.[0] ?? "";
    expect(chipsBlock).not.toBe("");
    expect(chipsBlock).toContain("anticipated.length > 0");
  });

  it("followUps are screened via renderCoachResponse (firewall condition — no unscreened rendered field)", () => {
    // The rendered text (the exact text screenModelOutput runs on) appends them.
    expect(contracts).toContain("Suggested Follow-ups");
    expect(contracts).toContain("response.followUps");
  });

  it("Council with an empty composer re-asks the last user question", () => {
    const councilSend = /const handleCouncilSend = async[\s\S]*?\n  \};/.exec(ctx)?.[0] ?? "";
    expect(councilSend).not.toBe("");
    expect(councilSend).toContain('find((m) => m.sender === "user")');
    expect(councilSend).toContain("chatInput.trim() || lastUserTurn?.text");
  });

  it("the Council button disables (with an honest hint) ONLY when no prior turn exists", () => {
    expect(coach).toContain("disabled={isChatLoading || (!chatInput.trim() && !lastUserText)}");
    expect(coach).toContain('t("coach.councilHint.empty")');
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "coach.councilHint.empty").trim()).not.toBe("");
    }
    expect(translate("he", "coach.councilHint.empty")).not.toMatch(/[a-z]/i);
  });
});

describe("ASK-5 — the HE journey shows what the parent tapped, zero injected English", () => {
  it("appendChatUser stores displayText only when it differs from the canonical prompt", () => {
    const tapped = appendChatUser([], "My child refuses to get dressed…", "Integrated Balanced", "סירוב בבוקר");
    expect(tapped[0]).toMatchObject({ text: "My child refuses to get dressed…", displayText: "סירוב בבוקר" });
    const typed = appendChatUser([], "Bedtime is hard.", "Integrated Balanced", "Bedtime is hard.");
    expect(typed[0].displayText).toBeUndefined();
  });

  it("retry keeps the original localized bubble (dedupe wins over the display-less resend)", () => {
    const afterFailure: ChatMessage[] = [
      { sender: "user", text: "Canonical EN prompt", displayText: "תווית בעברית" },
    ];
    const retried = appendChatUser(afterFailure, "Canonical EN prompt", "Integrated Balanced");
    expect(retried).toBe(afterFailure);
    expect(retried[0].displayText).toBe("תווית בעברית");
  });

  it("scenario + follow-up taps pass the tapped label as displayText; the bubble renders it", () => {
    expect(coach).toContain("displayText: t(s.labelKey)");
    expect(coach).toContain("displayText: q.label");
    expect(coach).toContain("msg.displayText || msg.text");
  });

  it("the 402 meter bubble is t()-localized — no English literal remains in ArborContext", () => {
    expect(ctx).toContain('t("coach.paywall.title")');
    expect(ctx).toContain('t("coach.paywall.body")');
    expect(ctx).not.toContain("You've used today's free coaching");
    expect(ctx).not.toContain("Upgrade to keep going");
    for (const key of ["coach.paywall.title", "coach.paywall.body"] as const) {
      expect(translate("en", key).trim()).not.toBe("");
      expect(translate("he", key)).not.toMatch(/[a-z]/i);
    }
  });

  it("the conversation title derives from what the parent SAW", () => {
    expect(ctx).toContain("firstUser.displayText || firstUser.text");
  });
});

describe("ASK-6 — memory visibility keys (counts only, firewall wording)", () => {
  const KEYS = ["coach.memory.grounded", "coach.memory.grounded.one", "coach.memory.manage", "coach.memory.reviewChip"] as const;

  it("every key exists in both languages; HE is Hebrew", () => {
    for (const key of KEYS) {
      expect(translate("en", key).trim(), `EN missing ${key}`).not.toBe("");
      const he = translate("he", key, { n: 2 });
      expect(he.trim(), `HE missing ${key}`).not.toBe("");
      expect(he, `HE not Hebrew for ${key}`).not.toMatch(/[a-z]/i);
    }
  });

  it("firewall: no percentage/confidence wording in the footer copy, either language", () => {
    for (const key of KEYS) {
      for (const lang of ["en", "he"] as const) {
        const s = translate(lang, key, { n: 3 });
        expect(s).not.toContain("%");
        expect(s.toLowerCase()).not.toContain("confidence");
        expect(s).not.toContain("ביטחון");
      }
    }
  });

  it("the review chip names THAT something is pending — never its content (source guard)", () => {
    // The chip block gates on .length only and never reads a proposal's fact.
    const chipBlock = /coach\.memory\.reviewChip[\s\S]{0,400}/.exec(cards)?.[0] ?? "";
    expect(cards).toContain("memoryProposals?.length");
    expect(cards).not.toMatch(/memoryProposals[^\n]*\.fact/);
    expect(chipBlock).not.toContain(".fact");
  });

  it("the count row deep-links to the memory route via the seedable tab seam", () => {
    expect(coach).toContain('onManageMemory={() => setActiveTab("memory")}');
  });
});
