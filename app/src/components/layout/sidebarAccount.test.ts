/**
 * v3 F-SHELL-2 (critic ruling 12) — the Sidebar account row is ONE button:
 * the parent's avatar, name and plan, and a settings glyph. One tap opens
 * Settings through the settings bus (same Kid Mode gate as the More sheet).
 * No popover, no email in chrome, no Sign out (it lives in SettingsModal).
 *
 * The plan line prints NOTHING until the server has answered: while the
 * entitlement is loading or is the client fallback, a "Free plan" line would
 * be a guess presented as a fact (MOB-08).
 *
 * The parent is an invented example ("Sam Example"); the repo is public.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import type { EntitlementInfo } from "../../lib/api";

type Ent = { plan: "free" | "plus" | "family"; enforced: boolean };
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  user: null as null | { displayName: string | null; email: string | null; photoURL: string | null },
  ent: { plan: "free", enforced: true } as { plan: "free" | "plus" | "family"; enforced: boolean },
  loading: false,
  isFallback: false,
  setActiveTab: vi.fn(),
  openSettings: vi.fn(),
  converse: vi.fn(),
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ activeTab: "overview", setActiveTab: state.setActiveTab }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: state.user, signOut: vi.fn(), firebaseEnabled: true }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate: tr } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => tr(state.lang, key, vars) }) };
});
vi.mock("../profile/ProfileSwitcher", () => ({ default: () => null }));
vi.mock("./settingsBus", () => ({ requestOpenSettings: state.openSettings }));
vi.mock("../../lib/companionConversation", () => ({ requestCompanionConversation: state.converse }));
vi.mock("../../hooks/useEntitlement", () => ({
  useEntitlement: () => ({ entitlement: state.ent, loading: state.loading, isFallback: state.isFallback }),
}));
const captured = vi.hoisted(() => ({ buttons: [] as Record<string, unknown>[] }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") captured.buttons.push(props as Record<string, unknown>);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import Sidebar, { sidebarPlanKey } from "./Sidebar";

const SAM = { displayName: "Sam Example", email: "sam@example.test", photoURL: null };

beforeEach(() => {
  vi.clearAllMocks();
  captured.buttons = [];
  state.lang = "en";
  state.user = SAM;
  state.ent = { plan: "family", enforced: true };
  state.loading = false;
  state.isFallback = false;
});

/** The account button's markup and its visible text. */
function account(): { html: string; open: string; text: string; plan: string | null } {
  const page = renderToStaticMarkup(React.createElement(Sidebar));
  const m = /<button\b([^>]*data-testid="sidebar-account"[^>]*)>([\s\S]*?)<\/button>/.exec(page);
  expect(m, "account button not rendered").toBeTruthy();
  const plan = /data-testid="sidebar-plan"[^>]*>([^<]*)</.exec(m![2])?.[1] ?? null;
  return { html: page, open: m![1], text: m![2].replace(/<[^>]+>/g, ""), plan };
}
const ent = (plan: Ent["plan"], enforced = true) => ({ plan, enforced }) as unknown as EntitlementInfo;

describe("v3 F-SHELL-2 · the account row is one button that opens Settings", () => {
  it("one tap opens Settings through the bus and changes no route", () => {
    account();
    const btn = captured.buttons.find((b) => b["data-testid"] === "sidebar-account")!;
    (btn.onClick as () => void)();
    expect(state.openSettings).toHaveBeenCalledOnce();
    expect(state.setActiveTab).not.toHaveBeenCalled();
    expect(state.converse).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("shows the name, the plan and the settings glyph; no email, no Sign out, no menu (%s)", (lang) => {
    state.lang = lang;
    const { html, open, text, plan } = account();
    expect(text).toContain("Sam Example");
    expect(plan).toBe(translate(lang, "elev.sidebar.plan.family"));
    expect(text).toContain("settings"); // the Material Symbols glyph
    expect(text).toContain(translate(lang, "nav.popover.settings")); // its sr-only name
    expect(html).not.toContain("sam@example.test");
    expect(html).not.toContain(translate(lang, "nav.signout"));
    expect(html).not.toContain('role="menu"');
    expect(open).toMatch(/class="[^"]*\bmin-h-11\b/);
    expect(open).not.toContain("aria-haspopup");
  });

  it("with no display name the row says Parent, in both languages", () => {
    for (const lang of ["en", "he"] as const) {
      state.lang = lang;
      state.user = null;
      expect(account().text).toContain(translate(lang, "nav.parent"));
    }
  });

  it("the avatar is decoration beside the printed name (one accessible name, not two)", () => {
    const { html } = account();
    const at = html.indexOf('data-testid="sidebar-account"');
    const inner = html.slice(at, html.indexOf("</button>", at));
    expect(inner).toMatch(/<span aria-hidden="true" class="flex-shrink-0"><span aria-hidden="true"/);
  });
});

describe("v3 F-SHELL-2 · the plan line never guesses (MOB-08)", () => {
  it("prints nothing while the entitlement is loading or unverified", () => {
    state.loading = true;
    expect(account().plan).toBeNull();
    state.loading = false;
    state.isFallback = true;
    state.ent = { plan: "free", enforced: true };
    expect(account().plan).toBeNull();
  });

  it.each(["en", "he"] as const)("names each verified plan (%s)", (lang) => {
    state.lang = lang;
    const cases: [Ent, string][] = [
      [{ plan: "free", enforced: true }, "elev.sidebar.plan.free"],
      [{ plan: "plus", enforced: true }, "elev.sidebar.plan.plus"],
      [{ plan: "family", enforced: true }, "elev.sidebar.plan.family"],
      [{ plan: "plus", enforced: false }, "elev.sidebar.plan.beta"],
    ];
    for (const [e, key] of cases) {
      state.ent = e;
      const label = translate(lang, key);
      expect(label, key).not.toBe(key);
      expect(account().plan, key).toBe(label);
      if (lang === "he") expect(label, key).not.toMatch(/[A-Za-z]/);
    }
  });

  it("sidebarPlanKey: the same branch order as SettingsModal's plan label", () => {
    expect(sidebarPlanKey(ent("family"), true, false)).toBeNull();
    expect(sidebarPlanKey(ent("family"), false, true)).toBeNull();
    expect(sidebarPlanKey(ent("free"), false, false)).toBe("elev.sidebar.plan.free");
    expect(sidebarPlanKey(ent("plus"), false, false)).toBe("elev.sidebar.plan.plus");
    expect(sidebarPlanKey(ent("family"), false, false)).toBe("elev.sidebar.plan.family");
    expect(sidebarPlanKey(ent("family", false), false, false)).toBe("elev.sidebar.plan.beta");
    expect(sidebarPlanKey(ent("plus", false), false, false)).toBe("elev.sidebar.plan.beta");
    // A free plan that is not enforced is still Free, never Beta.
    expect(sidebarPlanKey(ent("free", false), false, false)).toBe("elev.sidebar.plan.free");
  });
});

describe("v3 F-SHELL-2 · the wordmark", () => {
  it("is display 24/600 and still a paragraph, not a second h1", () => {
    const { html } = account();
    expect(html).toMatch(/<p class="text-\[24px\] font-semibold leading-none" style="font-family:var\(--font-display\);color:var\(--arbor-ink\)">Arbor<\/p>/);
    expect(html).not.toMatch(/<h1[\s>]/);
  });
});
