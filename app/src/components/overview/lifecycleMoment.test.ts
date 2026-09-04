import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveTodayModules, todayModulePriority } from "./todayModules";
import { LIFECYCLE_STICKY_KINDS } from "./useLifecycleMoment";
import { resolveLifecycle } from "../../lib/lifecycle";
import { en as lifecycleEn } from "../../lib/i18nElevation/lifecycle";

/**
 * Wave E surface acceptance — the lifecycle module on Today (ENG-09, ENG-L0/L1/
 * L2/L3/L5, ENG-20).
 *
 * The vitest env is node-only, so the render-shape checks are SOURCE scans in
 * the house pattern. Two rules apply to every scan here, because both have bitten
 * this repo:
 *   · CRLF. Every file is normalised to \n before scanning — a source scan that
 *     silently returns "" on CRLF passes vacuously and proves nothing.
 *   · Every extraction is guarded with toBeTruthy() before it is asserted on,
 *     and every ban carries a NEGATIVE CONTROL built from the pre-change shape,
 *     so the scan is proven to catch what it claims to catch.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");

/** Read + normalise line endings. A CRLF checkout must not neuter a scan. */
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8").replace(/\r\n/g, "\n");
}
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const overviewRaw = read("components/tabs/OverviewTab.tsx");
const cardRaw = read("components/overview/LifecycleMomentCard.tsx");
const hookRaw = read("components/overview/useLifecycleMoment.ts");
const overview = stripComments(overviewRaw);
const card = stripComments(cardRaw);
const hook = stripComments(hookRaw);

describe("the scans actually read the files they claim to", () => {
  it("every source is non-empty after normalisation and comment-stripping", () => {
    for (const [name, src] of [
      ["OverviewTab.tsx", overview],
      ["LifecycleMomentCard.tsx", card],
      ["useLifecycleMoment.ts", hook],
    ] as const) {
      expect(src, `${name} extracted empty — the scan would pass vacuously`).toBeTruthy();
      expect(src.length, name).toBeGreaterThan(500);
    }
    // And no CR survived: a scan written against \n would otherwise miss.
    expect(overview.includes("\r")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ENG-09 — the module is genuinely MOUNTED, and inside the Rule-A budget
   ═══════════════════════════════════════════════════════════════════════════ */
describe("ENG-09 — the lifecycle module is wired into Today", () => {
  it("NEGATIVE CONTROL: the pre-change OverviewTab had none of this", () => {
    // The shipped file before Wave E: a module plan with no lifecycle want.
    const before = [
      "  const modulePlan = useMemo(",
      "    () => resolveTodayModules(",
      "      {",
      "        since: isReturning && sinceBase.rows.length > 0,",
      "        rail: railWould,",
      "      },",
    ].join("\n");
    expect(before).toBeTruthy();
    expect(before).not.toMatch(/lifecycle/);
    expect(before).not.toMatch(/<LifecycleMomentCard/);
    // The same scans applied to the current file must therefore find them.
    expect(overview).toMatch(/lifecycle/);
  });

  it("mounts the card and the hook", () => {
    expect(overview).toMatch(/import LifecycleMomentCard from "\.\.\/overview\/LifecycleMomentCard"/);
    expect(overview).toMatch(/useLifecycleMoment\(\{ previousVisitAt \}\)/);
    expect((overview.match(/<LifecycleMomentCard/g) ?? []).length).toBe(1);
  });

  it("feeds the budget the module's REAL render condition, not a proxy", () => {
    expect(overview).toMatch(/lifecycle:\s*lifecycleMoment\s*!==\s*null/);
    expect(overview).toMatch(/showLifecycle\s*=\s*modulePlan\.visible\.has\("lifecycle"\)/);
    expect(overview).toMatch(/\{showLifecycle && lifecycleMoment && \(/);
  });

  it("mounts useLastVisit exactly once — the hook WRITES, so twice is a double stamp", () => {
    expect((overview.match(/useLastVisit\(/g) ?? []).length).toBe(1);
    // The lifecycle hook is handed the value, never allowed to re-derive it.
    expect(hook).not.toMatch(/useLastVisit/);
  });

  it("renders AFTER the day's action (P1-A) and BEFORE the since-strip", () => {
    const anchor = overview.indexOf("lg:grid-cols-[1.85fr_0.85fr]");
    const lifecycle = overview.indexOf("<LifecycleMomentCard");
    const since = overview.indexOf("<SinceLastVisit");
    expect(anchor).toBeGreaterThan(-1);
    expect(lifecycle).toBeGreaterThan(anchor);
    expect(since).toBeGreaterThan(lifecycle);
  });

  it("the budget ranks it directly below the anchor, in both orders", () => {
    for (const noticedCanFold of [false, true]) {
      const order = todayModulePriority({ noticedCanFold });
      expect(order[0]).toBe("anchor");
      expect(order[1]).toBe("lifecycle");
    }
  });

  it("Rule A holds: a lifecycle moment never pushes Today past five modules", () => {
    const plan = resolveTodayModules(
      { lifecycle: true, since: true, noticed: true, narrative: true, rail: true, play: true },
      { noticedCanFold: true },
    );
    expect(plan.visible.size).toBeLessThanOrEqual(5);
    expect(plan.visible.has("lifecycle")).toBe(true);
  });

  it("day-0 with no data stays bare — the card cannot be the thing that breaks it", () => {
    // The resolver cannot produce a moment before the first capture, so the
    // want is false and the day-0 shape (header + capture + action + rail) holds.
    const plan = resolveTodayModules({ lifecycle: false, rail: true });
    expect([...plan.visible].sort()).toEqual(["anchor", "rail"]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The card: counts only, tokens only, RTL, 44px, every string through t()
   ═══════════════════════════════════════════════════════════════════════════ */
describe("LifecycleMomentCard — clinical firewall and house style", () => {
  it("NEGATIVE CONTROL: the scans catch the shapes they ban", () => {
    const scored = 'style={{ color: pct >= 70 ? "var(--arbor-clay)" : "var(--arbor-yellow-ink)" }}';
    const hex = 'style={{ background: "#f4f1ea" }}';
    const raw = "<h2>Welcome back</h2>";
    expect(scored).toMatch(/(?:pct|score|percent|accuracy)\s*>=\s*\d+\s*\?/);
    expect(hex).toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(raw).toMatch(/<h2>[A-Za-z]/);
    // The real file must match none of them.
    expect(card).not.toMatch(/(?:pct|score|percent|accuracy)\s*>=\s*\d+\s*\?/);
  });

  it("renders no percentage, score, ring or verdict tag", () => {
    for (const banned of [/\bpercent\b/i, /\bscore\b/i, /ProgressRing/, /\btoFixed\(/, /%\s*[<{]/]) {
      expect(card, `banned primitive ${banned}`).not.toMatch(banned);
    }
  });

  it("the accent is chosen by moment KIND, never by a value (no chromatic verdict)", () => {
    expect(card).toMatch(/const KIND_STYLE: Record<LifecycleMomentKind/);
    expect(card).toMatch(/const style = KIND_STYLE\[moment\.kind\]/);
    // A threshold-coloured branch is the exact shape the tree-wide firewall bans.
    expect(card).not.toMatch(/\?\s*"var\(--arbor-[\w-]+\)"\s*:\s*"var\(--arbor-[\w-]+\)"\s*\}/);
  });

  it("the only numbers it renders are the resolver's three counts", () => {
    expect(card).toMatch(/moment\.counts\.total/);
    expect(card).toMatch(/moment\.counts\.week/);
    expect(card).toMatch(/moment\.counts\.noticed/);
    // `daysAway` is not even in scope here — the card cannot leak the gap.
    expect(card).not.toMatch(/daysAway/);
  });

  it("token-only colour: no hex literal, no rgba (the ratchet)", () => {
    expect(card).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(card).not.toMatch(/rgba\(/);
    expect((card.match(/var\(--arbor-/g) ?? []).length).toBeGreaterThan(10);
  });

  it("RTL-safe and reachable: logical properties, mirrored chevrons, 44px targets", () => {
    expect(card).not.toMatch(/\b(?:ml|mr|pl|pr)-\d/);
    expect(card).toMatch(/rtl:-scale-x-100/);
    const buttons = (card.match(/<button/g) ?? []).length;
    const targets = (card.match(/min-h-\[44px\]|h-11/g) ?? []).length;
    expect(buttons).toBeGreaterThan(0);
    expect(targets).toBeGreaterThanOrEqual(buttons);
  });

  it("every user-visible string goes through t() — no inline copy, no HE ternary", () => {
    expect(card).not.toMatch(/uiLang\s*===\s*"he"\s*\?/);
    expect(card).not.toMatch(/>[A-Za-z][A-Za-z ']{4,}</);
    expect(card).toMatch(/t\(`elev\.lifecycle\.\$\{k\}\.title`/);
  });

  it("uses only icon names that exist in the shipped font subset", () => {
    const subset = new Set(
      fs
        .readFileSync(
          path.join(SRC_ROOT, "..", "public", "fonts", "material-symbols-rounded-subset.icons.txt"),
          "utf8",
        )
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    );
    expect(subset.size).toBeGreaterThan(100);
    // Every literal the card hands to <Icon> — the KIND_STYLE table plus the
    // inline `name="…"` props.
    const used = [
      ...[...cardRaw.matchAll(/icon:\s*"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]),
      ...[...cardRaw.matchAll(/<Icon\s+name="([a-z][a-z0-9_]*)"/g)].map((m) => m[1]),
    ];
    expect(used.length, "no icon names extracted — the scan would pass vacuously").toBeGreaterThan(8);
    // A name outside the shipped subset renders as its own English ligature —
    // "cake" as the word cake, in the middle of a Hebrew parent's screen.
    const missing = used.filter((n) => !subset.has(n));
    expect(missing, `icon names outside the shipped subset: ${missing.join(", ")}`).toEqual([]);
    // NEGATIVE CONTROL: a name the subset genuinely lacks would be caught.
    expect(subset.has("rocket_launch_not_a_real_subset_entry")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ENG-L2 — the ask writes the real field, through the real sanitiser
   ═══════════════════════════════════════════════════════════════════════════ */
describe("ENG-L2 — the interests capture is wired to the field that already works", () => {
  it("writes interests[] + the timestamp through the profile seam", () => {
    expect(hook).toMatch(/updateChild\(childId, \{/);
    expect(hook).toMatch(/interests: cleaned/);
    expect(hook).toMatch(/interestsUpdatedAt: new Date\(now\)\.toISOString\(\)/);
  });

  it("every token passes the shared CI-29 sanitiser (never a hand-rolled filter)", () => {
    expect(hook).toMatch(/import \{ sanitizeInterestToken \} from "\.\.\/\.\.\/playbank\/select"/);
    expect(hook).toMatch(/sanitizeInterestToken\(v\)/);
  });

  it("the ask STAYS until it is answered; announcements retire after one render", () => {
    expect([...LIFECYCLE_STICKY_KINDS]).toEqual(["interest-ask"]);
    expect(hook).toMatch(
      /if \(!LIFECYCLE_STICKY_KINDS\.has\(momentKind\)\) markLifecycleSeen\(childId, momentKey\)/,
    );
  });

  it("the card offers curated chips from the EXISTING shared interest keys", () => {
    expect(card).toMatch(/"interest\.trains"/);
    expect(card).not.toMatch(/const SUGGESTION_LABELS[^=]*=\s*\[\s*"Trains"/);
  });

  it("claims only what is true: interests reach PLAY selection, not the coach prompts", () => {
    // AI-21/ENG-17: `interests` is collected but still not instructed into the
    // coach prompt. Copy that promised otherwise would be a lie on the surface.
    expect(lifecycleEn["elev.lifecycle.loves.body"]).toBeTruthy();
    expect(lifecycleEn["elev.lifecycle.loves.body"]).not.toMatch(/\bcoach\b/i);
    expect(lifecycleEn["elev.lifecycle.loves.saved"]).not.toMatch(/\bcoach\b/i);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The cascade this hook must not have
   ═══════════════════════════════════════════════════════════════════════════ */
describe("one open burns ONE moment, never the whole queue", () => {
  const armed = {
    onboardingCompletedAt: new Date(2026, 7, 28, 8).toISOString(),
    previousVisitAt: new Date(2026, 7, 1, 9).toISOString(),
    birthDate: "2022-09-04",
    band: "early-school",
    recordedBand: "preschool",
    interestCount: 0,
    totalMoments: 9,
    weekMoments: 0,
    noticedMilestones: 3,
    now: new Date(2026, 8, 4, 9).getTime(),
  };

  it("NEGATIVE CONTROL: a LIVE seen-set would burn every waiting moment in one pass", () => {
    // This is exactly what happens if the ledger feeding the resolver updates
    // when a moment is marked seen: the resolver yields the next one, the same
    // effect retires it, and the parent silently loses the lot.
    const live: string[] = [];
    for (let i = 0; i < 8; i++) {
      const m = resolveLifecycle({ ...armed, seen: [...live] }).moment;
      if (!m) break;
      live.push(m.key);
    }
    expect(live.length).toBeGreaterThan(1);
  });

  it("a FROZEN seen-set yields the same single moment however often it re-resolves", () => {
    const frozen: readonly string[] = [];
    const keys = new Set<string>();
    for (let i = 0; i < 8; i++) keys.add(resolveLifecycle({ ...armed, seen: frozen }).moment!.key);
    expect([...keys]).toHaveLength(1);
  });

  it("the hook freezes the ledger for the mount and never re-reads it into state", () => {
    // A ref pinned to the child id, read once — not useState + setLedger.
    expect(hook).toMatch(/ledgerRef\s*=\s*useRef</);
    expect(hook).toMatch(/ledgerRef\.current\?\.id !== childId/);
    expect(hook).not.toMatch(/setLedger\(/);
    // What hides the acted-on card is local state, not a re-resolve.
    expect(hook).toMatch(/const moment = settled \? null : state\.moment/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   No push, no email, no local notification — anywhere in this feature
   ═══════════════════════════════════════════════════════════════════════════ */
describe("in-app only — nothing here schedules or sends", () => {
  it("NEGATIVE CONTROL: the scan catches a scheduled-notification wiring", () => {
    const wouldBe = [
      'import { LocalNotifications } from "@capacitor/local-notifications";',
      "await LocalNotifications.schedule({ notifications: [{ id: 1 }] });",
    ].join("\n");
    expect(wouldBe).toMatch(/@capacitor\/local-notifications|LocalNotifications|\.schedule\(/);
  });

  it("no lifecycle file imports a notification, push or mail path", () => {
    for (const [name, src] of [
      ["card", card],
      ["hook", hook],
      ["spine", stripComments(read("lib/lifecycle.ts"))],
      ["ledger", stripComments(read("lib/lifecycleState.ts"))],
    ] as const) {
      for (const banned of [
        /@capacitor\/local-notifications/,
        /LocalNotifications/,
        /from "[^"]*\/push"/,
        /RESEND_API_KEY/,
        /\bsendMail\b|\bsendEmail\b/,
      ]) {
        expect(src, `${name} must not reach for ${banned}`).not.toMatch(banned);
      }
    }
  });

  it("the package still has no local-notifications dependency (nothing was added)", () => {
    const pkg = JSON.parse(read("../package.json")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies).toBeTruthy();
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain("@capacitor/local-notifications");
  });
});
