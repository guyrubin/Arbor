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
    expect(read("components/layout/KidModeButton.tsx")).toContain("openKidMode");
    expect(read("components/practice/PracticeStudioTab.tsx")).toContain("openKidMode");
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

  it("the completion star — the one real reward — still fires on the last step", () => {
    expect(TAB).toContain("const nowComplete = nextKeys.length === total && total > 0;");
    expect(TAB).toContain('toast(t("routines.starEarned", { name: firstName }), "success")');
    for (const lang of LANGS) expect(translate(lang, "routines.starEarned")).not.toBe("routines.starEarned");
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
