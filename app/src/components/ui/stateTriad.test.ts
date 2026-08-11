/* Masterplan 4.3 — "one state triad" guard suite.
 *
 * Node-env (tokens.test.ts style): pure logic is tested directly, components
 * are rendered with react-dom/server where they are provider-free
 * (EmptyState/GhostBlock), and provider-dependent pieces (SectionSkeleton)
 * plus the migrated surfaces are verified at the source level — the same
 * technique as the SafetyTab/bg-white guards.
 *
 * Locks:
 *  1. EmptyState API stays backwards-compatible (the 3 pre-existing
 *     consumers — AttributionTab, HeroJourneyTab, PlansTab — keep passing
 *     only supported props; tsc is the type gate, this is the drift alarm).
 *  2. The teach-empty upgrade renders: ghost preview (aria-hidden,
 *     non-interactive) + ONE cta button.
 *  3. Skeleton slow-path: watchSkeletonTimeout fires at ~10s, never when
 *     loaded, and cancel disarms it; SectionSkeleton wires retry to the W0
 *     syncStore by default.
 *  4. HeroJourneyTab carries NO bare "Loading…"/"טוען…" literal anymore
 *     (the W-audit i18n violation class stays dead).
 *  5. The migrated surfaces actually use the shared shapes.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyState, GhostBlock } from "./EmptyState";
import { SKELETON_TIMEOUT_MS, watchSkeletonTimeout } from "./Skeleton";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8");
// Drop comments so prose about banned literals can't trip the scans.
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ── 1 · EmptyState: back-compat API + teach-empty upgrade ────────────────── */

describe("EmptyState — backwards-compatible API", () => {
  const source = read("EmptyState.tsx");

  it("still declares every legacy prop (icon/headline/body/action/className)", () => {
    for (const prop of ["icon", "headline", "body", "action", "className"]) {
      expect(source, `legacy prop ${prop} missing from EmptyState`).toMatch(
        new RegExp(`${prop}\\??:`),
      );
    }
  });

  it("adds the teach-empty props (preview/cta/onCta) without removing the default export", () => {
    for (const prop of ["preview", "cta", "onCta"]) {
      expect(source).toMatch(new RegExp(`${prop}\\??:`));
    }
    expect(source).toContain("export default EmptyState");
  });

  it("legacy usage renders byte-compatibly (headline, body, icon, action)", () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        headline: "No events yet",
        body: "Share a tagged link to start measuring.",
        icon: React.createElement("span", null, "icon-node"),
        action: React.createElement("code", null, "utm_source=x"),
      }),
    );
    expect(html).toContain("No events yet");
    expect(html).toContain("Share a tagged link");
    expect(html).toContain("icon-node");
    expect(html).toContain("utm_source=x");
    // No CTA button and no preview wrapper when the new props are omitted.
    expect(html).not.toContain("<button");
  });

  it("teach-empty usage renders a ghosted aria-hidden preview + ONE cta button", () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        headline: "The story starts with one moment",
        preview: React.createElement("div", null, "ghost-day-group"),
        cta: "Log the first moment",
        onCta: () => {},
        ctaTestId: "empty-cta",
      }),
    );
    expect(html).toContain("ghost-day-group");
    expect(html).toContain("aria-hidden");
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("Log the first moment");
    expect(html.match(/<button/g)?.length, "exactly ONE primary action").toBe(1);
    expect(html).toContain('data-testid="empty-cta"');
    // The CTA meets the 44px touch floor.
    expect(html).toContain("min-h-[44px]");
  });

  it("GhostBlock is static (never the pulsing arbor-skeleton class) and decorative", () => {
    const html = renderToStaticMarkup(React.createElement(GhostBlock, { className: "h-3 w-16" }));
    expect(html).toContain("aria-hidden");
    expect(html).toContain("--arbor-paper-deep");
    expect(html).not.toContain("arbor-skeleton");
  });

  it("the 3 pre-existing consumers still import the shared EmptyState", () => {
    for (const rel of ["../tabs/AttributionTab.tsx", "../tabs/HeroJourneyTab.tsx", "../tabs/PlansTab.tsx"]) {
      const src = read(rel);
      expect(src, `${rel} dropped the shared EmptyState import`).toMatch(
        /import \{[^}]*EmptyState[^}]*\} from "\.\.\/ui\/EmptyState"/,
      );
    }
  });
});

/* ── 2 · Skeleton slow path: ~10s timeout → retry ─────────────────────────── */

describe("watchSkeletonTimeout — fake-timer behavior", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires at the ~10s default, not before", () => {
    const onTimeout = vi.fn();
    watchSkeletonTimeout(false, onTimeout);
    vi.advanceTimersByTime(SKELETON_TIMEOUT_MS - 1);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("never fires when the section is already loaded", () => {
    const onTimeout = vi.fn();
    watchSkeletonTimeout(true, onTimeout);
    vi.advanceTimersByTime(SKELETON_TIMEOUT_MS * 3);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("cancel disarms the pending timeout (unmount/reset semantics)", () => {
    const onTimeout = vi.fn();
    const cancel = watchSkeletonTimeout(false, onTimeout, 5000);
    vi.advanceTimersByTime(4999);
    cancel();
    vi.advanceTimersByTime(60_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("honors a custom timeout", () => {
    const onTimeout = vi.fn();
    watchSkeletonTimeout(false, onTimeout, 2000);
    vi.advanceTimersByTime(2000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});

describe("SectionSkeleton + useSkeletonTimeout — wiring (source level)", () => {
  const source = stripComments(read("Skeleton.tsx"));

  it("useSkeletonTimeout wraps the tested timer seam inside an effect", () => {
    expect(source).toContain("watchSkeletonTimeout(loaded,");
    expect(source).toMatch(/useEffect\(/);
  });

  it("SectionSkeleton mimics a section (title line + rows) and localizes via the states module", () => {
    expect(source).toContain("export function SectionSkeleton");
    expect(source).toMatch(/title && <Skeleton/);
    expect(source).toContain('statesText("elev.states.slow"');
    expect(source).toContain('statesText("elev.states.retry"');
  });

  it("retry defaults to the W0 syncStore retrySync and re-arms the timer", () => {
    expect(source).toContain("(onRetry ?? retrySync)()");
    expect(source).toContain("restart()");
    expect(source).toMatch(/import \{ retrySync \} from "\.\.\/\.\.\/lib\/syncStore"/);
  });

  it("the slow row keeps the 44px touch floor", () => {
    expect(source).toContain("min-h-[44px]");
  });
});

/* ── 3 · HeroJourneyTab: the bare Loading… literal class is dead ──────────── */

describe("HeroJourneyTab — loading region migrated", () => {
  const source = stripComments(read("../tabs/HeroJourneyTab.tsx"));

  it('no bare "Loading…" / "טוען…" string literal remains (i18n violation class)', () => {
    expect(source).not.toMatch(/["'`]Loading(…|\.\.\.)["'`]/);
    expect(source).not.toMatch(/["'`]טוען(…|\.\.\.)["'`]/);
  });

  it("library loading renders the shared SectionSkeleton", () => {
    expect(source).toMatch(/import \{ SectionSkeleton \} from "\.\.\/ui\/Skeleton"/);
    expect(source).toContain("<SectionSkeleton");
  });

  it("story-start feedback localizes through the states module", () => {
    expect(source).toContain('statesText("elev.states.hero.opening"');
  });
});

/* ── 4 · Migrated empty surfaces use the shared teach-empty shape ─────────── */

describe("JournalTab — bespoke empty replaced by the shared teach-empty", () => {
  const source = stripComments(read("../tabs/JournalTab.tsx"));

  it("the bespoke journal.empty card is gone; the shared EmptyState renders instead", () => {
    expect(source).not.toContain('t("journal.empty")');
    expect(source).toContain("<EmptyState");
    expect(source).toContain('statesText("elev.states.journal.head"');
    expect(source).toContain('statesText("elev.states.journal.cta"');
  });

  it("the CTA focuses the existing capture bar (no second capture path)", () => {
    expect(source).toContain("data-capture-bar");
    expect(source).toContain("focusCaptureBar");
    expect(source).toContain('ctaTestId="journal-empty-cta"');
  });

  it("the ghost preview is composed from static GhostBlocks", () => {
    expect(source).toMatch(/import \{ EmptyState, GhostBlock \} from "\.\.\/ui\/EmptyState"/);
    expect(source).toContain("<GhostBlock");
  });
});

describe("ComicsTab — teach-empty for the untouched shelf", () => {
  const source = stripComments(read("../tabs/ComicsTab.tsx"));

  it("zero saved books → ghost bookshelf + create-first-comic CTA via the existing openComic path", () => {
    expect(source).toContain("savedCount === 0");
    expect(source).toContain('statesText("elev.states.comics.cta"');
    expect(source).toContain("openComic(shelfAdventures[0].id)");
    expect(source).toContain('ctaTestId="comics-empty-cta"');
    expect(source).toContain("<GhostBlock");
  });
});

describe("PlansTab — EmptyState upgraded to the preview variant", () => {
  const source = stripComments(read("../tabs/PlansTab.tsx"));

  it("keeps plan.empty.* copy, adds ghost preview + input-focusing CTA", () => {
    expect(source).toContain('t("plan.empty.head")');
    expect(source).toContain("preview={");
    expect(source).toContain('statesText("elev.states.plans.cta"');
    expect(source).toContain("focusTopicInput");
    expect(source).toContain('ctaTestId="plans-empty-cta"');
  });

  it("loading uses the shared SectionSkeleton", () => {
    expect(source).toContain("<SectionSkeleton");
  });
});
