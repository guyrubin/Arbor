# Arbor Product Backlog — Design, UI/UX & IA
**Version:** 2.1 · **Updated:** 2026-06-29 · **Method:** Hermes brand/UX/IA review + 9-agent code analysis + open-PR verification
**Source of truth:** This file. Fed by the `arbor-improve` routine. Build happens only on Guy's go.

This backlog has **two complementary spines** that should be read together:
- **Spine 1 — Hermes Brand/UX/IA Program (P0.1–P3.3):** the conceptual-coherence / brand-language / IA agenda from the Hermes review (`~/arbor_brand_ux_review/`, 2026-06-29). This is the *design system & mental-model* track.
- **Spine 2 — DUX-001…040 feature/retention catalog:** code-grounded feature, retention, and moat-visibility items from the 9-agent audit (below the program tracker). This is the *what-to-build-next* track.

They do not conflict — Spine 1 fixes how the product *hangs together*; Spine 2 adds what the product *does*. Where they touch the same surface (e.g. Settings green-drift), the items cross-reference.

---

## ✅ PR Verification Verdict (2026-06-29) — VERIFIED + FIXES EXECUTED

Two open PRs were verified against the Hermes P0.1/P0.2 acceptance criteria with ground-truth build/test, **then all 8 review fixes were executed on a green branch.** Full report: [`PR-VERIFICATION-2026-06-29.md`](PR-VERIFICATION-2026-06-29.md).

| PR | Implements | Verdict | Note |
|---|---|---|---|
| `arbor-settings-language-canonical` | **P0.1** (one language surface) + **P0.2** (sectioned Settings) | **Ship** | Polish applied (green→neutral chrome; admin isolated; +advanced AI-lang override) |
| `arbor-confirm-p0-waitlist` | Founder email on new lead | **Merge-safe** | 502 decoupled; lead-save now always 200; ops-docs + tests added |

> A static-review "double-ship AddChildModal / stale-base, rebase onto 8c9fd58" alarm was a **phantom** — artifact of local `main` (`8c9fd58`) having diverged from `origin/main` (`e8e56cd`). Neither PR touches child-profile code vs the real base. No rebase needed.

### 🟢 Green deliverable branch: `claude/arbor-pr-fixes` (local, off `origin/main`)
Contains both PRs **+** all 8 fixes below. Verified: `tsc` PASS · **1162 tests pass / 0 fail** (baseline 1158 + 4 new) · `vite build` PASS. **Not pushed** — push + PR + merge are the Guy-gated (Tier-C) steps. The branch is based on `origin/main` (the real base), so it opens a clean PR; do **not** merge it into the divergent local `main`.

---

## Hermes Brand/UX/IA Program — status tracker

The conceptual spine. Core thesis: *the risk is not missing features — it's conceptual sprawl.* Target mental model: **Notice → Understand → Try → Share.**

| ID | Item | Status |
|---|---|---|
| **P0.1** | System Settings = the only language-control surface | ✅ **Done** (PR `arbor-settings-language-canonical`) |
| **P0.2** | Rebuild Settings IA around real system controls (sections) | ✅ **Done** (incl. admin-isolation via SET-ADMIN on `claude/arbor-pr-fixes`) |
| **P0.3** | Remove/reframe parent-editable "Risk level" | 🟡 **Needs your decision** — changes clinician-facing exports + removes a user-facing field; scoped on the keep-field path (see decision below) |
| **P0.4** | Make onboarding completion explicit (`onboardingComplete`) | ✅ **Done** (branch `claude/arbor-hermes-p0`) — explicit flag, legacy-safe `=== false` gate, resume guard, regression test |
| **P0.5** | One reusable trust/consent pattern (what Arbor uses / stores / you control) | ✅ **Done** (branch `claude/arbor-hermes-p0`) — `TrustPanel` + `ReviewBeforeShare`, adopted on Avatar, HE+EN |
| **P1.1** | Define + wire the Notice→Understand→Try→Share loop (one job + one CTA per screen) | ⬜ Open |
| **P1.2** | Make Today the true home base ("What should I do now?", ≤2 actions above fold) | ⬜ Open — overlaps DUX-001/011/012/018 |
| **P1.3** | Complete Hebrew/RTL across hardcoded strings in core flows | ⬜ Open — overlaps DUX-024 |
| **P1.4** | Standardize visual tokens; remove raw-color + sapphire-vs-green drift | ⬜ Open — overlaps DUX-006/008/027 + GREEN-DRIFT below |
| **P1.5** | Improve mobile action hierarchy (bottom nav + contextual FAB) | ⬜ Open — overlaps DUX-003/009/038 |
| **P1.6** | Define + test Kid Mode boundaries (no reports/share/settings/sensitive memory) | ⬜ Open — overlaps DUX-013/035 |
| **P2.1** | Search as rescue: grouped results + parent synonyms (doctor→Consult) | ⬜ Open |
| **P2.2** | Profile editing → calm structured sections + chips | ⬜ Open |
| **P2.3** | First-week empty-state system (every tab: what to do first) | ⬜ Open — overlaps DUX-033 |
| **P2.4** | Differentiate story products (Journey / Bedtime / Comics / Kid quest) | ⬜ Open — overlaps DUX-040 |
| **P2.5** | Separate operator/admin tools from parent Settings | ⬜ Open — overlaps SET-ADMIN |
| **P3.1** | Product analytics taxonomy (`view_/click_/start_/complete_/error_`) | ⬜ Open |
| **P3.2** | Accessibility + reduced-motion polish (focus-visible, dialog focus-trap) | ⬜ Open — overlaps DUX-010 |
| **P3.3** | Design documentation in repo (IA map, token board, trust pattern, Kid spec) | 🟡 Partial — 7 SVG artifacts exist in `~/arbor_brand_ux_review/images/`; not yet in repo |

**Designer artifacts (Hermes, 2026-06-29):** `~/arbor_brand_ux_review/images/` — `01_ia_map.svg`, `02_settings_language_model.svg`, `03_today_wireframe.svg`, `04_trust_pattern.svg`, `05_visual_token_board.svg`, `06_mobile_action_model.svg`, `07_kid_mode_boundaries.svg`. **Action:** copy into `app/docs/design/` to satisfy P3.3.

---

## New items from PR review

Real findings surfaced by the 2026-06-29 PR verification (phantoms excluded). **All 8 executed on `claude/arbor-pr-fixes` (green).**

| ID | Title | Priority | Status |
|---|---|---|---|
| **LANG-ADV-OVERRIDE** | Advanced "use a different language for Arbor responses" row in Settings | P1 | ✅ **Done** — in-Settings toggle + EN/עב picker; `effectiveAiLang` drives save; reuses `set.aiLang.*`. Serves HE-UI/EN-guidance parents. |
| **WAITLIST-DECOUPLE** | Never 502 the parent for a founder-notify failure; best-effort notify | P1 | ✅ **Done** — `notifyWaitlistSafely()`: logs + swallows; lead-save always returns 200. Removes the 502 trap. |
| **SET-ADMIN** | Wrap the 2 `isAdmin` rows in an "Operator" section + route titles through `t()` | P2 | ✅ **Done** — own `<Section>` (admin-only) + `set.admin.*` keys (EN/HE). Closes P0.2 "admin isolated". |
| **GREEN-DRIFT-SETTINGS** | Swap emerald tokens in the new Settings Section chrome → neutral | P2 | ✅ **Done** — Section eyebrow now `--arbor-muted`/`--arbor-faint`, not `--arbor-green-ink`. (Pre-existing Row-icon green deferred to DUX-008 sweep.) |
| **WAITLIST-ROUTE-TESTS** | Tests locking the decouple behavior | P2 | ✅ **Done** — 3 `notifyWaitlistSafely` tests (null no-op / throw-swallow / success). |
| **LANG-DEAD-I18N** | Remove orphaned i18n keys | P3 | ✅ **Done** — dropped `top.language` + `coach.aiLang.label/.en/.he` (EN+HE). `set.aiLang.*` kept (reused by override); `setAiLang` now wired to the override. |
| **WAITLIST-OPS-DOCS** | Document env vars + startup log | P3 | ✅ **Done** — `RESEND_API_KEY`/`WAITLIST_NOTIFY_EMAIL`/`_FROM` in `.env.example` + "enabled/disabled" startup log. |
| **LANG-MIGRATE-SPLIT** | One-time legacy `LS_AI`≠`LS_UI` reconcile | P2 | ⏭️ **Superseded** by LANG-ADV-OVERRIDE — the AI/UI split is now a *visible, controllable* setting, not a hidden bug, so no silent migration is needed. |

---

## Executive Summary

Arbor has a genuine, unmatched product moat: longitudinal child memory, scholar-lens coaching, clinical-grade professional handoff, bilingual RTL, the 0–12 developmental arc, and a GDPR-anchored trust architecture. No single competitor has more than two of these.

**Three execution gaps** stand between the product and its potential:
1. **The moat is hidden** — parents cannot see what Arbor knows about their child on the home screen
2. **The app is pull-only** — Arbor never proactively surfaces patterns; parents must always ask
3. **Critical UX friction** — 4–6 tap log flow, fixed 520px chat viewport, session-volatile comics

**Top 5 by score** (all safe-class, buildable without Tier-C gates):
| Score | ID | Title |
|---|---|---|
| 94 | DUX-001 | Proactive behavior prediction card on Overview |
| 93 | DUX-013 | Kid Mode register firewall in HeroJourneyTab |
| 91 | DUX-002 | Coach session summary auto-saved to Growth Plans |
| 90 | DUX-003 | Quick Log: 2-tap capture with offline queue |
| 88 | DUX-011 | Arbor Noticed card on Overview from timeline |

---

## Design Vision

The Arbor 2035 sapphire glassmorphic brand is specified in 80+ CSS tokens but **only partially executed in the live app.** The chrome (Sidebar, AiRail, InsightRail, MobileNav) renders as flat white because the global `.arbor-app aside` rule actively suppresses backdrop-filter via `!important`. The `--glass-blur: blur(12px)` and `--glass-border` tokens exist but are used nowhere in the layout files. The primary blue diverges between `#58a6ff` (`:root`) and `#2b7fff` (`.arbor-parent`). The type scale has two competing definition blocks and is never referenced by any layout component.

The gap between brand promise and executed product is significant but addressable: remove one `!important` rule, consolidate the type scale, apply glass tokens to the chrome layer, and split the kid/parent surface register firewall. Once connected, the 2035 brand will be the visual reality — it is fully specified, just not yet wired.

---

## IA Gaps

Five structural IA gaps exist:
1. **Ask Arbor has no sidebar entry** — `TAB_SECTION_FALLBACK` maps `coach` to `today`; past conversations are not findable in navigation
2. **Today reconstructs fresh every session** — no "resume" surface for active plans, unsaved coach insights, or in-progress story arcs
3. **Kid Mode entry is invisible from Today** — parents must know to look in the topbar; hand-off during breakfast is not discoverable
4. **Academy conflates child and parent registers** — Story Journeys/Hero Comics (for the child) share a section with Masterclasses/Family Formation (for the parent)
5. **The longitudinal moat is buried in a sub-tab** — `deriveNextStep` (the most intelligent output in the codebase) lives in the Story Timeline, which most parents never visit

---

## UX Wins (protect these)

- **RhythmStrip** — predicted calm/friction/wind-down windows; no equivalent in any competitor → promote to home screen
- **Scholar lens system** — multi-scholar council coaching applied to a specific child's profile; no equivalent anywhere → add discovery in CoachTab
- **Hold-to-exit Kid Mode** — 3-second friction with circular progress ring; correctly communicates "barrier, not lock" → keep exactly as-is
- **Clinical firewall in weekly report** — intensity trend arrows and deficit-framing removed; architecturally correct clinical trust positioning → never revert
- **JITAI nudge system** — just-in-time adaptive interventions timed to the child's rhythm; technically sophisticated, no direct competitor has built this → amplify, don't replace

---

## Scoring Formula

| Dimension | Max pts |
|---|---|
| Purpose alignment (answers one of the 6 north star questions) | 30 |
| User retention impact (brings parents back daily/weekly) | 25 |
| Competitive differentiation (moat-building vs parity) | 20 |
| Implementation feasibility (no Tier-C gates required) | 15 |
| Design quality uplift (premium + sapphire 2035 consistent) | 10 |

**Risk classes:** `safe` = build-ready · `gated-data` = child GDPR · `gated-billing` = RevenueCat/Stripe · `gated-store` = App Store/Play · `gated-ai` = new AI vendor/clinical claim

---

## Backlog

### P0 — Critical (build next)

---

#### DUX-001 · Proactive behavior prediction card on Overview
**Category:** UX · **Surface:** Parent · **Effort:** M · **Score:** 94 · **Risk:** safe

**Problem:** Overview reconstructs fresh each session with no proactive signal. Parents who logged 3 screen-time disputes this week and have an incomplete plan step see a generic "Today's Focus" — not a targeted, data-grounded prediction. Huckleberry's SweetSpot card is the strongest retention driver in the parenting app market and Arbor has no equivalent.

**Solution:** Add a `PredictiveSignalCard` component below the hero guidance card on OverviewTab. Using existing `rhythm/predict.ts` output and the last 14 days of `behaviorLogs`, compute the highest-risk window for today and render: predicted window (e.g. "5–6 PM transition"), the top contributing pattern (e.g. "3 screen disputes, same trigger"), and a one-tap "Get script for tonight" button that pre-seeds the coach. Render only when predict confidence > `'low'`. Collapse to a compact chip when already seen today (sessionStorage flag).

**Serves:** Q2 (is this a pattern?) + Q3 (what to do today?) — converts existing logged data into proactive guidance without any parent input

**Acceptance:**
- [ ] Card appears on Overview when rhythm predict confidence is `'medium'` or `'high'` AND `behaviorLogs` contains >= 2 logs of same type in last 7 days
- [ ] Card is absent for new users with < 5 total logs (no false precision)
- [ ] One-tap CTA pre-populates CoachTab input with behavior type + predicted window + child name
- [ ] Card dismisses for the session after being tapped or explicitly closed
- [ ] Card renders correctly in both EN and HE with RTL layout

**Regression risk:** Low. New component inserted between hero card and dev-map card. No existing state modified. Wrap `rhythm/predict.ts` call in `useEffect`.

---

#### DUX-002 · Coach session summary auto-saved to Growth Plans
**Category:** UX · **Surface:** Parent · **Effort:** M · **Score:** 91 · **Risk:** safe

**Problem:** Ask Arbor conversations end and the parent must re-read the thread to recall any commitment made. The gap between insight and action is the most broken loop in Arbor — coach guidance is excellent but has no structured path to execution. `CoachAnswerCards` already contain `actionableAdvice` and scripts; none of this is persisted anywhere actionable.

**Solution:** After any CoachTab conversation that contains a `CoachAnswerCard` response, render a `SessionSummaryCard` at the end of the chat: what we covered (one sentence), your one commitment (from `actionableAdvice`), the script to use tonight. A single "Save to Plans" button calls `handleGenerateActionPlan` with `topic=commitment` text, bypassing the topic-entry step. Session summary also persisted to the `conversations` subcollection as a special message type so it appears in the thread strip.

**Serves:** Q3 (what to do today?) + Q6 (structure at home) — closes the insight-to-action loop

**Acceptance:**
- [ ] `SessionSummaryCard` renders automatically after any AI reply with `actionableAdvice.length > 0`
- [ ] "Save to Plans" creates a Growth Plan with `title` = first 60 chars of commitment; phase-1 step = script text; navigates to PlansTab
- [ ] Session summary visible in thread strip as distinct "Summary" chip
- [ ] If parent navigates away before saving, Overview shows "Unsaved coach insight" chip for 24h
- [ ] Feature works in both EN and HE; Hebrew plan titles render RTL in PlansTab

**Regression risk:** Medium. `handleGenerateActionPlan` currently requires `planChallengeTopic` state. Accept an optional `topicOverride` param. Existing plan generation flow unchanged.

---

#### DUX-003 · Quick Log: 2-tap behavior capture with offline queue
**Category:** UX · **Surface:** Parent · **Effort:** L · **Score:** 90 · **Risk:** gated-data

**Problem:** BehaviorsTab logging form requires 4–6 taps before a log can be saved. Parents most need to log in the moment of a behavioral incident — in the car, at school pickup, in the grocery store. The form is a desktop tool accessed from a sidebar tab. Every competitor with high retention (Lovevery, Duolingo ABC, Huckleberry) solves high-friction capture at the moment of need.

**Solution:** Add a persistent `QuickLogFAB` (floating action button) on all parent surfaces — bottom-right on desktop, above MobileNav on mobile. Tap opens a bottom sheet (not a modal route): 6 behavior type chips, a voice note button (existing voice-to-log infrastructure), and a photo button. One tap on a chip + optional note = saved. Queues in localStorage `'pendingLogs'` when offline; syncs on reconnect via `useEffect` watching `navigator.onLine`. Logs marked `'quick'` get a lightning-bolt icon in BehaviorsTab list.

**Serves:** Q1 (what is happening?) — captures the raw log that feeds all downstream intelligence; moat input that compounds everything else

**Acceptance:**
- [ ] `QuickLogFAB` visible on all parent-surface tabs (OverviewTab, CoachTab, WeeklyTab, DevelopmentTab) — not in Kid Mode
- [ ] Tap-to-save completes in <= 3 taps total (open sheet → tap type → confirm)
- [ ] Offline: log written to `localStorage.pendingLogs` immediately; toast "Saved offline — will sync when connected"
- [ ] Online sync: `pendingLogs` flushed to Firestore within 5 seconds of reconnect; confirmation toast shown
- [ ] Quick logs appear in BehaviorsTab list with lightning-bolt badge; all form fields except type and timestamp are nullable
- [ ] FAB does not overlap MobileNav on iOS; respects `safe-area-inset-bottom`

**Regression risk:** High. New write path to Firestore outside `BehaviorsTab`'s `handleAddLog`. Must reuse same `behaviorLogs` collection schema and trigger same `ArborContext` refresh. Assign client-side UUID to each quick log; use `setDoc` with `merge:false` to prevent duplicates.

---

#### DUX-011 · Arbor Noticed card on Overview from timeline deriveNextStep
**Category:** IA · **Surface:** Parent · **Effort:** S · **Score:** 88 · **Risk:** safe

**Problem:** The Story Timeline's `deriveNextStep` function already computes a proactive coaching suggestion from momentum state — the most intelligent output in the app. It appears only inside a sub-tab that most parents never visit. The Overview home screen has no "Arbor noticed" signal unless the parent navigates to Grow > Daily Play or My Child > Journey. The moat is hidden inside a sub-section.

**Solution:** Import and call `deriveNextStep` at the OverviewTab level using existing ArborContext (`behaviorLogs`, `milestones`, `actionPlans`). Render the result as an `ArborNoticedCard` (already used in DevelopmentTab) just above the coach card on Overview. When `nextStep` is null or empty (new user, < 5 logs), render nothing. When content is present, show the card with a "See full story" link that navigates to the timeline tab.

**Serves:** Q2 (is this a pattern?) — surfaces the longitudinal intelligence that distinguishes Arbor from every competitor, directly on the home screen

**Acceptance:**
- [ ] `ArborNoticedCard` renders on Overview when `deriveNextStep` returns a non-empty suggestion
- [ ] Card is absent for users with < 5 total behavior logs
- [ ] Card renders above the Coach card section, below the JITAI nudge area
- [ ] "See full story" link navigates to the timeline tab (`setActiveTab('timeline')`)
- [ ] Card text rendered through `t()` system for HE/EN support
- [ ] `deriveNextStep` call is `useMemo`'d on `behaviorLogs` + `milestones` + `actionPlans`

**Regression risk:** Low. `ArborNoticedCard` is production-tested in DevelopmentTab. `deriveNextStep` is pure — no side effects. Wrap in a web worker or debounce for large log sets.

---

#### DUX-013 · Kid Mode register firewall in HeroJourneyTab
**Category:** UX · **Surface:** Kid · **Effort:** M · **Score:** 93 · **Risk:** safe

**Problem:** HeroJourneyTab inside Kid Mode still shows the `parentInsight` block ("For grown-ups · Why this story"), development metric badges ("courage +2"), "Finish & save development" CTA, and the "Talk about it together" reflection checklist — all parent-register clinical content. A child operating Kid Mode independently reads clinical framing immediately after the story's emotional climax.

**Solution:** Add `isKidMode` boolean from `KidModeContext` to `HeroJourneyTab`. Gate all parent-only blocks behind `!isKidMode`: the `parentInsight` div, the `metricsEarned` badge row, the "Finish & save development" button, and the "Talk about it together" checklist. In Kid Mode, replace the reflection beat ending with a child-friendly completion screen: the child's hero avatar at full size, a confetti burst (already imported), and the text "[Name] completed a Journey!" in display font. The development save action still fires silently (Firestore write without the button being visible to the child).

**Serves:** Design quality uplift — the kid surface should feel magical; this is the single most important register correctness fix in the app

**Acceptance:**
- [ ] `parentInsight` block does not render when `isKidMode === true`
- [ ] `metricsEarned` badge chips do not render when `isKidMode === true`
- [ ] "Finish & save development" button does not render when `isKidMode === true`
- [ ] "Talk about it together" checklist does not render when `isKidMode === true`
- [ ] Development save Firestore write still fires automatically on story completion in Kid Mode
- [ ] Kid Mode completion screen shows hero avatar, confetti, and child-readable message
- [ ] All gating uses `KidModeContext` (not a prop) so it works across lazy load boundaries

**Regression risk:** Medium. Automatic save-without-button requires extracting the save action from `onClick` into a `useEffect` that fires when the story reaches the final beat. Verify the save fires exactly once.

---

### P1 — High

---

#### DUX-004 · Developmental domain progress rings on Overview
**Category:** Design · **Surface:** Parent · **Effort:** S · **Score:** 87 · **Risk:** safe

**Problem:** Overview shows richness but not coverage. A parent cannot tell at a glance which developmental domains are active vs. neglected. Kinedu's domain-split progress rings are the most effective retention driver in the developmental tracking market — they create daily pull ("language is at 48%, what can I do today?").

**Solution:** Replace the current dev-map card with a `DomainRingsCard` showing 5 sapphire progress rings (Cognitive, Language, Social-Emotional, Motor, Self-Regulation) using the existing `ProgressRing` component from MilestonesTab. Each ring shows checked/total milestones for the child's current age band in that domain. Tapping a ring deep-links to MilestonesTab with that domain pre-selected. Rings use fade-in stagger animation.

**Serves:** Q4 (what to track over time) — makes the developmental coverage map visible on the home screen

**Acceptance:**
- [ ] 5 rings rendered using `ProgressRing` component; each shows % of age-appropriate milestones checked per domain
- [ ] Domain labels translated via `t()` for EN and HE
- [ ] Tapping any ring navigates to MilestonesTab and sets `activeDomain` to the tapped domain
- [ ] Card renders skeleton state while milestones data is loading
- [ ] When no milestones exist for a domain, ring shows 0% with label "Not started" (not hidden)
- [ ] Layout: 5 rings in a row on desktop, 2+3 grid on mobile

**Regression risk:** Low. Replaces dev-map card. `ProgressRing` is production-tested in MilestonesTab. Reads from existing `milestones` ArborContext state.

---

#### DUX-005 · Pattern-detected inline card after behavior log save
**Category:** UX · **Surface:** Parent · **Effort:** S · **Score:** 86 · **Risk:** safe

**Problem:** After logging a behavior, the parent receives a "Saved" toast and returns to the form. The pattern question (Q2: is this normal or urgent?) is only answered on demand via an "Analyze" button. Parents logging in a stressful moment do not navigate to analysis — they need the signal immediately.

**Solution:** After `handleAddLog` resolves, check if the saved behavior type appears >= 3 times in the last 14 days with the same trigger value. If so, render an inline `PatternDetectedCard` below the form: behavior type + count, the common trigger, and two CTAs — "See pattern analysis" (scrolls to PatternInsights) and "Get a plan" (pre-seeds PlansTab with the behavior type as challenge topic). Card dismisses after either CTA or 30 seconds.

**Serves:** Q2 (is this a pattern?) — delivers the pattern signal at the moment of capture

**Acceptance:**
- [ ] Pattern check runs client-side against ArborContext `behaviorLogs` — no additional API call
- [ ] Threshold: same type AND (same trigger OR same context) within last 14 days, count >= 3
- [ ] Card renders below the behavior form, above the log list, with `var(--arbor-lav-soft)` background
- [ ] Both CTAs work: PatternInsights scrolls into view; PlansTab pre-seeds `planChallengeTopic`
- [ ] Card does not render when count < 3 (no false positives for new users)
- [ ] `role='status'`, `aria-live='polite'` — announced to screen readers

**Regression risk:** Low. Post-save logic appended inside `handleAddLog` callback. No existing state modified.

---

#### DUX-006 · Token type-scale adoption in all layout components
**Category:** Design · **Surface:** Shared · **Effort:** S · **Score:** 82 · **Risk:** safe

**Problem:** Every layout component (Sidebar, AiRail, InsightRail, MobileNav, Shell) uses Tailwind default text classes or hardcoded `text-[Npx]` values. The design token type scale (`--t-xs` through `--t-display`) was built but never adopted by the layout layer. `text-sans` on Shell.tsx line 182 is not a valid Tailwind class and does nothing.

**Solution:** Replace all hardcoded `text-[Npx]` values and Tailwind default `text-*` classes in the 5 layout files with `text-[var(--t-*)]` references: `text-[9.5px]` → `text-[var(--t-caption)]`, `text-[12px]` → `text-[var(--t-xs)]`, etc. Fix `text-sans` → `font-sans` on Shell.tsx line 182. Consolidate the duplicate px/rem type scale blocks in index.css into a single rem-only block.

**Serves:** Design quality uplift — establishes type scale as single source of truth

**Acceptance:**
- [ ] Zero `text-[Npx]` hardcoded values remain in Sidebar, AiRail, InsightRail, MobileNav, Shell
- [ ] Zero Tailwind default `text-sm/text-base/text-xl` classes remain in those files
- [ ] `font-sans` replaces `text-sans` on Shell.tsx line 182
- [ ] `index.css` has exactly one type scale definition block
- [ ] Visual regression: no text size changes visible at current viewport (values must match within 1px)

**Regression risk:** Low. Pure CSS change. Verify Tailwind JIT picks up `text-[var(--t-sm)]` syntax; add to safelist if not.

---

#### DUX-007 · Glass-blur surface applied consistently to sidebar and rails
**Category:** Design · **Surface:** Shared · **Effort:** M · **Score:** 81 · **Risk:** safe

**Problem:** The 2035 glassmorphic brand exists only in token definitions. Sidebar, AiRail, InsightRail, and MobileNav all hardcode `bg-white`. The global `.arbor-app aside { backdrop-filter: none !important }` rule actively suppresses glass in all aside elements. `--glass-blur: blur(12px)` and `--glass-border` tokens are defined but used nowhere in layout files.

**Solution:** Remove the `backdrop-filter: none !important` override from `.arbor-app aside` in index.css. Replace `bg-white` in Sidebar, AiRail, InsightRail with a new utility class `arbor-glass-surface` applying `background: var(--arbor-paper-elevated)`, `backdrop-filter: var(--glass-blur)`, `border-right: var(--glass-border)`. MobileNav gets a softer variant: `rgba(255,255,255,0.85)` + `blur(8px)`. The `.arbor-parent` content area keeps `--glass-blur: none` (clinical flat-white) — only chrome elements get glass.

**Serves:** Design quality uplift — brings the live app in line with the 2035 sapphire brand promise; the biggest gap between brand identity and visible product

**Acceptance:**
- [ ] Sidebar renders as translucent glass surface with visible backdrop blur
- [ ] AiRail and InsightRail render with the same glass treatment
- [ ] MobileNav renders with 85% white + 8px blur on mobile viewports
- [ ] `.arbor-parent` main content area remains flat-white (override preserved)
- [ ] Glass effect degrades gracefully on browsers without `backdrop-filter` support
- [ ] No regression in Topbar (already uses `var(--arbor-paper-deep)` correctly)

**Regression risk:** Medium. Removing `!important` could expose previously suppressed blur on unintended elements. Audit all `aside` elements after change.

---

#### DUX-009 · Mobile active state pill on MobileNav (parity with Sidebar)
**Category:** UX · **Surface:** Shared · **Effort:** XS · **Score:** 79 · **Risk:** safe

**Problem:** MobileNav active item has no visual indicator beyond color change — no background pill, no icon fill change. The desktop Sidebar shows `var(--arbor-clay-dim)` background + inset box-shadow on the active item. On a 6-section bottom tab bar, color-only active state is a weak affordance. MobileNav labels at `text-[9.5px]` are the smallest text in the codebase, below the `--t-caption` minimum.

**Solution:** Add a conditional background pill to the active nav item in MobileNav.tsx: a `rounded-full` div with `background: var(--arbor-clay-dim)`, `width: 48px`, `height: 28px`, centered behind the icon. Add `box-shadow: inset 0 0 0 1px var(--arbor-clay)` at 30% opacity. Mirror the Sidebar active pattern exactly. Change `text-[9.5px]` to `text-[var(--t-caption)]`.

**Acceptance:**
- [ ] Active MobileNav item shows a background pill (`var(--arbor-clay-dim)`) behind the icon
- [ ] Pill transitions smoothly when switching tabs (framer-motion `layoutId` animation)
- [ ] Label text uses `text-[var(--t-caption)]` not `text-[9.5px]`
- [ ] Inactive items have no pill and use `var(--arbor-muted)` for icon + label
- [ ] Touch target for each nav item remains >= 44px height
- [ ] Active state is correct when app restores last active tab from localStorage

**Regression risk:** Low. Style-only change to MobileNav.tsx. Verify `AnimatePresence` wrapper is active for the `layoutId` animation.

---

#### DUX-010 · Inline behavior delete confirmation (replace window.confirm)
**Category:** UX · **Surface:** Parent · **Effort:** XS · **Score:** 78 · **Risk:** safe

**Problem:** BehaviorsTab and MilestonesTab use `window.confirm()` or `window.prompt()` for destructive actions. These are blocking browser-native dialogs that break the sapphire 2035 design system, are blocked in some mobile WebView contexts, and are inaccessible to screen readers.

**Solution:** Replace `window.confirm` on delete with an inline two-step pattern: first tap transitions the Delete button to "Confirm delete?" state (red background, 3-second auto-reset). Second tap fires the delete. Replace `window.prompt` on milestone rename with an inline edit field. No modal, no dialog, no blocking call.

**Acceptance:**
- [ ] No `window.confirm()` or `window.prompt()` calls remain in BehaviorsTab, MilestonesTab, or HandoffTab
- [ ] Log delete: first tap shows "Confirm delete?" with 3-second auto-reset; second tap fires `deleteLog`
- [ ] Milestone rename: title text becomes an `<input>` inline with `onBlur` save and Escape-to-cancel
- [ ] Milestone delete follows same two-tap pattern
- [ ] All delete confirmations are keyboard accessible
- [ ] HandoffTab saved-brief delete also gets the two-tap pattern

**Regression risk:** Low. Localized to 3 files. The 3-second timer must be cleaned up in `useEffect` return.

---

#### DUX-012 · Resume card on Overview for active Growth Plans
**Category:** IA · **Surface:** Parent · **Effort:** S · **Score:** 84 · **Risk:** safe

**Problem:** There is no "pick up where you left off" surface on Overview. A parent who generated a Growth Plan last session has zero visual reminder it exists unless they navigate to Grow > Growth Plans. Every competitor with high session-to-session retention surfaces an active-task resume prompt on the home screen.

**Solution:** Add a `ResumePlanCard` to OverviewTab when: at least one `actionPlan` with `planProgress < 100%` and `updatedAt` within last 14 days. Shows plan title, progress bar, next incomplete step, and a "Continue" button navigating to PlansTab. If multiple active plans, show only the most recently updated.

**Acceptance:**
- [ ] `ResumePlanCard` appears on Overview when `actionPlans` contains a plan with `planProgress < 100` and `updatedAt` within 14 days
- [ ] Card shows plan title, progress bar, and first incomplete step text
- [ ] "Continue" button navigates to PlansTab; target plan is scrolled into view
- [ ] Card is absent when all plans are 100% complete or older than 14 days
- [ ] Card is absent when there are no plans (new users)
- [ ] Multiple active plans: only the most recent by `updatedAt` is surfaced

**Regression risk:** Low. Read-only against existing `actionPlans` state. Extract `planProgress` computation to a shared utility if not already.

---

#### DUX-015 · Coach chat viewport: replace fixed 520px height with dynamic dvh
**Category:** Mobile · **Surface:** Parent · **Effort:** XS · **Score:** 80 · **Risk:** safe

**Problem:** CoachTab's chat viewport is fixed at `h-[520px]`. On iPhone SE (568px total height) with the virtual keyboard open, the chat viewport is crushed — potentially below 200px of visible height. The input bar may be partially or fully obscured. This is the most-used tab in the app and mobile is the primary device.

**Solution:** Replace `h-[520px]` with `min-h-[320px] max-h-[60dvh]`. The `dvh` unit accounts for virtual keyboard viewport reduction in modern iOS/Android browsers. Add `--coach-viewport-min: 320px` in index.css. Add `overscroll-behavior: contain` on the chat scroll container.

**Acceptance:**
- [ ] Chat viewport height is min 320px and max 60dvh at all screen sizes
- [ ] On iPhone SE with virtual keyboard open, at least 280px of chat is visible
- [ ] On desktop 1280px viewport, chat height is capped at 60dvh
- [ ] `overscroll-behavior: contain` is applied to the chat scroll container
- [ ] Voice input button remains fully visible above the input bar on iPhone SE, 14 Pro, Galaxy S22

**Regression risk:** Low. CSS-only change. `dvh` supported in iOS 15.4+ and Chrome 108+. Fallback `min-h-[320px]` handles older browsers via CSS cascade.

---

#### DUX-017 · Add "Ask Arbor" as a persistent sidebar section (sixth icon)
**Category:** IA · **Surface:** Parent · **Effort:** S · **Score:** 83 · **Risk:** safe

**Problem:** Ask Arbor coach is the highest-value, most-used feature in the app. It is accessible via a topbar compact button and a card on Today — but has no sidebar entry. `TAB_SECTION_FALLBACK` maps coach to `'today'`, meaning a parent scanning the sidebar for past conversations has no answer. This is an IA failure: the primary product surface is not findable in primary navigation.

**Solution:** Add a sixth sidebar section for Ask Arbor (MessageCircle icon, label "Ask Arbor") between "Today" and "My Child" in the SECTIONS array. CoachTab becomes the primary view for this section. Update `TAB_SECTION_FALLBACK` to map `coach → 'coach'` (new section ID). The topbar compact coach button remains as a quick-access shortcut.

**Acceptance:**
- [ ] Sixth sidebar icon renders between Today and My Child with MessageCircle icon and "Ask Arbor" label
- [ ] Tapping the sidebar section navigates to CoachTab
- [ ] `TAB_SECTION_FALLBACK['coach'] === 'coach'` (new section), not `'today'`
- [ ] MobileNav shows Ask Arbor icon; if 6 items cause crowding, replace Academy with Ask Arbor and move Academy to "More" overflow
- [ ] Thread list in CoachTab is visible without additional taps
- [ ] URL hash routing: `#/coach` maps to the Ask Arbor section

**Regression risk:** Medium. Adding a sixth section changes the SECTIONS array used to generate both Sidebar and MobileNav. Test MobileNav at 375px (iPhone SE: 62.5px per item). `TAB_SECTION_FALLBACK` change affects breadcrumb rendering in Topbar.

---

#### DUX-018 · Rhythm strip surfaced on Today / Overview
**Category:** IA · **Surface:** Parent · **Effort:** S · **Score:** 82 · **Risk:** safe

**Problem:** `RhythmStrip` (predicted calm/friction/wind-down windows) is used inside DailyPlayTab (Grow section) — not on Today. The rhythm prediction is the most valuable real-time signal in the app and is buried two navigation hops from the home screen.

**Solution:** Move a compact variant of `RhythmStrip` into OverviewTab, rendered below the hero guidance section and above the DailyPlayCard. 3 windows displayed horizontally with icon + time label + window label; current window highlighted with `--arbor-clay-dim`. Full RhythmStrip with all details remains in DailyPlayTab. Compact variant links to DailyPlayTab via "See full day plan" tap target.

**Acceptance:**
- [ ] Compact RhythmStrip renders on OverviewTab showing today's 3 predicted windows (morning/afternoon/evening)
- [ ] Current time window is highlighted (`background: var(--arbor-clay-dim)`)
- [ ] Strip is absent when rhythm prediction confidence is `'low'`
- [ ] Tapping the strip navigates to DailyPlayTab with RhythmStrip in view
- [ ] Strip renders correctly in RTL layout for Hebrew users
- [ ] Strip does not duplicate data shown in the JITAI nudge card

**Regression risk:** Low. RhythmStrip is an existing component; a compact variant needs a `displayMode` prop. No data model changes.

---

#### DUX-019 · Tailwind dynamic class safelist for Shell grid columns
**Category:** Design · **Surface:** Shared · **Effort:** XS · **Score:** 75 · **Risk:** safe

**Problem:** Shell.tsx lines 184–188 construct conditional Tailwind class strings via template literals: `'xl:grid-cols-[290px_1fr_340px]'` etc. Tailwind JIT scans source files for complete class strings — dynamically constructed strings are purged from the production CSS bundle, causing the grid to collapse to `grid-cols-1` at xl breakpoints. This is a **silent production regression** invisible in dev mode.

**Solution:** Add all four conditional grid class strings to the Tailwind safelist in `tailwind.config.ts`. Verify in the production build that all four grid classes are present in the dist CSS.

**Acceptance:**
- [ ] `tailwind.config.ts` safelist includes `'xl:grid-cols-[290px_1fr_340px]'`, `'2xl:grid-cols-[290px_1fr_365px]'`, `'xl:grid-cols-[290px_1fr]'`, `'md:grid-cols-[260px_1fr]'`
- [ ] Production build: all four grid classes present in dist CSS
- [ ] At 1280px viewport with AI rail open, grid renders 290px + 1fr + 340px (not collapsed)
- [ ] No regressions at md, xl, 2xl breakpoints

**Regression risk:** Low. Config-only change. Verify exact strings match Shell.tsx template literal output.

---

#### DUX-025 · SafetyTab: tap-to-call emergency contacts and dynamic risk signal
**Category:** Feature · **Surface:** Parent · **Effort:** S · **Score:** 81 · **Risk:** gated-data

**Problem:** SafetyTab emergency contacts show phone numbers as plain text — a parent in crisis cannot tap a number to call. `riskLevel` is a static field from the child profile (set months ago), not a dynamic signal from behavior logs. A child with 8 high-intensity logs this week may still show "Low" risk. All text is English, even for Hebrew users.

**Solution:** Wrap each emergency contact phone number in `<a href={`tel:${contact.phone}`}>`. Add a dynamic `riskSignal` computed from last 14 days of `behaviorLogs`: count of logs with `intensity >= 7` + count of unresolved logs. When `dynamicRisk > 2` high-intensity logs in 7 days, show a notice above the static risk banner. Translate all 8 hardcoded English strings through `t()`.

**Accepts:**
- [ ] Emergency contact phone number is wrapped in `<a href='tel:...'>` — tapping opens phone dialer on mobile
- [ ] Dynamic risk signal computes from last 14 days of `behaviorLogs` (intensity >= 7 count + unresolved count)
- [ ] When `dynamicRisk > 2` high-intensity logs in 7 days, notice renders above static risk banner
- [ ] All 8 static English strings in SafetyTab replaced with `t()` keys; Hebrew translations provided
- [ ] Dynamic risk computation is `useMemo`'d against `behaviorLogs` — no API calls

**Regression risk:** Medium. Reads `behaviorLogs` (same data as PatternInsights). Wrap in `useMemo` with stable dependency array.

---

#### DUX-032 · BedtimeStories: replace string-based escalation detection with typed error code
**Category:** Feature · **Surface:** Parent · **Effort:** XS · **Score:** 76 · **Risk:** gated-ai

**Problem:** BedtimeStoriesTab escalation detection uses `message.includes('409')` — a string match on the error message text. If the API module's error wrapping changes, the escalation router breaks silently and parents in crisis see an adult error toast instead of the professional support screen. This is a **clinical safety regression risk**.

**Solution:** Add a `StoryEscalationError` class (or `err.code === 'ESCALATED'`) to `api.generateBedtimeStory`'s catch block when the server returns HTTP 409. BedtimeStoriesTab checks `if (err.code === 'ESCALATED')` instead of string match.

**Acceptance:**
- [ ] `lib/api.ts`: `generateBedtimeStory` throws with `code: 'ESCALATED'` when server returns HTTP 409
- [ ] BedtimeStoriesTab: escalation check is `if (err?.code === 'ESCALATED')`, not `message.includes('409')`
- [ ] Professional support screen renders correctly on 409
- [ ] All other API errors (500, network timeout, auth) are NOT routed to escalation screen
- [ ] Unit test: mock 409 → escalation screen renders; mock 500 → retry screen renders

**Regression risk:** Low. 3-line change. Audit all catch blocks for `api.generateBedtimeStory`.

---

#### DUX-033 · Onboarding: "first morning" orientation card on first Today visit
**Category:** UX · **Surface:** Onboarding · **Effort:** S · **Score:** 78 · **Risk:** safe

**Problem:** After OnboardingFlow, a new parent lands on Today/Overview with no orientation layer. A new parent has no mental model for "what is Arbor trying to show me here?" — the dashboard is rich but opaque on first visit. Competitors with highest activation rates (Lovevery, Huckleberry) all have an explicit first-session orientation card.

**Solution:** Show a `FirstMorningCard` on OverviewTab for exactly the first 3 sessions (tracked via `localStorage('arbor.sessionCount')`). The card has 3 tabs: "Today (you are here)", "Ask Arbor", "My Child". Each tab has one sentence and one illustration. Auto-dismisses after all 3 tabs are viewed or after the 3rd session. Skippable via "X" dismiss.

**Acceptance:**
- [ ] `FirstMorningCard` renders on OverviewTab for the first 3 sessions (`localStorage arbor.sessionCount <= 3`)
- [ ] Card has 3 swipeable tabs with the three orientation messages
- [ ] Card fully dismissed after parent views all 3 tabs OR after session 3 starts
- [ ] `localStorage arbor.sessionCount` increments on each app load, not each render
- [ ] Card uses `cardCls` and `var(--arbor-hero-grad)` background
- [ ] Skippable via "X" dismiss that sets `sessionCount` to 4 immediately

**Regression risk:** Low. New component, `localStorage`-gated. No existing state modified.

---

#### DUX-035 · Kid Mode entry point: add hand-off CTA on Today/Overview
**Category:** IA · **Surface:** Kid · **Effort:** XS · **Score:** 80 · **Risk:** safe

**Problem:** Kid Mode is launched from the Topbar KidModeButton (desktop) and a compact mobile area. Today/Overview is where a parent most naturally reaches to hand the phone to a child. Kid Mode is not visible anywhere on Today. A parent handing a phone to a child mid-breakfast cannot find Kid Mode without knowing to look in the topbar.

**Solution:** Add a `KidModeEntryCard` to OverviewTab, rendered as the last card before the daily tools section. Shows "Hand it to [name]" heading, the child's hero avatar, and a large "Start Kid Mode" button. Calls the same `enterKidMode()` function as the topbar button. When no avatar exists, shows "Create [name]'s hero first" with a link to the avatar creator.

**Acceptance:**
- [ ] `KidModeEntryCard` renders on OverviewTab when `avatarReady === true`
- [ ] Card shows child's avatar thumbnail and first name
- [ ] "Start Kid Mode" button calls `enterKidMode()` from KidModeContext
- [ ] Card renders "Create [name]'s hero first" with link to avatar creator when `avatarReady === false`
- [ ] Card is the last item in the main content column, above the daily tools drawer

**Regression risk:** Low. New read-only card. `enterKidMode()` is production-tested. Ensure `avatarReady` state is available in OverviewTab's context.

---

#### DUX-036 · PlansTab: fix hardcoded "language-switching triggers" coach CTA
**Category:** Content · **Surface:** Parent · **Effort:** XS · **Score:** 74 · **Risk:** safe

**Problem:** PlansTab line 199: the "Refine" coach CTA always seeds a hardcoded `'preoperational language-switching triggers'` prompt regardless of the actual plan topic. A parent with a plan titled "Morning Departure Routine" who taps "Refine" lands in the coach with a prompt about language switching — completely unrelated to their plan. This is a copy-paste artifact.

**Solution:** Replace the hardcoded string with: `` `Help me refine my approach to: ${plan.title}. Here's the current script: ${plan.scripts[0]?.say ?? 'see the plan'}.` `` Also add null-guard: `(plan.scripts ?? []).map(...)`.

**Acceptance:**
- [ ] "Refine" CTA in PlansTab pre-seeds coach with actual `plan.title`, not a hardcoded string
- [ ] Coach prompt includes first script from `plan.scripts` if available
- [ ] `plan.scripts.map()` is wrapped with `(plan.scripts ?? []).map()` to prevent throw when undefined
- [ ] Coach is opened (`setActiveTab('coach')`) after the prompt is seeded
- [ ] Applies to all plans in the list, not just the most recently generated one

**Regression risk:** Low. One-line string replacement + one null-guard addition.

---

### P2 — Medium

---

#### DUX-008 · Duplicate token cleanup: consolidate green-named sapphire tokens
**Category:** Design · **Surface:** Shared · **Effort:** S · **Score:** 72 · **Risk:** safe

**Problem:** index.css has 7 tokens with semantically green names mapped to sapphire values: `--arbor-green-cta-start: #58a6ff`, `--arbor-green-mid`, `--arbor-green-soft`, `--arbor-green-ink`, `--shadow-green`, etc. The `.arbor-parent` block maps `--arbor-clay` to `#2b7fff` while `:root` maps it to `#58a6ff` — two different primary blues coexist. AiRail.tsx line 54 uses hardcoded `color: '#1f6f4b'` not in any token. Three dead theme blocks (`[data-theme='teal']`, `[data-theme='blue']`) are byte-for-byte identical to `:root`.

**Solution:** Rename the 7 green-named tokens to sapphire-semantic equivalents. Unify `--arbor-clay` to `#2b7fff` in both `:root` and `.arbor-parent`. Delete the three dead theme blocks. Add `--arbor-emerald-ink: #1f6f4b` for AiRail's hardcoded hex.

**Acceptance:**
- [ ] Zero instances of `--arbor-green-cta-start`, `--arbor-green-mid`, `--arbor-green-soft`, `--arbor-green-ink`, `--shadow-green` in any file
- [ ] `--arbor-clay` resolves to same hex (`#2b7fff`) in both `:root` and `.arbor-parent`
- [ ] AiRail.tsx line 54 color replaced with `var(--arbor-emerald-ink)`
- [ ] `[data-theme='teal']` and `[data-theme='blue']` blocks removed from index.css
- [ ] Visual regression: no color changes visible in running app

**Regression risk:** Medium. Broad rename across potentially 50+ files. Use a TypeScript-aware codemod, not text substitution.

---

#### DUX-014 · Hero comic session-volatility warning and download prompt
**Category:** UX · **Surface:** Parent · **Effort:** XS · **Score:** 77 · **Risk:** safe

**Problem:** HeroComicsTab holds generated comics in component state. When the parent closes the tab or the session times out, all generated comics are lost silently. There is no warning. A parent who generates all 10 comics and then receives a phone call — loses everything.

**Solution:** Add a `beforeunload` warning when `generatedComics.length > 0` and not all comics have been downloaded. Show a persistent banner above the comic grid: "Your comics are ready to download — they won't be saved automatically." Navigation guard: when `setActiveTab` is called from HeroComicsTab with pending undownloaded comics, show an inline confirmation chip.

**Acceptance:**
- [ ] `beforeunload` event fires when `generatedComics.length > 0` and `downloadedCount < generatedComics.length`
- [ ] Persistent banner renders above the comic grid after the first comic is generated
- [ ] Banner text is translated via `t()` for HE support
- [ ] Banner dismisses when all generated comics have been downloaded
- [ ] Navigation guard: confirmation chip appears when parent tries to navigate away with undownloaded comics

**Regression risk:** Low. `addEventListener('beforeunload')` is a browser standard. Navigation guard uses a ref-based guard in the tab's `useEffect` cleanup.

---

#### DUX-016 · Weekly milestone wins: scope to current week window only
**Category:** UX · **Surface:** Parent · **Effort:** XS · **Score:** 71 · **Risk:** gated-data

**Problem:** WeeklyTab `milestoneWins` shows all ever-checked milestones (`milestones.filter(m => m.checked)`), not milestones checked this week. The weekly digest tells parents "your milestone wins this week" but shows wins from months ago. This erodes trust in the report's accuracy.

**Solution:** Filter `milestoneWins` to milestones where `m.checkedAt` is within the report's week window. Add `checkedAt: serverTimestamp()` to `handleToggleMilestone` if missing. Empty state: "No new milestones this week — keep going!" rather than empty list.

**Acceptance:**
- [ ] `milestoneWins` only includes milestones where `checkedAt` falls within current report's ISO week
- [ ] If `checkedAt` is missing on a milestone document, excluded from wins
- [ ] Empty state renders when `milestoneWins` is empty
- [ ] New milestones checked going forward have `serverTimestamp()` as `checkedAt`

**Regression risk:** Medium. Requires adding `checkedAt` to MilestoneItem type and the Firestore write.

---

#### DUX-020 · Bedtime Story: save title and discussion questions to timeline
**Category:** Feature · **Surface:** Parent · **Effort:** S · **Score:** 73 · **Risk:** gated-data

**Problem:** Bedtime Stories are generate-and-discard. Not even the story title or discussion questions are persisted. A parent who wants to remember "what we talked about Tuesday night" has no way to do so. The bedtime ritual contributes zero to the longitudinal moat.

**Solution:** After a story is generated and the parent advances past page 1, write a lightweight `StoryRecord` to Firestore: `{ title, discussionQuestions, eventSummary (log type labels only — no text), generatedAt, childId }`. This is GDPR-safe: no story text, no child PII beyond `childId`. `StoryRecord` appears in the Story Timeline as a "Bedtime Story" entry.

**Acceptance:**
- [ ] `StoryRecord` written to Firestore after parent advances past page 1 of the story
- [ ] `StoryRecord` contains only: title, discussionQuestions array, eventSummary (log type labels), generatedAt, childId
- [ ] No story text (narrative paragraphs) ever included in the Firestore write
- [ ] `StoryRecord` appears in Story Timeline as "Bedtime Story" event type
- [ ] GDPR delete: `StoryRecord` included in child data export/deletion flow (added to `CHILD_SUBCOLLECTIONS` in childData.ts)

**Regression risk:** Medium. New Firestore subcollection `'storyRecords'`. Must be registered in `CHILD_SUBCOLLECTIONS` — the GDPR guard test will catch omission.

---

#### DUX-021 · Add TTS read-aloud button to Bedtime Stories
**Category:** Feature · **Surface:** Parent · **Effort:** S · **Score:** 69 · **Risk:** gated-ai

**Problem:** Bedtime Stories are explicitly a read-aloud-to-child use case, but there is no TTS capability in the tab. `lib/tts.ts` and `speak()`/`stopSpeaking()`/`ttsSupported()` are already implemented and used in CoachTab. A parent at 8:30pm with a tired child who wants to listen has to read aloud manually from a screen.

**Solution:** Add a "Read aloud" / "Stop" toggle to the story reader. Call `speak(currentPageText, lang)` from `lib/tts.ts`. Auto-advance to next page on speech-end event. Show a subtle animated audio waveform while speaking. Use the child's primary language for TTS voice selection. Respect `prefers-reduced-motion`.

**Acceptance:**
- [ ] Read aloud button renders using `ttsSupported()` check — hidden if TTS not available
- [ ] Button calls `speak(page.text, childPrimaryLanguage)` from `lib/tts.ts`
- [ ] Auto-advance fires after speech completes (`onend` event) with 1.5-second pause
- [ ] Pressing Stop or navigating manually calls `stopSpeaking()`
- [ ] Hebrew story text reads in Hebrew voice (`lang='he-IL'`); English in `lang='en-US'`
- [ ] Animated waveform renders while speaking; removed when `prefers-reduced-motion` is set

**Regression risk:** Low. `lib/tts.ts` is production-tested in CoachTab. Clean up `onend` event on component unmount.

---

#### DUX-022 · Hero Journey virtue metrics surfaced in Weekly Report and coach context
**Category:** Feature · **Surface:** Parent · **Effort:** M · **Score:** 74 · **Risk:** safe

**Problem:** Virtue metrics from Hero Journey story runs (courage, responsibility, empathy, growth, truth tallies) exist in Firestore but are invisible in every parent-facing surface. A child who completed "The Dragon of Responsibility" after a week of sibling conflicts is doing exactly the kind of character-building the platform is designed to support — but the parent coach does not know this happened.

**Solution:** Read from `heroRuns` in WeeklyTab snapshot computation. Add a "Character development" section to the weekly digest when `heroRuns.length > 0` this week. Pass `heroRuns` summary to the coach via the existing child profile context object. Add `'HeroJourney'` event type to `buildTimeline`.

**Acceptance:**
- [ ] WeeklyTab renders "Character development" section when any heroRun was completed in the current week
- [ ] Section shows: story titles, virtue badge icons, total XP earned this week
- [ ] Coach API call includes `heroRuns` summary (last story completed, virtue totals) in child context payload
- [ ] Story Timeline includes HeroJourney event type with story title and virtue icons
- [ ] When no `heroRuns` exist this week, section does not render

**Regression risk:** Low. New read from existing `heroRuns` subcollection. Verify coach payload size does not exceed limits with added virtue data.

---

#### DUX-023 · Week labels in WeeklyTab history strip: human-readable date ranges
**Category:** UX · **Surface:** Parent · **Effort:** XS · **Score:** 66 · **Risk:** safe

**Problem:** WeeklyTab history strip shows raw ISO week IDs ('2026-W26', '2026-W25') as labels. These are developer-readable codes, not parent-friendly date ranges.

**Solution:** Add a `weekIdToDateRange(weekId)` utility function converting `'2026-W26'` to `'Jun 23 – Jun 29'` using `Intl.DateTimeFormat` with the user's locale. Current week is labeled "This week"; previous week is "Last week"; all others use the date range format.

**Acceptance:**
- [ ] History strip renders 'Jun 23 – Jun 29' format for EN locale
- [ ] History strip renders Hebrew month names for HE locale using `Intl.DateTimeFormat('he-IL')`
- [ ] `weekIdToDateRange` is a pure utility function with unit tests
- [ ] Current week is labeled "This week"; previous week is "Last week"

**Regression risk:** Low. Display-only change.

---

#### DUX-024 · Behavior type filter translated in BehaviorsTab dropdown
**Category:** Content · **Surface:** Parent · **Effort:** XS · **Score:** 64 · **Risk:** safe

**Problem:** The behavior type filter dropdown lists raw English strings even in Hebrew sessions. The log form's type select uses `t('beh.type.*')` translation keys correctly. Hebrew-primary parents cannot filter by behavior type in their language.

**Solution:** In the BehaviorsTab type filter select, replace hardcoded English option values with `t('beh.type.{type}')` keys — same keys used in the log form's type select. The option `value` attribute remains the English key (for filter logic); only the displayed label changes.

**Acceptance:**
- [ ] All 6 behavior type options in the filter dropdown display in Hebrew when language is HE
- [ ] Filter logic is unchanged (value attribute uses English key)
- [ ] "All types" default option is also translated
- [ ] Labels are consistent between filter dropdown and log form select

**Regression risk:** Low. Display-only change.

---

#### DUX-026 · Care Network split: Professionals vs. Monitoring sub-sections
**Category:** IA · **Surface:** Parent · **Effort:** S · **Score:** 70 · **Risk:** safe

**Problem:** Care Network has 6 sub-tabs spanning very different mental contexts: Consult (crisis-adjacent), School Brief (documentation), Care Team (ongoing relationship), Trusted Sharing (data governance), Appointments (calendar), Safety (crisis protocols). A parent who wants to call their pediatrician and a parent who wants to review data-sharing settings land in the same top-level section with no grouping cue.

**Solution:** Add a two-group visual divider inside the Care Network sub-nav chip strip: group 1 "Professionals" (Consult, School Brief, Find Pro) and group 2 "Monitoring" (Safety, Care Team, Sharing, Appointments). Groups separated by a labeled divider line — not new routes, same tabs. Visual/layout changes only.

**Acceptance:**
- [ ] Care Network sub-nav chip strip shows two visual groups with labels "Professionals" and "Monitoring"
- [ ] Group divider uses a vertical separator line (not a full heading) to avoid excessive height
- [ ] On mobile, the two groups stack visually or scroll with group separators
- [ ] Tab routing is unchanged — all 6 tabs reachable with same IDs
- [ ] Group labels are translated via `t()` for HE support

**Regression risk:** Low. Visual grouping only — no routing, state, or data changes.

---

#### DUX-027 · AiRail AskArborButton: replace green gradient anomaly with sapphire token
**Category:** Design · **Surface:** Shared · **Effort:** XS · **Score:** 62 · **Risk:** safe

**Problem:** AiRail.tsx line 49 uses `background: 'var(--arbor-green-soft)'` — an emerald-tinted gradient pill in a sapphire 2035 interface. AiRail.tsx line 54 hardcodes `color: '#1f6f4b'` — a forest green not in the design system.

**Solution:** Replace `var(--arbor-green-soft)` on AiRail line 49 with `var(--arbor-lav-soft)`. Replace hardcoded `'#1f6f4b'` with `var(--arbor-emerald-ink)` (new token from DUX-008) or `var(--arbor-clay-deep)`.

**Acceptance:**
- [ ] AiRail privacy card background uses a sapphire-family token (not an emerald token)
- [ ] AiRail privacy card text color uses a token from the design system (not a hardcoded hex)
- [ ] Visual result: privacy card is visually consistent with sapphire 2035 chrome
- [ ] The gradient CTA button (`var(--arbor-gradient-primary)`) is unchanged

**Regression risk:** Low. Two-line change. Verify no text legibility regression with the new background token.

---

#### DUX-028 · Milestone cross-reference: connect unchecked milestones to behavior logs
**Category:** Feature · **Surface:** Parent · **Effort:** M · **Score:** 76 · **Risk:** safe

**Problem:** Milestones and behavior logs are isolated silos. A child with four logged Sleep Meltdowns and an unchecked "self-regulates sleep transitions" milestone for their age band should surface a connection — but the app does not make it. This is the biggest missed opportunity in the developmental intelligence layer.

**Solution:** After the milestone list renders, compute a `crossReference`: for each domain, find unchecked milestones in the child's current age band where the milestone title semantically matches the child's top behavior log types (a predefined `behaviorToMilestone` mapping). Render a `CrossReferenceCard` inside the relevant domain section with behavior count and a "Learn more" CTA pre-seeding the coach.

**Acceptance:**
- [ ] `CrossReferenceCard` renders inside the domain section when a behavior log type matches the predefined mapping and the target milestone is unchecked
- [ ] Card text: "[Behavior type] logged [N] times this month — you haven't checked [milestone title] yet."
- [ ] "Learn more" CTA pre-seeds CoachTab with a specific prompt about the milestone + behavior pattern
- [ ] Matching logic uses a static `behaviorToMilestone` map — no API call
- [ ] Card uses `var(--arbor-lav-soft)` background to distinguish from regular milestone items
- [ ] Card does not render if behavior count is < 2

**Regression risk:** Low. Read-only cross-reference computation. Document the mapping table in a types file.

---

#### DUX-029 · ScholarTab: fold into coach as "Why this lens?" contextual tooltip
**Category:** IA · **Surface:** Parent · **Effort:** M · **Score:** 68 · **Risk:** safe

**Problem:** ScholarTab has no sidebar entry and is only reachable via two deep-links. Most parents never find it. The content — 6 developmental scholars with "use when" guidance — is valuable but is presented as a library requiring the parent to make connections to their own situation.

**Solution:** Keep ScholarTab as a navigable destination but add the scholar framing directly inside CoachTab as a collapsible "Why this lens?" panel on each AI reply with a lens applied. The panel shows: applied scholar's name + concept, a one-sentence "why this lens for [child name]", and "Explore this framework" link to ScholarTab filtered to that scholar.

**Acceptance:**
- [ ] Each CoachTab AI reply with a `lensId` includes a collapsible "Why this lens?" panel
- [ ] Panel is collapsed by default; expands on tap with a chevron animation
- [ ] "Explore this framework" link navigates to ScholarTab with the matching scholar card highlighted
- [ ] WeeklyTab "Scholar spotlight" links directly to ScholarTab
- [ ] ScholarTab itself is unchanged

**Regression risk:** Low. Additive change to CoachTab — new collapsible panel on existing `CoachAnswerCards` render.

---

#### DUX-030 · HandoffTab: auto-save on generation + unsaved-changes guard
**Category:** UX · **Surface:** Parent · **Effort:** XS · **Score:** 67 · **Risk:** gated-data

**Problem:** HandoffTab requires manual "Save" after generating a brief. If the parent navigates away mid-review, the generated brief is lost with no warning. For a document a parent may have spent 5 minutes reviewing, silent loss is a significant trust failure.

**Solution:** Auto-save the `schoolBrief` to Firestore immediately after `handleGenerateBrief` resolves. Remove the manual "Save" button; replace with a "Saved [timestamp]" status chip. Show a toast on auto-save: "Brief saved to history" (3-second dismiss).

**Acceptance:**
- [ ] `schoolBrief` saved to Firestore automatically after `handleGenerateBrief` resolves
- [ ] A "Saved [timestamp]" status chip renders in place of the "Save" button after auto-save
- [ ] Toast notification: "Brief saved to history" appears for 3 seconds after auto-save
- [ ] Brief is findable in saved briefs history on next visit even if parent navigated away immediately
- [ ] Duplicate saves prevented: `savedRef` resets on new generation
- [ ] GDPR: brief is included in child data export (verify `CHILD_SUBCOLLECTIONS` already includes `'briefs'`)

**Regression risk:** Low. Firestore write logic unchanged — only trigger changes from manual to automatic.

---

#### DUX-031 · DailyPlayTab: surface moat-reasoning below each activity pick
**Category:** UX · **Surface:** Parent · **Effort:** XS · **Score:** 72 · **Risk:** safe

**Problem:** Daily Play activity picks are personalized using a sophisticated scoring engine (goal-match, concern-match, age-band, interest-match weights) but the reasoning is hidden. A parent sees "Calm Water Activity — Sensory Awareness" with no indication why it was chosen today. The `ScoredActivity.reason` field is already computed by `selectDailyPlay` but never displayed.

**Solution:** Add a one-line "Why today:" reason below each activity card title. Map `ScoredActivity.reason` to human-readable strings: `{ 'goal-match': 'Matches your current focus goal', 'concern-match': 'Based on patterns this week', 'interest-match': "Matches [child]'s interests", 'age-band': 'Developmental milestone for this age' }`. Render in `var(--arbor-muted)` + `var(--t-xs)`. Translate via `t()` for HE.

**Acceptance:**
- [ ] Each of the 4 daily activity picks shows a "Why today:" reason label below the title
- [ ] `REASON_LABELS` map covers all possible `ScoredActivity.reason` values
- [ ] Reason label uses `var(--arbor-muted)` text color and `var(--t-xs)` font size
- [ ] Labels are translated via `t()` for HE locale
- [ ] When `ScoredActivity.reason` is undefined, label renders "Personalized for [child]" as fallback

**Regression risk:** Low. Display-only addition to activity card. Verify `ScoredActivity.reason` is exposed from `selectDailyPlay` return value.

---

#### DUX-034 · DailyPlayTab: fix dual session-length chip state
**Category:** UX · **Surface:** Parent · **Effort:** XS · **Score:** 63 · **Risk:** safe

**Problem:** DailyPlayTab renders two parallel session-length chip selectors: one for DailyPlanCard (`planSessionLength` state) and one for the activity grid (`sessionLength` state). These are independent — setting "5 min" in one does not change the other. A parent who taps "5 min" expects to filter everything.

**Solution:** Consolidate to a single `sessionLength` state driving both DailyPlanCard and the activity grid. Move the chip strip to a single location above both sections. Pass `sessionLength` as a prop to DailyPlanCard. Remove `planSessionLength` state.

**Acceptance:**
- [ ] Only one session-length chip strip renders in DailyPlayTab
- [ ] Single strip placed above both DailyPlanCard and the activity grid
- [ ] Changing the chip immediately updates both DailyPlanCard and the activity grid
- [ ] `sessionLength` persisted to `localStorage` per child
- [ ] `planSessionLength` state variable removed from DailyPlayTab
- [ ] DailyPlanCard accepts `sessionLength` as a prop

**Regression risk:** Low. Internal state consolidation. Verify DailyPlanCard is only used in DailyPlayTab before making it a controlled component.

---

#### DUX-037 · Coach conversation auto-naming from first user message
**Category:** UX · **Surface:** Parent · **Effort:** XS · **Score:** 65 · **Risk:** safe

**Problem:** Coach conversation thread strip displays generic titles (likely timestamps). A parent with 10 past conversations cannot navigate to "the one about morning transitions" without reading each thread. The thread strip is a navigation surface that currently fails its primary purpose.

**Solution:** When the first user message in a conversation is sent, generate the conversation title as the first 50 characters of the first user message. Write this as the `title` field on the conversation document in Firestore. For existing conversations without titles, use `createdAt` formatted as "Conversation — [date]".

**Acceptance:**
- [ ] New conversations are titled with the first 50 characters of the first user message
- [ ] Title is written to Firestore `conversations` document `title` field on first message send
- [ ] Thread strip displays the title, not a generic identifier
- [ ] Existing conversations without a `title` field display "Conversation — [formattedDate]"
- [ ] Title is not re-generated on subsequent messages — set once

**Regression risk:** Low. New field write on an existing document. No schema migration needed.

---

#### DUX-038 · Topbar child context: show current section label on mobile
**Category:** UX · **Surface:** Shared · **Effort:** S · **Score:** 68 · **Risk:** safe

**Problem:** The Topbar is hidden on mobile (`hidden md:flex`). On mobile, there is no persistent header showing the current section name. A parent navigating between sections has no persistent context anchor — the section name is only visible after the mobile nav transition completes.

**Solution:** Add a compact mobile header bar (height: 44px, sticky, `md:hidden`) above the scroll area. Shows: ArborMark (20px), current section label (display font, `var(--t-sm)`), child's first name (`var(--t-xs)`, `var(--arbor-muted)`). Background: `rgba(255,255,255,0.92)` with `backdrop-blur: 8px`. Section label derives from `SECTIONS[activeSection].label`.

**Acceptance:**
- [ ] Mobile header bar renders on all parent-surface views below md breakpoint
- [ ] Bar shows ArborMark (20px), current section label, and child's first name
- [ ] Bar uses the same glass blur treatment as MobileNav
- [ ] Bar is `position: sticky` to the top of the scroll container (not `position: fixed`)
- [ ] Bar is hidden on md+ viewports
- [ ] Bar does not render inside Kid Mode

**Regression risk:** Low. New component added to Shell.tsx for mobile viewports only. Sticky bar adds 44px above scroll content — verify it does not overlap ChildContextHeader on any tab.

---

#### DUX-039 · Plan staleness monitor: surface plan check-in when behavior logs continue after plan creation
**Category:** Feature · **Surface:** Parent · **Effort:** M · **Score:** 74 · **Risk:** safe

**Problem:** Growth Plans are created and manually ticked. If a plan is not working (the same behavior continues after the plan was created), Arbor does not notice. A parent who created a "Morning Departure" plan 3 weeks ago and continues logging Transition Refusals every day receives no signal that the plan needs adaptation. Plan and behavior log stream are separate silos with no feedback loop.

**Solution:** After each new behavior log is saved in `handleAddLog`, check if there is an active plan (`planProgress < 100%`) whose challenge topic semantically matches the behavior type. If a match is found and the behavior has been logged 2+ times since the plan was created, render a `PlanCheckinCard` on PlansTab (and a chip on OverviewTab): current plan step, new log count since plan creation, and "Adapt approach" CTA pre-seeding the coach.

**Acceptance:**
- [ ] `PlanCheckinCard` renders on PlansTab when: active plan exists + same behavior type logged 2+ times after `plan.createdAt`
- [ ] Check is performed client-side against ArborContext state — no API call
- [ ] Card shows: plan title, "[behavior type] logged [N] times since creating this plan", progress bar
- [ ] "Adapt approach" CTA pre-seeds CoachTab with plan title + behavior type + occurrence count
- [ ] A summary chip version appears on OverviewTab when `PlanCheckinCard` condition is met
- [ ] Card dismisses for 7 days if parent taps "Dismiss"

**Regression risk:** Low. Check runs in `useEffect` after `handleAddLog` resolves. Read-only against existing state.

---

#### DUX-040 · Academy section split: rename and regroup child vs. parent-education surfaces
**Category:** IA · **Surface:** Shared · **Effort:** M · **Score:** 69 · **Risk:** safe

**Problem:** Arbor Academy contains both child-starring entertainment surfaces (Story Journeys, Bedtime Story, Hero Comics) and parent education surfaces (Masterclasses, Family Formation). A parent looking for tonight's bedtime story and a parent looking for a masterclass on attachment theory both navigate to "Arbor Academy". The section name fits the education items but not the child-starring ones.

**Solution:** Restructure Academy sub-nav chip strip with a visual divider: group 1 "Your Child's World" (Story Journeys, Bedtime Story, Hero Comics) and group 2 "Parent Learning" (Masterclasses, Family Formation). Add group labels as non-chip headings inside the chip strip. Rename sidebar section from "Arbor Academy" to "Academy". Add a "For [child name]" tag next to child-starring items.

**Acceptance:**
- [ ] Academy sub-nav chip strip shows two visual groups: "Your Child's World" and "Parent Learning"
- [ ] Group divider matches the visual style of DUX-026 Care Network grouping (consistent pattern)
- [ ] Sidebar section label is "Academy" (not "Arbor Academy") — same icon unchanged
- [ ] All 5 sub-tabs still reachable with unchanged IDs and routing
- [ ] On mobile, two-group chip strip is horizontally scrollable with group labels visible
- [ ] Group labels are translated via `t()` for HE support

**Regression risk:** Low. Visual grouping only. Must be implemented consistently with DUX-026 to avoid two different grouping visual patterns.

---

## Intake Log

_(dated `## YYYY-MM-DD` blocks appended by the arbor-improve routine)_

## 2026-06-29 — Initial backlog (9-agent deep analysis)

40 items generated from: design-system-audit · tab-audit · kid-secondary-audit · ia-nav-audit · ARBOR_NEXT.md gap analysis · branch analysis · purpose audit (16 features) · competitive benchmark (Khan Kids, Lovevery, Kinedu, Duolingo ABC, Huckleberry, Cleo, ClassDojo) · synthesis.

**Key findings:**
- ARBOR_NEXT.md (Hermes, 2026-05-28) is **entirely superseded** — every major item in it is already implemented in the actual app; the app is 5–10× richer than the plan describes
- Stale plan references the old `.workspace/PPPPtherapy-` path (now cleaned up) and the old parchment/clay design (now sapphire 2035)
- The 2035 glassmorphic brand is spec'd in 80+ tokens but the `!important backdrop-filter:none` global override actively suppresses it in all layout chrome
- 344 hardcoded hex literals remain in the app (known from previous audit); the backlog addresses these via token adoption items
- **Top safe-class items to build first:** DUX-001, DUX-002, DUX-011, DUX-013, DUX-004, DUX-012 (all require no Tier-C gates)
- **Clinical safety item:** DUX-032 (escalation detection string-match) should be treated as a P0 bug fix, not a backlog item — consider shipping it immediately

riskClass summary: 29 safe · 6 gated-data · 1 gated-billing · 0 gated-store · 3 gated-ai
