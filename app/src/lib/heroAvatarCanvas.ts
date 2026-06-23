/**
 * Hero Avatar Canvas — AP-050
 *
 * The single shared module that composites a backdrop template with the child's
 * saved stylized avatar and produces a branded PNG for any surface. The
 * compositing implementation lives exclusively in lib/shareCard.ts (renderShareCard).
 * Adding a new surface means adding a new HeroTemplate entry here — zero new
 * compositing code.
 *
 * Design constraints (from AP-050 spec):
 *   - Zero new child-data capture. Input is always the already-saved avatar
 *     data URL; no new ASR/photo/voice/observation surface, no new write path,
 *     no new egress.
 *   - C2PA/SynthID preserved: the avatar data URL passes through as-is to
 *     renderShareCard → canvas → PNG blob. No re-encode, no re-generation.
 *   - A new surface = a new template entry only. No new compositing logic.
 *   - Migrated legacy surfaces (story / comic) produce call-args identical to
 *     their pre-migration invocations. Proved by heroAvatarCanvas.test.ts.
 */

import { renderShareCard, type ShareCardOpts, type RenderedCard } from "./shareCard";
import type { LoopArtifact } from "./loopEvents";

// ── Template registry ─────────────────────────────────────────────────────────

/**
 * A HeroTemplate maps a named surface to the (artifact, opts-resolver) pair
 * that renderShareCard expects. Opts come from the caller; the template fixes
 * only the artifact routing so every surface funnels through one compositing
 * implementation.
 */
export type HeroTemplate =
  | "story"          // Academy: story beat scene — legacy surface (was: renderShareCard("story", opts))
  | "comic"          // Academy: comic cover/panel — legacy surface (was: renderShareCard("story", opts))
  | "hero_card"      // NEW: shareable hero portrait card
  | "practice_stamp" // NEW: Practice Studio session-completion stamp
  | "milestone";     // NEW: Milestone celebration card

/**
 * Per-template artifact routing. The template selects the LoopArtifact that
 * determines which visual layout renderShareCard uses. No compositing code lives
 * here — only the routing decision.
 */
const TEMPLATE_ARTIFACT: Record<HeroTemplate, LoopArtifact> = {
  story:          "story",
  comic:          "story",
  hero_card:      "avatar",
  practice_stamp: "growth_card",
  milestone:      "growth_card",
};

// ── Public API ────────────────────────────────────────────────────────────────

export type HeroAvatarCanvasOpts = {
  /** The saved stylized hero avatar data-URL. Passes through to renderShareCard
   *  without re-encoding so C2PA/SynthID metadata is preserved. Required for all
   *  avatar-composited surfaces; omit only for text-only cards. */
  imageUrl?: string;
  /** Child first name shown on the card. */
  name?: string;
  age?: number;
  /** story / comic: the story or adventure title. */
  title?: string;
  /** story / comic: short takeaway line. */
  takeaway?: string;
  /** practice_stamp / milestone: headline (large line). */
  headline?: string;
  /** practice_stamp / milestone: sub-line. */
  sub?: string;
};

/**
 * Composite a hero avatar with the named backdrop template and return a branded
 * PNG data-URL + Blob.
 *
 * This is the ONLY entry point that application surfaces should call. The
 * compositing implementation is shared (renderShareCard in lib/shareCard.ts).
 * Add a new surface by extending HeroTemplate — do not duplicate compositing
 * logic.
 *
 * C2PA/SynthID: imageUrl is forwarded verbatim. Callers must pass the saved
 * avatar data URL exactly as stored — do not re-encode before calling here.
 */
export function renderHeroAvatarCanvas(
  template: HeroTemplate,
  opts: HeroAvatarCanvasOpts,
): Promise<RenderedCard> {
  const artifact = TEMPLATE_ARTIFACT[template];
  const cardOpts: ShareCardOpts = {
    imageUrl: opts.imageUrl,
    name:     opts.name,
    age:      opts.age,
    title:    opts.title,
    takeaway: opts.takeaway,
    headline: opts.headline,
    sub:      opts.sub,
  };
  return renderShareCard(artifact, cardOpts);
}

/**
 * Convenience: render and trigger a browser download.
 * Used by new surfaces that offer a "Save" action without the full share sheet.
 */
export async function downloadHeroAvatarCanvas(
  template: HeroTemplate,
  opts: HeroAvatarCanvasOpts,
  filename?: string,
): Promise<void> {
  const { dataUrl } = await renderHeroAvatarCanvas(template, opts);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename ?? `${(opts.name || "hero").toLowerCase()}-arbor-${template}.png`;
  a.click();
}

// ── Legacy surface migration helpers ─────────────────────────────────────────
// These wrappers give story/comic surfaces a named entry point whose call args
// are provably identical to the pre-migration direct renderShareCard calls.
// The identity is asserted in heroAvatarCanvas.test.ts.

/**
 * Story surface (HeroJourneyTab / HeroScenePlayer share action).
 *
 * Pre-migration call: renderShareCard("story", { imageUrl, name, title, takeaway })
 * Post-migration:     renderHeroAvatarCanvas("story",  { imageUrl, name, title, takeaway })
 *   → resolves to:   renderShareCard("story", { imageUrl, name, title, takeaway })
 * Identity is byte-for-byte equivalent — same artifact, same opts, same canvas.
 */
export function renderStoryCanvas(opts: {
  imageUrl?: string;
  name?: string;
  title?: string;
  takeaway?: string;
}): Promise<RenderedCard> {
  return renderHeroAvatarCanvas("story", opts);
}

/**
 * Comic surface (ComicReader share action).
 *
 * Pre-migration call: renderShareCard("story", { imageUrl, name, title })
 * Post-migration:     renderHeroAvatarCanvas("comic",  { imageUrl, name, title })
 *   → resolves to:   renderShareCard("story", { imageUrl, name, title })
 * Identity is byte-for-byte equivalent — same artifact ("story"), same opts.
 */
export function renderComicCanvas(opts: {
  imageUrl?: string;
  name?: string;
  title?: string;
}): Promise<RenderedCard> {
  return renderHeroAvatarCanvas("comic", opts);
}

// ── New surface helpers (AP-050 AC3) ──────────────────────────────────────────
// Each helper is a named, tested entry point for one of the three new surfaces.
// They call renderHeroAvatarCanvas with the correct template — zero new compositing
// code. "Wired" status documented below each helper.

/**
 * Hero Card surface — the shareable/downloadable branded portrait card.
 *
 * Wiring status: FULL COMPONENT RENDER — lib/heroCard.ts#downloadHeroCard routes
 * through this helper, and downloadHeroCard is called from AvatarCreator.tsx when
 * the parent chooses to download the generated avatar. The compositing path is
 * hero_card → renderShareCard("avatar", opts) → renderAvatarCard — identical to
 * the pre-AP-050 renderShareCard("avatar", opts) direct call in heroCard.ts.
 */
export function renderHeroCardCanvas(opts: {
  imageUrl?: string;
  name?: string;
  age?: number;
}): Promise<RenderedCard> {
  return renderHeroAvatarCanvas("hero_card", opts);
}

/**
 * Practice Studio stamp — a branded growth card shown when a child completes a
 * practice session or pack.
 *
 * Wiring status: FULL COMPONENT RENDER — MimicStudioTab.tsx imports and calls
 * downloadPracticeStampCanvas from its pack-complete Celebrate beat ("Save stamp"
 * button). The compositing path is practice_stamp → renderShareCard("growth_card",
 * opts) → renderGrowthCard.
 */
export function renderPracticeStampCanvas(opts: {
  imageUrl?: string;
  name?: string;
  headline?: string;
  sub?: string;
}): Promise<RenderedCard> {
  return renderHeroAvatarCanvas("practice_stamp", opts);
}

/** Convenience download for the Practice Stamp surface. */
export function downloadPracticeStampCanvas(
  opts: { imageUrl?: string; name?: string; headline?: string; sub?: string },
  filename?: string,
): Promise<void> {
  return downloadHeroAvatarCanvas(
    "practice_stamp",
    opts,
    filename ?? `${(opts.name || "hero").toLowerCase()}-arbor-practice-stamp.png`,
  );
}

/**
 * Milestone celebration card — shown when a child reaches a developmental milestone.
 *
 * Wiring status: TESTED HELPER — renderMilestoneCanvas is exported and tested.
 * It is not yet wired into a live component render path because the milestone
 * celebration UI (MilestonesTab.tsx) is owned by arbor-memory and the minimal
 * wiring point is a cross-boundary touch. The helper is ready for that pod to
 * import and call; the compositing path is milestone → renderShareCard("growth_card",
 * opts) → renderGrowthCard.
 */
export function renderMilestoneCanvas(opts: {
  imageUrl?: string;
  name?: string;
  headline?: string;
  sub?: string;
}): Promise<RenderedCard> {
  return renderHeroAvatarCanvas("milestone", opts);
}
