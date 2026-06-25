# Arbor 2035 reskin — migration source of truth

These token files are the **target** look for porting the live React app to the
sapphire-blue "Arbor 2035" prototype. Canonical source: the claude.ai/design
project **"Arbor Design System"** (`c3ac103a-78d1-43e3-9db9-656917e3f802`),
`tokens/*.css` + `styles.css`. `colors.css` here is the real delta (sapphire +
glass + blue-tinted shadows). typography/spacing/base/play are structurally the
same as the live app's `src/index.css` sections — adapt those in place.

## The change in one line
Live app primary `--arbor-clay` is **green `#34b277`**; the 2035 target is
**sapphire `#58a6ff`** with glassmorphic gradient surfaces and blue-tinted shadows.

## Key token deltas (live → 2035)
- `--arbor-clay`            `#34b277`  → `#58a6ff`
- `--arbor-clay-deep`       `#2a9c66`  → `#1f6feb`
- `--arbor-clay-dim/-soft/-glow` green rgba → sapphire rgba `(88,166,255,…)`
- surfaces: flat/near-white → **gradient + glass** (`--arbor-paper`, `-elevated`, `-deep`)
- `--arbor-rule/-rule-strong`: green-tinted → sapphire-tinted
- shadows: green-neutral → **blue-tinted** (`rgba(88,166,255,…)`); add `--shadow-xl`, `--arbor-clay-glow`
- new: `--glass-blur: blur(12px)`, `--glass-border`, jewel accents peach/lav/yellow/pink/sky each with `-soft/-ink/-glow`
- type + radii + HE/RTL font swap: unchanged (Fraunces/Nunito; Frank Ruhl Libre/Heebo)

## Why this is not a token-only swap
The app has ~344 hardcoded hex literals (override-hack styling), incl. 34× green
`#3cc081`. Swapping `:root` tokens alone leaves those green. Full reskin = migrate
hardcoded hex → tokens screen-by-screen so they inherit the sapphire palette.
Do it at ZERO functional regression on a live child-data app.
