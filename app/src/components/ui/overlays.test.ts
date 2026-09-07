import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const root = path.resolve(__dirname, "..");
const TARGETS = {
  "ui/Modal.tsx": "open",
  // MOB-28 / CR-22: the bottom sheet is a dialog owner like any other — it
  // joins the explicit list rather than being exempted from it.
  "ui/Sheet.tsx": "open",
  "layout/MobileNav.tsx": "moreOpen",
  "practice/GoalBuilderModal.tsx": "open",
  "profile/AvatarCreator.tsx": "open",
  "profile/ProfileEditDrawer.tsx": "open",
  "tabs/MilestonesTab.tsx": "Boolean(celebratingId)",
  "coach/VoiceOverlay.tsx": "true",
  "tabs/HeroJourneyTab.tsx": "Boolean(kidNav) && immersive && Boolean(activeStory && render)",
};
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
function contract(source: string) {
  const file = ts.createSourceFile("consumer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let binding = "", open = "", close = "";
  const dialogs: ts.JsxAttributes[] = [], layers: ts.JsxAttributes[] = [];
  const attrs = (attributes: ts.JsxAttributes, name: string) => attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(file) === name) as ts.JsxAttribute | undefined;
  const value = (attributes: ts.JsxAttributes, name: string) => attrs(attributes, name)?.initializer?.getText(file) ?? "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(file) === "useDialog") {
      if (ts.isObjectBindingPattern(node.name)) binding = node.name.elements.find(el => el.propertyName?.getText(file) === "ref")?.name.getText(file) ?? "";
      const options = node.initializer.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
          const name = property.name.getText(file);
          const text = ts.isPropertyAssignment(property) ? property.initializer.getText(file) : name;
          if (name === "open") open = text;
          if (name === "onClose") close = text;
        }
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (value(node.attributes, "role") === '"dialog"') dialogs.push(node.attributes);
      if (attrs(node.attributes, "data-arbor-dialog-layer")) layers.push(node.attributes);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return {
    open, close,
    bound: binding !== "" && dialogs.length === 1 && value(dialogs[0], "ref") === "{" + binding + "}",
    fallback: dialogs.length === 1 && value(dialogs[0], "tabIndex") === "{-1}",
    modal: dialogs.length === 1 && value(dialogs[0], "aria-modal") === '"true"',
    named: dialogs.length === 1 && !!(attrs(dialogs[0], "aria-label") || attrs(dialogs[0], "aria-labelledby")),
    layers: layers.length,
    layerResetsAppScope: layers.some(layer => /\barbor-app\b/.test(value(layer, "className"))),
    backdrop: layers.some(layer => value(layer, "onClick") === "{onBackdropClick}"),
  };
}

describe("CR-03 actual consumer wiring", () => {
  for (const [file, open] of Object.entries(TARGETS)) {
    it(file + " binds the dialog element and actual open state to shared ownership", () => {
      const source = read(file), found = contract(source);
      expect(found.open).toBe(open);
      expect(found.close).not.toBe("");
      expect(found.bound).toBe(true);
      expect(found.fallback).toBe(true);
      expect(found.modal).toBe(true);
      expect(found.named).toBe(true);
      expect(found.layers).toBe(1);
      if (!file.endsWith("VoiceOverlay.tsx") && !file.endsWith("HeroJourneyTab.tsx")) expect(found.backdrop).toBe(true);
      expect(source).not.toMatch(/addEventListener\(["']keydown["']/);
      expect(source).toContain("requestClose");
      expect(source).toContain("createPortal");
    });
  }
  it("rejects an import-only fix, wrong ref, always-open hidden form and missing immersive role", () => {
    const source = read("profile/AvatarCreator.tsx");
    expect(contract(source.replace('ref={dialogRef}', '')).bound).toBe(false);
    expect(contract(source.replace('ref={dialogRef}', 'ref={otherRef}')).bound).toBe(false);
    expect(contract(source.replace('useDialog({ open,', 'useDialog({ open: true,')).open).not.toBe("open");
    expect(contract(source.replace('role="dialog"', '')).modal).toBe(false);
  });
  it("preserves local reset/save and voice safety ownership while centralizing dismissal", () => {
    const avatar = read("profile/AvatarCreator.tsx"), voice = read("coach/VoiceOverlay.tsx");
    expect(contract(avatar).close).toBe("close");
    expect(avatar).toContain("const close = () => { reset(); onClose(); }");
    expect(avatar).toContain("runAvatarGeneration");
    expect(read("practice/GoalBuilderModal.tsx")).toContain("onSave(merged)");
    expect(voice).toContain('"connecting" | "listening" | "thinking" | "speaking"');
    expect(voice).toContain('useMicLevel(phase === "listening" && !reducedMotion, haloRef)');
    expect(voice).toContain('typeof document === "undefined" ? overlay : createPortal(');
    expect(voice.match(/aria-live="polite"/g)).toHaveLength(2);
    const hero = read("tabs/HeroJourneyTab.tsx");
    expect(hero.indexOf("useDialog({")).toBeLessThan(hero.indexOf("if (!activeStory || !render) {"));
  });
});

describe("new portals retain their original register and scrim styles", () => {
  for (const [file, scope] of [
    ["layout/MobileNav.tsx", "arbor-app"],
    ["tabs/MilestonesTab.tsx", "arbor-app arbor-parent"],
    ["coach/VoiceOverlay.tsx", "arbor-app arbor-parent"],
    ["tabs/HeroJourneyTab.tsx", "arbor-app arbor-parent"],
  ]) {
    it(file + " retains ancestor scope in a nonvisual wrapper, not on the backdrop", () => {
      const source = read(file);
      expect(source).toContain('className="' + scope + '" style={{ display: "contents" }}');
      expect(contract(source).layerResetsAppScope).toBe(false);
    });
  }
  it("rejects the pre-review scope-on-scrim regression", () => {
    const source = read("tabs/MilestonesTab.tsx");
    expect(contract(source.replace('className="fixed inset-0', 'className="arbor-app fixed inset-0')).layerResetsAppScope).toBe(true);
  });
  it("Hero stays inside the existing Kid Mode trap and play scope; only parent mode portals", () => {
    const source = read("tabs/HeroJourneyTab.tsx");
    expect(source).toContain("{immersive && (kidNav ? createPortal(");
    expect(source).toContain(") : immersiveDialog)}");
    expect(source).toContain("open: Boolean(kidNav) && immersive");
    expect(source).toContain("onClick={kidNav ? requestClose : () => setImmersive(false)}");
    const kidBody = source.slice(source.indexOf("const immersiveDialog ="), source.indexOf("const immersiveDialog =") + source.slice(source.indexOf("const immersiveDialog =")).indexOf("\n  );"));
    expect(kidBody).not.toContain("arbor-parent");
    expect(kidBody).not.toContain("createPortal");
    expect(read("profile/ProfileEditDrawer.tsx")).toContain("parentDialogRef={dialogRef}");
    expect(read("profile/AvatarCreator.tsx")).toContain("parentRef: parentDialogRef");
  });
});

// Other existing dialog owners are explicit and frozen, including protected Kid
// Mode. A new raw dialog cannot pass by importing Modal somewhere in its file.
const LEGACY = new Set([
  "kidmode/ParentChallenge.tsx", "kidmode/KidModeOverlay.tsx", "onboarding/WowOnboarding.tsx",
  "sections/ScreeningSheet.tsx", "tabs/LanguageLabVocabView.tsx",
]);
const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(path.join(directory, entry.name)) : entry.name.endsWith(".tsx") ? [path.join(directory, entry.name)] : []);
it("new raw dialogs cannot evade the explicit owner list", () => {
  const unmanaged = walk(root).filter(file => /role=["'](?:dialog|alertdialog)["']/.test(readFileSync(file, "utf8")))
    .map(file => path.relative(root, file).replace(/\\/g, "/"))
    .filter(file => !(file in TARGETS) && !LEGACY.has(file));
  expect(unmanaged).toEqual([]);
});

/**
 * MOB-28 / CR-22 — Settings and the Paywall are SHEETS on a phone.
 *
 * MEASURED at 390 (ledger-SHELL Screens D and E): both rendered as a centred
 * 358×760 card — a desktop dialog scaled down, floating over a page it had
 * scrolled away from, with its only close control in the far top-right corner.
 * The one correct phone dialog in the app was MobileNav's More sheet, and its
 * presentation lived inline in that component. It is now `ui/Sheet`, on the
 * same useDialog/dialogStack contract as `ui/Modal` (asserted above, in the
 * CR-03 consumer sweep, because Sheet is in TARGETS), so the swap changes
 * where the box sits and nothing else.
 */
describe("MOB-28 — the bottom sheet is the phone presentation, Modal keeps lg+", () => {
  const sheet = read("ui/Sheet.tsx");

  it("it is anchored to the bottom edge, not centred", () => {
    expect(sheet).toContain("fixed inset-0 z-50 flex flex-col justify-end");
    expect(sheet).toContain("rounded-t-3xl");
    // negative control: Modal's own layer is the centred shape it replaces.
    expect(read("ui/Modal.tsx")).toContain("flex items-center justify-center");
    expect(sheet).not.toContain("flex items-center justify-center p-4");
  });

  it("it clears the home indicator (safe-area, not a plain padding)", () => {
    expect(sheet).toContain('paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)"');
  });

  it("its close control holds the 44 px floor", () => {
    const close = sheet.slice(sheet.indexOf("onClick={requestClose}"), sheet.indexOf('aria-label={t("aria.close")}'));
    expect(close).toContain("touch-target");
    expect(close).toContain('minWidth: "var(--touch-min)"');
    expect(close).toContain('minHeight: "var(--touch-min)"');
  });

  it("the breakpoint is a media QUERY at lg, not a device sniff", () => {
    expect(sheet).toContain('const COMPACT_QUERY = "(max-width: 1023.98px)";');
    expect(sheet).toContain("useSyncExternalStore(subscribeCompact, readCompact, () => false)");
    expect(sheet).not.toMatch(/userAgent|ontouchstart|isNativePlatform/);
    // no matchMedia (SSR, some test envs) falls back to the centred Modal —
    // i.e. to what shipped, never to a broken dialog.
    expect(sheet).toContain('typeof window !== "undefined" && !!window.matchMedia');
  });

  it("Settings and the Paywall pick the surface; Modal is still the lg+ answer", () => {
    for (const file of ["layout/SettingsModal.tsx", "billing/PaywallModal.tsx"]) {
      const source = read(file);
      expect(source, file).toContain('import { Sheet, useCompactSurface } from "../ui/Sheet";');
      expect(source, file).toContain("const Surface = useCompactSurface() ? Sheet : Modal;");
      expect(source, file).toContain("<Surface open=");
      expect(source, file).toContain("</Surface>");
      // exactly one surface element pair — not a Modal left behind beside it
      expect((source.match(/<Modal /g) ?? []), file).toEqual([]);
    }
  });

  it("negative control: the shipped callers mounted Modal at every width", () => {
    const preFix = '  return (\n    <Modal open={paywall.open} onClose={closePaywall} title={t("pw.title")}>';
    expect(preFix).toContain("<Modal open=");
    expect(preFix).not.toContain("useCompactSurface");
  });
});
