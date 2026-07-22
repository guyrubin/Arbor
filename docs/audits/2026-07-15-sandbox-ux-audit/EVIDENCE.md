# Arbor Sandbox UX Audit — Evidence Dossier

Date: 2026-07-15 · Environment: **sandbox mode** (local vite on :4805, `VITE_FIREBASE_*` blanked → synthetic "Sandbox Parent" + seeded child "Dylan · Age 5", localStorage persistence, NO backend `/api` — AI replies and remote data unavailable by design). Auditor: Claude (arbor-product-auditor skill v1.0). Viewport: 1440×900 primary; 390×844 spot-check. Pixel screenshots limited (Browser pane hidden → rAF frozen; structure/text/axe evidence used instead — see Honest scope).

## Interaction manifest (tool-backed, chronological)

| # | Screen | Interaction | Result |
|---|---|---|---|
| M1 | Prod front door (arborparentingapp.com) | Clicked "Continue with Google" ×2 | Popup blocked → friendly error card, NO redirect fallback (code: AuthContext.tsx only `signInWithPopup`) |
| M2 | Today | Clicked hero CTA "Begin" | `arbor.activeTab` → "coach" (state changed; render frozen by hidden-pane rAF — env artifact) |
| M3 | Ask Arbor | Typed real 144-char worried-parent question (bilingual 5yo, teacher concern), clicked Send | Message rendered in thread; API error → BOTH a raw developer error in-thread AND a friendly retry card; follow-up chips rendered despite no answer |
| M4 | Ask Arbor | Reload | Conversation persisted as history chip ✓ |
| M5 | Behaviors | Filled "What triggered this?" + "What was your response?" (React-synthetic), clicked Save log | Entry count 4→5; new entry timestamped, pattern cards updated live ✓ |
| M6 | Journal | Navigated | New behavior log AND coach session both appear in timeline (memory spine works cross-surface ✓) |
| M7 | Care Network | Clicked "Review the summary" | No dialog opened (scroll-anchor?); export gating copy present but export unlock flow not reached |
| M8 | Kid Mode | Launched from parent shell; synthetic .click() on exit | Kid Mode dialog opened; instant click did NOT exit — gate = "Hold to go back to parent" ✓ |
| M9 | Mobile 390×844 | Overflow probe | `scrollWidth - innerWidth = 0` (no page overflow); pill rails scroll ✓ |

## axe-core (4.10.2, wcag2a/2aa/22aa) per hub

| Hub | Violations |
|---|---|
| Today | color-contrast serious ×11 (incl. active sidebar item); label critical ×1 (`input[min="4"]`) |
| Ask Arbor | color-contrast serious ×6 |
| Behaviors | color-contrast ×8; **label critical ×2**; **select-name critical ×4** (filter + form selects) |
| Growth | color-contrast ×6 |
| Journal | color-contrast ×10 |
| Academy | **aria-progressbar-name serious ×14**; color-contrast ×6 |
| Care Network | color-contrast ×8 |
| Profile | color-contrast ×7 |

Recurring contrast target: small `11px whitespace-nowrap` labels (likely `--arbor-faint` on light bg) — one token fix.

## Key captured copy/state per surface (condensed)

**Front door (prod):** "Your child — the hero of the story"; invite-only + Request access; popup-block error card is friendly but dead-ends.

**Today:** onboarding checklist "2 of 4 done"; ONE hero guidance card + Begin ✓; "0 of 133 age-appropriate milestones noticed — Parent observation, not an assessment" ✓; play idea w/ time variants ✓; activity feed = 4 identical generic "Logged a moment" rows (no content preview); mood/sleep/appetite check-in ✓.

**Ask Arbor:** persona header "**Dr. Levi — Online now**" (AI presented with doctor title + human presence signal); scholar lenses (Vygotsky/Bowlby/Winnicott/Montessori/Bronfenbrenner/Piaget/Erikson) ✓; fast-start moment chips ✓; welcome = "non-diagnostic next steps" ✓; trust footer "Parent observations — not a diagnosis · Non-diagnostic guidance · Escalation available" ✓; "Want a human? Ask a specialist" ✓. ERROR STATE: raw in-thread bubble "Connection Error… Reason: Failed to execute 'json' on 'Response'… If this continues, check the Arbor API deployment and model provider configuration" followed by friendly "Arbor couldn't bring you an answer just now. Your question is safe — try again." Suggested-followup chips render as if an answer existed.

**Behaviors:** "Patterns you noticed — to understand, not to judge" ✓; counts-only stats ✓; log form (type/where/intensity/duration/trigger*/response*/notes/photo) ✓; quick-fill scenarios ✓; literal text "**AUTO_AWESOME**" rendered (`.msr` icon span inherits `text-transform:uppercase` → Material ligature breaks — confirmed via computed style); patterns section: "Hard moments cluster at home on Wed." derived from n=2.

**Growth:** "Every milestone you notice is kept — Arbor remembers it" ✓; "a starting point, not a verdict" ✓; CDC/AAP/ASHA anchor ✓; **"Arbor is quietly watching Dylan's development"** (surveillance framing); pill rail shows raw i18n key "**nav.tab.routines**" (key absent from src — dynamic `nav.tab.*` lookup falls back to key); good empty states (measurements).

**Journal:** timeline merges parent logs + coach sessions + Arbor plans ✓; Arbor-generated plan copy uses "Transition **anxiety**…" (clinical-adjacent).

**Academy:** header claims "10 courses · 0 completed · **12 min to next** · Continue the next course" while body says "Our first lessons are in production; here's what's coming" (phantom inventory); learning map + "editorial suggestion, not a diagnostic signal" ✓; inline 4-min Scholar Hub article ✓.

**Care Network:** consent architecture copy exemplary ("Review first — before any copy, download, export, or send action unlocks"; per-item uncheck; "Nothing leaves Arbor until you take the final action"; GDPR/COPPA) ✓; packet renders "**Severe transition anxiety (refusal to leave the house)**" as Current focus (clinical-severity phrasing; source = seeded profile currentFocus rendered as Arbor framing, unattributed); **raw snake_case keys in packet**: "social_development: 0/27", "language_communication: 0/38" etc.; professionals roster "Dr. Maya Levi · Child Psychologist · verified · 4.9★", "Noa Ben-David · SLP · 4.8★", "Dr. Amir Cohen · Pediatrician · 5★" + "Request consult" — **hardcoded fictional people with `verified:true` in `src/services/professionals.ts:24-26` AND duplicated in `components/sections/FindProfessional.tsx:24-26`** (static bundle content, not sandbox-gated seed data).

**Profile:** "The family album that grows itself" ✓; Family Circle + invite ✓; "What Arbor remembers · 0 approved · 0 pending · Review Dylan's memory" (Living Child Memory card EXISTS ✓); development profile w/ languages/school/focus ✓; **"WORTH WATCHING NEXT: Calms when comforted · Smiles at people · Makes sounds other than crying" — infant (2-4mo) milestones shown for age-5 child** (age filter not applied to this widget); "Severe transition anxiety" repeated under "Where to support".

**Kid Mode:** "Hi Dylan! You're doing amazing today"; explicit "Parent locked · Private by default · **Stars, never streaks**" ✓; hero story + Playbank + Feelings + Studio + games (Memory Match, Feelings Detective, Mimic Studio, Sound Explorer, Sequence Quest, Calm B…) — no streaks/timers/leaderboards/share observed ✓; exit = "Hold to go back to parent" (hold gate resisted instant click; no PIN option observed).

**Global:** sidebar icon ligatures NOT aria-hidden → accessible names = "monitoring Behaviors", "eco Growth" etc.; `aria-current="page"` on active hub ✓; 7 unread notifications badge on fresh sandbox boot; app re-persists activeTab on unload (localStorage nav injection loses race — dev-only note).

## Honest scope (NOT covered)

Pixel-level visual/design-consistency judgment (pane hidden → screenshots mostly unavailable); real AI answer quality + answer contract (needs API); billing/paywall surfaces; store/native; RTL/Hebrew + multi-child switcher (sandbox has one EN child); onboarding steps 1-4 as a new user (sandbox boots post-onboarding; demo replay exists per code AP-049); Care Network export unlock end-flow; keyboard-only pass; dark mode; real-data prod authenticated audit (Google popup blocked in pane + password entry not permitted for the agent).
