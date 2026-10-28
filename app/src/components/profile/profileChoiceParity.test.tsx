/**
 * B-SHELL-44 — Add child and Edit child use the same language and focus
 * choices, keep custom and legacy values through save and reload, and the
 * drawer keeps the existing Your data door, in EN and HE.
 *
 * Before: Add stored six language tokens and seven focus names from chips,
 * while Edit showed "Languages (comma separated)" and "Challenges (one per
 * line)" as English-only free text, so the same child read through two
 * contracts (and a Hebrew parent met English field names).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { en, he, translate, type UiLang } from "../../lib/i18n";
import {
  CHILD_FOCUS_AREAS, CHILD_LANGUAGES, challengesToSave, customLanguages, focusAliases, hasChoice, isFocusChoice,
  languageAliases, languageOf, otherChallengesText, toggleChoice, toggleLanguage,
} from "../../lib/childProfileChoices";
import { buildNewChildInput } from "../../lib/childProfileInput";
import { stampChangedFacts } from "../../lib/factsAsOf";

let lang: UiLang = "en";
let child: Record<string, unknown> = {};
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v), uiLang: lang }),
}));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ activeChild: child, updateChild: async () => true }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: () => undefined }) }));
vi.mock("../../hooks/useDialog", () => ({ useDialog: () => ({ ref: { current: null }, requestClose: () => undefined, onBackdropClick: () => undefined }) }));
vi.mock("react-dom", async (orig) => ({ ...(await orig<typeof import("react-dom")>()), createPortal: (node: React.ReactNode) => node }));
vi.mock("motion/react", () => {
  const strip = (tag: string) => ({ children, initial: _i, animate: _a, exit: _e, transition: _t, ...rest }: Record<string, any>) => React.createElement(tag, rest, children);
  return { AnimatePresence: ({ children }: { children: React.ReactNode }) => children, motion: { div: strip("div") } };
});
vi.mock("./AvatarCreator", () => ({ default: () => null }));
vi.mock("./HeroSheetPanel", () => ({ default: () => null }));
vi.mock("./RewardsCard", () => ({ default: () => null }));

import ProfileEditDrawer from "./ProfileEditDrawer";
import { ChildFocusChoices, ChildLanguageChoices, DOMAINS } from "./AddChildFields";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(path.join(here, file), "utf8");
const unescape = (h: string) => h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const baseChild = {
  id: "child-synthetic", name: "Noa", age: 4, ageMonths: 50, gender: "girl", schoolContext: "Gan",
  strengths: ["Kind"], interests: [],
};
const renderDrawer = (l: UiLang, overrides: Record<string, unknown>) => {
  lang = l;
  child = { ...baseChild, ...overrides };
  // The drawer portals to document.body; createPortal is mocked to render in place.
  vi.stubGlobal("document", { body: {} });
  try {
    return unescape(renderToStaticMarkup(React.createElement(ProfileEditDrawer, { open: true, onClose: () => undefined })));
  } finally {
    vi.unstubAllGlobals();
  }
};
/** The pressed/unpressed chips of one rendered group, by visible label. */
const chips = (html: string, testId: string) => {
  const group = new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</div>`).exec(html)?.[1] ?? "";
  return [...group.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({
    pressed: m[1] === "true",
    label: m[2].replace(/<[^>]+>/g, "").replace(/^(favorite|chat_bubble|group|bedtime|menu_book|repeat|restaurant)/, "").trim(),
  }));
};
const pressed = (html: string, testId: string) => chips(html, testId).filter((c) => c.pressed).map((c) => c.label);

describe("B-SHELL-44 · one vocabulary: the same choices and stored forms in Add and Edit", () => {
  it("Add's StepChild and the Edit drawer render the SAME language and focus components", () => {
    const fields = read("AddChildFields.tsx");
    const drawer = read("ProfileEditDrawer.tsx");
    expect(fields).toMatch(/<ChildLanguageChoices value=\{languages\} onChange=\{setLanguages\} \/>/);
    expect(drawer).toMatch(/<ChildLanguageChoices value=\{languages\} onChange=\{setLanguages\} \/>/);
    expect(drawer).toMatch(/<ChildFocusChoices value=\{challengeItems\} onChange=\{setChallengeItems\} \/>/);
    expect(DOMAINS.map((d) => d.nameKey)).toEqual(CHILD_FOCUS_AREAS.map((a) => a.nameKey));
    // The comma/newline free-text contract is gone from Edit.
    expect(drawer).not.toMatch(/\(comma separated\)|languages\.split\(","\)|setChallenges\(/);
  });

  it("NEGATIVE CONTROL: the pre-change drawer shape is what the guard rejects", () => {
    const preFix = `<label>Languages <span>(comma separated)</span></label>\nlanguages: languages.split(",").map((s) => s.trim())`;
    expect(preFix).toMatch(/\(comma separated\)|languages\.split\(","\)/);
  });

  for (const l of ["en", "he"] as const) {
    it(`${l}: the chip labels are the localized Add child labels`, () => {
      lang = l;
      const languagesHtml = unescape(renderToStaticMarkup(React.createElement(ChildLanguageChoices, { value: [], onChange: () => undefined })));
      const focusHtml = unescape(renderToStaticMarkup(React.createElement(ChildFocusChoices, { value: [], onChange: () => undefined })));
      for (const language of CHILD_LANGUAGES) expect(languagesHtml).toContain(translate(l, `ob.lang.${language.toLowerCase()}`));
      for (const area of CHILD_FOCUS_AREAS) expect(focusHtml).toContain(translate(l, area.nameKey));
      expect((languagesHtml + focusHtml).match(/<button\b[^>]*>/g)?.every((b) => /min-h-11/.test(b) && /aria-pressed/.test(b))).toBe(true);
    });
  }
});

describe("B-SHELL-44 · Add → save → Edit → change → save → reload keeps every value", () => {
  it("a child added in HE reopens in an EN session with the same choices, and an untouched save rewrites nothing", () => {
    // Add (Hebrew session): StepChild language tokens, StepDomains names in the UI language.
    const added = buildNewChildInput({
      name: "Noa", ageMonths: 50, gender: "unspecified", languages: ["Hebrew", "English"],
      strengthsText: "", challengesText: [he["ob.step.domains.sleep"], he["ob.step.domains.eating"]].join("\n"),
    });
    const stored = { ...added, challenges: [...added.challenges, "Needs a quiet corner"] };
    // Edit (English session) reads the same choices back.
    const html = renderDrawer("en", stored);
    expect(pressed(html, "child-language-choices")).toEqual([en["ob.lang.hebrew"], en["ob.lang.english"]]);
    expect(pressed(html, "child-focus-choices")).toEqual([en["ob.step.domains.sleep"], en["ob.step.domains.eating"]]);
    expect(html).toMatch(/data-testid="profile-other-challenges"[^>]*>Needs a quiet corner<\/textarea>/);
    // Save with no change → the exact stored arrays; facts-as-of not restamped.
    const otherAtOpen = otherChallengesText(stored.challenges);
    const unchanged = { languages: stored.languages, challenges: challengesToSave(stored.challenges, otherAtOpen, otherAtOpen) };
    expect(unchanged.challenges).toEqual(stored.challenges);
    expect(stampChangedFacts({ ...stored, factsAsOf: { challenges: "2026-01-01" } }, unchanged, "2026-10-28")).toEqual({ challenges: "2026-01-01" });
    // Change: drop Sleep (saved in HE) from the EN session, add Big Feelings, add a parent line.
    let items = toggleChoice(stored.challenges, focusAliases("ob.step.domains.sleep"), en["ob.step.domains.sleep"]);
    items = toggleChoice(items, focusAliases("ob.step.domains.feelings"), en["ob.step.domains.feelings"]);
    const saved = challengesToSave(items, `${otherAtOpen}\nLikes a warning before changes`, otherAtOpen);
    expect(saved).toEqual([he["ob.step.domains.eating"], en["ob.step.domains.feelings"], "Needs a quiet corner", "Likes a warning before changes"]);
    // Reload (Hebrew session) shows the saved choices; nothing else was lost.
    const reloaded = renderDrawer("he", { ...stored, challenges: saved });
    expect(pressed(reloaded, "child-focus-choices")).toEqual([he["ob.step.domains.feelings"], he["ob.step.domains.eating"]]);
    expect(reloaded).toMatch(/data-testid="profile-other-challenges"[^>]*>Needs a quiet corner\nLikes a warning before changes<\/textarea>/);
  });

  it("custom and legacy languages survive: ISO codes read as their choice, a free-text language stays its own chip", () => {
    const legacy = ["he", "Deutsch", "english"];
    expect(customLanguages(legacy)).toEqual(["Deutsch"]);
    expect(hasChoice(legacy, languageAliases("Hebrew"))).toBe(true);
    expect(hasChoice(legacy, languageAliases("English"))).toBe(true);
    const html = renderDrawer("he", { languages: legacy, challenges: [] });
    expect(pressed(html, "child-language-choices")).toEqual([he["ob.lang.hebrew"], he["ob.lang.english"], "Deutsch"]);
    // Toggling Arabic on and off returns the exact original list.
    const withArabic = toggleLanguage(legacy, "Arabic");
    expect(withArabic).toEqual([...legacy, "Arabic"]);
    expect(toggleLanguage(withArabic, "Arabic")).toEqual(legacy);
    // Removing Hebrew removes only its aliases.
    expect(toggleLanguage(legacy, "Hebrew")).toEqual(["Deutsch", "english"]);
  });

  it("a qualified older entry ('Hebrew (Native)') presses its own chip with its own words, never a duplicate", () => {
    const legacy = ["Hebrew (Native)", "English - at school", "Englishman"];
    expect(languageOf("Hebrew (Native)")).toBe("Hebrew");
    expect(languageOf("English - at school")).toBe("English");
    expect(languageOf("Englishman")).toBeNull();
    expect(customLanguages(legacy)).toEqual(["Englishman"]);
    const html = renderDrawer("he", { languages: legacy, challenges: [] });
    expect(pressed(html, "child-language-choices")).toEqual(["Hebrew (Native)", "English - at school", "Englishman"]);
    expect(chips(html, "child-language-choices").map((c) => c.label)).not.toContain(he["ob.lang.hebrew"]);
    // Tapping Hebrew removes the qualified entry; tapping again adds the plain token.
    expect(toggleLanguage(legacy, "Hebrew")).toEqual(["English - at school", "Englishman"]);
    expect(toggleLanguage(toggleLanguage(legacy, "Hebrew"), "Hebrew")).toEqual(["English - at school", "Englishman", "Hebrew"]);
  });

  it("empty values: no chip is pressed and the parent's lines box is empty", () => {
    const html = renderDrawer("en", { languages: [], challenges: [] });
    expect(pressed(html, "child-language-choices")).toEqual([]);
    expect(pressed(html, "child-focus-choices")).toEqual([]);
    expect(challengesToSave([], "", "")).toEqual([]);
    expect(isFocusChoice("Needs a quiet corner")).toBe(false);
  });
});

describe("B-SHELL-44 · Edit child reads in the parent's language and keeps the Your data door", () => {
  for (const l of ["en", "he"] as const) {
    it(`${l}: field labels, Save and the Your data link are localized; the link opens Settings › Your data`, () => {
      const html = renderDrawer(l, { languages: ["Hebrew"], challenges: [] });
      for (const key of ["aria.editChildProfile", "ob.step.ready.labelName", "cp.f.school", "ob.langsAtHome", "ob.step.ready.labelDomains", "ac.strengths", "ac.challenges", "companion.capture.saveChanges", "elev.yourData.row.title"]) {
        expect(html, key).toContain(translate(l, key));
      }
      expect(html).toContain('data-testid="profile-your-data-link"');
      expect(html).toContain(translate(l, "elev.yourData.link", { name: "Noa" }));
      if (l === "he") expect(html).not.toMatch(/>(Edit profile|Name|School context|Languages|Challenges|Strengths|Save changes)</);
    });
  }
  it("the link still asks Settings for its data focus (the one export/delete home)", () => {
    expect(read("ProfileEditDrawer.tsx")).toContain('requestOpenSettings({ focus: "data" })');
  });
});
