# Arbor — IA & Functionality Deep Analysis + Enhancement Plan

**Date:** 2026-06-07
**Scope:** Canonical app `PPPPtherapy-/PPPPtherapy-/app` (React 19 + Vite client). Source-level analysis of every navigable category.
**Author:** EA/PAI review

---

## 1. What Arbor is today

The app exposes **6 strategic sections → 22 leaf views**, defined in `app/src/lib/navigation.ts` and routed in `app/src/components/layout/Shell.tsx` (`tabRegistry`).

| # | Section | Leaf views |
|---|---|---|
| 1 | **Home** | Overview |
| 2 | **Ask Arbor** | Coach |
| 3 | **Child Intelligence** | Story (timeline), Development Profile, Milestones, Behavior Patterns, Language & Communication, Strengths & Challenges, Weekly Insight, Child Memory |
| 4 | **Growth Plans** | Active Growth Plans |
| 5 | **Care Network** | Find a Professional, My Care Team, School & Care Handoff, Reports, Appointments, Trusted Sharing |
| 6 | **Arbor Academy** | Story Journeys, Parent Masterclasses, Scholar Frameworks, Family Formation |
| — | *(orphaned)* | Safety (in registry + reachable, **not in sidebar**) |

The IA-v2 refactor (PRD v1.2) regrouped a flat 10-module sidebar into this 6-capability model. **The regroup is sound. The execution is half-finished** — roughly a third of the surface is either visually pre-refactor, a static mockup, or a dead-end.

---

## 2. Category-by-category verdict

Legend: ✅ Real & working · 🟡 Partial / thin · 🟫 Mockup (looks real, does nothing) · 🎨 Wrong theme (pre-refactor dark skin) · ⚠️ Broken/bug

| View | Meant to do | Actual state | Verdict |
|---|---|---|---|
| **Overview** | Daily command center | ✅ Rich, data-driven (trends, focus, charts, quick-log). Best-built page. | **KEEP** |
| **Coach (Ask Arbor)** | Structured AI guidance + scholar lens + council | ✅ Real streaming chat, contracts, multi-thread, council. Core product. ⚠️ hardcoded "Dylan" sample prompt. | **KEEP + fix copy** |
| **Story (timeline)** | One living timeline of all signals + next step | ✅ Genuinely strong — aggregates moments/milestones/plans/memory/coach, computes momentum. | **KEEP — promote** |
| **Development Profile** | Section landing | 🟡 Real profile fields + nav cards, but mostly a menu duplicating the sub-nav. ⚠️ hardcoded "Dylan". | **MERGE into section header** |
| **Milestones** | Track dev milestones + AI scaffold | ✅ Real (toggle, custom, AI gap analysis). | **KEEP** |
| **Behavior Patterns** | Log moments + AI analysis | ✅ Real (CRUD logs, photo, AI co-regulation scripts, analysis). | **KEEP** |
| **Language & Communication** | Bilingual practice | 🟡✅ Logic real & profile-driven, useful. 🎨 **Old dark theme** — looks like a different app. | **RE-SKIN** |
| **Strengths & Challenges** | Strengths/where-to-support | 🟡 Just re-lists `childProfile.strengths/challenges`. No new value. | **MERGE into Profile** |
| **Weekly Insight** | Weekly AI summary | ✅ Real (data snapshot + AI insight + history). 🎨 **Old dark theme.** Overlaps Overview + Reports + Story momentum. | **RE-SKIN + de-dup** |
| **Child Memory** | Parent-approved fact ledger | ✅ Real, wired to `/api/memory`. **This is the moat.** Underexposed. | **KEEP — promote** |
| **Active Growth Plans** | Generated intervention plans | ✅ Real (AI generation, kanban steps, edit). | **KEEP** |
| **Find a Professional** | Verified directory | 🟫 Lists fetch from API/fallback, but **"Request consultation" & "Share summary" buttons do nothing**, search box & filters don't filter. ⚠️ hardcoded "Dylan". | **FIX (make transactional)** |
| **My Care Team** | Active professionals | 🟫 **100% hardcoded** (Dr. Maya Levi, Ms. Tal). No real data; buttons just navigate. | **CUT or rebuild from real data** |
| **School & Care Handoff** | Professional briefs | ✅ AI brief generation real. 🎨 **Old dark theme.** Heavily overlaps Reports. ⚠️ hardcoded "Dylan". | **MERGE into Reports + re-skin** |
| **Reports** | Exportable PDFs from real data | ✅ Real (`reportExport`, 8 types incl. teacher/therapist/pediatrician). | **KEEP — absorb Handoff** |
| **Appointments** | Prep + track sessions | 🟡 Client-only, **not persisted** (lost on refresh). "Coming later: Booking/Payment/Reminders/Video/Insurer." | **DEFER or persist** |
| **Trusted Sharing** | Scoped, time-boxed sharing | ✅ Real, server-enforced (create/revoke/inbound, export). Strong differentiator. | **KEEP — promote** |
| **Story Journeys** | Personalized stories | ✅ Real generation (`generateStory`). | **KEEP** |
| **Parent Masterclasses** | Premium lessons | 🟫 **8 hardcoded titles, "Start lesson" does nothing.** Pure placeholder. | **CUT until content exists** |
| **Scholar Frameworks** | Theory lenses → coach | 🟡 Real (loads lens + prompt into coach). 🎨 **Old dark theme.** Overlaps Coach lens picker + Weekly spotlight. | **DEMOTE to a Coach drawer + re-skin** |
| **Family Formation** | Long-game values/rituals | 🟡 Family Charter is real (localStorage). **Other 7 cards do nothing.** | **TRIM to Charter** |
| **Safety** | Risk signs + emergency contacts | ✅ Real (contacts persist, checklist). 🎨 **Old dark theme.** **Orphaned** — no sidebar home. | **RE-SKIN + give it a home** |
| **AI Engines rail** | Trust/capability panel | 🟡 "Parent" mode fine. "Professional" mode = 8 cards with **fake status labels** ("Scanning", "Standby"). ⚠️ hardcoded "Dylan". Marketing veneer. | **Honest copy or cut Pro mode** |

**Tally:** ~10 genuinely working, ~6 partial/thin, ~3 pure mockups, **5 views on the wrong (pre-refactor dark) theme.**

---

## 3. Cross-cutting defects (why it "feels broken")

1. **Two design systems shipped side by side — the #1 problem.** The IA-v2 re-skin to the light "Soft Daylight" system never reached **Language Lab, Weekly, Scholar, Handoff, Safety** (and `OnboardingFlow`, `AddChildModal`). They still use the old dark palette (`#141821`, gold `#d7aa55`, `text-white`, `#08090c`). Jumping into one of these from a light page reads as a bug — *this alone explains most of the "doesn't work / out of place" feeling.*
2. **Hardcoded "Dylan"** in 5 user-facing places (`AiRail.tsx:19`, `ChildProfile.tsx:24`, `FindProfessional.tsx:46`, `CoachTab.tsx:542`, `HandoffTab.tsx:43`). Any child not named Dylan sees a stranger's name.
3. **Dead CTAs** that look live: Masterclasses "Start lesson", Find-a-Pro "Request consultation"/"Share summary", Find-a-Pro search & filters, Family Formation's 7 cards, Care Team actions. Buttons that do nothing erode trust fast.
4. **Redundant "weekly/insight" surfaces (×3–4):** Weekly Insight tab vs Reports' "Weekly Insight" PDF vs Story momentum strip vs Overview "this week's insights/weekly pattern." Same data, four homes.
5. **Reports vs Handoff duplication:** both generate professional summaries for teacher/therapist/pediatrician.
6. **Scholar surface (×3):** Scholar Frameworks tab vs Coach lens picker vs Weekly "scholar spotlight."
7. **Orphaned Safety:** a whole "Risk & Safety Classifier" engine with no sidebar entry, reachable only via Overview footer + AiRail.
8. **Thin landing pages:** Development Profile and Strengths mostly re-display profile fields / re-list the sub-nav.

---

## 4. Market-demand lens

Target per PRD: parents of 0–12, IL/NL/BE→EU, plus B2B (schools, therapists, clinics). What parents actually **pay** for, ranked by proven willingness-to-pay:

1. **Acute-moment AI coaching** ("my kid is melting down *now*") → Arbor's Coach. ✅ Strong.
2. **Developmental reassurance + early red-flag screening** (autism/ADHD/speech) → Milestones exist, but **no structured screener / red-flag surfacing** yet. **Biggest unmet demand.**
3. **Sleep** → not a first-class surface. High-demand, high-retention category Arbor ignores.
4. **Co-parent / caregiver coordination** → Trusted Sharing is the seed; not productized as "co-parenting."
5. **School/therapist handoff** → Reports/Handoff exist; strong B2B2C wedge if consolidated and made shareable (Trusted Sharing already does the hard part).

**Read:** Arbor spreads thin across many half-built surfaces instead of going deep on the 2–3 parents pay for. The fix is **consolidate the sprawl, then invest the freed capacity into screening + sleep + co-parenting.**

---

## 5. Enhancement plan (phased)

### Wave 0 — Stop looking broken (days, not weeks) — ✅ DONE 2026-06-07 (branch `feat/arbor-wave0-theme-unify`)

> **Scope was larger than first estimated.** The initial analysis flagged 5 dark views; a full sweep found the dark theme across **~25 files** — including the core CoachTab, all four primary tabs (Behaviors, Milestones, Plans, Stories catalog), the always-visible sidebar ProfileSwitcher, every Home card, shared UI primitives, the coach answer/vision cards, and the auth/profile screens. All re-skinned to the `ui/kit` Soft-Daylight tokens. The only surface intentionally left dark is the cinematic Story-Journey reading stage. Shipped in 6 commits (Wave 0a–0f); `tsc --noEmit` and `vite build` both clean.

- ✅ **Unified the theme** app-wide (Coach, Weekly, Scholar, Language, Handoff, Safety, Behaviors, Milestones, Plans, Stories catalog, sidebar, Home cards, Modal/Button/Badge/EmptyState/MarkdownBlock, CoachAnswerCards, ArborVision, ProfileEditDrawer, AddChildModal, OnboardingFlow, LoginScreen, ErrorBoundary).
- ✅ **Killed hardcoded "Dylan"** → active child's name everywhere (AiRail, ChildProfile, FindProfessional, CoachTab, HandoffTab); neutralized placeholder examples to "e.g. Maya".
- ✅ **Honest/working CTAs** — Masterclasses + Family Formation no-op cards now show "Coming soon"; Find-a-Pro search + filters actually filter and its card buttons navigate (Appointments / Reports).

### Wave 1 — Collapse the redundancy (the IA gets *legible*) — ✅ DONE 2026-06-07 (branch `feat/arbor-wave0-theme-unify`)

> 22 nav leaves → **17**. No capability deleted — demoted views stay valid routes (deep-linkable, reachable in-app and via ⌘K search), just no longer equal-weight primary items. `tsc` + `vite build` clean.

- ✅ **Merged Handoff → "Reports & Handoffs"** — Reports hosts an "Open handoff builder" card; Handoff keeps a back-link.
- ✅ **Demoted Weekly Insight** — off Child Intelligence nav; surfaced via a "Weekly insight" button on the Story timeline (+ back-link).
- ✅ **Demoted Scholar Frameworks** — off Academy nav (the lens picker already lives in Ask Arbor); back-link added.
- ✅ **Folded Strengths into Development Profile** — Profile renders strengths & "where to support" inline.
- ✅ **Gave Safety a home** under Care Network (was orphaned).
- ✅ **Hid placeholder "My Care Team"** from nav until Wave 2 rebuilds it from real grant data.
- Result: Child Intelligence 8→6, Care Network 6→5, Academy 4→3. `sectionForTab()` fallback keeps sidebar highlighting correct for demoted views.

### Wave 2 — Make the moat real (retention) — 🟡 PARTIAL 2026-06-07 (branch `feat/arbor-wave0-theme-unify`)

Client-achievable slice shipped; backend/business-dependent items deferred. `tsc` + `vite build` clean.

- ✅ **Promoted Child Memory + Trusted Sharing** — Home command center now carries a "What Arbor remembers" card (pending-approval queue / approved-fact count → Memory) and a "Trusted sharing" card (→ Sharing). Both were invisible from Home before.
- ✅ **My Care Team rebuilt from real data** — derives from server-enforced share grants (`api.listShares` + `sharedWithMe`): role, scopes, expiry, inbound shares, guided empty state. No more hardcoded people. Re-added as a primary Care Network item.
- ⏳ **Deferred — real professional intro/booking transaction.** "Request consultation" still routes to Appointments (honest, no dead click); a true intro/booking flow needs a backend + a decision on whether Arbor staffs a directory or pivots to "invite your own professional." Pricing/financials live in `[[arbor-business-model-pricing]]`.
- ⏳ **Deferred — Masterclasses content.** Kept honest as "Coming soon" (no fake catalog); needs ~8 real lessons commissioned before the section earns a working CTA.

### Wave 3 — Build to market demand (growth)

All four wedges are in scope (owner decision, 2026-06-07). Recommended build order, sequenced by dependency and payoff:

1. **Red-flag screening** (autism/ADHD/speech): structured, validated-style milestone screeners that surface "worth discussing with a professional" — non-diagnostic, escalation-routed. #1 unmet paid demand; builds on existing Milestones and feeds Reports + Care Network. **Do first** — it's the acquisition hook and reuses the most existing surface. → **🟡 MVP BUILT 2026-06-07** (`lib/screening.ts` + `sections/Screening.tsx`, "Development Check" under Child Intelligence; PRD: `prd-red-flag-screening-2026-06-07.md`). General non-diagnostic check shipped behind product/legal review; named-condition screeners still gated on the legal opinion.
2. **Sleep module:** routine builder + log + AI wind-down plans. High retention, recurring daily engagement. **Do second** — independent, fast to ship, drives DAU.
3. **Co-parenting workspace:** rebrand Trusted Sharing's co-parent role into a real shared workspace (shared timeline, aligned plans). **Do third** — depends on Wave 2 promoting Sharing/Memory first.
4. **B2B therapist/school portal:** the inbound side of Trusted Sharing becomes a lightweight pro dashboard — the B2B2C revenue path the PRD describes. **Do fourth** — monetization layer; needs screening + sharing + reports mature underneath it.

---

## 6. Recommended target IA (slimmed)

```
Home
Ask Arbor                     (+ Scholar lenses as a drawer)
Child Intelligence            → Story · Profile (merged) · Milestones+Screening · Behaviors · Language · Memory
Growth Plans
Care Network                  → Reports & Handoffs (merged) · Sharing · Find/Invite a Pro · Safety
Academy                       → Stories · Masterclasses (only if real)
```

22 views → ~14, each one real.

---

## Decision / next action

**Recommended first move: Wave 0 (theme unification + kill hardcoded names + honest CTAs).** It's mostly mechanical, low-risk, and removes ~80% of the "it's broken / I don't get the point" perception before any feature work. **Proposed next action:** approve Wave 0 and I'll execute the 5 re-skins + the "Dylan" fixes as a single PR, then bring Wave 1 (merges) as a follow-up.

---

## Redesign build status (approved + shipped to production)

The approved 3-phase product/UX redesign was implemented and **deployed to production** (arborprd-westeu.web.app), designed against the impeccable rubric (removed the hero-metric stat block, the identical-card "Arbor Way" grid, the internals-exposing "AI Engines" rail; benefit-named copy; em dashes removed; contrast/hierarchy checked).

- **Phase 1 — clarity & nav (DONE):** Home rebuilt around one "pulse" + one dominant "Today" action zone + a single "How {child} is doing" panel folding in the moat (milestones + parent-approved memory + story); calm "How Arbor helps" trust rail replacing AI-Engines mode; Ask Arbor input clarified; "Child Intelligence"→"My Child", "Behavior tracker"→"Moments".
- **Phase 2 — guidance/onboarding/trust (DONE):** instant-payoff onboarding (name + age + "what's on your mind" → seeds first focus); Development Check credibility line (CDC/AAP-style, non-diagnostic); privacy/trust surfaced in the rail.
- **Phase 3 — monetization frame (DONE, client-side):** honest "Arbor Free / Arbor Plus (coming soon)" plan frame in Settings + interest capture; mobile Settings access.
- **Deferred (needs backend / business decisions, not client-implementable):** real billing/checkout for Plus, real professional intro/booking transaction, weekly-digest push/email sending, and the B2B clinician/school portal.
