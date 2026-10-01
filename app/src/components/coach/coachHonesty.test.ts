/**
 * Wave T lane A (2026-09-03) — honest-AI + mobile guards on the Ask surface.
 *
 *  AI-13  no presence idiom on the coach identity strip: no green dot beside
 *         the coach name, no "always here" clause (Law 4: no fake presence).
 *  AI-23  the Ask hero memory line is COUNT-AWARE — day-0 never claims memory
 *         use; en+he keys live in lib/i18nElevation/aiHonesty.ts.
 *  MOB-14 any sticky/fixed bottom-docked element under components/tabs/**
 *         clears the MobileNav via --mobile-nav-h (+ safe-area), never a
 *         hard-coded bottom-16.
 *
 * Source-scan tests in the clinicalFirewall.wave3 / cosmeticsFirewall
 * pattern; every regex is proven against the PRE-fix snippet first so the
 * guards cannot rot into a vacuous pass.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { assembleSpokenContext } from "../../server/spokenContext";
import type { MemoryLedgerEvent, MemoryStore } from "../../memory/types";
import { en as honestyEn, he as honestyHe } from "../../lib/i18nElevation/aiHonesty";
import { elevationEn, elevationHe } from "../../lib/i18nElevation";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(here, "..", "..");
const coachSrc = readFileSync(path.join(srcRoot, "components", "tabs", "CoachTab.tsx"), "utf8");

/* ── AI-13: presence dot + "always here" ─────────────────────────────────── */
// A filled dot (rounded-full / animate-pulse span) rendered between the coach
// name and its status line = the "online now" affordance.
const PRESENCE_DOT_BESIDE_NAME = /coach\.coachName"\)\}<\/p>[\s\S]{0,400}?<span[^>]*\b(?:rounded-full|animate-pulse)\b[^>]*aria-hidden[^>]*\/>[\s\S]{0,200}?coachStatus/;
const OLD_IDENTITY_STRIP = `<p className="text-sm font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>{t("coach.coachName")}</p>
            <p className="text-[11px] font-bold flex items-center gap-1.5 leading-tight" style={{ color: "var(--arbor-green-ink)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--arbor-green-ink)" }} aria-hidden />
              {t("coach.coachStatus")}
            </p>`;

describe("AI-13 — coach identity strip carries no presence idiom", () => {
  it("negative control: the regex recognises the OLD dot-beside-name markup", () => {
    expect(PRESENCE_DOT_BESIDE_NAME.test(OLD_IDENTITY_STRIP)).toBe(true);
  });
  it("CoachTab renders no presence dot beside the coach name", () => {
    expect(coachSrc).not.toMatch(PRESENCE_DOT_BESIDE_NAME);
  });
  it("CoachTab reads the honest status key (AI guide) and no longer the 'always here' key", () => {
    expect(coachSrc).toContain('t("elev.aihonesty.coachStatus")');
    expect(coachSrc).not.toContain('t("coach.coachStatus")');
  });
  it("the status copy names the software, never a shift (en + he)", () => {
    for (const dict of [honestyEn, honestyHe]) {
      const v = dict["elev.aihonesty.coachStatus"];
      expect(v).toBeTruthy();
      expect(v).not.toMatch(/always here|online|תמיד כאן|מחובר/i);
    }
    expect(honestyEn["elev.aihonesty.coachStatus"]).toBe("AI guide");
  });
});

/* ── AI-23: count-aware memory line ──────────────────────────────────────── */
const OLD_MEMORY_LINE = `{t("coach.memoryLine", { name: childFirst })}`;
const UNCONDITIONAL_MEMORY_CLAIM = /t\("coach\.memoryLine"/;

describe("AI-23 — Ask hero memory line is count-aware", () => {
  it("negative control: the regex recognises the OLD unconditional claim", () => {
    expect(UNCONDITIONAL_MEMORY_CLAIM.test(OLD_MEMORY_LINE)).toBe(true);
  });
  it("CoachTab never renders the unconditional 'uses the memory you approved' line", () => {
    expect(coachSrc).not.toMatch(UNCONDITIONAL_MEMORY_CLAIM);
  });
  it("CoachTab branches on the approved-fact count (0 / 1 / n) with the aiHonesty keys", () => {
    expect(coachSrc).toContain("approvedMemoryItems.length === 0");
    expect(coachSrc).toContain('t("elev.aihonesty.memory.none", { name: childFirst })');
    expect(coachSrc).toContain('t("elev.aihonesty.memory.one", { name: childFirst })');
    expect(coachSrc).toContain('t("elev.aihonesty.memory.some", { name: childFirst, n: approvedMemoryItems.length })');
  });
  it("day-0 copy promises to ASK, not to use memory (en + he)", () => {
    expect(honestyEn["elev.aihonesty.memory.none"]).toMatch(/will ask before remembering/);
    expect(honestyEn["elev.aihonesty.memory.none"]).not.toMatch(/uses the memory/i);
    expect(honestyHe["elev.aihonesty.memory.none"]).toMatch(/ישאל לפני/);
    expect(honestyEn["elev.aihonesty.memory.some"]).toContain("{n}");
    expect(honestyHe["elev.aihonesty.memory.some"]).toContain("{n}");
  });
});

/* ── aiHonesty module: parity + registration ─────────────────────────────── */
describe("i18nElevation/aiHonesty — en/he parity, namespace, registration", () => {
  it("en and he carry exactly the same key set, all elev.aihonesty.*", () => {
    const enKeys = Object.keys(honestyEn).sort();
    expect(Object.keys(honestyHe).sort()).toEqual(enKeys);
    for (const k of enKeys) expect(k.startsWith("elev.aihonesty."), `bad namespace: ${k}`).toBe(true);
  });
  it("Hebrew values are actually Hebrew; no empty values", () => {
    for (const [k, v] of Object.entries(honestyHe)) expect(v, k).toMatch(/[֐-׿]/);
    for (const [k, v] of [...Object.entries(honestyEn), ...Object.entries(honestyHe)]) expect(v.trim().length, k).toBeGreaterThan(0);
  });
  it("is registered in i18nElevation/index.ts (keys resolve through the merged dictionaries)", () => {
    for (const k of Object.keys(honestyEn)) {
      expect(elevationEn[k], `${k} missing from elevationEn`).toBe(honestyEn[k]);
      expect(elevationHe[k], `${k} missing from elevationHe`).toBe(honestyHe[k]);
    }
  });
});

/* ── MOB-14: bottom-docked elements under components/tabs clear the nav ──── */
const tabsRoot = path.join(srcRoot, "components", "tabs");
const listTsx = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__snapshots__" ? [] : listTsx(full);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [full] : [];
  });
// Every className string literal / template that docks something to the
// bottom (sticky|fixed, any responsive prefix) …
const CLASS_ATTR = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
const DOCKED = /(?:^|[\s:])(?:sticky|fixed)\b/;
// … must offset every NON-desktop `bottom-` token via --mobile-nav-h.
const BOTTOM_TOKEN = /(?:^|\s)((?:[a-z-]+:)*)bottom-(\[[^\]]*\]|[^\s]+)/g;
const DESKTOP_PREFIX = /(?:^|:)(?:lg|xl|2xl):/;
const NAV_OFFSET = /--mobile-nav-h/;

const offendingBottomTokens = (cls: string): string[] => {
  if (!DOCKED.test(cls)) return [];
  const bad: string[] = [];
  for (const m of cls.matchAll(BOTTOM_TOKEN)) {
    const prefix = m[1] ?? "";
    const value = m[2];
    if (DESKTOP_PREFIX.test(prefix)) continue;
    if (!NAV_OFFSET.test(value)) bad.push(`${prefix}bottom-${value}`);
  }
  return bad;
};

describe("MOB-14 — bottom-docked elements under components/tabs clear the MobileNav (--mobile-nav-h)", () => {
  it("negative control: the OLD CoachTab class string is caught; the OverviewTab formula passes", () => {
    expect(offendingBottomTokens("sticky bottom-16 lg:bottom-0 z-30")).toEqual(["bottom-16"]);
    expect(offendingBottomTokens("fixed bottom-0 inset-x-0 z-40")).toEqual(["bottom-0"]);
    expect(offendingBottomTokens("max-md:fixed max-md:inset-x-4 max-md:z-30 max-md:bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+8px)]")).toEqual([]);
    expect(offendingBottomTokens("sticky bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+8px)] lg:bottom-0 z-30")).toEqual([]);
    // Not docked → not in scope (a plain margin/padding token is fine).
    expect(offendingBottomTokens("mb-4 bottom-2")).toEqual([]);
  });

  it("every sticky/fixed bottom-docked className under components/tabs/** references --mobile-nav-h", () => {
    const failures: string[] = [];
    let docked = 0;
    for (const file of listTsx(tabsRoot)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(CLASS_ATTR)) {
        const cls = m[1] ?? m[2] ?? "";
        if (!DOCKED.test(cls) || !/bottom-/.test(cls)) continue;
        docked += 1;
        const bad = offendingBottomTokens(cls);
        if (bad.length > 0) failures.push(`${path.relative(srcRoot, file)}: ${bad.join(", ")}`);
      }
    }
    expect(docked, "the scan found no bottom-docked element at all — walker broken?").toBeGreaterThanOrEqual(2);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("CoachTab's docked composer uses the OverviewTab offset formula", () => {
    expect(coachSrc).toContain('className="sticky bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+8px)] lg:bottom-0 z-30"');
    expect(coachSrc).not.toContain("sticky bottom-16");
  });
});

/* ── B-ASKJB-01: the spoken contract matches what the server sends ───────── */
// Since PR 109 both spoken paths carry approved memory + this conversation's
// recent turns (server/spokenContext.ts). The panel said the opposite.
const SPOKEN_NEGATIONS = ["sends less", "not the memory", "does not carry", "ולא את עובדות הזיכרון", "אבל לא את עובדות הזיכרון", "שולח פחות"];

describe("B-ASKJB-01 — data-use panel: voice carries what the server assembles", () => {
  it("negative control: the negation list recognises the OLD copy", () => {
    const OLD_EN = "Speaking sends less than typing — your words and the profile, but not the memory facts you approved or earlier turns";
    const OLD_HE = "שיחת קול חיה היא שיחת אודיו ישירה עם המודל: היא נושאת את המילים שלכם ואת הפרופיל, ולא את עובדות הזיכרון שאישרתם או את החילופים הקודמים";
    expect(SPOKEN_NEGATIONS.some((n) => OLD_EN.includes(n))).toBe(true);
    expect(SPOKEN_NEGATIONS.some((n) => OLD_HE.includes(n))).toBe(true);
  });

  it("assembleSpokenContext returns approved memory and recent turns (the premise)", async () => {
    const ev: MemoryLedgerEvent = {
      eventId: "m1", memoryId: "m1", childId: "child-a", familyId: "family-a", status: "approved",
      fact: "Shoes picked the night before help.", eventType: "approved", source: "parent",
      retention: "3 months", createdAt: new Date().toISOString(), actor: "parent",
    } as MemoryLedgerEvent;
    const store: MemoryStore = { listEvents: vi.fn(async () => [ev]), appendEvent: vi.fn(async () => {}), eraseChild: async () => 0 };
    const ctx = await assembleSpokenContext({
      memoryStore: store, childProfile: { id: "child-a", name: "Noa", age: 4 }, contextChildId: "child-a",
      canReadMemory: true, recentTurns: [{ role: "parent", text: "That helped yesterday." }],
    });
    expect(ctx.approvedMemory).toContain("Shoes picked the night before help.");
    expect(ctx.recentTurns.length).toBeGreaterThan(0);
  });

  it("neither spoken key says voice carries less memory than typing (en + he)", () => {
    for (const dict of [elevationEn, elevationHe] as Record<string, string>[]) {
      for (const key of ["elev.coachcontract.uses.spoken", "elev.coachcontract.uses.spokenLive"]) {
        const v = dict[key];
        expect(v, key).toBeTruthy();
        for (const neg of SPOKEN_NEGATIONS) expect(v, `${key} contains "${neg}"`).not.toContain(neg);
      }
    }
  });

  it("both keys name approved memory and recent turns; the Live line says 'without names'", () => {
    const en = elevationEn as Record<string, string>;
    const he = elevationHe as Record<string, string>;
    for (const key of ["elev.coachcontract.uses.spoken", "elev.coachcontract.uses.spokenLive"]) {
      expect(en[key]).toMatch(/memory facts you approved/);
      expect(en[key]).toMatch(/recent turns/);
      expect(he[key]).toMatch(/עובדות הזיכרון שאישרתם/);
    }
    expect(en["elev.coachcontract.uses.spokenLive"]).toMatch(/without names/);
    expect(he["elev.coachcontract.uses.spokenLive"]).toMatch(/ללא שמות/);
  });

  it("the CoachTab render-site comment no longer repeats the false claim", () => {
    expect(coachSrc).not.toMatch(/carries neither the\s+\/\/\s+approved memory facts nor earlier turns/);
    expect(coachSrc).not.toMatch(/carries neither the approved memory/);
  });
});
