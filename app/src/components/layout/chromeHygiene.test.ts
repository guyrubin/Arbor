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

  it("the active badge ink is a token, the sandbox banner is peach-ink — no raw hex in either file", () => {
    expect(sidebar).toContain('color: "var(--arbor-on-accent)"');
    expect(shell).toContain('color: "var(--arbor-peach-ink)"');
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
