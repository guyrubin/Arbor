/**
 * ENG-L4 — the day-30 keepsake is WIRED, offered once, and carries no invented
 * commercial claim.
 *
 * This repo's recurring failure mode is capability BUILT and never reached, so
 * the value of this item is in the seams: the card must derive its numbers from
 * the closed first-month window rather than from the three resolver counts, it
 * must reuse the existing share pipeline rather than mint a second one, it must
 * mint no device key of its own, and it must appear once.
 *
 * It also pins the half that was deliberately NOT built. ENG-L4 is "first-month
 * keepsake + honest Plus value moment"; the value moment needs a benefit
 * statement and a price position that are the product owner's to make, so the
 * seam is left empty and this file fails if commercial copy appears in it
 * without that decision. A future author who lands owner-approved pricing copy
 * is expected to update PRICING_SEAM_BANS in the same change — the guard is a
 * decision gate, not a permanent prohibition.
 *
 * Scan discipline (this repo has been bitten by vacuous scans):
 *  · \r\n normalised and comments STRIPPED before any regex runs, so a mention
 *    in a doc comment is never mistaken for a call;
 *  · every extraction is asserted non-empty and anchored on known code;
 *  · every rule carries a NEGATIVE CONTROL in the shape it bans.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { LIFECYCLE_STICKY_KINDS } from "./useLifecycleMoment";
import { childScopedKey, isChildScopedKey } from "../../lib/childLocalState";
import { LIFECYCLE_NAMESPACE } from "../../lib/lifecycleState";
import { en as l4En, he as l4He } from "../../lib/i18nElevation/firstMonth";

const SRC_ROOT = path.resolve(__dirname, "..", "..");

const read = (rel: string) =>
  fs.readFileSync(path.join(SRC_ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CARD_RAW = read("components/overview/LifecycleMomentCard.tsx");
const CARD = stripComments(CARD_RAW);
const HOOK = stripComments(read("components/overview/useLifecycleMoment.ts"));
const SPINE = stripComments(read("lib/lifecycle.ts"));

/** The first-month JSX branch only — anchored on two real markers. */
const BRANCH_START = CARD.indexOf("isMonth ? (");
const BRANCH_END = CARD.indexOf("<>", BRANCH_START);
const MONTH_BRANCH = BRANCH_START >= 0 && BRANCH_END > BRANCH_START ? CARD.slice(BRANCH_START, BRANCH_END) : "";

describe("the sources were actually read", () => {
  it("every scanned file carries real code after normalisation and stripping", () => {
    expect(CARD.length).toBeGreaterThan(4_000);
    expect(CARD).toContain("export default function LifecycleMomentCard");
    expect(HOOK.length).toBeGreaterThan(2_000);
    expect(SPINE.length).toBeGreaterThan(2_000);
    expect(CARD.includes("\r")).toBe(false);
  });

  it("the first-month branch was extracted, not silently empty", () => {
    expect(BRANCH_START, "isMonth branch not found in the card").toBeGreaterThan(-1);
    expect(MONTH_BRANCH.length).toBeGreaterThan(800);
    expect(MONTH_BRANCH).toContain('data-testid="l4-month-lines"');
  });
});

/* ── The numbers ──────────────────────────────────────────────────────────── */

describe("the card derives the month's OWN numbers, from the closed window", () => {
  it("reads the shared derivation module, not local arithmetic", () => {
    expect(CARD).toContain('from "../../lib/firstMonthKeepsake"');
    expect(CARD).toContain("buildFirstMonthKeepsake({");
    expect(CARD).toMatch(/onboardingCompletedAt: childProfile\.onboardingCompletedAt/);
    // Both capture streams, or the count would silently omit completed play.
    expect(CARD).toMatch(/behaviorLogs\.map\(\(l\) => l\.timestamp\)/);
    expect(CARD).toMatch(/playLogs\.map\(\(p\) => p\.timestamp\)/);
  });

  it("renders NONE of the three resolver counts on this card", () => {
    // counts.week is a rolling seven-day figure that falls in a quiet week;
    // counts.noticed is band-windowed and falls when the child ages into a new
    // band — thirty days is long enough for that to happen. Either one under
    // "your first month" is a falling number about a child.
    for (const banned of ["counts.week", "counts.noticed", "counts.total", "moment.counts"]) {
      expect(MONTH_BRANCH, `the first-month branch must not render ${banned}`).not.toContain(banned);
    }
  });

  it("NEGATIVE CONTROL — the shape this rule bans, and the card that still uses it", () => {
    const wouldBe = '<div>{moment.counts.noticed}</div>';
    expect(wouldBe).toContain("counts.noticed");
    // The assertion above is not vacuous: the OTHER branch legitimately renders
    // all three, so "not in the month branch" is a real restriction.
    expect(CARD).toContain("moment.counts.noticed");
    expect(CARD).toContain("moment.counts.week");
  });

  it("renders no percentage, ratio, ring or bar off the two counts", () => {
    for (const banned of [/percent/i, /Math\.round/, /toFixed\(/, /<progress/, /strokeDasharray/, /momentsKept\s*\/\s*/]) {
      expect(MONTH_BRANCH, `banned primitive ${banned}`).not.toMatch(banned);
    }
  });

  it("picks its copy by the window's tone, never by a threshold on the child", () => {
    expect(CARD).toMatch(/monthKeepsake\.tone === "kept"/);
    expect(CARD).toContain('t("elev.l4.quiet")');
    // Plural forms are explicit keys, not string surgery on a count.
    expect(CARD).toContain('t("elev.l4.moments.one")');
    expect(CARD).toContain('t("elev.l4.days.one")');
  });
});

/* ── The keepsake itself ──────────────────────────────────────────────────── */

describe("the keepsake REUSES the existing share pipeline, correctly captioned", () => {
  const share = MONTH_BRANCH.match(/<ShareButton[\s\S]*?\/>/)?.[0] ?? "";

  it("the mount was extracted", () => {
    expect(share.length).toBeGreaterThan(150);
  });

  it("is a growth_card through ShareButton — no second render path was built", () => {
    expect(share).toContain('artifact="growth_card"');
    expect(share).toContain('surface="l4_first_month"');
    expect(share).toContain("getCardOpts");
    // renderShareCard is reached through ShareButton/lib/share, never directly.
    expect(CARD).not.toContain("renderShareCard");
  });

  it("declares its caption explicitly — the fallback would claim a month of PROGRESS", () => {
    expect(share).toContain('captionKey="elev.l4.share.caption"');
  });

  it("is offered only when there is something to make a card OF", () => {
    // An empty window has no keepsake in it. The parent still gets the warm
    // line and the way in to what they kept — just not a card of nothing.
    expect(MONTH_BRANCH).toMatch(/\{monthKeepsake\.tone === "kept" && \(\s*<span data-testid="l4-keepsake-share">/);
  });

  it("NEGATIVE CONTROL — a growth_card mount with no captionKey is the defect", () => {
    const wouldBe = '<ShareButton artifact="growth_card" surface="l4_first_month" />';
    expect(/captionKey=/.test(wouldBe)).toBe(false);
    expect(l4En["elev.l4.share.caption"]).not.toMatch(/progress/i);
  });
});

/* ── Once, and only once ──────────────────────────────────────────────────── */

describe("one appearance, dismissible, never re-offered", () => {
  it("is an ANNOUNCEMENT: it retires the first time it renders", () => {
    expect(LIFECYCLE_STICKY_KINDS.has("first-month")).toBe(false);
    expect(HOOK).toMatch(
      /if \(!LIFECYCLE_STICKY_KINDS\.has\(momentKind\)\) markLifecycleSeen\(childId, momentKey\)/,
    );
  });

  it("NEGATIVE CONTROL — a sticky kind would come back on every open until acted on", () => {
    // The set is not empty, so "first-month is not in it" is a real statement.
    expect(LIFECYCLE_STICKY_KINDS.size).toBeGreaterThan(0);
    expect(LIFECYCLE_STICKY_KINDS.has("interest-ask")).toBe(true);
  });

  it("the spine offers it under a once-ever occurrence key", () => {
    expect(SPINE).toContain('offer("first-month", "first-month")');
    // Not keyed by year, month or day — those recur by construction.
    expect(SPINE).not.toMatch(/offer\("first-month", `[^`]*\$\{/);
  });

  it("the shared dismiss X covers it — no second dismissal path was invented", () => {
    expect(CARD).toContain('data-testid="lifecycle-dismiss"');
    expect(MONTH_BRANCH).not.toContain("onDismiss");
  });
});

/* ── Device-local state ───────────────────────────────────────────────────── */

describe("no new device key — and the key it does ride on is swept on child deletion", () => {
  const KID = "kid-l4-sentinel";

  it("the card and the derivation mint NO arbor.* key of their own", () => {
    const derivation = stripComments(read("lib/firstMonthKeepsake.ts"));
    expect(derivation.length).toBeGreaterThan(400);
    for (const [name, src] of [["card", CARD], ["derivation", derivation]] as const) {
      expect(src, `${name} must not mint a device key`).not.toMatch(/["'`]arbor\./);
      expect(src, `${name} must not touch storage directly`).not.toMatch(/localStorage|sessionStorage/);
    }
  });

  it("being offered once is the lifecycle ledger's key, which IS swept", () => {
    const key = childScopedKey(LIFECYCLE_NAMESPACE, KID);
    expect(key).toBe(`arbor.${LIFECYCLE_NAMESPACE}.${KID}`);
    expect(isChildScopedKey(key, KID), `${key} would survive child deletion`).toBe(true);
  });

  it("NEGATIVE CONTROL — the leak shape five keys have already escaped through", () => {
    // A per-variant suffix glued on after the child id. If this ever starts
    // passing, the sweep has been widened past a segment match.
    expect(isChildScopedKey(`arbor.l4.first.month.seen${KID}`, KID)).toBe(false);
    expect(isChildScopedKey(`arbor-l4-${KID}-seen`, KID)).toBe(false);
    // A sibling whose id merely shares a prefix is never swept either.
    expect(isChildScopedKey(`arbor.${LIFECYCLE_NAMESPACE}.${KID}-2`, KID)).toBe(false);
  });
});

/* ── The half that was deliberately not built ─────────────────────────────── */

/**
 * Commercial vocabulary. ENG-L4's second half ("honest Plus value moment")
 * needs a benefit statement and a price position that only the product owner
 * can set; until then the seam in LifecycleMomentCard stays empty rather than
 * carrying an invented claim about what Arbor is worth.
 *
 * When that decision lands, the copy belongs in i18nElevation/firstMonth.ts
 * under `elev.l4.plus.*` and this list is updated in the SAME change. Deleting
 * it to make an unapproved upsell pass is the failure it exists to catch.
 */
const PRICING_SEAM_BANS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "plan", re: /\bplus\b|\bpro\b|\bpremium\b|\bpaywall\b|\bfree plan\b/i },
  { id: "commerce", re: /\bupgrade\b|\bsubscri\w+|\bcheckout\b|\bpurchase\b|\bbilling\b|\btrial\b|\bunlock\b/i },
  { id: "price", re: /[€$₪]\s?\d|\bper month\b|\b\d+\.\d\d\b|\bpricing\b/i },
  { id: "he-commerce", re: /מנוי|לשדרג|שדרוג|תשלום|בתשלום|חינם/ },
];

describe("the pricing half is genuinely absent — no placeholder, no teaser", () => {
  it("NEGATIVE CONTROL: the ban list catches the upsell that would be written here", () => {
    const wouldBe = [
      '<button>{t("elev.l4.plus.cta")}</button> // Upgrade to Plus',
      "Arbor Plus is €12.99 per month",
      "Unlock your full first month with a free trial",
      "שדרגו למנוי בתשלום",
    ];
    for (const s of wouldBe) {
      expect(PRICING_SEAM_BANS.some((r) => r.re.test(s)), s).toBe(true);
    }
  });

  it("no commercial control is mounted in the first-month branch", () => {
    const hits = PRICING_SEAM_BANS.filter((r) => r.re.test(MONTH_BRANCH)).map((r) => r.id);
    expect(hits, "an unapproved commercial claim reached the day-30 card").toEqual([]);
  });

  it("no ENG-L4 string in either language carries a commercial claim", () => {
    const hits: string[] = [];
    for (const dict of [l4En, l4He]) {
      for (const [key, value] of Object.entries(dict)) {
        for (const rule of PRICING_SEAM_BANS) {
          if (rule.re.test(value)) hits.push(`${key} [${rule.id}]: ${value}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("the seam is NAMED in the source, so the gap is visible to the next reader", () => {
    // The comment is stripped from every scan above; this asserts on the raw
    // file, because a silent gap is indistinguishable from an oversight.
    expect(CARD_RAW).toContain("DELIBERATELY UNBUILT");
    expect(CARD_RAW).toMatch(/honest Plus value moment/);
  });
});
