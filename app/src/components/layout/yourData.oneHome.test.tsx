/**
 * B-CAREPRO-35 — data rights get ONE home: Settings › Your data.
 *
 * Before: four doors with different rigour — Sharing (export + typed-name
 * delete with a receipt), the profile drawer (export + a receipt-less delete
 * that refused the only child, English literals), Settings' data row (opened
 * #/profile, not the controls) and account deletion in Settings.
 *
 * Acceptance pinned here:
 *   - 1 export path and 1 child-delete path: only YourDataSheet imports
 *     exportChildData / calls deleteChild; ProfileEditDrawer and TrustedSharing
 *     import neither exportChildData nor eraseEverything (and no deleteChild);
 *   - the receipt is ALWAYS the delete done-state (no early-return toast path);
 *   - 1 tap from Settings: the data row opens the sheet; every other door
 *     (Sharing, the drawer, The Science) asks Settings for focus "data", which
 *     opens the sheet itself;
 *   - the sheet renders EN + HE (rendered, contexts mocked) with export,
 *     delete-child and — for a real account — delete-account.
 * lib/childData.export.test.ts keeps the export-semantics guard (complete
 * record, exportNote top-level) on the one call site.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";

let lang: UiLang = "en";
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v),
    uiLang: lang,
  }),
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "c1", name: "Noa Levi" }, setActiveTab: () => undefined }),
}));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ deleteChild: async () => null }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: () => undefined }) }));
vi.mock("../../lib/childData", () => ({ exportChildData: async () => ({}), downloadJson: () => undefined }));
vi.mock("../ui/Modal", () => {
  const M = ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? React.createElement("div", { role: "dialog", "aria-label": title }, children) : null;
  return { default: M, Modal: M };
});

import YourDataSheet from "./YourDataSheet";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
/** Import lines only — comments that NAME the moved seam are not imports. */
const imports = (src: string) => src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const sheet = read("components/layout/YourDataSheet.tsx");
const settings = read("components/layout/SettingsModal.tsx");
const drawer = read("components/profile/ProfileEditDrawer.tsx");
const sharing = read("components/sections/TrustedSharing.tsx");
const science = read("components/tabs/SciencePage.tsx");

describe("B-CAREPRO-35 · one export path, one child-delete path", () => {
  for (const [name, src] of [["ProfileEditDrawer", drawer], ["TrustedSharing", sharing]] as const) {
    it(`${name} imports neither exportChildData nor eraseEverything, and deletes no child`, () => {
      expect(imports(src)).not.toMatch(/\bexportChildData\b|\beraseEverything\b|\bdownloadJson\b/);
      expect(code(src)).not.toMatch(/\bdeleteChild\b/);
      expect(code(src)).toContain('requestOpenSettings({ focus: "data" })');
    });
  }

  it("the sheet is the one place that exports and deletes a child", () => {
    expect(imports(sheet)).toMatch(/\bexportChildData\b/);
    expect(code(sheet)).toMatch(/await deleteChild\(childId\)/);
  });

  it("the receipt is always the done-state: every resolved erase sets a receipt", () => {
    // deleteChild → setReceipt(r ?? zero-count receipt); no toast-and-close path.
    expect(code(sheet)).toMatch(/setReceipt\(r \?\? \{/);
    expect(code(sheet)).not.toMatch(/profiles\.length\s*<=\s*1/); // the only child is never refused
    expect(code(sheet)).toContain('data-testid="delete-receipt"');
  });

  it("NEGATIVE CONTROL: the pre-fix drawer shape is caught", () => {
    const preFix = `import { exportChildData, downloadJson } from "../../lib/childData";\nconst { deleteChild } = useProfile();`;
    expect(imports(preFix)).toMatch(/\bexportChildData\b/);
    expect(code(preFix)).toMatch(/\bdeleteChild\b/);
  });
});

describe("B-CAREPRO-35 · one tap from Settings; every other door lands on the sheet", () => {
  it("the Settings data row opens the sheet (not #/profile)", () => {
    const row = /data-testid="settings-data-row"[\s\S]{0,600}?<\/button>/.exec(settings)?.[0] ?? "";
    expect(row).toContain("onClick={() => setDataOpen(true)}");
    expect(row).not.toContain('setActiveTab("profile")');
    expect(row).toMatch(/min-h-11/);
    expect(settings).toMatch(/<YourDataSheet[\s\S]{0,80}open=\{open && dataOpen\}/);
  });

  it("focus 'data' (Sharing, drawer, The Science) opens the sheet itself", () => {
    expect(settings).toMatch(/if \(focus === "data"\) setDataOpen\(true\)/);
    expect(science).toContain('requestOpenSettings({ focus: "data" })');
  });

  it("account deletion from the sheet opens the one DeleteAccountModal", () => {
    expect(settings).toMatch(/onDeleteAccount=\{firebaseEnabled && user \? \(\) => setDeleteOpen\(true\) : undefined\}/);
    expect((settings.match(/<DeleteAccountModal\b/g) ?? []).length).toBe(1);
  });
});

describe("B-CAREPRO-35 · rendered sheet, EN + HE", () => {
  const render = (l: UiLang, withAccount: boolean) => {
    lang = l;
    const unescape = (h: string) => h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    return unescape(renderToStaticMarkup(
      React.createElement(YourDataSheet, {
        open: true,
        onClose: () => undefined,
        onDeleteAccount: withAccount ? () => undefined : undefined,
      }),
    ));
  };

  for (const l of ["en", "he"] as const) {
    it(`${l}: export, delete child and delete account — all keyed, 44 px`, () => {
      const html = render(l, true);
      expect(html).toContain('data-testid="your-data-export"');
      expect(html).toContain('data-testid="delete-child-btn"');
      expect(html).toContain('data-testid="your-data-delete-account"');
      expect(html).toContain(translate(l, "elev.yourData.export", { name: "Noa" }));
      expect(html).toContain(translate(l, "sec.sharing.delete.btn"));
      expect(html).toContain(translate(l, "set.acctDel.open"));
      expect((html.match(/<button\b[^>]*>/g) ?? []).every((b) => /min-h-11/.test(b))).toBe(true);
      // No raw key leaks.
      expect(html).not.toMatch(/elev\.yourData\.|sec\.sharing\./);
      if (l === "he") expect(html).not.toMatch(/Export|Delete/);
    });
  }

  it("no account → no delete-account door (sandbox / signed-out)", () => {
    expect(render("en", false)).not.toContain("your-data-delete-account");
  });

  it("every new key has EN and a distinct HE string", () => {
    for (const k of ["row.title", "row.sub", "row.open", "sub", "export", "exportFailed", "link"]) {
      const key = `elev.yourData.${k}`;
      expect(translate("en", key)).not.toBe(key);
      expect(translate("he", key)).not.toBe(translate("en", key));
    }
    for (const dead of ["set.data.title", "set.data.sub", "set.data.open", "sec.sharing.data.export"]) {
      expect(translate("en", dead)).toBe(dead);
    }
  });
});
