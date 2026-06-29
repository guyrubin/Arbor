# design-sync NOTES — Arbor "Soft Daylight" UI kit

Repo-specific gotchas for future syncs of `src/components/ui/` → claude.ai/design.

## Source shape & entry
- This is an **app**, not a published component library → **synth-entry mode** via a hand-authored entry: `.design-sync/ds-entry.tsx` (explicit re-exports of the 34 kit components; `default as` for default-only `HeroCrest`/`HubTabs`). Run `package-build` with `--entry ./.design-sync/ds-entry.tsx`. Do NOT rely on the converter's `export *` synth — it drops default exports and risks app-wide name collisions.
- `HeroAvatar`/`useHeroAvatar` are **excluded** (`componentSrcMap.HeroAvatar: null`) — they read `ArborContext`. Every other `ui/` export is context-free.

## Styling / CSS
- `cssEntry` = `.design-sync/arbor-compiled.css`. This is a **generated** copy of the app's Vite build output (`dist/assets/index-*.css`, content-hashed) with Arbor's Google-Fonts `@import` **prepended** (the build strips it). Regenerate on every re-sync:
  1. `DISABLE_HMR=true npm run build`
  2. copy `dist/assets/*.css` → `.design-sync/arbor-compiled.css`
  3. prepend line 1 of `src/index.css` (the `@import url('https://fonts.googleapis.com/...')`).
- Fonts load at runtime via that remote `@import` → `[FONT_REMOTE]` (Heebo, Frank Ruhl Libre, Fraunces, Nunito). **Known render warn — legitimate.** Not yet in the @import: `Assistant` (RTL) — falls back; add `&family=Assistant:wght@400..800` if Hebrew previews are added.

## Tone vocabularies (authoring-critical — these are NOT interchangeable)
- **kit.tsx / PASTEL** (props `tone` on `Chip`, `IconBadge`, `PageHeader`(n/a), `SectionCard`, `TrustSafetyBar`): ONLY `mint | coral | lav | yellow | pink | sky`. **No `peach`, no `clay`** — `PASTEL[tone]` is undefined for those → throws `reading 'soft'` → blank card.
- **playkit.tsx / PlayTone** (props `tone` on `PlayButton`, `ChoiceTile`, `ProgressPips`, `StatBubble`, `MascotSay`?): `clay | lav | sky | yellow | pink | peach`. **No `mint`, no `coral`.**
- `Button`: `variant` = `primary | secondary | ghost`; `size` = `sm | md`.

## Preview authoring conventions
- Import components from `"arbor-private-beta-app"`; icons from `"lucide-react"`. Relative/`@/` imports also resolve.
- White-card components (`Card`, `SectionCard`, `EmptyState`, kit panels) render on a **white** harness → wrap each export in a paper-bg div: `style={{background:"var(--arbor-paper)"|"var(--arbor-paper-elevated)", padding:24, borderRadius:24}}` so the card reads.
- Use real Arbor parenting/child-development content, never `foo`/`test`.

## Build/perf gotchas (this machine)
- The preview esbuild compile (story-imports plugin chain) is **slow and highly variable: 15–120s per single component**, almost certainly Windows Defender scanning each spawned esbuild process. Use a **180s timeout + 1 retry** per `preview-rebuild`.
- **`buildPreviews` (multiple previews in one process) HANGS** — the plugin chain deadlocks on the 2nd+ esbuild `build()` in a single Node process. Therefore:
  - **`package-build` only runs cleanly with authored previews moved ASIDE** (0 authored → bundle + floor cards + anchor).
  - Compile authored previews **one component per `preview-rebuild` process** (each patches `_ds_sync.json`). Never run `package-build`/`resync` with authored previews present.
  - `package-capture` and `package-validate` use chromium (not esbuild) → **batching many components is fine**.
- Playwright: cache has chromium 1179/1223; install `playwright@1.53.2` (pins 1179) in `.ds-sync` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.

## Re-sync risks
- `arbor-compiled.css` is gitignored & regenerated — if skipped, `cssEntry` points at a stale/missing file. Always regenerate (3 steps above) before build.
- The slow/hanging esbuild behavior means the **standard `resync.mjs` driver will hang** (its build step = package-build over authored previews). Re-syncs must use the manual sequence: build-without-authored → per-component `preview-rebuild` → batched capture → validate.
- Tone-vocab mismatches render BLANK silently (caught only by capture) — always capture + eyeball after authoring.

## Floor-carded (context-bound)
- `PlayHeader`, `Celebrate` render `HeroAvatar` which reads `ArborContext` (`useArbor` throws without `ArborProvider`). The provider mounts Firebase/network state, so wrapping all previews is unsafe — these two ship the floor card. To author them later, add a sandbox `ArborProvider` via `cfg.provider` and verify it mounts offline.
- `PlayShell` live render is correct (verified via headless probe: real content, opacity 1) but its static capture catches the outer `motion.div` entrance animation (opacity 0→1) mid-flight → blank thumbnail. The claude.ai/design DS pane renders the live html, so the card shows content; only the grading screenshot is affected. Graded good.
