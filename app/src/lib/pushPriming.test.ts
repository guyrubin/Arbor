/**
 * ENG-23 — the Growth reminders card is primed, and never over-promises.
 *
 * WHAT SHIPPED: DevelopmentTab rendered `<PushOptInToggle>` as the last element
 * on the page, below the screening sheet, with a label and a sublabel and no
 * priming whatsoever — and the component returned null unless `pushCapable()`.
 * No build carries VITE_FIREBASE_VAPID_KEY, so in production that switch was
 * invisible in every session that has ever run, and a parent had no way to know
 * whether Arbor was going to interrupt their evening.
 *
 * WHAT THESE PIN:
 *   1. the decision table (lib/pushPriming) — capability first;
 *   2. the ONE rule that matters: a switch may only appear where Arbor can
 *      actually deliver, so the copy can never promise a notification that has
 *      no sender;
 *   3. the card is mounted on Growth and the pre-change bare toggle is gone;
 *   4. every copy key the card can ask for exists in EN and HE.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pushPrimingCopy, pushPrimingState, type PushPrimingInputs } from "./pushPriming";
import { en, he } from "./i18nElevation/returnhooks";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8").replace(/\r\n/g, "\n");

const inputs = (o: Partial<PushPrimingInputs>): PushPrimingInputs => ({
  capable: false,
  permission: "default",
  registered: false,
  ...o,
});

describe("ENG-23 — the reminders state is decided by capability first", () => {
  it("no sender (the ONLY state any shipped build has ever been in) → in-app", () => {
    expect(pushPrimingState(inputs({ capable: false, permission: "default" }))).toBe("inApp");
    // Even a browser that already granted permission cannot make a sender exist.
    expect(pushPrimingState(inputs({ capable: false, permission: "granted", registered: true }))).toBe("inApp");
  });

  it("a sender the browser cannot reach → in-app, not a dead switch", () => {
    expect(pushPrimingState(inputs({ capable: true, permission: "unsupported" }))).toBe("inApp");
  });

  it("a sender the browser refuses → blocked", () => {
    expect(pushPrimingState(inputs({ capable: true, permission: "denied" }))).toBe("blocked");
  });

  it("a real sender, undecided → offer; granted and registered → on", () => {
    expect(pushPrimingState(inputs({ capable: true, permission: "default" }))).toBe("offer");
    expect(pushPrimingState(inputs({ capable: true, permission: "granted", registered: false }))).toBe("offer");
    expect(pushPrimingState(inputs({ capable: true, permission: "granted", registered: true }))).toBe("on");
  });
});

describe("ENG-23 — the card never promises what it cannot deliver", () => {
  it("shows NO switch in any state where Arbor cannot send", () => {
    for (const i of [
      inputs({ capable: false }),
      inputs({ capable: false, permission: "granted", registered: true }),
      inputs({ capable: true, permission: "unsupported" }),
      inputs({ capable: true, permission: "denied" }),
    ]) {
      expect(pushPrimingCopy(i).showToggle, JSON.stringify(i)).toBe(false);
    }
  });

  it("shows the switch ONLY where the sender is real", () => {
    expect(pushPrimingCopy(inputs({ capable: true, permission: "default" })).showToggle).toBe(true);
    expect(pushPrimingCopy(inputs({ capable: true, permission: "granted", registered: true })).showToggle).toBe(true);
  });

  it("primes before it asks — the offer state is the only one carrying points", () => {
    expect(pushPrimingCopy(inputs({ capable: true, permission: "default" })).pointKeys.length).toBe(3);
    expect(pushPrimingCopy(inputs({ capable: false })).pointKeys.length).toBe(0);
  });

  it("the no-sender copy says so, and says where things wait instead", () => {
    const copy = pushPrimingCopy(inputs({ capable: false }));
    const body = en[copy.bodyKey];
    expect(body).toBeTruthy();
    expect(body).toMatch(/does not send/i);
    expect(copy.noteKey).toBeTruthy();
    expect(en[copy.noteKey]).toBeTruthy();
  });

  it("every key the card can ask for exists in EN and HE", () => {
    const states: PushPrimingInputs[] = [
      inputs({ capable: false }),
      inputs({ capable: true, permission: "default" }),
      inputs({ capable: true, permission: "granted", registered: true }),
      inputs({ capable: true, permission: "denied" }),
    ];
    const keys = new Set<string>(["elev.rh.push.toggle.label", "elev.rh.push.toggle.sub"]);
    for (const i of states) {
      const c = pushPrimingCopy(i);
      keys.add(c.titleKey);
      keys.add(c.bodyKey);
      if (c.noteKey) keys.add(c.noteKey);
      for (const k of c.pointKeys) keys.add(k);
    }
    expect(keys.size).toBeGreaterThan(6);
    for (const k of keys) {
      expect(en[k], `EN missing ${k}`).toBeTruthy();
      expect(he[k], `HE missing ${k}`).toBeTruthy();
    }
  });
});

describe("ENG-23 — Growth mounts the primed card, not the bare toggle", () => {
  const src = read("../components/tabs/DevelopmentTab.tsx");
  const card = read("../components/nextopen/PushPrimingCard.tsx");

  it("NEGATIVE CONTROL: the scan recognises the exact pre-change shape", () => {
    const shipped = [
      "      <PushOptInToggle",
      "        enabled={pushEnabled}",
      '        label={t("push.optin.label")}',
      '        sublabel={t("push.optin.sublabel")}',
      "      />",
    ].join("\n");
    expect(/<PushOptInToggle/.test(shipped)).toBe(true);
    expect(/<PushPrimingCard/.test(shipped)).toBe(false);
  });

  it("reads both files (a scan over an empty string proves nothing)", () => {
    expect(src.length).toBeGreaterThan(2000);
    expect(card.length).toBeGreaterThan(1000);
  });

  it("the unprimed toggle is gone and PushPrimingCard is mounted with real props", () => {
    expect(src).not.toMatch(/PushOptInToggle/);
    expect(src).toMatch(/<PushPrimingCard/);
    const mount = src.match(/<PushPrimingCard[\s\S]{0,400}?\/>/)?.[0];
    expect(mount).toBeTruthy();
    for (const prop of ["capable=", "permission=", "registered=", "onToggle="]) {
      expect(mount, `PushPrimingCard mounted without ${prop}`).toContain(prop);
    }
  });

  it("the card decides through lib/pushPriming rather than re-deriving state", () => {
    expect(card).toContain('from "../../lib/pushPriming"');
    expect(card).toMatch(/copy\.showToggle\s*&&/);
    // The switch is inside the guarded branch, never above it.
    const guardAt = card.indexOf("copy.showToggle &&");
    const switchAt = card.indexOf('role="switch"');
    expect(guardAt).toBeGreaterThan(-1);
    expect(switchAt).toBeGreaterThan(guardAt);
  });
});
