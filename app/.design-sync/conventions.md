# Arbor "Soft Daylight" design system

Arbor is a calm, warm, clinical-humanist product for parents of young children (0–6) — milestones, speech, behavior, memories, growth. Build with these real components; they carry the brand. Voice: reassuring, plain, never clinical-cold or hype.

## Setup — no provider, token-first
These components need **no theme provider or wrapper** to be styled. They style themselves with Tailwind utilities + inline `var(--arbor-*)` tokens, all defined in the bound `styles.css` (load it once at the app root). Brand fonts load from a remote `@import` inside that stylesheet:
- `var(--font-display)` → **Fraunces** (serif) for headings/numbers
- `var(--font-sans)` → **Nunito** (rounded sans) for body — this is the default UI font

The app canvas should sit on `var(--arbor-paper)` (a cool off-white), with content on white `var(--arbor-paper-elevated)` cards. Most components assume that paper canvas — put your own layout glue on it.

## Styling idiom — Tailwind utilities + `var(--arbor-*)` tokens
Two complementary tools, both used throughout:
1. **Component props** carry the design language — prefer these over restyling.
2. **Inline `style={{ ... }}` with `var(--arbor-*)`** for your own layout glue (backgrounds, text color, spacing). Use the real token names below; do not hardcode hex.

Token families (all `var(--arbor-…)`):
- Surfaces: `--arbor-paper`, `--arbor-paper-elevated`, `--arbor-paper-deep`, `--arbor-paper-sunk`
- Text/ink: `--arbor-ink`, `--arbor-ink-soft`, `--arbor-muted`, `--arbor-faint`
- Primary (green = trust/growth): `--arbor-clay`, `--arbor-clay-deep`, `--arbor-green-soft`, `--arbor-green-ink`
- Pastel accents, each as base / `-soft` (tint bg) / `-ink` (AA text): `--arbor-peach*`, `--arbor-lav*`, `--arbor-yellow*`, `--arbor-pink*`, `--arbor-sky*`
- Rules: `--arbor-rule`, `--arbor-rule-strong`

## Tone props are component-family-specific — do not mix the sets
Passing a tone outside a component's set renders it BLANK (the lookup is undefined). Use exactly:
- `Button`: `variant="primary|secondary|ghost"`, `size="sm|md"`
- `Badge`: `tone="green|blue|amber|red|neutral"`
- Layout kit (`Chip`, `IconBadge`, `SectionCard`, `TrustSafetyBar`): `tone="mint|coral|lav|yellow|pink|sky"` — **no `peach`/`clay`**
- PlayKit, child-facing (`PlayButton`, `ChoiceTile`, `ProgressPips`, `StatBubble`, `MascotSay`): `tone="clay|lav|sky|yellow|pink|peach"` — **no `mint`/`coral`**

Two registers: **parent surfaces** are calm (kit + primitives, green primary); **child surfaces** are playful (PlayKit, brighter PlayTones, the `ArborMascot`/Sprout). Don't bring playful PlayKit into a parent dashboard or vice-versa.

## Where the truth lives
Read these bound files before styling: `styles.css` (and its `@import`s — tokens + component CSS), each component's `<Name>.d.ts` (exact props) and `<Name>.prompt.md` (usage). The component preview cards show realistic compositions to imitate.

## Idiomatic snippet
```tsx
import { SectionCard, Chip, Button } from "<ds>";
import { Sprout, ArrowRight } from "lucide-react";

<div style={{ background: "var(--arbor-paper)", padding: 24 }}>
  <SectionCard title="This week's growth" tone="mint" icon={<Sprout size={18} />}
    action={<Button variant="ghost" size="sm">View all <ArrowRight size={14} /></Button>}>
    <p style={{ color: "var(--arbor-muted)", fontSize: 13 }}>
      Mia is forming two-word phrases — right on track for 22 months.
    </p>
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <Chip tone="mint">Language ↑</Chip>
      <Chip tone="lav">Motor steady</Chip>
    </div>
  </SectionCard>
</div>
```
