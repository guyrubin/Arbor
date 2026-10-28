import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { RETIRED_ROUTES, ROUTE_IDS, resolveHash, resolveRouteId } from "./routes";
import { contractFor } from "./surfaceContract";
import { sectionForTab } from "./navigation";
import { PORTRAIT_COPY } from "../components/companion/portraitCopy";
import { recommend } from "../practice/signals";
import { translate } from "./i18n";

/* B-GROWTH-22 — the Copilot (#/copilot, "The Full Picture") retires into My
   child. Its one door left with v3 F-CHILD-1, yet a typed, stored or shared
   #/copilot still rendered the leaf, and a Hebrew parent read an English
   directive at its top: "Increase … this week" (signals.recommend headline).
   G-13: the id keeps its ROUTE_IDS seat, the hash lands on #/development,
   the reader, its labels and the English directive are gone. */

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  if (statSync(full).isDirectory()) return name === "node_modules" ? [] : walk(full);
  return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
});

describe("B-GROWTH-22 · #/copilot lands on My child", () => {
  it("every way in resolves to development, and the id keeps its seat", () => {
    expect(RETIRED_ROUTES.copilot).toBe("development");
    expect(ROUTE_IDS as readonly string[]).toContain("copilot");
    for (const hash of ["#/copilot", "#/copilot/", "#/Copilot", "#/copilot?from=email"]) {
      expect(resolveHash(hash), hash).toEqual({ tab: "development", unknown: false });
    }
    expect(resolveRouteId("copilot")).toBe("development");
    // A parent whose last session ended on the Full Picture comes back to My child.
    expect(resolveHash("", "copilot")).toEqual({ tab: "development", unknown: false });
    expect(sectionForTab("copilot").id).toBe("growth");
  });

  it("the registry seat renders the My child leaf; the Full Picture leaf is deleted", () => {
    const shell = read("components/layout/Shell.tsx");
    expect(shell).toMatch(/^\s*copilot: DevelopmentTab,$/m);
    expect(shell).not.toContain("DevelopmentCopilot");
    expect(existsSync(path.join(SRC, "components/practice/DevelopmentCopilot.tsx"))).toBe(false);
    expect(existsSync(path.join(SRC, "lib/i18nElevation/fullpicture.ts"))).toBe(false);
    // The seat's contract is the development leaf's own: no copilot budget or move survives.
    const seat = contractFor("copilot")!, home = contractFor("development")!;
    expect([seat.primaryMove, seat.moduleBudget, seat.job]).toEqual([home.primaryMove, home.moduleBudget, home.job]);
    // NEGATIVE CONTROL: the pre-change registry line is what the match rejects.
    expect(/^\s*copilot: DevelopmentTab,$/m.test("  copilot: DevelopmentCopilot,")).toBe(false);
  });

  it("no English directive ships anywhere: recommend() names a key, never 'Increase … this week'", () => {
    const rec = recommend([], []);
    expect(rec).not.toHaveProperty("headline");
    expect(rec.whyKey).toMatch(/^elev\./);
    const DIRECTIVE = /`Increase \$\{|"Increase [a-z].* this week"/;
    const hits = walk(SRC).filter((file) => DIRECTIVE.test(readFileSync(file, "utf8"))).map((f) => path.relative(SRC, f));
    expect(hits).toEqual([]);
    // NEGATIVE CONTROL: the removed literal is what the scan catches.
    expect(DIRECTIVE.test("headline: `Increase ${DOMAIN_ACTIVITY[target]} this week`,")).toBe(true);
  });

  it("the Copilot's labels are gone in both languages", () => {
    for (const lang of ["en", "he"] as const) {
      expect(Object.keys(PORTRAIT_COPY[lang])).not.toContain("copilot");
      expect(Object.keys(PORTRAIT_COPY[lang])).not.toContain("copilotSub");
      for (const key of ["nav.tab.copilot", "elev.waveR.why.copilotFocus", "elev.waveR.why.copilotWatch", "prac.copilot.title", "elev.growth.link.copilot.label", "elev.growth.more.sub", "elev.growthTruth.copilot.focus.title", "elev.fullpicture.title"]) {
        expect(translate(lang, key), `${lang} ${key}`).toBe(key);
      }
    }
  });

  it("My child keeps its retained doors (the development check stays the one move; Care and Reports keep their routes)", () => {
    expect(contractFor("development")!.primaryMove).toBe("start-development-check");
    const areas = read("components/companion/MilestoneAreas.tsx");
    expect(areas).toContain('setActiveTab("screening")');
    for (const id of ["consult", "reports", "screening", "development"]) expect(ROUTE_IDS as readonly string[]).toContain(id);
  });
});
