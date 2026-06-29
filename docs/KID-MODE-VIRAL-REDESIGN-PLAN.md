# Arbor Kid Mode — Viral Redesign Plan

> Produced 2026-06-29 via a 7-agent design+build workflow (5 specialist lenses → child-safety/clinical-firewall critic → synthesis). Target = the "Hi Mia!" personalized kid-dashboard mockup. Driving logic (Guy): **maximize avatar usage × maximize set-theme usage**, engaging at a **viral** level, inside Arbor's clinical firewall. Prod-promote is Guy-gated (Level 3); this plan produces green branches, not a deploy.

## 1. The thesis

Arbor's kid mode becomes viral the same way the best storybooks do: the child is the hero of every page. We already own the two engines that make this possible without a rewrite — an **avatar engine** (`renderHeroAvatarCanvas` composites the ONE saved `comicAvatarUrl` into any backdrop through a single shared compositor, so "another surface" costs one template entry, not new pixels) and a latent **theme/world engine** (the worlds scattered across `heroJourneys.ts`, `heroComics.ts`, and `HeroArcade.tsx`'s `WORLDS[]`, waiting to be lifted into one registry). Multiplying *avatar × themes* is the cheapest content multiplier in the codebase: the same hero rendered into N themed scenes = N personalized, cached, C2PA-preserving surfaces with **zero new child-data capture**. The result is a personalized kid OS where every tile shows *your* hero in *your* world — and crucially, this is engineered to be viral **by construction inside the clinical firewall**: earned-not-bought progression, deterministic unlocks, a bounded daily quest, and a share loop that is exclusively the **parent's** decision.

## 2. Target vs. reality

| | Live `KidModeOverlay` today | Target dashboard |
|---|---|---|
| Entry surface | Plain full-screen overlay, "Kid Mode" header + 3 flat tabs | Personalized home: greeting + quest + adventures + games |
| Personalization | None at the shell level | Child avatar portrait + "Hi {name}!" top-of-fold |
| Hero moment | None | "TODAY'S QUEST" full-bleed avatar-in-scene banner |
| Navigation | 3 tabs (Story Quests / Hero Arcade / Feelings) | 4 art-tile "growth adventures" + 8-tile games grid |
| Progression | None visible | Star counter + per-game Level badges |
| Art | Surfaces render their own internals unchanged | Consistent Pixar/storybook avatar-in-theme across ~13 surfaces |

**The gap is a shell, not the surfaces.** The overlay already imports `HeroJourneyTab` / `PracticeHubTab` / `FeelingsLabTab` unchanged and already ships the parent-gated hold-to-exit (`HoldExitButton`, `parentGate.ts`), focus-trap, and Escape-block. We keep all of that verbatim and insert a new `KidDashboard` *above* the three surfaces as the default view. Every adventure/game tile is a navigation entry that mounts the existing surface — **re-shell, never rewrite.**

## 3. The two engines

### 3a. Avatar-everywhere engine

**Strategy: the template registry is the only lever we pull.** `lib/heroAvatarCanvas.ts` already encodes the contract "adding a surface = adding one `HeroTemplate` entry, zero new compositing code." We extend the `HeroTemplate` union + `TEMPLATE_ARTIFACT` map with the dashboard surfaces — `quest_banner`, `adventure_playbank`, `adventure_hero`, `adventure_feelings`, `adventure_studio`, `game_tile` — routing each to an existing artifact layout (`growth_card` / `avatar`). Named helpers (`renderQuestBannerCanvas`, `renderAdventureTileCanvas`, `renderGameTileCanvas`) mirror the existing `renderPracticeStampCanvas` pattern.

**Canvas vs AI-gen — the decisive call (resolves the Art/Avatar/Theme lenses vs the cost critic):** v1 ships the **canvas-composite path as the default** — the saved avatar drawn over a small set of pre-vetted themed backdrops via `renderShareCard`. This is ~50ms, zero per-tile network cost, no fresh per-child generative content to safety-review, and still fully avatar-max + theme-max. **Live per-scene AI generation is a Guy-gated upgrade**, not the v1 baseline (see §9). The lenses that proposed up-to-13 AI renders per entry were optimizing the *ceiling*; the safe *floor* is canvas-composite, with AI as an opt-in tier behind the existing `sceneCache` throttle.

**The render ladder (one reusable `SceneArt` component, codifying the never-block rule):**
1. **Tier 0 (synchronous, first paint):** the theme's `--arbor-{accent}-soft` token gradient, instant, never grey.
2. **Tier 1 (async):** the canvas composite (or, if AI-gen is enabled, the cached AI scene) cross-fades in at ~220ms opacity when resolved.
3. Generation is gated to near-viewport via `IntersectionObserver`; resolution flows through `lib/sceneCache.ts` (`resolveScene`, LRU 24, `MAX_CONCURRENT=2`, in-flight dedupe). Above-the-fold (banner + 4 adventures) pre-warm on mount; the 8 games lazy-generate on scroll.

**Caching:** `sceneCache` is **memory-only by design** — the localStorage path was removed because multi-MB data URLs blow the 5MB quota and break Firebase Auth/preferences writes. **Never persist scene PNGs to localStorage.** Cross-session scene persistence remains the deferred, Guy-gated Firebase Storage layer.

**Sprout fallback + zero-capture/C2PA:** When `useHeroAvatar()` returns `hasHero=false`, `HeroAvatar` already falls back to ArborMascot (Sprout) — every tile is warm, never blank, never blocking on generation. The avatar `imageUrl` (`comicAvatarUrl`) is forwarded **verbatim** through the compositor, preserving C2PA/SynthID on the original. (Caveat: a canvas composite is a *new* PNG via `toDataURL` and does **not** inherit the original's C2PA — fine for in-app display, but any externally-shared artifact must use the provenance-carrying path.) Character identity is consistent **by construction**: we generate *backdrops*, never the child — the same `comicAvatarUrl` draws in all surfaces, enforced by an identity test mirroring `heroAvatarCanvas.test.ts`.

### 3b. Theme/world engine

**The keystone: one `lib/kidThemes.ts` registry** that the scattered worlds map *into* (not a rewrite of them). Shape:

```ts
type KidTheme = {
  id: WorldId;
  title: string; titleHe: string;
  blurb: string; blurbHe: string;
  accent: 'clay' | 'sky' | 'lav' | 'peach' | 'green';   // existing index.css token ramp
  backdropTemplate: HeroTemplate;                         // canvas scene slug
  scenePromptSlug: string;                                // future AI-gen key
  surface: 'journeys' | 'arcade' | 'feelings' | 'studio'; // which existing tab it routes to
  unlock: { kind: 'default' | 'pack-progress' | 'seasonal'; packId?: HeroPackId; threshold?: number };
  collectible: boolean;
};
```

**Accent + world composition:** `accent` maps to the existing `--arbor-{family}` / `-soft` / `-ink` / `-glow` ramp already in `index.css` — token-only, no hex. A tile self-styles from `themeVars(theme.accent)`. Re-skinning the whole dashboard for a chosen world reuses the **proven `data-theme` mechanism from `lib/theme.ts` (AP-052)**: an `applyWorldTheme(worldId, el)` sets `data-world="<id>"` on the **`.arbor-play` dashboard root only** — never `<html>`, so it can never bleed into the parent clinical dashboard (honors the parent-vs-kid firewall).

**Seeding:** migrate `HeroArcade.tsx`'s `WORLDS[]` (which already carries `imagePrompt` + `WorldColor` + the avatar-compositing `WorldScene`) out to the registry as a **pure data lift** preserving world ids/counts, and fold the 5 `heroJourneys.ts` PACKS (courage/responsibility/growth/wisdom/truth) in as the collectible "hero worlds."

**How it multiplies avatar reuse:** the 4 adventure tiles and 8 game tiles become a `KID_THEMES.filter(...)` map. Adding a theme = one data row = one more avatar surface for free. Five worlds × the surfaces turns one avatar into ~20 distinct scenes — the cheapest possible content multiplier, all cached, all C2PA-preserving on the source.

## 4. The dashboard, screen by screen

Single vertical scroll, `max-inline-size: 1100px` centered, scoped under the existing `.arbor-play` wash (its `::before` radial blobs of lav/sky/clay/peach on mint base **already are** the storybook-meets-comic register — do not invent a new visual language).

**Greeting header.** Round `HeroAvatar` (size 72, existing conic-gradient ring, Sprout fallback for free) at inline-start; "Hi {name}!" in `var(--font-display)` weight 900; "You're doing amazing today!" sub-line (a *fixed warm greeting*, never a streak number). At inline-end: a star-count pill and the existing `HoldExitButton` relabeled **"Back to parent"** (3s gate kept verbatim). Star numeral count-ups once on mount via rAF (~600ms), `prefers-reduced-motion` snaps to total. RTL-safe via `marginInlineEnd: auto` push.

**Today's Quest banner.** Full-bleed rounded hero card, the single highest-impact surface. Art = avatar composited into the day's themed scene (e.g. building a glowing blanket-fort calm corner) via `SceneArt`; first paint = the accent token gradient + skeleton shimmer, PNG cross-fades in. Eyebrow "TODAY'S QUEST", title + one-line description, a `2/4` progress bar reusing `.power-fill` (striped, animated, reduced-motion-guarded), and a warm CTA "Let's go!" using `background: var(--arbor-peach)` (token, not hex). **Bounded by construction:** exactly one quest/day, deterministically seeded by `date+childId` over the already-saved vetted activity pool (reuse `DailyPlayTab` selection — no new write path), with an explicit "Quest complete — see you tomorrow" terminal state. No refill, no countdown, no "X left today."

**My growth adventures (4 tiles).** `KID_THEMES.filter(surface ∈ adventures)`. Each tile = the existing `.world-tile` class (comic-panel + hard offset shadow `--comic-pop` + reduced-motion-safe hover lift/tilt). Full-bleed avatar-in-scene art behind a `linear-gradient` scrim (`transparent → color-mix(--arbor-{accent}-ink)`) carrying the title + sub-line at AA contrast. Grid `repeat(auto-fit, minmax(220px,1fr))` → 4-up / 2×2 / 1-up. Tap routes `setActiveSurface(theme.surface)` into the existing tab. Playbank=green, Hero Stories=clay, Feelings=lav, Studio=peach.

**Games grid (8 tiles).** `KID_THEMES.filter(surface ∈ games)`. Compact `.world-tile`, small-format avatar art, a "Level N" badge = a pill (`theme.inkVar` on `theme.softVar`, positioned via logical `insetBlockStart`/`insetInlineEnd`). The 8 named games **must map to existing Arcade worlds** (`MemoryMatch→MindVault`, `RhythmHero→BeatKeeper`, `SequenceQuest→PatternPower`, etc.) — tap routes into `PracticeHubTab` at that world. Any mockup game without an existing world is a stub-route, **not a net-new game build** (out of re-shell scope — confirm mapping before wiring). Grid `repeat(auto-fill, minmax(140px,1fr))`; "See all games" → `setActiveSurface('arcade')`.

**Motion notes.** Reuse existing keyframes only: `.world-tile` hover tilt (-0.6deg + lift), `.play-pressable` press scale 0.96, `.play-pop-in` staggered grid entrance (`index*40ms`), `.power-fill` quest bar, the overlay's `AnimatePresence mode=wait` for surface transitions, `.sprout-sparkle` **only** on explicit celebration beats. All under the global `prefers-reduced-motion` guard. **No ambient looping attention-bait, no red badges, no notification dots, no urgency text** — the page has a bottom.

## 5. Viral engagement model

**Surface the existing competence economy — do not build a new points system.** `practice/cosmetics.ts` already encodes the firewall-safe philosophy ("gentle rewards EARNED through development play, never bought, never streak-shamed"). The "12" star counter = a monotonic field (`totalSessions` or unlocked-cosmetic count) read from already-saved `playLogs`; per-game Level = `floor(domainSessions/3)+1`, bucketed read-only. A pure, unit-tested selector (`lib/kidProgress.ts`) computes these — **no new Firestore collection, no new write path.**

**Collectible worlds = discovery, never gacha.** A world's avatar "scene card" unlocks deterministically when the child completes that world's pack progress; locked worlds show an encouraging "keep growing to discover" card (no countdown). Each collected card is the child's hero in a new theme — maximal avatar+theme reuse and a ready parent-share artifact. **Banned and tested-against:** random drops, duplicates-to-trade, pay-to-unlock, time-limited/expiring cards. Cards never disappear.

**The PARENT-mediated share loop (asymmetric by design).** When the child completes a quest / unlocks a world / hits a milestone, the child sees an *on-screen* celebration (one-shot avatar pop + star — never looping, never a timer). The **share affordance is offered only to the parent**, behind the same `parentGate.ts` hold-friction as exit, rendered post-gate or in the parent dashboard. It uses the built share pipeline: `renderMilestoneCanvas` (currently a tested-but-unwired helper — the kid-mode celebration is its natural call site) / `hero_card` → `shareCard.ts` → `share.ts` (`buildShareUrl` with referral code from `referral.ts`). Capped at ≤1 prompt/session, dismissable-forever. The viral artifact is literally the child's avatar — the personalization moat travels with every share.

**BANNED dark-patterns list (rationale):**

| Banned | Rationale |
|---|---|
| **Consecutive-day streaks / "🔥 7 days in a row" titles** | Loss-aversion / streak-anxiety on a child who can't consent. *(Confirmed pre-existing leak — see §8 BLOCKER 1.)* |
| Live-ticking / escalating star counters | Manufactured pressure; ours is a one-shot mount reveal of earned progress. |
| Leaderboards / cross-child comparison | Competence-as-ranking; Levels are labels ("Level 3 explorer"), never compared. |
| Loot-box / random / expiring unlocks | Gambling mechanics; unlocks are deterministic and tied to real progress. |
| Infinite feed / quest refill / "X left today" | Compulsion loop; the quest is one/day with a satisfied end-state, the page has a bottom. |
| Child-facing share buttons | Pushing a child to social; share is exclusively a parent action behind the gate. |
| Notification nagging of the child | `push.ts` is already consent-gated with a no-streak-copy contract; no child-facing notifications added. |

## 6. Component architecture & data model

**Component tree after re-shell:**

```
KidModeOverlay  (motion.div shell + focus-trap + Escape-block + HoldExitButton — UNCHANGED)
└─ KidThemeProvider  (applyWorldTheme on the .arbor-play root only)
   ├─ view==='home'  → KidDashboard
   │   ├─ GreetingHeader   (HeroAvatar + "Hi {name}!" + StarMeter + BackToParent[=HoldExitButton])
   │   ├─ QuestBanner      (SceneArt + .power-fill progress + peach "Let's go!" CTA)
   │   ├─ AdventuresRow    (4× GrowthAdventureTile → SceneArt, route to existing tab)
   │   └─ GamesGrid        (8× GameTile → SceneArt + Level badge, "See all games")
   └─ view===surfaceId → SurfaceShell  (back-chevron + lazy <HeroJourneyTab|PracticeHubTab|FeelingsLabTab|GameComp/> VERBATIM)
```

**Re-shelling the existing surfaces:** `KidModeOverlay`'s `activeSurface` state becomes a `view: 'home' | KidSurface` router. Default = `'home'` (replace the existing reset-to-`'journeys'` effect). The header tabs become secondary nav; tiles call `setView(...)`. The 3 tabs and games are lazy-imported into `SurfaceShell` and rendered **unchanged**.

**Shared primitives:**
- `lib/kidThemes.ts` — the theme registry (§3b).
- `lib/heroAvatarCanvas.ts` — extended `HeroTemplate` union + render helpers (§3a).
- `components/kidmode/SceneArt.tsx` — the render-ladder component enforcing never-block + Sprout fallback + C2PA pass-through in one place.
- `lib/kidProgress.ts` — pure star/level selectors over `playLogs` **+** local persistence for quest-of-day / unlocked-theme / chosen-world state.

**Minimal data additions within zero-capture:** all new state (quest progress, unlocked themes, chosen world) persists to **`localStorage` only**, keyed by `childProfile.id` (the `lib/theme.ts` pattern), storing **only small JSON** (numbers/ids — never image data URLs). This adds nothing to `childData.ts#CHILD_SUBCOLLECTIONS`, makes no Firestore write, and keeps the `kidMode.test.ts` no-egress contract green. Cross-device sync stays the deferred Guy-gated Firebase path. The star/level numbers are *derived* from already-saved `playLogs` — no new capture.

## 7. Phased delivery

Each phase = one green branch behind the human-gated prod promote (Guy, Level 3).

| Phase | Branch ships | Contents | Gate |
|---|---|---|---|
| **P0 — Firewall pre-req** | `rel/kidmode/firewall-fix` | Reframe the two `streakDays` cosmetics → monotonic `totalSessions`/`activeDays`, drop "in a row" + 🔥, keep ids/emoji stable; update `cosmetics.test.ts` + `cosmeticEligibility.test.ts`; add guard test "no kidmode surface reads `streakDays`". **Lands BEFORE/WITH the dashboard (PR-blocking).** | Guy L3 |
| **P0 — Visual shell** | `rel/kidmode/shell` | `KidDashboard` + `QuestBanner`/`GrowthAdventureTile`/`GamesGrid`/`GameTile`/`StarMeter` skeletons; overlay `view` router; `HoldExitButton`/focus-trap/Escape untouched; static token gradients (no art yet). | Guy L3 |
| **P1 — Avatar tiles** | `rel/kidmode/avatar` | New `HeroTemplate` entries + render helpers; `SceneArt` render ladder (canvas-composite default, `IntersectionObserver` lazy, `sceneCache` throttle, Sprout fallback); identity test. | Guy L3 |
| **P2 — Theme engine** | `rel/kidmode/themes` | `lib/kidThemes.ts` registry; lift `WORLDS[]` (pure data, ids preserved) + fold in PACKS; `applyWorldTheme` `data-world` on `.arbor-play` root; `WorldPicker` (deterministic unlocks, encouraging locked copy). | Guy L3 |
| **P3 — Quests & stars** | `rel/kidmode/progress` | `lib/kidProgress.ts` (pure selectors + localStorage, no firestore import); bounded daily quest (seeded, terminal state, no refill); star count-up + Level badges; extend `kidMode.test.ts` no-egress assertion to new files. | Guy L3 |
| **P4 — Parent share loop** | `rel/kidmode/share` | Wire `renderMilestoneCanvas` → parent-share queue; share controls gated behind `parentGate.ts`, child-unreachable (tested); ≤1 prompt/session; provenance-honest artifact; referral code baked in. | Guy L3 |

## 8. Safety verdict & guardrails

Critic verdict: **GO-WITH-CHANGES.** The architecture is firewall-safe by construction (parent-gated exit preserved, zero new child-data writes, deterministic unlocks, parent-mediated share). PR-blocking conditions:

- **BLOCKER 1 (confirmed leak — P0):** `cosmetics.ts` ships `steady-title` (3 days in a row) and `devoted-title` ("🔥 7 days in a row") keyed on `streakDays`. The dashboard would amplify this banned streak-anxiety. **Fix lands before/with the dashboard:** reframe to a monotonic non-resettable metric, reword to drop "in a row"/🔥, ids stable. Star counter reads a monotonic field, **never `streakDays`**; guard test enforces it.
- **BLOCKER 2:** "Create your hero" on avatarless tiles must **not** trigger generation from a child tap. The avatarless state stays warm (Sprout + "Your hero is coming soon!"), and the creation CTA routes **through the `parentGate.ts` hold-gate** into a parent-only flow.
- **BLOCKER 3:** Every share control is **child-unreachable** (tested), gated behind `holdComplete`, ≤1 parent prompt/session. Externally-shared artifacts use the **provenance-carrying** path; a re-encoded canvas composite is never presented as the verifiable original. In-app display keeps `imageUrl` pass-through (C2PA intact).
- **CHANGE 1 (quest bounded):** one/day, deterministic seed, terminal "see you tomorrow", no refill/countdown/urgency; fixed vetted catalog, never dynamically generated. Tested.
- **CHANGE 2 (collection = discovery):** deterministic unlocks over saved progress (no `Math.random`, no date-deadline gating); no expiry/trade/purchase. Guard test asserts purity.
- **CHANGE 3 (numerals calm):** one-shot mount count-up (reduced-motion snaps), Levels are labels not rankings, no leaderboards/red badges/"need N more."
- **CHANGE 4 (AI-gen gated):** v1 defaults to **static-backdrop canvas composite**; live per-scene AI is a separate Guy-gated decision behind `sceneCache` (`MAX_CONCURRENT=2`, LRU 24). Never block first paint.
- **CHANGE 5 (no-egress asserted):** `kidProgress.ts` stores only small JSON; extend the contract test so every new kidmode file imports no firebase/firestore symbol and writes nothing to `CHILD_SUBCOLLECTIONS`.

**Clean (keep as-is):** parent-gated hold-to-exit, zero-new-capture posture, C2PA pass-through on the source avatar, avatar identity discipline, consent-gated `push.ts`, re-shell-not-rewrite.

## 9. Open decisions for Guy

1. **"Set themes" interpretation (the biggest scope lever).** Recommended: the 5 unlockable worlds map 1:1 to the `heroJourneys` PACKS (courage/responsibility/growth/wisdom/truth) as the collectible spine, with seasonal worlds layered later as a static date-flagged additive set. Confirm vs. a separate broader biome taxonomy.
2. **AI-gen cost budget (recommend: defer).** v1 ships canvas-composite over pre-vetted static backdrops (zero per-tile latency, bounded cost, no fresh generative content to safety-review). Approve, or fund live per-scene AI behind the `sceneCache` throttle as a v1.1 upgrade?
3. **Unlock model.** Confirm deterministic earned-only unlocks (no purchase, no randomness, no expiry) — and whether parents get a toggle over which worlds/seasonal packs are available.
4. **Star semantics.** Which already-saved field is the "12" — `totalSessions`, count of unlocked cosmetics, or a distinct earned-stars tally? (Must be monotonic, never `streakDays`.)
5. **Games mapping.** Confirm all 8 named games resolve to existing Arcade worlds. Any that don't are stub-routes for v1, not net-new game builds.
6. **Avatar creation gating.** Confirm avatar creation is parent-gated so the "Create your hero" funnel routes through the exit gate rather than dead-ending or triggering generation from inside child-facing kid mode.

---

**Resolved lens conflicts:** (a) *AI-gen volume* — demoted to a Guy-gated upgrade; v1 floor is canvas-composite. (b) *State persistence* — localStorage-only; cross-device sync deferred. (c) *Cosmetics reuse* — adopted **only after** the streak-reframe (BLOCKER 1) lands first (P0). (d) *Worlds registry* — all lenses converge on one `lib/kidThemes.ts` seeded from `HeroArcade.WORLDS[]` + PACKS.

**Key files** (all under `Arbor/app/src/`): `components/kidmode/KidModeOverlay.tsx`, `components/ui/HeroAvatar.tsx`, `lib/heroAvatarCanvas.ts`, `lib/shareCard.ts`, `lib/sceneCache.ts`, `lib/theme.ts`, `practice/cosmetics.ts`, `components/practice/HeroArcade.tsx`, `lib/heroJourneys.ts`, `components/kidmode/kidMode.test.ts`, `components/kidmode/parentGate.ts`. **New:** `lib/kidThemes.ts`, `lib/kidProgress.ts`, `components/kidmode/{KidDashboard,SceneArt,QuestBanner,GrowthAdventureTile,GamesGrid,GameTile,StarMeter,WorldPicker,KidThemeProvider}.tsx`.
