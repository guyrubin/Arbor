# Arbor — Enhancement Backlog v3 (Next Level)

**Date:** 2026-06-03
**Basis:** the live, deployed app after the **Soft Daylight redesign** and the
**IA v2 six-capability refactor** (`main` @ `0813e2e`, deployed to
arborprd-westeu). Grounded in the shipped code, not from memory.
**Relationship to prior docs:** v2 (`arbor-enhancements-v2.md`, 2026-06-02) is
largely shipped (AI cost caps, types, tests, trends, routines, goals, memory
view, mobile nav, token layer, RTL content). This v3 starts from *today's* state
and the new surface area IA v2 created.

---

## 1. The thesis — what "next level" means now

Arbor today is a **beautiful, coherent single-parent app**. The IA v2 refactor
told a six-part story (Understand → Guide → Grow → Connect → Learn) — but two of
those pillars (**Connect / Care Network** and parts of **Learn / Academy**) and
the **Child Memory moat** are currently *scaffolds with sample data*, not live
capabilities. The visual system also forked (two token sources) during the fast
redesign.

Next level = **close the gap between the story and the substance** along four
moves:

1. **Connect the loop** — Intelligence *detects* → Ask Arbor *recommends* →
   Growth Plans *operationalize* → Follow-Up *feeds back* into Intelligence.
   Today these are linked by navigation, not by data.
2. **Back the scaffolds with real systems** — Care Network (the platform play),
   Child Memory (the moat), Reports/Handoff generation, AI-Engine orchestration.
3. **Harden trust** — make Trust & Safety dynamic (real risk classification per
   answer), and make privacy controls (export/delete/expiry) actually enforced.
4. **Open the second side of the marketplace** — professional + school/org
   surfaces, so "coordinate care" becomes a network, not a directory mockup.

---

## 2. Maturity scorecard (today)

| Dimension | State | Rating |
|---|---|---|
| **Ask Arbor (Guide)** | Real AI Q&A, scenarios, Scholar lenses. Response not yet enforced into the 9-part structure; Trust & Safety bar is static. | ●●●●○ |
| **Child Intelligence (Understand)** | Behavior, Milestones, Language, Weekly are real & persisted. Profile/Strengths are presentational; **Child Memory UI is local sample data, not wired to the real memory service.** | ●●●○○ |
| **Growth Plans (Grow)** | Real kanban plans, persisted. Plan-type templates (Sleep/Screen/School/Reset) and follow-up→intelligence feedback not built. | ●●●○○ |
| **Care Network (Connect)** | **Entirely scaffolded** — directory, care team, appointments, sharing, reports are sample UI with no backend, data model, or permissions. | ●○○○○ |
| **Arbor Academy (Learn)** | Story Journeys + Scholar Frameworks real. Masterclasses + Family Formation are scaffolds. | ●●○○○ |
| **Trust & Safety** | Non-diagnostic contract + SafetyTab exist; `TrustSafetyBar` is hardcoded `Low`; escalation is informational. | ●●○○○ |
| **Design system** | Soft Daylight is cohesive and on-brand. But: **two `PASTEL` token sources** (`ui/kit.tsx` vs `OverviewTab`), the legacy `!important` dark→light remap layer still in `index.css`, a11y not audited on new surfaces. | ●●●○○ |
| **Platform / Tech** | Vite+Express+Vertex+Firestore solid. **No URL routing** (tab state in localStorage) → no deep links, no back button, no shareable handoff links. Firebase vendor chunk ~566 KB. | ●●●○○ |

---

## 3. Five strategic bets (epics)

| Epic | One-liner | Why now |
|---|---|---|
| **E1 — The Living Loop** | Wire detect→recommend→operationalize→feedback so sections share data, not just links. | Turns 6 tabs into one intelligent system; biggest perceived "intelligence" jump. |
| **E2 — Memory, for real** | Connect Child Memory UI to the append-only memory service; Memory Proposal Engine proposes facts from logs/sessions for approval. | The moat is currently a mockup; making it real is the defensibility story. |
| **E3 — Care Network platform** | A real professional data model, verification, request/booking, and a permissioned **recipient portal** for shared context. | The second marketplace side + the "coordinate care" promise; needs URL routing. |
| **E4 — Dynamic Trust & Safety** | Risk & Safety Classifier scores every AI answer; `TrustSafetyBar` and escalation reflect real risk; privacy controls enforced. | Trust is the brand; today it's asserted, not computed. |
| **E5 — One design system + routing foundation** | Single token source, retire the `!important` layer, adopt URL routing, a11y pass. | Removes the fragility that caused the recent `peach`/`coral` runtime bug; unlocks deep links for E3. |

---

## 4. Backlog by dimension

Priority: **P0** now / **P1** next / **P2** later. V/E = Value/Effort (H/M/L · S/M/L).

### Capabilities

| ID | Enhancement | Epic | Pri | V/E |
|---|---|---|---|---|
| CAP-1 | Wire **Child Memory** UI to the real append-only memory service (read approved facts, approve/edit/delete persisted, enforce time-boxing). | E2 | P0 | H/M |
| CAP-2 | **Memory Proposal Engine**: after a coach session or notable log, propose a memory fact for one-tap parent approval. | E2/E1 | P1 | H/M |
| CAP-3 | Enforce the **9-part Ask Arbor response** (what/why/today/script/avoid/observe/escalate/save-memory/handoff) as structured output, each a labeled block. | E1/E4 | P0 | H/M |
| CAP-4 | **Recommend a Growth Plan from a pattern**: Intelligence flags a pattern → Ask Arbor proposes a plan → one-tap create. Close the loop visibly. | E1 | P0 | H/M |
| CAP-5 | **Growth Plan templates** (Sleep, Screen-Time, School Adaptation, Behavior Reset, Responsibility Ladder) + Follow-Up Logs that write back to Intelligence. | E1 | P1 | H/M |
| CAP-6 | **Reports generation** for all 8 types (reuse Weekly/Handoff generators); real PDF export on the Reports page (today only Weekly exports). | E3 | P1 | M/M |
| CAP-7 | **Handoff types coverage**: ensure all 7 (Teacher/Therapist/Pediatrician/School-Meeting/Language-Transition/Development-Snapshot/Behavior-Pattern) generate with the specified fields. | E3 | P1 | M/M |
| CAP-8 | **Care Network backend**: professional data model, Verified-by-Arbor flag, search/filter API, "Request consultation" + "Share Arbor summary" actions. | E3 | P1 | H/L |
| CAP-9 | **Trusted Sharing for real**: scoped, expiring, revocable grants + audit log; a **recipient portal** (tokenized link) where a professional sees only shared fields. | E3/E4 | P1 | H/L |
| CAP-10 | **Appointments**: request → confirm → prepare questions → post-session feedback (calendar + reminders later). | E3 | P2 | M/M |
| CAP-11 | **Personalized "developmental focus"** on Home/Profile derived from milestones + logs (today hardcoded). | E1 | P1 | M/S |
| CAP-12 | **Parent Masterclasses + Family Formation** content (even 3–5 real lessons / a working Family Charter) to back the Academy scaffolds. | — | P2 | M/M |
| CAP-13 | **Co-parent alignment**: invite a second caregiver with a role/permission scope. | — | P2 | H/L |

### Information Architecture

| ID | Enhancement | Epic | Pri | V/E |
|---|---|---|---|---|
| IA-1 | **URL routing** (`/home`, `/intelligence/behavior`, `/care/find`…) replacing localStorage tab state. Enables deep links, browser back, and E3's recipient links. | E5 | P0 | H/M |
| IA-2 | **Ask Arbor sub-structure**: saved threads/history, scenario library as fast-start, and the response sections as a guided flow. | E1 | P1 | M/M |
| IA-3 | **Command palette upgrade** (Cmd-K): cross-section, action-oriented ("Log a moment", "New Teacher Handoff", "Find a speech therapist"). | — | P2 | M/S |
| IA-4 | **Global context bar**: persistent child + current developmental focus, consistent across sections. | — | P2 | L/S |
| IA-5 | **Mobile nav refinement**: six items is tight on small phones — test, and consider a labeled active-only / overflow pattern. | E5 | P2 | M/S |
| IA-6 | **Onboarding → personalization**: capture enough profile depth in onboarding to power Home recommendations from day one. | E1 | P1 | M/M |

### Design system & UX

| ID | Enhancement | Epic | Pri | V/E |
|---|---|---|---|---|
| DS-1 | **Single token source**: unify the two `PASTEL` maps (kit vs OverviewTab) into `ui/kit.tsx`; one `coral` name. Removes the class of bug that broke Home. | E5 | P0 | H/S |
| DS-2 | **Retire the `!important` dark→light remap** in `index.css`: migrate legacy tabs to semantic Soft Daylight classes/tokens (finishes v2's D2). | E5 | P1 | H/L |
| DS-3 | **Accessibility audit (WCAG 2.1 AA)** on new surfaces: pastel chip contrast, focus-visible on sub-nav pills/cards, keyboard nav, `aria` on the AI-rail toggle. | E5 | P1 | H/M |
| DS-4 | **Consistent data-viz theming**: all charts on green/pastel, shared axis/tooltip style, the behavior heat scale documented. | — | P2 | M/S |
| DS-5 | **Mascot + illustration system**: Sprout states (idle/thinking/celebrate), section illustrations, real child-photo handling with the ring treatment. | — | P2 | M/M |
| DS-6 | **Motion polish**: one page-transition system, consistent list stagger, all behind `prefers-reduced-motion`. | — | P2 | L/S |
| DS-7 | **Component kit docs** (a lightweight Storybook or a `/kit` route) so the system is reusable and consistent. | E5 | P2 | M/M |
| DS-8 | **Full RTL** for Hebrew (layout, not just AI content) and **Dutch** copy for NL/BE markets. | — | P2 | M/L |

### Trust, Safety & Privacy

| ID | Enhancement | Epic | Pri | V/E |
|---|---|---|---|---|
| TS-1 | **Dynamic risk classification** per AI answer; `TrustSafetyBar` shows the real level; high-risk routes to an escalation flow with professional options. | E4 | P0 | H/M |
| TS-2 | **Enforced privacy controls**: data export and delete actually run; sharing grants expire and are revocable end-to-end (pairs with CAP-9). | E4 | P1 | H/M |
| TS-3 | **Escalation directory**: when risk is high, surface relevant Care Network professionals + local emergency guidance by market. | E4/E3 | P1 | M/M |
| TS-4 | **Audit everywhere**: every share/export/delete logged and visible to the parent. | E4 | P2 | M/S |

### Platform / Tech

| ID | Enhancement | Epic | Pri | V/E |
|---|---|---|---|---|
| PLAT-1 | **Front-end tests for the new sections** + e2e smoke (nav across all six sections, render each capability) + a render guard that would have caught the token bug. | E5 | P0 | H/M |
| PLAT-2 | **Performance**: code-split firebase/charts off the first paint; lazy-init the memory/AI-wiki retrieval. | — | P1 | M/M |
| PLAT-3 | **Service-worker discipline**: versioned cache + skipWaiting/clients.claim so deploys don't strand users on stale shells (the recurring hard-refresh issue). | E5 | P1 | H/S |
| PLAT-4 | **Professional / org backend foundations** for the B2B/B2G vision: provider accounts, clinic dashboards, school cohort views (PRD long-term). | E3 | P2 | H/L |
| PLAT-5 | **Notifications**: FCM push + scheduled weekly digest (carried over from v2 deferred C3/C4). | E1 | P2 | M/L |
| PLAT-6 | **Analytics (privacy-aware)** + funnel/activation instrumentation to guide the roadmap. | — | P2 | M/M |

---

## 5. Recommended sequence

**Now (P0 — close the credibility gap + stop fragility):**
DS-1 (one token source) · IA-1 (URL routing) · CAP-1 (wire Child Memory) ·
CAP-3 (9-part response) · CAP-4 (pattern→plan loop) · TS-1 (dynamic risk) ·
PLAT-1 (tests + render guard) · PLAT-3 (SW versioning).

**Next (P1 — back the scaffolds, finish the system):**
E2: CAP-2 memory proposals · E3: CAP-8 Care Network backend → CAP-9 sharing +
recipient portal → CAP-6/7 reports & handoffs · CAP-5 plan templates+feedback ·
CAP-11 personalized focus · IA-2 Ask Arbor structure · IA-6 onboarding ·
DS-2 retire `!important` · DS-3 a11y · TS-2/TS-3 privacy+escalation · PLAT-2 perf.

**Later (P2 — expand the platform):**
CAP-10 appointments · CAP-12 Academy content · CAP-13 co-parent · IA-3/4/5 ·
DS-4/5/6/7/8 · TS-4 · PLAT-4 (B2B/B2G) · PLAT-5 notifications · PLAT-6 analytics.

### Top 10 highest-leverage moves
1. **IA-1 URL routing** (unlocks E3 + deep links + fixes back button)
2. **CAP-1 wire Child Memory** (moat becomes real)
3. **CAP-4 pattern→plan loop** (the "intelligence" wow moment)
4. **DS-1 single token source** (kills the fragility that broke Home)
5. **TS-1 dynamic risk** (trust becomes computed, not asserted)
6. **CAP-3 structured Ask Arbor response** (consistent, safe guidance)
7. **CAP-8 Care Network backend** (second marketplace side)
8. **CAP-9 sharing + recipient portal** (the coordinate-care promise)
9. **PLAT-1 tests + render guard** (refactors stop breaking silently)
10. **PLAT-3 SW versioning** (no more stranded-on-old-build)

---

## 6. Guardrails / non-goals (unchanged)

Non-diagnostic always; no unsupervised child-facing AI; parent-approved memory
only; Soft Daylight premium-calm aesthetic (not childish, not clinical); curated
"Find a Professional" (never a gig directory); privacy and escalation first.
