# Arbor UX Audit — Report (sandbox, multi-agent verified)

Date: 2026-07-15 · Method: `arbor-product-auditor` skill v1.0 — live sandbox walkthrough (interaction manifest in [EVIDENCE.md](EVIDENCE.md)) → 4 methodology-lens agents (ux-heuristics scored · cognitive-walkthrough · clinical-firewall sweep · a11y fix-map) → 6 adversarial verifiers (refute-first, code-grounded). 10 agents, 0 errors. Sandbox = local vite, no backend, synthetic family; env artifacts excluded.

## Verdict summary

| Surface | Heuristic /10 | Firewall /5 | a11y /5 | Verdict |
|---|---|---|---|---|
| Kid Mode | 9 | 5 | — | **Pass** (gate correction below) |
| Journal | 8 | 3 | 3 | Conditional Pass |
| Auth front door | 7 | — | — | Conditional Pass |
| Today | 6 | 5 | 2 | Conditional Pass |
| Academy | 6 | 5 | 2 | Conditional Pass (stale copy hides real value) |
| Profile | 6 | **2** | 3 | **Fail** (infant milestones + Risk picker) |
| Behaviors | 5 | 5 | **1.5** | Conditional Pass (a11y criticals) |
| Growth | 5 | 4 | 3 | Conditional Pass |
| Ask Arbor | 4 | **3** | 3 | **Fail** (raw error + Dr. Levi + risk badges) |
| Care Network | 3 | **2** | 3 | **Fail** (fabricated professionals) |

**What works (verified by interaction):** the memory spine is REAL — a logged behavior and a typed coach question both flowed into Journal, Profile "Right now", and live pattern cards (M5/M6). Kid Mode register is clean ("Stars, never streaks", no pressure mechanics) and its exit gate is *stronger* than the July-10 backlog assumed: hold → 2-digit math challenge + optional device PIN ([parentGate.ts](../../app/src/components/kidmode/parentGate.ts), HOLD_MS=3000) — the "harden exit gate" P0 is substantially built. Consent copy on Care Network is exemplary. Mobile 390px: zero page overflow in sandbox.

## Top 5 by impact × ease

1. **Fabricated "verified professionals" ship to production — CONFIRMED Critical (worse than first seen).** Six fictional clinicians (`verified: true`, credentials, ratings, prices) are hardcoded in [professionals.ts:23-30](../../app/src/services/professionals.ts) AND served by the prod API route [api.ts:172-180](../../app/src/routes/api.ts) — no flag, no gate; duplicated in FindProfessional.tsx + AskSpecialist.tsx fallbacks. Parents can "Request consult" with invented doctors. *Fix (S):* serve `[]` (or `PROFESSIONALS_LIVE` env gate) at api.ts:173 and empty the client fallbacks; empty-states already exist. **Tier-C: child-trust/legal.**
2. **Clinical-firewall breach cluster — Critical vs standing constraint.** The firewall lens found live verdict/grade surfaces: graded child-risk badge "Risk: Severe/Urgent/High" in [CoachAnswerCards.tsx:28-35](../../app/src/components/coach/CoachAnswerCards.tsx); "% readiness" + "Risk level:" in parent-shareable [reportExport.ts:67-100](../../app/src/lib/reportExport.ts); first-class editable "Risk level Low/Moderate/High" picker in the child profile ([types.ts:11](../../app/src/types.ts), ProfileEditDrawer); "On track" verdict chips in Screening.tsx:146-233; banned terms in Arbor voice ("behind" watch.ts:63, "delays" i18n:1751, "Separation anxiety" chip i18n:1471). *Fix (M):* one firewall pass replacing grades/verdicts with counts + "worth a conversation" framing; extend the existing guard test to these files.
3. **Raw developer error renders as a coach message — CONFIRMED High.** [ArborContext.tsx:721-727](../../app/src/context/ArborContext.tsx) pushes `renderApiConnectionError(err.message)` ("check the Arbor API deployment…") into the thread as an AI message; the friendly retry card (CoachTab.tsx:645) already exists alongside. Cogwalk scored the whole worried-parent error journey 3/10; follow-up chips render as if an answer existed (CoachTab.tsx:111). *Fix (S):* delete the in-thread push; suppress follow-up chips on error.
4. **Infant milestones for a 5-year-old on Profile — CONFIRMED High.** "Worth watching next" = first 3 unchecked of ALL_MILESTONES, which starts at CDC 2-month items ("Smiles at people") — no age term ([ChildProfile.tsx:52](../../app/src/components/sections/ChildProfile.tsx)). Destroys clinical credibility on sight. *Fix (S):* filter by `bandForAgeMonths` (helpers already exist in milestoneData.ts).
5. **Academy hides real value behind stale copy — DOWNGRADED but highest-leverage copy fix.** The "phantom inventory" claim inverted under verification: **10 fully-authored EN+HE courses exist** in masterclasses.ts; the line "Our first lessons are in production; here's what's coming" (i18n.ts:671 + HE 2422) is stale and undermines them. *Fix (XS):* delete the sentence.

## Verified findings register (verifier verdict · severity · fix)

| ID | Finding | Verdict | Sev | Smallest fix |
|---|---|---|---|---|
| F1 | Fabricated verified professionals (prod API + client) | CONFIRMED | Critical | Serve `[]`/env-gate api.ts:173; empty client fallbacks |
| FW-1 | "Risk: Severe/Urgent/High" badge on coach answers | lens+code | Critical* | Counts/"worth a conversation" reframe, CoachAnswerCards.tsx |
| FW-2 | "% readiness" + "Risk level" in shareable reportExport | lens+code | Critical* | Remove %/grades from parent-facing export |
| FW-3 | Editable child "Risk level" picker in profile | lens+code | High | Drop field or reframe to parent-priority (types.ts:11) |
| F3 | Raw API error as in-thread coach message | CONFIRMED | High | ArborContext.tsx:721-727 remove push |
| F5 | Infant milestones in "Worth watching next" @ age 5 | CONFIRMED | High | Age-band filter at ChildProfile.tsx:52 |
| CW-1 | "Begin" lands parent on coach with an UNSENT draft, no cue | cogwalk | High | Auto-send or highlight composer + pulse send (OverviewTab.tsx:137-140) |
| F8 | "Arbor is quietly watching" surveillance copy family (3 EN + 3 HE) | DOWNGRADE | Medium | Rewrite in place to parent-agency register (i18n.ts:1454-5, 692) |
| A11Y-1 | `--arbor-faint` ≈2.9:1 drives 62 contrast hits | lens+code | Medium | Darken token at index.css:749 |
| A11Y-2 | ProgressBar has no accessible name (×14) | lens+code | Medium | One fix in kit.tsx:134 |
| A11Y-3 | Unnamed selects ×4 + unlabeled ranges (Behaviors, Today check-in) | lens+code | Medium | aria-labels: BehaviorsTab.tsx:385-393,62x · DailyCheckinCard.tsx:47 |
| F10 | `.msr` uppercase breaks ligature → literal "AUTO_AWESOME" | code-confirmed | Medium | `text-transform: none` in .msr rule, index.html:54 |
| F9 | Raw i18n key `nav.tab.routines` in Growth pill rail | code-confirmed | Medium | Add missing key (dynamic `nav.tab.*` lookup) |
| F13 | Popup-blocked error hides the email fallback on the same screen | heuristics | Medium | Append "…or continue with email below" / auto-expand (AuthContext.tsx:64) + add signInWithRedirect fallback |
| F4 | Academy stale "in production" line vs 10 real courses | DOWNGRADE | Low | Delete sentence i18n.ts:671 + HE 2422 |
| F6 | "Severe transition anxiety" = seed-only; prod is parent-authored | DOWNGRADE | Low | Add provenance "in the parent's words" (packet.ts:69) |
| MISC | Toast-only form validation · native window.confirm delete · silent lens overwrite · duration coerces to 5 · checklist marks done on click · contentless "Logged a moment" feed rows · "cluster" claim on n=2 | heuristics/cogwalk | Low | Per lens agent notes (BehaviorsTab 298/536/561/658 · FirstStepsRail:81 · OverviewTab:174) |

\* Critical by the standing clinical-firewall constraint (counts, never verdicts/grades on child-data surfaces).

**Corrections to prior records:** Kid Mode exit gate is challenge+PIN-capable, not hold-only (July-10 P0 largely shipped — verify copy claim gating only). Front door is not a dead end (email+password+reset exists behind "Continue with email") — the error copy just never points there. Icon-ligature aria-hidden concern REFUTED for current source (Icon.tsx defaults aria-hidden).

## Honest scope

Not covered (needs prod/API/accounts): real AI answer quality + answer contract; billing/paywall; RTL/multi-child sidebar (known P0 — sandbox has one EN child); Care Network export unlock end-flow; onboarding steps 1-4 fresh-user path; keyboard-only + dark mode; pixel screenshots (Browser pane hidden most of the session — structure/computed-style/axe evidence instead). Authenticated prod audit remains blocked on the safe demo account (AR-UX3) or Guy completing Google sign-in in the Browser pane.
