/**
 * Shell-chrome layout guards (visual-audit follow-ups).
 *
 * UC-8a — wide-desktop topbar title starvation.
 *   The topbar was a `flex-1 min-w-0` title zone against a `flex-shrink-0`
 *   control band. With the AI rail open on a 1920 desktop the band claimed
 *   ~740px of an 880px header and the page title collapsed to "T…" / "One …"
 *   (EN and HE). The band must therefore be shrinkable, the title must own a
 *   real minimum, and the shrinking must be paid for by ONE designated control
 *   (search) rather than by squeezing controls out of reach.
 *
 * UC-8b — sticky sub-tab row leaving a live sliver above it.
 *   <main> is the scroll container and carries a top padding, so the
 *   `sticky top-0` tablist parked one padding-height below the scrollport top;
 *   content scrolled through the gap and was clipped by the opaque band. The
 *   row cancels the inset with --arbor-main-pt, whose value must keep matching
 *   <main>'s Tailwind padding — that is what this test pins.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("TopbarBell — a LOG nudge opens the composer on arrival (lane T)", () => {
  it("handleNavigate calls requestCapture(item.capture) BEFORE setActiveTab", () => {
    const bell = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "TopbarBell.tsx"), "utf8");
    expect(bell).toMatch(/if \(item\.capture\) requestCapture\(item\.capture\);\s*\n\s*setActiveTab\(item\.action\);/);
  });
});

const here = path.dirname(fileURLToPath(import.meta.url));
const topbar = readFileSync(path.join(here, "Topbar.tsx"), "utf8");
const shell = readFileSync(path.join(here, "Shell.tsx"), "utf8");
const mobileNav = readFileSync(path.join(here, "MobileNav.tsx"), "utf8");
const safetyRing = readFileSync(path.join(here, "SafetyRing.tsx"), "utf8");
const childContextHeader = readFileSync(path.join(here, "ChildContextHeader.tsx"), "utf8");
const profileSwitcher = readFileSync(path.join(here, "..", "profile", "ProfileSwitcher.tsx"), "utf8");
const indexCss = readFileSync(path.join(here, "..", "..", "index.css"), "utf8");
// Drop comments so prose about a banned pattern cannot trip (or satisfy) a scan.
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ── IA-01 / IA-18 / IA-25 (wave T) — Safety life-ring is canon chrome ───── */

describe("IA-01 — the Safety life-ring is mounted in all three chrome homes", () => {
  it("Topbar control band, Shell accessories strip and the More-sheet header each mount <SafetyRing", () => {
    for (const [name, src] of [["Topbar", topbar], ["Shell", shell], ["MobileNav", mobileNav]] as const) {
      expect(stripComments(src), `${name} does not mount <SafetyRing`).toContain("<SafetyRing");
    }
  });

  it("Topbar: the ring is the FIRST control in the band, in a non-shrinking wrapper", () => {
    const band = stripComments(topbar.slice(topbar.lastIndexOf("Right zone")));
    const ring = band.indexOf("<SafetyRing");
    expect(ring).toBeGreaterThan(-1);
    for (const later of ["<OfflineChip", "<TopbarSearch", "<KidModeButton", "<TopbarBell", "<TopbarKidSwitcher"]) {
      expect(band.indexOf(later), `${later} renders before the Safety ring`).toBeGreaterThan(ring);
    }
    expect(/flex-shrink-0|flex-none/.test(band.slice(Math.max(0, ring - 120), ring))).toBe(true);
  });

  it("Shell: the ring takes the strip slot the duplicate Ask door held (IA-18)", () => {
    const strip = stripComments(shell.slice(shell.indexOf("actions={"), shell.indexOf("actions={") + 1800));
    expect(strip).toContain("<SafetyRing");
    expect(strip.indexOf("<SafetyRing")).toBeLessThan(strip.indexOf("requestOpenSearch"));
  });

  it("MobileNav: the More-sheet header row mounts the ring and closes the sheet on navigate", () => {
    const header = stripComments(mobileNav.slice(mobileNav.indexOf('aria-label={t("nav.popover.more")}')));
    expect(header).toMatch(/<SafetyRing onNavigate=\{\(\) => setMoreOpen\(false\)\} \/>/);
  });

  it("SafetyRing: aria-label = nav.tab.safety, navigates to the safety route, ≥44px, hidden while kid-locked", () => {
    const src = stripComments(safetyRing);
    expect(src).toContain('t("nav.tab.safety")');
    expect(src).toContain('setActiveTab("safety")');
    expect(src).toMatch(/min-w-\[44px\] min-h-\[44px\]/);
    expect(src).toContain("useSyncExternalStore(subscribeKidMode, isKidModeActive)");
    expect(src).toMatch(/if \(kidLocked\) return null;/);
    // tokens only
    expect(src.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toEqual([]);
  });
});

describe("IA-18 — the duplicate Ask Arbor strip door is gone", () => {
  it("AskArborButton.tsx no longer exists and has zero importers in src/", () => {
    expect(existsSync(path.join(here, "AskArborButton.tsx"))).toBe(false);
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== "node_modules") walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(name) || /\.test\./.test(name)) continue;
        if (/AskArborButton/.test(readFileSync(p, "utf8"))) importers.push(path.relative(here, p));
      }
    };
    walk(path.join(here, "..", ".."));
    expect(importers).toEqual([]);
  });
});

describe("IA-25 — no fake presence in the shell chrome", () => {
  it("no animate-pulse anywhere in Shell / Topbar / MobileNav", () => {
    for (const [name, src] of [["Shell", shell], ["Topbar", topbar], ["MobileNav", mobileNav]] as const) {
      expect(stripComments(src), `${name} carries a pulsing dot`).not.toContain("animate-pulse");
    }
  });

  it("negative control: the scan sees the pre-fix pattern", () => {
    const preFix = '<span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" />';
    expect(stripComments(preFix)).toContain("animate-pulse");
  });
});

describe("UC-8a — the topbar title always gets usable width", () => {
  const bandMatch = topbar.match(/<div className="flex min-w-0 ([a-z-]+) items-center gap-2\.5">/);

  it("the right control band is found by the guard (guard stays honest)", () => {
    expect(bandMatch, "topbar right control band not found — update this guard").toBeTruthy();
  });

  it("the control band can shrink", () => {
    expect(bandMatch![1]).not.toBe("flex-shrink-0");
    expect(bandMatch![1]).toMatch(/^shrink$/);
  });

  it("the title zone declares a minimum inline size", () => {
    const titleZone = topbar.slice(topbar.lastIndexOf("Left zone"), topbar.lastIndexOf("Right zone"));
    expect(titleZone).toMatch(/minInlineSize:\s*"[^"]+"/);
    expect(titleZone).toContain("flex-1");
  });

  it("search is the only control that gives up width", () => {
    const band = topbar.slice(topbar.lastIndexOf("Right zone"));
    // the search box shrinks, with a floor
    expect(band).toMatch(/flex:\s*"0 1 \d+px"/);
    expect(band).toMatch(/minInlineSize:\s*"[\d.]+rem"/);
    // …and every other control in the band keeps its intrinsic size, so no
    // control can be squeezed to unreachable.
    for (const control of ["KidModeButton", "TopbarBell", "TopbarKidSwitcher"]) {
      const idx = band.indexOf(`<${control}`);
      expect(idx, `${control} not found in the topbar control band`).toBeGreaterThan(-1);
      const wrapper = band.slice(Math.max(0, idx - 220), idx);
      expect(
        /flex-shrink-0|flex-none/.test(wrapper),
        `${control} sits in a shrinkable wrapper — it can be squeezed narrower than its content`,
      ).toBe(true);
    }
    // the rail toggle carries its own flex-shrink-0 on the button element
    expect(topbar).toMatch(/2xl:inline-flex[^"]*flex-shrink-0/);
  });
});

describe("UC-8b — the sticky sub-tab row is flush with the scrollport", () => {
  const stickyRow = shell.slice(shell.indexOf('role="tablist"') - 400, shell.indexOf('role="tablist"') + 1400);

  it("cancels the scrollport top inset instead of using a bare top-0", () => {
    expect(stickyRow).toContain("sticky");
    expect(stickyRow).not.toMatch(/className="sticky top-0/);
    expect(stickyRow).toMatch(/top:\s*"calc\(-1 \* var\(--arbor-main-pt\)\)"/);
    expect(stickyRow).toMatch(/marginBlockStart:\s*"calc\(-1 \* var\(--arbor-main-pt\)\)"/);
    // …and pads the band back out so the pills do not move at rest.
    expect(stickyRow).toMatch(/paddingBlockStart:\s*"calc\(var\(--arbor-main-pt\)[^"]*\)"/);
  });

  it("--arbor-main-pt matches <main>'s actual Tailwind top padding", () => {
    // F-02 added ref={mainRef} before className — match the tag, not an exact prop order.
    const mainClass = shell.match(/<main [^>]*className="(arbor-parent[^"]+)"/)?.[1];
    expect(mainClass, "<main> className not found — update this guard").toBeTruthy();

    // Tailwind spacing scale: n → n * 0.25rem.
    const base = mainClass!.match(/(?:^|\s)py-(\d+)/)?.[1] ?? mainClass!.match(/(?:^|\s)pt-(\d+)/)?.[1];
    const md = mainClass!.match(/\smd:py-(\d+)/)?.[1] ?? mainClass!.match(/\smd:pt-(\d+)/)?.[1];
    expect(base, "no base top padding found on <main>").toBeTruthy();
    expect(md, "no md: top padding found on <main>").toBeTruthy();

    const declared = [...indexCss.matchAll(/--arbor-main-pt:\s*([\d.]+)rem/g)].map((m) => Number(m[1]));
    expect(declared.length, "--arbor-main-pt must be declared for both breakpoints").toBe(2);
    expect(declared[0]).toBeCloseTo(Number(base) * 0.25, 5);
    expect(declared[1]).toBeCloseTo(Number(md) * 0.25, 5);
    // the md override must sit in a min-width:768px media query (Tailwind's md)
    expect(indexCss).toMatch(/@media \(min-width: 768px\)[\s\S]{0,160}--arbor-main-pt/);
  });
});

/* ── IA-03 / IA-16 / MOB-26 · the mobile chrome stack fits its budget ────── */

/**
 * Measured at 390 (ledger-SHELL Screen A): 260 px of chrome stood between the
 * top of the scrollport and the hub's own h1 — a 34 px brand row, a 72 px
 * identity/accessory strip and an 80 px sticky pill row — on a 844 px screen.
 * The budget is 200. Two of the three rows were structural: the brand row said
 * "Arbor" to somebody already inside Arbor, and the strip stacked into two
 * boxes below `sm` because ChildContextHeader was `flex-col sm:flex-row`.
 *
 * This is a source guard on the STRUCTURE that produced the 260 (one row, no
 * brand row, mark folded in). The pixel re-measure is the orchestrator's.
 */
describe("IA-03 / MOB-26 — the mobile chrome is one strip, not three rows", () => {
  it("the standalone lg:hidden brand row is gone from Shell", () => {
    const src = stripComments(shell);
    expect(src).not.toMatch(/<div className="flex lg:hidden items-center gap-2\.5 mb-5">/);
    // …and the wordmark it carried does not reappear anywhere in the shell.
    expect(src).not.toMatch(/>Arbor</);
    // negative control: the scan does fire on the shipped markup.
    const preFix = '<div className="flex lg:hidden items-center gap-2.5 mb-5">\n <ArborMark size={34} />\n <span>Arbor</span>';
    expect(preFix).toMatch(/<div className="flex lg:hidden items-center gap-2\.5 mb-5">/);
  });

  it("the 28 px mark folds into the strip's identity slot instead", () => {
    const src = stripComments(shell);
    const identity = src.slice(src.indexOf("identity={"), src.indexOf("actions={"));
    expect(identity).toContain("<ArborMark size={28} />");
    expect(src.match(/<ArborMark/g) ?? []).toHaveLength(1);
  });

  it("ChildContextHeader renders ONE row at every width (it stacked below sm)", () => {
    const src = stripComments(childContextHeader);
    expect(src).toContain("flex flex-row items-center justify-between");
    expect(src).not.toContain("flex-col sm:flex-row");
    // negative control: the retired shape is what the scan is looking for.
    expect("flex flex-col sm:flex-row sm:items-center").toContain("flex-col sm:flex-row");
  });

  it("the strip keeps exactly its two accessories — Settings left for the sheet", () => {
    const src = stripComments(shell);
    const actions = src.slice(src.indexOf("actions={"), src.indexOf("}/>"));
    expect(actions).toContain("<SafetyRing />");
    expect(actions).toContain("<KidModeButton compact />");
    expect(actions).toContain('requestOpenSearch("mobile")');
    expect(actions).not.toContain("setSettingsOpen(true)");
  });

  it("the sticky pill row no longer spends a whole extra row of margin", () => {
    const bare = stripComments(shell);
    const stickyRow = bare.slice(bare.indexOf('role="tablist"') - 400, bare.indexOf('role="tablist"') + 600);
    expect(stickyRow).toContain("mb-4");
    expect(stickyRow).not.toContain("mb-6");
  });
});

/* ── IA-04 / IA-17 · one child switcher per viewport ─────────────────────── */

describe("IA-04 / IA-17 — exactly one child switcher at every width", () => {
  it("the mobile strip's identity slot IS the switcher (mobile had none)", () => {
    const src = stripComments(shell);
    expect(src).toContain('import TopbarKidSwitcher from "./TopbarKidSwitcher";');
    const identity = src.slice(src.indexOf("identity={"), src.indexOf("actions={"));
    expect(identity).toContain('<TopbarKidSwitcher maxWidth="128px" />');
    // the read-only "Caring for {name}" line it replaces is gone
    expect(src).not.toContain('t("top.caringFor")');
  });

  it("the mobile mount is lg:hidden and the topbar mount is lg-only — never both", () => {
    const src = stripComments(shell);
    const header = src.slice(src.indexOf("<ChildContextHeader"), src.indexOf("}/>"));
    expect(header).toContain('className="lg:hidden"');
    expect(stripComments(topbar)).toMatch(/className="hidden lg:flex/);
    expect(stripComments(topbar)).toContain("<TopbarKidSwitcher />");
  });

  it("the sidebar card is identity now — no second popover over the same context", () => {
    const src = stripComments(profileSwitcher);
    expect(src).not.toContain("setActiveChild");
    expect(src).not.toContain("AddChildModal");
    expect(src).not.toContain("ChevronDown");
    // …while the capabilities that were NOT duplicated stay put (law 6).
    expect(src).toContain("<ProfileEditDrawer");
    expect(src).toContain("<FamilyGlanceCard />");
    // negative control: switching and add-child live in the surviving switcher.
    const chip = stripComments(readFileSync(path.join(here, "TopbarKidSwitcher.tsx"), "utf8"));
    expect(chip).toContain("setActiveChild(p.id)");
    expect(chip).toContain("<AddChildModal");
  });
});

/* ── IA-21 · the hub one-liner reaches the phone ─────────────────────────── */

describe("IA-21 — hub one-liners are no longer desktop-only", () => {
  it("Shell renders nav.sub.<hub> below lg, where there is no topbar to carry it", () => {
    const src = stripComments(shell);
    expect(src).toMatch(/<p className="lg:hidden[^"]*"[\s\S]{0,200}t\("nav\.sub\." \+ section\.id, \{ name: childProfile\.name \}\)/);
  });

  it("it is the SAME key the topbar uses — one sentence per hub, not two", () => {
    expect(stripComments(topbar)).toContain('t("nav.sub." + section.id, { name: childProfile.name })');
  });

  it("EN and HE exist for all ten hubs, so nothing falls back to a raw key", () => {
    const i18n = readFileSync(path.join(here, "..", "..", "lib", "i18n.ts"), "utf8");
    const nav = readFileSync(path.join(here, "..", "..", "lib", "navigation.ts"), "utf8");
    const hubs = [...nav.matchAll(/^\s{4}id: "([a-z-]+)",$/gm)].map((m) => m[1]);
    expect(hubs).toHaveLength(10);
    for (const hub of hubs) {
      expect((i18n.match(new RegExp('"nav\\.sub\\.' + hub + '":', "g")) ?? []).length, hub).toBe(2);
    }
  });
});

/* ── OBJ-SHELL-01 · the last English literal in the strip ────────────────── */

describe("OBJ-SHELL-01 — the focus label is a key, not an English literal", () => {
  it("Shell reads elev.shell.focus.multilingual", () => {
    const src = stripComments(shell);
    expect(src).not.toContain('"Language transition"');
    expect(src).toContain('t("elev.shell.focus.multilingual")');
  });

  it("the key lands in BOTH locales", () => {
    const foundation = readFileSync(path.join(here, "..", "..", "lib", "i18nElevation", "foundation.ts"), "utf8");
    expect((foundation.match(/"elev\.shell\.focus\.multilingual":/g) ?? []).length).toBe(2);
    const he = foundation.slice(foundation.indexOf("export const he"));
    expect(he).toContain('"elev.shell.focus.multilingual":');
    // the Hebrew is transcreated, not the English string in Hebrew quotes
    expect(he.slice(he.indexOf('"elev.shell.focus.multilingual":'), he.indexOf('"elev.shell.focus.multilingual":') + 120))
      .toMatch(/[\u0590-\u05FF]/);
  });
});
