import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/* B-PROG-09 (read link, client) — the professional's read-only link to the
   home program. The page renders ONLY the home program's section and only
   when the SERVER's resolved scopes carry `home-program-adherence`; today's
   server drops the scope (not in SHARE_SCOPE_IDS: fail closed), so the page
   is unreachable and the grant card stays OFF until the server mirror lands
   (REJECTIONS P6-PRACTICE 8 Oct). Consent sentence EN + HE; revocable in place. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: true, upsert: vi.fn(), remove: vi.fn() }) }));

import { HOME_PROGRAM_LINK_FLAG_KEY, HOME_PROGRAM_SECTION_ID, HomeProgramAdherenceView, HomeProgramShareBody, homeProgramLinkOn, sharedViewMode } from "./HomeProgramShare";
import { HOME_PROGRAM_SCOPE_ID, HOME_PROGRAM_SCOPE_SERVER_READY, SHARE_SCOPE_IDS, normalizeScopes } from "../../lib/shareScopes";
import { startHomeProgram } from "../../content/programs/homeProgram";
import { translate } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const flagOn = { getItem: (k: string) => (k === HOME_PROGRAM_LINK_FLAG_KEY ? "1" : null) };
const started = startHomeProgram([], { profession: "slp", exercises: [{ text: "Name the toy, then wait" }] }, new Date(2026, 9, 8, 9));
if (!("enrolment" in started)) throw new Error("no enrolment");
const enrolment = started.enrolment;

const sections = [
  { id: "moments", title: "Moments", items: [{ id: "m1", text: "A private moment line" }] },
  { id: "patterns", title: "Patterns", items: [{ id: "p1", text: "A pattern line" }] },
  { id: HOME_PROGRAM_SECTION_ID, title: "Home program", items: [{ id: "h1", text: "Home program · Speech therapist: week 1 of 4 · practice days 2/7 this week" }, { id: "h2", text: "Name the toy, then wait: done on 2 days" }] },
];

describe("B-PROG-09 read link · the gate (never a dead or an open door)", () => {
  it("the scope is pending the server: not a recognised scope today, so the server drops it (fail closed)", () => {
    expect(HOME_PROGRAM_SCOPE_ID).toBe("home-program-adherence");
    expect((SHARE_SCOPE_IDS as readonly string[]).includes(HOME_PROGRAM_SCOPE_ID)).toBe(false);
    expect(normalizeScopes([HOME_PROGRAM_SCOPE_ID])).toEqual([]);
    expect(HOME_PROGRAM_SCOPE_SERVER_READY).toBe(false);
  });

  it("the grant card is OFF until the server is ready, even with the pilot flag set", () => {
    expect(homeProgramLinkOn({ storage: flagOn })).toBe(false);
    expect(homeProgramLinkOn({ serverReady: true, storage: null })).toBe(false);
    expect(homeProgramLinkOn({ serverReady: true, storage: flagOn })).toBe(true);
  });
});

describe("B-PROG-09 read link · the read-only page renders the home program and nothing else", () => {
  it("mode follows the server-resolved scopes", () => {
    expect(sharedViewMode({ scopes: [HOME_PROGRAM_SCOPE_ID] })).toBe("home-program");
    expect(sharedViewMode({ scopes: ["story_timeline"] })).toBe("packet");
    expect(sharedViewMode({ scopes: [] })).toBe("packet");
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: only the home program's lines render, read-only, no other section, no number verdict`, () => {
      state.lang = lang;
      const html = renderToStaticMarkup(<HomeProgramAdherenceView view={{ scopes: [HOME_PROGRAM_SCOPE_ID], sections }} />);
      const plain = text(html);
      expect((html.match(/data-testid="home-program-view-line"/g) || []).length).toBe(2);
      expect(plain).toContain(translate(lang, "elev.homeProgram.view.readOnly"));
      expect(plain).not.toContain("A private moment line");
      expect(plain).not.toContain("A pattern line");
      expect(html).not.toMatch(/<(input|textarea|select|form)\b/);
      expect(plain).not.toMatch(/%/);
      expect(loopFirewallHits(plain)).toEqual([]);
    });
  }

  it("without the scope the page renders nothing at all", () => {
    state.lang = "en";
    expect(renderToStaticMarkup(<HomeProgramAdherenceView view={{ scopes: ["report_slp"], sections }} />)).toBe("");
  });
});

describe("B-PROG-09 read link · the grant card (consent, revocable in place)", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the consent sentence, the email field, and Stop sharing on a live grant`, () => {
      state.lang = lang;
      const grants = [
        { id: "g1", recipientEmail: "slp@example.com", scopes: [HOME_PROGRAM_SCOPE_ID] },
        { id: "g2", recipientEmail: "nan@example.com", scopes: ["story_timeline"] },
      ];
      const html = renderToStaticMarkup(<HomeProgramShareBody programs={[enrolment]} grants={grants} busy={null} onGrant={() => undefined} onRevoke={() => undefined} />);
      const plain = text(html);
      expect(plain).toContain(translate(lang, "elev.homeProgram.share.consent"));
      expect(html).toContain('data-testid="home-program-share-email"');
      expect((html.match(/data-testid="home-program-share-grant"/g) || []).length).toBe(1);
      expect(plain).toContain(translate(lang, "elev.homeProgram.share.stop"));
      expect(loopFirewallHits(plain)).toEqual([]);
    });
  }

  it("no active home program → no card", () => {
    expect(renderToStaticMarkup(<HomeProgramShareBody programs={[]} grants={[]} busy={null} onGrant={() => undefined} onRevoke={() => undefined} />)).toBe("");
  });

  it("TrustedSharing mounts the card only behind the gate, revokes through the one revoke path, and the viewer splits by mode", () => {
    const src = readFileSync(path.resolve(__dirname, "../sections/TrustedSharing.tsx"), "utf8");
    expect(src).toMatch(/\{homeProgramLinkOn\(\) && \(\s*<HomeProgramShareCard/);
    expect(src).toMatch(/onRevoke=\{\(g\) => void revoke\(g as ShareGrant\)\}/);
    expect(src).toMatch(/scopes: \[HOME_PROGRAM_SCOPE_ID\], duration: "until_revoked"/);
    expect(src).toMatch(/sharedViewMode\(view\) === "home-program" && <HomeProgramAdherenceView view=\{view\} \/>/);
    expect(src).toMatch(/sharedViewMode\(view\) === "packet" && \(/);
  });
});
