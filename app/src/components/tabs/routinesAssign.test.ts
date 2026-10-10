/**
 * GP-29 / OBJ-GROWTH-07 — the Routines footer's "Assign to {name}".
 *
 * The control toasted "✓ Routine assigned to {name}" and opened Kid Mode.
 * Nothing was assigned: `assignRoutine` wrote nothing, no routine id reaches
 * any child-facing collection, and the child's quest list is built from the
 * practice worlds, not from `arbor.routines.done.<childId>`. A parent who
 * tapped it was told a handoff happened and then shown a Kid Mode that looked
 * exactly as it had before.
 *
 * The claim lived in the confirmation itself, so there was no truthful shorter
 * wording — the same conclusion ENG-07 reached about the "Feeds the
 * Development Map" chip that stood beside it. Removed, with both dictionary
 * entries, on that precedent (claims.copy.test.ts §3).
 *
 * What must NOT change: the routine the parent runs with the child. The steps,
 * their persistence, the reset and the completion star are the surface's real
 * job and are pinned below, so "remove the dead control" cannot quietly become
 * "remove the routine".
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { en, he, translate, type UiLang } from "../../lib/i18n";
import { SURFACE_CONTRACTS } from "../../lib/surfaceContract";
import { ROUTINES } from "../../lib/routines";

const LANGS: UiLang[] = ["en", "he"];
const SRC = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

const TAB = read("components/tabs/RoutinesTab.tsx");

describe("GP-29 · the dead assign control is gone from the surface", () => {
  it("neither the button, its handler nor its test id survives", () => {
    expect(TAB).not.toContain('data-testid="routines-assign"');
    expect(TAB).not.toContain("assignRoutine");
    expect(TAB).not.toContain('t("routines.assign"');
    expect(TAB).not.toContain('t("routines.assigned"');
  });

  it("the Kid Mode hand-off it faked is no longer imported here", () => {
    // Routines had the ONLY openKidMode call that promised a transfer. The
    // real doors are untouched (shell KidModeButton, MobileNav, Practice
    // Studio), so Kid Mode stays reachable — law 6.
    expect(TAB).not.toContain("useKidMode");
    expect(TAB).not.toContain("openKidMode");
    expect(read("components/kidmode/useKidModeEntry.tsx")).toContain("openKidMode(target)");
    expect(read("components/layout/KidModeButton.tsx")).toContain("useKidModeEntry");
    expect(read("components/companion/TogetherView.tsx")).toContain("requestKidMode(");
  });

  it("the sentence is gone from BOTH dictionaries, not just unmounted", () => {
    // An unmounted key is a control waiting to be re-mounted; an unresolvable
    // key makes re-introducing the claim a visible decision.
    for (const lang of LANGS) {
      expect(translate(lang, "routines.assign")).toBe("routines.assign");
      expect(translate(lang, "routines.assigned")).toBe("routines.assigned");
    }
    for (const dict of [en, he]) {
      for (const value of Object.values(dict)) {
        expect(String(value)).not.toMatch(/Routine assigned|השגרה שויכה/);
      }
    }
  });

  it("the surface still declares no write path, so nothing replaced the claim", () => {
    expect(SURFACE_CONTRACTS.find((c) => c.route === "routines")?.threadWrite).toBe("none");
    // ENG-07's chip stays gone too — this item must not resurrect it.
    expect(TAB).not.toContain('t("routines.feeds")');
  });
});

describe("GP-29 · the routine itself is untouched", () => {
  it("the steps, their persistence and the reset all remain", () => {
    expect(TAB).toContain("data-testid={`routine-step-${step.key}`}");
    expect(TAB).toContain('data-testid="routines-reset"');
    expect(TAB).toContain("localStorage.setItem(lsKey(childProfile.id)");
    expect(TAB).toContain('t("routines.reset")');
  });

  it("completion answers in place through Receipt and names no star (B-STATUS-01 / B-GROWTH-24)", () => {
    expect(TAB).toContain("const nowComplete = total > 0 && selected.steps.every((step) => nextKeys.includes(step.key));");
    expect(TAB).toContain('<Receipt testId="routines-completion-receipt"');
    expect(TAB).not.toContain("useToast");
    expect(TAB).not.toContain("routines.doneToast");
    expect(TAB).not.toContain("routines.starEarned");
    for (const lang of LANGS) {
      const s = translate(lang, "routines.doneReceipt");
      expect(s).not.toBe("routines.doneReceipt");
      expect(translate(lang, "routines.doneToast")).toBe("routines.doneToast");
      // no star glyph, no child-world claim, no reward aimed at the child
      expect(s).not.toMatch(/⭐|★|star|world|כוכב|בעולם/i);
      expect(translate(lang, "routines.starEarned")).toBe("routines.starEarned");
    }
  });

  it("progress is still a count, never a percentage (firewall)", () => {
    expect(TAB).toContain("{doneCount}/{total}");
    expect(TAB).not.toMatch(/Math\.round\([^)]*100\)/);
  });
});

describe("GP-29 · NEGATIVE CONTROL — the shipped shapes are what this rejects", () => {
  it("the removed button and toast are recognisable, and both fail the rules above", () => {
    const shipped = '<Icon name="child_care" size={18} /> {t("routines.assign", { name: firstName })}';
    expect(shipped).toContain('t("routines.assign"');   // the needle is right…
    expect(TAB).not.toContain(shipped);                  // …and it is not in the file.

    const shippedToast = 'toast(t("routines.assigned", { name: firstName }), "success");';
    expect(shippedToast).toContain("routines.assigned");
    expect(TAB).not.toContain(shippedToast);

    // And the English sentence it rendered no longer resolves anywhere.
    expect(Object.values(en).some((v) => String(v).includes("Routine assigned"))).toBe(false);
  });

  it("the guard is not vacuous — the same predicates pass on controls that DO exist", () => {
    expect(TAB).toContain('data-testid="routines-reset"');
    expect(translate("en", "routines.reset")).not.toBe("routines.reset");
  });
});

/* B-GROWTH-24 — the subtitle said "Seven research-backed routines" over a
   catalogue of 12. The number now interpolates ROUTINES.length. */
describe("B-GROWTH-24 · the subtitle's number is the catalogue's", () => {
  it("the subtitle interpolates ROUTINES.length in EN and HE", () => {
    expect(TAB).toContain('t("routines.sub", { name: firstName, count: ROUTINES.length })');
    for (const lang of LANGS) {
      const s = translate(lang, "routines.sub", { name: "Noa", count: ROUTINES.length });
      expect(s.startsWith(`${ROUTINES.length} `), `${lang}: ${s}`).toBe(true);
      expect(s).not.toMatch(/Seven|שבע/);
    }
    expect(ROUTINES.length).toBe(12);
  });

  it("NEGATIVE CONTROL — the pre-fix subtitle disagrees with the catalogue", () => {
    const pre = "Seven research-backed routines — pick one, make it yours, run it with {name}.";
    expect(/Seven/.test(pre) && ROUTINES.length !== 7).toBe(true);
  });
});
