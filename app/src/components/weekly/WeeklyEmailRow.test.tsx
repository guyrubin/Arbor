import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* v3 F-NOW-3 (review round 2, finding 1) — the weekly-report email opt-in
   (W2 2.2 / N1-07) left #/weekly when the Weekly report became the v3 mock's
   dashboard, and lives in #/smart-reminders' Delivery section as
   WeeklyEmailRow. Its contract is the shipped row's, unchanged:

   - the store is recapEmail.ts (one localStorage key, a per-account map, a
     best-effort server mirror); the local key is the render source;
   - the channel is fail-closed: until GET /api/digest/email-status says
     enabled, the row shows only for a parent who already opted in, with the
     honest "not yet, your choice is kept" line (B-TODAY-22, Guy G4);
   - a role="switch" with a 44 px hit area, EN and HE, logical CSS only, no
     rgba or hex.

   renderToStaticMarkup runs no effects, so the status probe never resolves
   here: every render below is the channel-off state, which is production
   today (the email provider is off). Invented account ids and names only. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  user: { uid: "acct-invented" } as { uid: string } | null,
}));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});
vi.mock("../../lib/analytics", () => ({ track: () => undefined }));
vi.mock("../../lib/kpiEvents", () => ({ trackDigestEmailOptIn: () => undefined }));
vi.mock("../../lib/api", () => ({ authHeaders: async () => ({}) }));

import WeeklyEmailRow from "./WeeklyEmailRow";
import { EMAIL_OPTIN_KEY, readEmailOptIn, writeEmailOptIn } from "./recapEmail";
import { translate } from "../../lib/i18n";

function mapStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  };
}
let storage = mapStorage();
const noMirror = () => undefined;

beforeEach(() => {
  storage = mapStorage();
  state.user = { uid: "acct-invented" };
  vi.stubGlobal("window", { localStorage: storage });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const render = (lang: "en" | "he", childFirst = "Noa") => {
  state.lang = lang;
  return renderToStaticMarkup(<WeeklyEmailRow childFirst={childFirst} />);
};
const switchTag = (html: string) => /<button[^>]*data-testid="sr-weekly-email-switch"[^>]*>/.exec(html)?.[0] ?? "";
const text = (html: string) => html
  .replace(/<span class="msr[^"]*"[^>]*>[a-z0-9_]+<\/span>/g, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, " ").replace(/\s+/g, " ").trim();

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(path.join(here, "WeeklyEmailRow.tsx"), "utf8");
const SRC = RAW.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("WeeklyEmailRow — fail-closed: the channel is off and the parent never opted in", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: renders nothing (no switch, no promise of a mail)`, () => {
      expect(render(lang)).toBe("");
    });
  }

  it("another account's opt-in on this device does not show the row for this account", () => {
    writeEmailOptIn("acct-other-invented", true, storage, noMirror);
    expect(readEmailOptIn("acct-other-invented", storage)).toBe(true);
    expect(render("en")).toBe("");
  });
});

describe("WeeklyEmailRow — the parent opted in while the channel is off", () => {
  beforeEach(() => {
    writeEmailOptIn("acct-invented", true, storage, noMirror);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: one role="switch", checked, 44 px, labelled; the honest "not yet" line`, () => {
      const html = render(lang);
      expect(html).toContain('data-testid="sr-weekly-email"');
      expect(html.match(/role="switch"/g)).toHaveLength(1);
      const sw = switchTag(html);
      expect(sw).toContain('type="button"');
      expect(sw).toContain('aria-checked="true"');
      expect(sw).toContain(`aria-label="${translate(lang, "elev.recap.email.aria")}"`);
      expect(sw).toContain("min-inline-size:44px");
      expect(sw).toContain("min-block-size:44px");
      expect(html).toContain(translate(lang, "elev.wk.email.title"));
      expect(html).toContain(translate(lang, "elev.recap.email.desc", { name: "Noa" }).replace(/'/g, "&#x27;"));
      expect(html).toMatch(/<p data-testid="sr-weekly-email-soon"[^>]*role="status"[^>]*>/);
      expect(html).toContain(translate(lang, "elev.recap.email.soon").replace(/'/g, "&#x27;"));
      expect(html).not.toMatch(/data-primary-move|data-module=/);
    });
  }

  it("en: the visible words are English; he: no Latin word but the child's name", () => {
    expect(text(render("en"))).toMatch(/Weekly report by email/);
    const he = text(render("he", "Noa")).replace(/Noa/g, "");
    expect(he).not.toMatch(/[A-Za-z]/);
    expect(he).toMatch(/[֐-׿]/);
  });

  it("the row reads the signed-in account; with no user it reads the local account", () => {
    state.user = null;
    expect(render("en")).toBe("");
    writeEmailOptIn("local", true, storage, noMirror);
    expect(switchTag(render("en"))).toContain('aria-checked="true"');
  });

  it("the store is the shipped one: one key, a per-account map; opting out removes the entry", () => {
    expect(JSON.parse(storage.map.get(EMAIL_OPTIN_KEY) ?? "{}")).toEqual({ "acct-invented": true });
    writeEmailOptIn("acct-invented", false, storage, noMirror);
    expect(JSON.parse(storage.map.get(EMAIL_OPTIN_KEY) ?? "{}")).toEqual({});
    expect(render("en")).toBe("");
  });
});

describe("WeeklyEmailRow — source contract", () => {
  it("the store, the probe and the event are recapEmail's and analytics', nothing new", () => {
    expect(SRC).toContain('import { fetchDigestEmailStatus, readEmailOptIn, writeEmailOptIn, type DigestEmailStatus } from "./recapEmail";');
    expect(SRC).toContain("useState(() => readEmailOptIn(accountId))");
    expect(SRC).toContain("void fetchDigestEmailStatus().then(");
    expect(SRC).toContain('const accountId = user?.uid ?? "local";');
    expect(SRC).not.toMatch(/localStorage|fetch\(/);
  });

  it("fail-closed gate: the row renders only when the channel exists, the parent opted in, or it was shown this visit", () => {
    expect(SRC).toContain("useState<DigestEmailStatus>({ enabled: false, provider: null })");
    expect(SRC).toContain("if (!status.enabled && !optIn && !held) return null;");
    expect(SRC).toContain("{optIn && !status.enabled && (");
  });

  it("the switch state changes only after the local write returned, then the event", () => {
    const toggle = SRC.slice(SRC.indexOf("const toggle = () => {"), SRC.indexOf("};", SRC.indexOf("const toggle = () => {")));
    const write = toggle.indexOf("writeEmailOptIn(accountId, next);");
    const set = toggle.indexOf("setOptIn(next);");
    const event = toggle.indexOf('track("recap_email_optin", { on: next, channelEnabled: status.enabled });');
    expect(write).toBeGreaterThan(0);
    expect(set).toBeGreaterThan(write);
    expect(event).toBeGreaterThan(set);
  });

  it("logical CSS only, tokens only: no physical side, no translateX, no rgba, no hex", () => {
    expect(SRC).toContain("insetInlineStart: optIn ? 21 : 3");
    expect(SRC).not.toMatch(/\b(left|right)\s*:|marginLeft|marginRight|paddingLeft|paddingRight|\b[mp][lr]-\d|translateX/);
    expect(RAW).not.toMatch(/rgba?\(|#[0-9a-fA-F]{3,8}\b/);
  });

  it("one parent-register icon, from the Material Symbols subset", () => {
    const names = [...SRC.matchAll(/<Icon name="([a-z0-9_]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(["mail"]);
    const subset = readFileSync(path.join(here, "../../../public/fonts/material-symbols-rounded-subset.icons.txt"), "utf8")
      .split(/\r?\n/).map((l) => l.trim());
    for (const name of names) expect(subset).toContain(name);
  });
});
