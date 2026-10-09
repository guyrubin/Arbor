/**
 * B-SHELL-23 — chrome hygiene bundle.
 *
 * The shell carried English `title` literals, ~36 px popover menuitems, a raw
 * `#fff` badge ink, a SECOND SettingsModal instance (Sidebar mounted its own
 * while Shell already mounts one), stale "eight hubs" comments, an English
 * sandbox banner on a raw `#8a5326`, and no skip link to <main>.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translate } from "../../lib/i18n";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const full = path.join(dir, e);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx$/.test(e) && !/\.test\.tsx$/.test(e) ? [full] : [];
  });
const shell = read("components/layout/Shell.tsx");
const sidebar = read("components/layout/Sidebar.tsx");
const workspace = read("components/companion/CompanionWorkspace.tsx");
const workspaceCss = read("components/companion/companionWorkspace.css");
const HEBREW = /[֐-׿]/;

describe("B-SHELL-23 · one SettingsModal", () => {
  it("exactly one <SettingsModal mount in the whole app, and it is Shell's", () => {
    const mounts = walk(SRC).flatMap((f) => (readFileSync(f, "utf8").match(/<SettingsModal\b/g) ?? []).map(() => path.relative(SRC, f).split(path.sep).join("/")));
    expect(mounts).toEqual(["components/layout/Shell.tsx"]);
  });

  it("the Sidebar popover opens Settings through the settings bus, not its own modal", () => {
    expect(sidebar).not.toContain("import SettingsModal");
    expect(sidebar).not.toMatch(/showSettings|setShowSettings/);
    expect(sidebar).toContain('import { requestOpenSettings } from "./settingsBus";');
    expect(sidebar).toMatch(/onClick=\{\(\) => \{ setPopoverOpen\(false\); requestOpenSettings\(\); \}\}/);
  });
});

describe("B-SHELL-23 · targets, tokens and comments", () => {
  it("every popover menuitem meets the 44 px floor", () => {
    const menu = sidebar.slice(sidebar.indexOf('role="menu"'), sidebar.indexOf("aria-haspopup=\"menu\""));
    const items = menu.split('role="menuitem"').slice(1);
    expect(items.length).toBe(2);
    for (const item of items) expect(item.slice(0, 600)).toMatch(/className="[^"]*\bmin-h-11\b/);
  });

  it("active navigation and sandbox contrast use tokens — no raw hex in either file", () => {
    expect(sidebar).toContain('color: active ? "var(--arbor-clay-deep)" : "var(--arbor-ink)"');
    expect(shell).toContain('background: "var(--arbor-peach-ink)", color: "var(--arbor-on-accent)"');
    for (const src of [shell, sidebar]) expect(src).not.toMatch(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/);
  });

  it("the hub-count comments say ten, not eight", () => {
    expect(sidebar).not.toMatch(/\beight\b/i);
    expect(read("lib/searchIndex.ts")).not.toMatch(/across the eight sections/);
  });
});

describe("B-SHELL-23 · the sandbox banner is keyed and keeps its env gate", () => {
  it("the banner renders keys only, behind showSandboxBanner", () => {
    const banner = shell.slice(shell.indexOf("{showSandboxBanner && ("), shell.indexOf("{showSandboxBanner && (") + 1400);
    for (const key of ["shell.sandbox.title", "shell.sandbox.body", "shell.sandbox.learn", "shell.sandbox.toast"]) expect(banner).toContain(`t("${key}")`);
    expect(banner).not.toMatch(/Sandbox mode:|Learn how|GEMINI_API_KEY/);
  });
});

describe("B-SHELL-23 · skip link", () => {
  it("is the first focusable thing in the shell, before the Sidebar, and focuses <main id=\"main\">", () => {
    const app = shell.indexOf('className="arbor-app');
    const skip = shell.indexOf('data-testid="skip-to-content"');
    const side = shell.indexOf("<Sidebar />");
    expect(app).toBeGreaterThan(-1);
    expect(skip).toBeGreaterThan(app);
    expect(skip).toBeLessThan(side);
    const linkStart = shell.lastIndexOf("<a", skip);
    const between = shell.slice(app, linkStart);
    expect(between).not.toMatch(/<(button|a|input|select|textarea)\b/);
    const link = shell.slice(linkStart, shell.indexOf("</a>", skip));
    expect(link).toContain('href="#main"');
    expect(link).toContain("mainRef.current?.focus()");
    expect(link).toContain("e.preventDefault()"); // hash routing owns #/<tab>
    expect(link).toMatch(/sr-only focus:not-sr-only/);
    expect(link).toContain('t("shell.skipToContent")');
    expect(shell).toMatch(/<main id="main" tabIndex=\{-1\} ref=\{mainRef\}/);
  });

  it("EN + HE copy exists for every new chrome key", () => {
    for (const key of ["shell.skipToContent", "top.searchHint", "shell.sandbox.title", "shell.sandbox.body", "shell.sandbox.learn", "shell.sandbox.toast"]) {
      expect(translate("en", key), key).not.toBe(key);
      expect(HEBREW.test(translate("he", key)), `${key} HE`).toBe(true);
    }
    expect(translate("en", "shell.skipToContent")).toBe("Skip to content");
  });
});

describe("persistent companion · mobile chrome", () => {
  it("keeps the inline conversation and its backdrop above the sibling mobile navigation", () => {
    // A z-10 on page-shell traps even a z-46 fixed conversation below the
    // sibling z-40 nav. Check both the ancestor and the intended layer order.
    const pageClasses = /className="(page-shell[^"]*)"/.exec(shell)?.[1];
    expect(pageClasses).toBeTruthy();
    const createsStack = (classes: string) => /(?:^|\s)(?:[\w-]+:)*z-(?!auto\b)\S+/.test(classes);
    expect(createsStack(pageClasses!)).toBe(false);
    expect(createsStack(`${pageClasses} z-10`)).toBe(true); // original failure
    const pageRules = [...read("index.css").matchAll(/\.page-shell\s*\{([^}]+)\}/g)];
    expect(pageRules.length).toBeGreaterThan(0);
    for (const [, rule] of pageRules) expect(rule).not.toMatch(/(?:z-index|transform|isolation|contain)\s*:/);
    const workspaceRule = /\.companion-workspace\s*\{([^}]+)\}/.exec(workspaceCss)?.[1];
    expect(workspaceRule).toBeTruthy();
    expect(workspaceRule).not.toMatch(/(?:z-index|transform|isolation|contain)\s*:/);

    const defaultLayer = (selector: string) => {
      const rule = new RegExp(`\\.${selector}\\s*\\{([^}]+)\\}`).exec(workspaceCss)?.[1];
      expect(rule, selector).toMatch(/position:\s*fixed/);
      return Number(/z-index:\s*(\d+)/.exec(rule!)?.[1]);
    };
    const navClasses = /<nav\b[\s\S]*?className="([^"]+)"/.exec(read("components/layout/MobileNav.tsx"))?.[1];
    const navLayer = Number(/\bz-(\d+)\b/.exec(navClasses ?? "")?.[1]);
    expect(Number.isFinite(navLayer)).toBe(true);
    expect(defaultLayer("companion-workspace-backdrop")).toBeGreaterThan(navLayer);
    expect(defaultLayer("companion-conversation")).toBeGreaterThan(defaultLayer("companion-workspace-backdrop"));
    expect(shell.indexOf("<CompanionWorkspace")).toBeGreaterThan(shell.indexOf('className="page-shell'));
    expect(shell.indexOf("<MobileNav />")).toBeGreaterThan(shell.indexOf("</CompanionWorkspace>"));
  });

  it("styles launcher labels separately so mobile keeps both the arrow and accessible save icon", () => {
    // Icon itself renders a span: broad child-span rules flexed the arrow and
    // hid the only visible save affordance when the text label was removed.
    expect(read("components/ui/Icon.tsx")).toMatch(/return\s*\(\s*<span/);
    expect(workspace).toMatch(/<span className="companion-launch-copy">[\s\S]*?<\/span><Icon name="arrow_forward"/);
    expect(workspaceCss).toMatch(/\.companion-launch-copy\s*\{[^}]*flex:\s*1;/);
    expect(workspaceCss).toMatch(/@media\s*\(max-width:\s*520px\)\s*\{\s*\.companion-launch-save-label\s*\{\s*display:\s*none;/);
    const affectsIconSpans = (css: string) => /\.companion-launch-(?:main|save)(?:\s*>\s*|\s+)span\b/.test(css);
    expect(affectsIconSpans(workspaceCss)).toBe(false);
    expect(affectsIconSpans(".companion-launch-main > span { flex: 1; }")).toBe(true);
    expect(affectsIconSpans(".companion-launch-save > span { display: none; }")).toBe(true);
    const saveButton = /<button\b[^>]*className="companion-launch-save"[\s\S]*?<\/button>/.exec(workspace)?.[0];
    expect(saveButton).toBeTruthy();
    expect(saveButton).toContain('aria-label={inputText(uiLang, "companion.input.just-keep-a-moment")}');
    expect(saveButton).toMatch(/<Icon name="add_a_photo"[^>]*\/><span className="companion-launch-save-label">/);
    expect(workspaceCss).toMatch(/\.companion-launch-save\s*\{[^}]*min-inline-size:\s*48px;/);
  });
});
