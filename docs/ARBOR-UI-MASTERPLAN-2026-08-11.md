# Arbor UI Masterplan — Best-in-Market Interface

**Date:** 2026-08-11
**Status:** v1.0 — VERIFIED (3-lens adversarial panel: evidence 20/23 confirmed · 0 refuted; product; constraints/safety. Findings folded in — see §10.)
**Owner:** Guy
**Supersedes:** nothing — this SEQUENCES existing canon; it does not replace `ARBOR-IA-WIREFRAME-MASTERPLAN-2026-07-03.md` (IA canon), `arbor-enhancement-backlog-v6.md` (capability canon), or the 2026-07-10 production screen audit backlog.
**Sources:** Maytal Doron feedback 2026-08-04 (email, cc Keren) + 2026-07-09 (×2 incl. blind mom-test) + Karin Mor 2026-07-12/20 · 4-agent deep analysis 2026-08-11 (design system, IA/data-flow, backlog status, market benchmark) · market research (Huckleberry/Kinedu/Lovevery/Khan Kids/Duolingo ABC/Whoop/Oura/Gentler Streak).

---

## 0. The thesis

Every external reviewer converged on the same two sentences:

1. **"I can't tell what Arbor wants me to do, or why."** (blind mom-test: no graspable value in seconds, no first step; Maytal: no clear daily action, category overload for a tired evening parent)
2. **"The app doesn't remember my child's journey — nothing connects."** (Maytal 4 Aug: no sense of what changed since last visit, recommendations restart from zero; Karin: "the user journey is never told")

The deep analysis proves the root cause is NOT missing product. It is **built-but-disconnected** (all verified against source):

- No "since last visit" state exists anywhere in the app.
- The coach is **stateless per turn** — journal, logs, milestones, and prior turns are never sent to the model (`ai/prompts.ts:67–96`; payload at `routes/api.ts:443`).
- Kid-mode activity (practiceEvents, speechAttempts, mimicSessions, adventureResults, missionRecords, heroRuns) **never reaches** the timeline, journal, weekly report, or Today feed (`signalTimeline.ts:168–246` folds exactly 6 sources, none of them practice).
- The only screens that fuse longitudinal signals (`#/copilot` Development Copilot, practice JourneyTab) are **unreachable from navigation** (`navigation.ts` — fallback-only, two in-content entry points).
- 52 weeks of `devScoreSnapshots` are recorded and only `items[0]` is ever read; `bandSnapshots` trends render only on the unreachable screens.
- The "how it all connects" ribbon (`SpineRibbon.tsx`), the "Why this fits"/"Arbor remembers" strings (`today.intent.*`), the coach data-contract panel (`coach.contract.*`), the journal prompt bank (121 prompts × EN+HE + seeded-rotation engine, `promptBank.ts`), and the gentle streak util (`lib/streak.ts`) are ALL authored, translated, tested — **and mounted nowhere**. ~401 i18n keys (~17% of the dictionary) are dead (census, not recounted by verifier).
- A weekly digest with week-over-week comparison **already works** (`server/digest.ts` + `WeeklyTab.tsx:134–143`) — but only generates if the parent opens `#/weekly`, a buried Profile tools pill.

**North star: One process, visibly remembered.** Every screen answers: *what changed for my child, what one thing do I do now, and why does Arbor say so.* Mostly a wiring job, not a build job.

Market framing (verified 2026 patterns): **one answer on open** (Whoop / Huckleberry SweetSpot) · a **Today that visibly changes between visits** (Oura "Top Stories") · **cumulative continuity counters, never streaks** (Gentler Streak school; Duolingo's own data shows streak-loss churn) · a **weekly story-card recap** as the shareable ritual (Wrapped pattern, parent-mediated) · **inline "why + who says so" on every recommendation** — the cheapest differentiator in a category where only ~12% of parenting apps show expert provenance (JMIR).

---

## 1. Standing constraints (unchanged) + two NEW plan-wide rules

From IA canon §2 and the 07-10 guardrails: clinical firewall (no %, verdicts, trend deltas, deficit pointers on child-data parent surfaces; counts only; growth-signal framing gated on GD-10) · two registers never cross · kid dark-pattern ban (no streaks/🔥/countdowns/leaderboards/loot/child-facing share) · RTL/a11y/i18n (`t()` en+he, 44px, reduced-motion, AA) · Peterson never branded · prod-promote = Guy L3 · `:root` palette locked pending GD-1/GD-2 · evidence framing research-anchored, never claim review that didn't happen (GD-10).

**NEW RULE A — The Today budget (anti-overload).** Today renders **max 5 modules** and **exactly one primary action above the fold**. Everything continuity-related collapses INTO the Since-Last-Visit strip as lines (recap entry, continuity counter, kid-activity note) — they are never sibling cards. SpineRibbon does NOT ship on Today (explanatory chrome → first-run + trust center + hub screens only). Any new Today module must name the module it replaces or absorbs. Without this rule the plan re-creates the overload it diagnoses.

**NEW RULE B — Per-item acceptance line.** Every new surface ships with its own en+he/RTL/44px/motion-safe acceptance check in the PR description. The global rule alone demonstrably didn't hold (SafetyTab shipped hardcoded-English with 2 `t()` calls, both aria).

---

## 2. Wave 0 — Stop the bleeding (defects + measurement, ~3–4 days)

Maytal's top-ranked tier ("safety, error-vs-empty, age filtering") + loss-prevention + instrumentation.

| # | Item | Evidence | Fix |
|---|------|----------|-----|
| 0.1 | **Commit discipline + backlog recovery.** The 72-item backlog (28 Jul) exists ONLY as the PDF attached to the sent email — local HEAD `0347b606` and `origin/main` `ca876fb7` are both 27 Jul; nothing landed anywhere since. ⚠ The clone currently has branch `codex/arbor-learn-batch4-evidence` checked out — switch/branch deliberately before committing. | Backlog agent; verified vs remote | Retrieve `Arbor-UI-Backlog-2026-07-28.pdf` from sent mail (himalaya — Gmail MCP can't fetch attachments), re-land as markdown in `docs/`; commit this masterplan same-day on a fresh branch. House rule: uncommitted work = same-day branch+push. |
| 0.2 | **Safety screen cannot call for help.** Zero `tel:` links app-wide; helpline numbers exist in `safety/escalation.ts:18–103` but the Safety screen renders NO helplines at all (they surface only via coach markdown, as bold text). `SafetyTab.tsx` hardcoded English (2 `t()` calls, both aria) in an RTL app; contacts render "empty" during load (`:121`, never checks `loaded`). | Verified exact | Helpline block on SafetyTab with `tel:` links + `tel:` on saved contacts; full `t()` en+he pass; loading state. Ships first. |
| 0.3 | **Development check shows verdict badges** — green-vs-amber result wash + per-domain watch/calm chips (`Screening.tsx:302, 325–327`); the UND-1 fix removed the words, the color mechanism survived. | Verified exact | Neutral observational counts ("2 areas worth a conversation"), single-tone. Add a banned-token/register test so it can't regress. No new clinical claims → no GD-10 dependency. |
| 0.4 | **App scores the parent.** `effectivenessRating` ("feedback on parent's responses") in prompt schema (`routes/api.ts:2299,2307,2322`) and rendered (`BehaviorsTab.tsx:704`). | Verified exact | Remove from schema + UI. A parent logging a 2am meltdown must never receive a grade. |
| 0.5 | **Error is indistinguishable from empty on ~18 screens.** `useChildCollection.ts:81–85` swallows errors → localStorage fallback → `loaded=true`; interface has no `error` field. | Verified exact | **Additive** `error` field: keep the cached/local fallback rendering (offline persistence is ON — never replace cached data with an error wall), add a persistent "couldn't refresh" banner + retry via `ErrorState`. Explicit offline-path test. Highest-blast-radius change in the plan: full suite + before/after screenshot sweep of the 18 screens before merge. |
| 0.6 | **Offline is silent.** Firestore offline persistence is on; zero `navigator.onLine` listeners, no indicator. | Verified | Topbar offline chip + stale-data banner (pairs with 0.5). |
| 0.7 | **Age filtering everywhere** (moved up from W2 — it is a defect by this wave's own definition, and it is the exact criticism Maytal wrote about Kinedu). 6 screens don't filter by age; worst: a 6-month-old's parent offered ages-4–8 masterclasses. Age bands already exist in the content models. | IA agent | Default-filter all libraries by child age band + "show all ages" toggle. Days, not weeks. |
| 0.8 | **KPI instrumentation.** §9's metrics are currently unmeasurable — no analytics events exist for them. | Product lens #8 | Instrument: session-open, since-strip render+tap, action offered/accepted/outcome, recap open/share, why-line presence, tel: tap, error-banner render. Without this W1+ success is a vibe. |
| 0.9 | **Kid-lock verification** (Maytal 9 Jul ask — largely BUILT: `parentGate.ts` 3s-hold + `ParentChallenge` on kid→parent exit). | Product lens #1 | Verify the gate covers ALL kid→parent paths: deep links, hash nav, browser back. Close the audit, don't rebuild. |

---

## 3. Wave 1 — Open → changed → do → why (~1.5–2.5 weeks)

THE wave. If only one wave ever ships, it is this one: a returning parent sees what changed; every parent — including day-0 — gets exactly one thing to do and why. (Guaranteed-action moved up from W2 per verification: continuity alone serves only returning users, and users currently fail at first contact.)

**Pre-step (1 day): mount-or-delete triage.** Decide the fate of every dead artifact (401 keys, 5 dead components) BEFORE waves mount things — waves 1–3 mount only what survives; W4 deletes the rest; W5 artifacts (PrideMomentCard, CelebrationMoment) are explicitly reserved.

| # | Item | What exists | Build |
|---|------|-------------|-------|
| 1.1 | **"Since your last visit" strip on Today** (Oura "Top Stories"). | No visit state. Week-over-week compare exists (`ProgressNarrative`, `computeMomentum`, digest). | Persist visit timestamps per child in Firestore (two-slot: previous + current, so the open doesn't overwrite what the reader needs; register the field for GDPR export/erase — it lives outside the `CHILD_SUBCOLLECTIONS` guard's sight). Strip = **event list only** ("2 new moments · 1 milestone crossing · Mia played 2 speech adventures"), max 3 lines + "more in Journal". **Never comparative** ("more than last time" = a trend delta = firewall). Absorbs: recap entry line (W2), continuity counter line (W2), kid-activity note. |
| 1.2 | **Guaranteed action on every open** — the Whoop rule; Today ALWAYS answers "what do I do now," even day-0/AI-miss/offline. | Action loop exists but only fires when AI returns text AND signals>0 (`useTodaysFocus.ts:135`); day-0 = fallback copy, no action. Prompt bank (121 prompts × EN+HE + engine) dead. | Deterministic fallback chain: AI focus → prompt-bank capture prompt ("What made her laugh today?") → evergreen Daily Play pick. Mount `today.intent.why`/`.whySimple` why-lines (authored EN+HE, dead) on whichever action renders. |
| 1.3 | **Coach remembers — CONSENT-GATED.** ⚠ Verification blocker: injecting log summaries without approval would bypass the approved-memory model (per-fact parent approval, `memoryService.ts:73–92`) and falsify the `coach.contract.*` panel. | Coach receives message+profile+approved-memory only; conversations stored, never re-fed. | (a) Prior coach turns: include last N turns of the SAME thread — conversational continuity, no new data class, no consent change. (b) Log/milestone summaries: behind an explicit parent toggle ("Let the coach see this week's moments") surfaced in the coach TrustPanel — ship the TrustPanel + updated `coach.contract.*` strings **in the same PR**, update `approvedMemoryFactsUsed` accounting. (c) Bump the pinned prompt version (`PROMPT_VERSIONS.coach_chat` fingerprint guard) + run the ai-eval-harness suite before merge. This is prompt+privacy+eval work, not a wiring PR. |
| 1.4 | **Kid activity reaches the parent.** | All six practice collections are in `CHILD_SUBCOLLECTIONS` (guard-tested — privacy clear). Timeline excludes them. | Add as `buildTimeline` sources, read directly via `useChildCollection` (NO derived/materialized sink — keeps the GDPR guard sighted). Type surgery: `SIGNAL_PROVENANCE` is a closed `"manual"|"auto"` union → add third class `"child"` + i18n. Surface in 1.1's strip + Journal. Parent-facing celebration, never child-facing pressure. Cost note: ~6 additional app-wide listeners. |
| 1.5 | **Mount the spine — everywhere EXCEPT Today** (Rule A). | `SpineRibbon.tsx` built, tested, RTL-ready, zero mounts; `elev.spine.*` dead. | Mount on Journal, Development, Academy hubs + first-run + trust center. The literal answer to "how everything feeds into each other," without new Today clutter. |
| 1.6 | **First-run promise** (moved up from W3 — first-session kill factor per mom-test). | WowOnboarding wired (~2min avatar→comic). | One screenful before Today: the one-sentence promise + the three things Arbor does daily/weekly/over-months. De-jargoned (no "AI-powered"). |
| 1.7 | **Give the full picture a home — gated.** ⚠ `DevelopmentCopilot.tsx:195–227` renders per-area "Discuss/Monitor" chips + Low/Mod/High `dashboardRisk` — verdict-shaped; cannot be promoted as-is. IA canon assigns copilot's home to the Development-Map "Now" strip (card), not a hub pill. | Copilot unreachable; bandSnapshots render only there. | Acceptance gate BEFORE any promotion: reframe chips to counts/observations, single tone, banned-token test; then mount per IA canon (Now-strip card on Development Map). Rename to parent language ("The Full Picture"). devScore/band **values** never render pre-GD-10. |
| 1.8 | **Progress over time.** | 52wk devScoreSnapshots unrendered; monthly story layer absent. | Timeline "over the months": milestone-crossing events + **cumulative (monotonic) counts only** — no per-period series side-by-side (a rate series is a trend by inspection). Firewall register test on the new layer. Anything verdict-adjacent waits for GD-10. |
| 1.9 | **Mobile search entry point** (Maytal first-tier; full re-index in W2). | SearchModal desktop-only; static catalog. | Topbar + More-sheet entry on mobile now; index expansion W2.4. |

**Wave-1 acceptance:** within 2s of open a returning parent sees ≥1 change since last visit; EVERY open (incl. day-0, offline) ends in exactly one offered action with a why-line; the coach references the same thread's prior turns; Today ≤5 modules, one primary action above the fold.

---

## 4. Wave 2 — The week-2 ritual (~1–1.5 weeks)

Maytal's answer to "what brings a parent back": new value every visit — plus the channel that makes the loop non-circular.

| # | Item | Build |
|---|------|-------|
| 2.1 | **Weekly recap becomes the ritual.** Digest engine works; hoist the generate path out of WeeklyTab (component-local hooks → app-level hook; weekId-keyed upsert makes the two-device race last-write-wins) and auto-generate on first open of a new ISO week. Today's since-strip carries the entry line ("Your week with Mia is ready"). Story-card format (one stat per card, 3–5 cards), parent-mediated ShareButton; swipe with reduced-motion + keyboard path. **Acceptance: the recap's last card is exactly ONE recommendation; tap = accept into Today** (digest `tryThisWeek` → `acceptTodayAction` already exists). Recap narrative + share-card images pass the existing clinical scan / export ceiling (GD-11 comparative-counts ruling). |
| 2.2 | **Recap delivery channel — email digest v1.** ⚠ Without a channel the retention loop is circular (the artifact meant to cause the return requires the return). `server/digest.ts` already carries subject/preheader fields. Weekly email, parent opt-in at recap #1, counts-only content (firewall applies to email too). Web push = later, separate decision. |
| 2.3 | **Continuity counter — `totalDays` ONLY.** ⚠ `computeStreak().current` resets on lapse = a resettable streak = banned by this plan's own wall; it stays unrendered. Ship cumulative framing only ("42 moments captured together"), as a LINE in the since-strip (Rule A), `.arbor-parent` register only. Gap return = Gentler-Streak welcome-back ("here's what's new for her age"), zero guilt. |
| 2.4 | **Search that works.** Index all libraries (Learn/Masterclasses/Routines missing today), forgiving HE+EN matching. Hygiene, not headline — every competitor does it badly. |
| 2.5 | **Recommendations continue — parent-attributed.** Today's-focus already feeds last outcome back (the ONE real loop). Extend to Daily Play and Learn ranking. Framing is always an echo of the parent's own report ("**you said** the calming game helped — here's the next step"), never an AI efficacy claim, and never a grade (0.4 stays dead). |
| 2.6 | **Journal prompts.** Mount promptBank: 3 rotating prompts above the capture triad ("What funny word did he say today?"); tap = pre-seeded capture. Maytal's empty-journal-paralysis ask, verbatim. |
| 2.7 | **Nav de-overload.** Named tension: Maytal's #1 9-Jul complaint was category overload, and wiring alone doesn't reduce it. Progressive disclosure on the mobile hub surface: 3 primary hubs (Today/Journal/Ask) visually weighted, rest quieter under More. Full IA reduction stays with the IA canon (record as canon follow-up with a date, not silently dropped). |

**Wave-2 acceptance:** recap ships to 100% of active parents weekly WITH a delivery channel; recap→Today acceptance rate measured; zero resettable counters anywhere.

---

## 5. Wave 3 — Trust as a surface (~1 week)

| # | Item | Build |
|---|------|-------|
| 3.1 | **Inline "why" required on every recommendation card.** Live: `learn.why*`, `play.why*`, `foryou.*`, ArborNoticed reasons. Standardize as a REQUIRED slot in the shared card (4.2) — card without a why-line fails review. LinkedIn depth: 2–3 plain factors, never algorithm talk. |
| 3.2 | **Coach data contract everywhere it's due.** TrustPanel (built, mounted once) → Consult + anywhere 1.3's toggle lives (the Coach mount shipped WITH 1.3). Render `coach.contract.*` / `airail.b.*` disclosure keys. |
| 3.3 | **One trust center** ("How Arbor works"): what it reads, what each signal means, what Arbor explicitly does NOT do. Consolidate into the Science page; every why-line links here. Honest uncertainty: ranges + "typical for this age," never point claims. SpineRibbon lives here too. |
| 3.4 | **Expert provenance on content cards** (the 12% category gap). NOW: research-anchored provenance ("Based on AAP milestone guidance", source+date) on all cards. AFTER GD-10 appoints the reviewer: "Reviewed by [name]" — fail-closed until then. |
| 3.5 | **De-jargon copy pass.** Systematic sweep (strings-only): "AI-powered/engine/model" → what it does for the child. The mom-test first-impression killer; pairs with the trust work. |
| 3.6 | **Free-vs-Plus clarity in-app:** badge on gated features; PaywallModal copy states the split plainly. (Landing page stays MKT-owned.) |

---

## 6. Wave 4 — Coherence & craft (~2.5–3.5 weeks)

Maytal ranked design-system work "later" — correct, EXCEPT the register leak, which parents see as visual incoherence on every screen.

| # | Item | Build |
|---|------|-------|
| 4.1 | **Fix the 71-token register leak — declare-only (GD-neutral).** Verified exactly: `:root` 95 props, flat block re-declares 35, 71 leak through at glass values — `mint` renders flat while coral/lav/yellow/pink/sky render glass gradients in the same tone API; two sapphires ship side by side (`#58a6ff` vs `#2b7fff`); glass glow leaks onto 15 flat CTAs. Fix: byte-copy today's rendered values into the flat scope for all 95, **marked provisional-pending-GD-2**. ⚠ Deleting/quarantining the `:root` glass block WAITS for the GD-2 ruling (deleting it forecloses the revert path; the `:root` palette is a locked wall). |
| 4.2 | **One ContentActionBar.** 9 hand-rolled variants, 0 shared abstraction; "save" ships in 2 incompatible shapes in one file. Build the bar (done/save/rate/share/swap + required why-line slot); migrate all 9. ⚠ Variants are NOT identical — inventory each surface's affordances first so none silently drop (UC-1 zero-regression). Before/after screenshot sweep of all 9 surfaces. |
| 4.3 | **One state triad.** 3 competing EmptyState shapes, 4 spinner shapes, ErrorState on 2/43 screens. Standardize: per-section skeletons (mimic final layout, ~10s timeout→error), EmptyStates that TEACH (preview of filled state + one CTA), ErrorState w/ retry. |
| 4.4 | **Type/radius/color discipline.** 863 arbitrary `text-[Npx]` / 28 values → 4-size ramp with big jumps; one card radius; extend the ratchet test to rgba + `lib/` + `practice/`. ⚠ The ~87 pre-sapphire rgba literals: PROVE unreferenced-at-render before deleting; anything still rendering waits for GD-1. ⚠ **Icons need their own GD:** prod drifted to Material Symbols but the UC-1 lock says lucide-never-Material — migrating the 33 lucide files INTO Material completes an unratified violation. Put the direction decision to Guy (ratify Material as superseding the lock, or reverse); do not bury it in a discipline pass. |
| 4.5 | **Motion pass.** Kill the double entrance animation (CSS stagger + motion.div both fire; stagger caps at 6 children); spring micro-interactions on press (scale ~0.97, 120–150ms release; M3 "standard" scheme — functional motion only, calm register); `motion-safe:` guard the 12 unguarded hover-translates. |
| 4.6 | **Perceived performance budget.** Cold-open TTI target on mid-range mobile; route-level code-split audit (43+ screens, one SPA); image policy. "Modern polished" dies at a 4-second open regardless of token discipline. |
| 4.7 | **Dead-weight purge — executes the W1 triage list.** Delete what wasn't mounted in W1–3; W5 reservations honored. Theme picker (3 byte-identical themes): remove = recorded capability removal (defensible: it's a no-op). Fix `theme-color` meta (near-black on a light app); delete dead selectors + 2 of 3 parallel design-sync toolchains. |

---

## 7. Wave 5 — Delight (~1 week; FIRST CUT if the timeline bites)

- **Mount the celebration chain** (PrideMomentCard + CelebrationMoment — reserved in the W1 triage): milestone crossings get their moment (Khan pattern: celebrate completion, never zeros). Parent register only; parent-mediated share only.
- **Wow → Story seed:** the onboarding comic page becomes the Story timeline's first artifact — day-0 already shows a remembered moment.
- **Teach-empty-states rollout** to all libraries (from 4.3).
- **Time-aware calm** (evening = calmer greeting, shorter Today): explicitly the lowest-priority item in this plan; cut first.

---

## 8. What this plan does NOT do (gates honored)

- No palette retint; 4.1 is declare-only (GD-1/GD-2 are Guy's).
- No clinical-review claims before GD-10 (3.4 fail-closed); no devScore/band VALUES rendered pre-GD-10 (1.7/1.8).
- No icon migration before the icon GD (4.4).
- No caregiver identity work (GD-9 blocked).
- No child-facing streaks/timers/shares, no resettable counters, ever.
- No unconsented coach data flows (1.3 toggle + contract, or it doesn't ship).
- No landing-page fork (MKT-owned) — **"real parent stories/testimonials" (mom-test ask) parked with MKT/E12 alongside it** (quote permission pending), not dropped.
- Kid-mode HE transcreation (GD-6/7) unblocked separately by Guy.

## 9. Sequencing, effort, measures

**Order:** W0 → W1 → W2 → W3 → W4 → W5. W0+W1 alone deliver the complete "open → changed → do → why" loop.

**Effort honestly:** best case (single-track, no surprises) ≈ 7–9 weeks. **Expected case: 10–12 weeks** — priced in: Guy-gated promote serialization across 6 waves, 1.3's eval+consent work, 4.2's nine-surface migration, and this repo's demonstrated two-week freeze risk. **Pre-declared cut line:** W5 first, then 4.4/4.5 — never W0–W2.

**KPIs (instrumented in 0.8, measured from W1):** week-2 return rate (THE metric) · time-to-first-action per session · % opens showing a since-visit delta · % opens ending in an offered action (target: 100%) · % recommendation cards with why-line · recap open + recap→Today acceptance rate · email-digest CTR · safety tel: tap-through · error-banner visibility (vs silent empty).

**First three PRs:** (1) 0.2 safety tel:+i18n, (2) 0.5+0.6 error/offline (additive), (3) 0.7 age filtering.

## 10. Verification log (2026-08-11)

3-agent adversarial panel on the v0 draft:
- **Evidence lens:** 20/23 claims CONFIRMED at exact file:line, 0 refuted, 3 nuances (SafetyTab `t()` count 2 not 3; copilot has 2 entry links not 1; bandSnapshots do render on the unreachable screens) — corrected above. Feasibility flags folded in: digest hoist (2.1), two-slot lastVisit (1.1), provenance-union surgery (1.4), `coach_chat` fingerprint pin (1.3).
- **Product lens:** 4 P0s — Today information budget (→ Rule A), circular retention loop (→ 2.2 email channel), best-case timeline (→ §9 expected case + cut line), guaranteed-action stranded in W2 (→ 1.2). Also: age-filter/search moved up, KPI instrumentation added (0.8), kid-lock disposition (0.9), coach eval gate (1.3), triage-before-mount (W1 pre-step), nav de-overload (2.7), perf budget (4.6), stories parked with MKT (§8).
- **Constraints lens:** 1 BLOCKER (coach consent — resolved as 1.3's toggle+same-PR contract), 6 MUST-FIX (copilot verdict chips + canon home → 1.7; monotonic-counts-only → 1.8; `totalDays` only → 2.3; 4.1 split declare-only; icon GD → 4.4; additive error field + QA gates → 0.5), 6 WATCH items folded in (1.1 event-list + export registration; 1.4 direct reads; 2.5 parent attribution; recap clinical scan; W5 reservations; Rule B).
