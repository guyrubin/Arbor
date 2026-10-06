/**
 * B-SHELL-38 guard — the active child is unmistakable.
 *  · ONE identity line (picture · name · "22 months" / "5 years") and it IS
 *    the switcher: the phone strip mounts it (lg:hidden), the desktop sidebar
 *    mounts it (lg-only); the top-right chip and the "All children" glance
 *    card are gone, the strip no longer repeats the age;
 *  · the sidebar caption is "Showing Leni's app · 22 months" (HE "של" forms
 *    by gender), never "content for children 5 years old";
 *  · a child switch crossfades the line (200 ms, keyed on the child) and
 *    re-mounts the hub (the motion key carries the child id) — the one motion.
 * The founder's family: Leni (22 months, girl) and Dylan (5 years, boy).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import type { ChildProfile } from "../../types";

const ISO = new Date().toISOString().slice(0, 10);
const LENI = { id: "leni", name: "Leni", age: 1, ageMonths: 22, ageMonthsAsOf: ISO, gender: "girl", languages: ["Hebrew"], schoolContext: "", strengths: [], challenges: [] } as unknown as ChildProfile;
const DYLAN = { id: "dylan", name: "Dylan", age: 5, ageMonths: 62, ageMonthsAsOf: ISO, gender: "boy", languages: ["Hebrew"], schoolContext: "", strengths: [], challenges: [] } as unknown as ChildProfile;

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", active: null as unknown }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(state.lang as UiLang, k, v), uiLang: state.lang }),
}));
vi.mock("../../context/ProfileContext", () => ({
  useProfile: () => ({ profiles: [LENI, DYLAN], activeChild: state.active, setActiveChild: () => undefined }),
}));
vi.mock("../profile/AddChildModal", () => ({ default: () => null }));
vi.mock("../profile/ProfileEditDrawer", () => ({ default: () => null }));

import { ChildIdentity } from "./TopbarKidSwitcher";
import ProfileSwitcher from "../profile/ProfileSwitcher";

const tFor = (lang: UiLang) => (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/[‎‏⁦-⁩]/g, "").replace(/\s+/g, " ").trim();
const SRC = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("B-SHELL-38 · the identity line prints name over her own age", () => {
  const cases: Array<[ChildProfile, UiLang, string]> = [
    [LENI, "en", "22 months"], [LENI, "he", "22 חודשים"], [DYLAN, "en", "5 years"], [DYLAN, "he", "5 שנים"],
  ];
  for (const [child, lang, age] of cases) {
    it(`${child.name} · ${lang}`, () => {
      const html = renderToStaticMarkup(React.createElement(ChildIdentity, { child, t: tFor(lang) }));
      expect(html).toContain(`data-child-identity="${child.id}"`);
      expect(/data-identity-name[^>]*>([^<]*)</.exec(html)?.[1]).toBe(child.name);
      expect(/data-identity-age[^>]*>([^<]*)</.exec(html)?.[1]).toBe(age);
    });
  }
});

describe("B-SHELL-38 · the desktop sidebar: the child once, as the switcher, with whose app this is", () => {
  const cases: Array<[ChildProfile, UiLang, RegExp]> = [
    [LENI, "en", /Showing Leni's app · 22 months/],
    [LENI, "he", /מוצגת האפליקציה שלה, של Leni · 22 חודשים/],
    [DYLAN, "en", /Showing Dylan's app · 5 years/],
    [DYLAN, "he", /מוצגת האפליקציה שלו, של Dylan · 5 שנים/],
  ];
  for (const [child, lang, caption] of cases) {
    it(`${child.name} · ${lang}`, () => {
      state.lang = lang;
      state.active = child;
      const html = renderToStaticMarkup(React.createElement(ProfileSwitcher));
      const words = text(html);
      expect(words).toMatch(caption);
      expect(words).not.toMatch(/content for children|year-olds|\bAge\b/);
      // the name renders in exactly one identity line (+ once in the caption sentence)
      expect(html.match(/data-identity-name/g)?.length).toBe(1);
      expect(html).not.toMatch(/family\.glance|data-testid="family-glance"/);
      expect(html).toContain('aria-haspopup="listbox"'); // the identity IS the switcher
    });
  }
});

describe("B-SHELL-38 · one identity per screen (source pins)", () => {
  const shell = code(read("components/layout/Shell.tsx"));
  const topbar = code(read("components/layout/Topbar.tsx"));
  const sidebarCard = code(read("components/profile/ProfileSwitcher.tsx"));
  const sw = read("components/layout/TopbarKidSwitcher.tsx");

  it("phone: the strip mounts the identity switcher and does not repeat the age", () => {
    const strip = shell.slice(shell.indexOf("<ChildContextHeader"), shell.indexOf("actions={"));
    expect(strip).toContain('className="lg:hidden"');
    expect(strip).toContain('<TopbarKidSwitcher maxWidth="128px" />');
    expect(strip).not.toMatch(/ageLabel\(|formatChildAge\(/);
  });

  it("desktop: no top-right chip; the sidebar card mounts the switcher full width; no glance card", () => {
    expect(topbar).not.toContain("<TopbarKidSwitcher");
    expect(topbar).not.toContain("import TopbarKidSwitcher");
    expect(sidebarCard).toContain("<TopbarKidSwitcher maxWidth=\"100%\" fullWidth />");
    expect(sidebarCard).not.toContain("<FamilyGlanceCard");
    expect(sidebarCard).not.toContain("elev.growthTruth.agechip.switcher");
  });

  it("the one motion: a 200 ms crossfade keyed on the child, and the hub re-mounts per child", () => {
    const identity = sw.slice(sw.indexOf("export function ChildIdentity"), sw.indexOf("/**\n * AP-047"));
    expect(identity).toMatch(/key=\{child\.id\}/);
    expect(identity).toMatch(/duration: 0\.2/);
    expect(identity).not.toMatch(/\by:|scale|rotate/);
    expect(shell).toMatch(/key=\{`\$\{activeTab\}@\$\{childProfile\.id\}`\}/);
  });

  it("tokens only, nothing under 12 px in the identity line and the caption", () => {
    const identity = sw.slice(sw.indexOf("export function ChildIdentity"), sw.indexOf("/**\n * AP-047"));
    expect(identity).not.toMatch(/#[0-9a-fA-F]{3,8}\b|fontSize: "(?:[0-9]|1[01])px"/);
    expect(sidebarCard).not.toMatch(/text-\[(?:[0-9]|1[01])px\]|uppercase|gradient/);
  });
});
