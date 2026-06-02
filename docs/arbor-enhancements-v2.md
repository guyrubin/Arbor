# Arbor — Deep Enhancement Analysis & Backlog (v2)

**Date:** 2026-06-02
**Scope:** all levels — App (architecture/reliability/cost/quality), Capabilities
(product), Design (UX/visual/interaction/a11y/content).
**Basis:** grounded in the shipped, production-deployed codebase (verified, not from memory).

---

## Severity callouts — confirmed in code, fix-first

| # | Finding (verified) | Level | Severity |
|---|---|---|---|
| 1 | **Half the app is unreachable on phones.** `MobileNav` exposes only overview/coach/behaviors/milestones/weekly; the sidebar is `hidden md:flex`, so **Plans, Stories, Scholar, Handoff, Safety have no mobile entry point.** | App + Design | **P0** |
| 2 | **Unbounded AI cost per user.** Only an IP rate-limit (30/min) exists. Daily Focus, auto weekly report, voice-parse, milestone explainers, and coach all call the model with no per-user quota/cost cap. | App | **P0 (financial)** |
| 3 | **Type safety is off.** No `@types/react` installed → `React` is `any`; the entire UI is effectively untyped (source of the `key`/`className` bugs hit during build). | App | P1 |
| 4 | **Zero front-end tests.** All test files are server-side; no component/hook/context tests guard the UI. | App | P1 |
| 5 | **Photos stored as base64 in Firestore docs** (X4). Bloats docs and read cost; belongs in Storage. | App | P1 debt |
| 6 | **Theme dual-system.** Components use dark Tailwind classes; `index.css` overrides them to parchment with **46 `!important` rules**. Fragile to evolve. | Design | P1 debt |
| 7 | **No load skeletons.** Tabs render seeded/empty content while Firestore loads (only WeeklyTab uses one). | Design | P2 |
| 8 | **Modal/drawer a11y gaps.** No ESC-to-close, no focus trap; toasts aren't `aria-live`. | Design/a11y | P2 |
| 9 | **No pagination.** `behaviorLogs`/`conversations` load in full via `onSnapshot`; degrades at scale. | App | P2 |

---

## APP level (architecture, reliability, cost, quality)

| ID | Enhancement | Outcome | V/E |
|---|---|---|---|
| A1 | Per-user AI quotas + cost guardrails | Spend can't run away; looping/abusive calls capped | H/M |
| A2 | Move prompt construction + language to the server | One source of truth; removes hacky client-side localization | H/M |
| A3 | Add `@types/react`/`@types/react-dom`, fix surfaced errors | Real type safety; fewer runtime bugs | H/M |
| A4 | Front-end test suite (Vitest + RTL): hooks, contexts, gates, key tabs | Refactors stop breaking silently | H/M |
| A5 | Photos → Firebase Storage (upload + signed URL; keep client downscale) | Cheaper, scalable attachments | M/M |
| A6 | Query limits + pagination on logs/conversations | Stays fast at thousands of entries | M/M |
| A7 | Error + event monitoring (capture ErrorBoundary catches; or Sentry) | See prod breakage instead of guessing | M/S |
| A8 | CI/CD: merge `feat/arbor-next` → `main`; auto build+deploy on main | Repeatable, reviewable releases (currently manual) | M/M |
| A9 | Vendor code-splitting (`manualChunks` for recharts/firebase/dnd-kit) | Faster first load (main chunk ~700KB today) | M/S |
| A10 | Auth completeness: password reset, email verification, last-login | Real account hygiene | M/S |
| A11 | Consolidate/limit live listeners (8+ onSnapshot per child) or lazy-subscribe | Lower Firestore cost + memory | M/M |

## CAPABILITIES level (product)

| ID | Enhancement | Outcome | V/E |
|---|---|---|---|
| C1 | Edit (not just delete) logs, milestones, plan steps & titles | Fix mistakes without recreating | H/S |
| C2 | Trends over time — milestone-progress timeline + multi-month behavior-intensity line | See the arc, not just this week | H/M |
| C3 | Server-scheduled weekly report + email digest (Cloud Scheduler) | Reports + Sunday email land with the app closed | H/M |
| C4 | Background push reminders (FCM) | Nudges fire when Arbor isn't open | H/M |
| C5 | Structured routines builder (morning/bedtime co-regulation checklists) | Turns guidance into a daily ritual | M/M |
| C6 | Goals: set a focus and track it to resolution | Outcome tracking, not just logging | M/M |
| C7 | Global search across logs, notes, conversations | Find anything fast | M/S |
| C8 | Scholar Academy depth — per-scholar content + "apply to my child" | Turns a thin tab into real value | M/M |
| C9 | Sleep / food / mood quick-trackers feeding the correlation engine | Richer pattern intelligence (X5) | M/M |
| C10 | "What Arbor knows" memory view (browse approved memory, edit/forget) | Transparency + trust | M/S |

## DESIGN level (UX, visual, interaction, content, a11y)

| ID | Enhancement | Outcome | V/E |
|---|---|---|---|
| D1 | Fix mobile navigation — "More" sheet in the bottom bar exposing all tabs (resolves #1) | Phone users reach the whole app | H/S |
| D2 | Resolve the theme dual-system — one theme, tokens, delete `!important`; adopt `ui/` primitives everywhere | Coherent, maintainable visual system | H/M |
| D3 | Loading skeletons on collection load (gate on `loaded`) | No empty/seeded flash | M/S |
| D4 | Modal/drawer a11y: ESC, focus trap, return focus, `aria-live` toasts | Keyboard + screen-reader usable | M/S |
| D5 | Polished empty states with illustration + CTA on every tab | New users always know the next step | M/S |
| D6 | Full RTL when Hebrew is selected (not just AI content) | The app, not just answers, fits the persona | M/M |
| D7 | Microcopy/voice pass — warm, plain language (less jargon) | Approachable, on-brand tone | M/S |
| D8 | Directional tab transitions (slide by tab order) + reduced-motion | The editorial, premium feel intended | L/S |
| D9 | Real story illustrations (richer generative SVG scenes) | Bedtime feels magical, not abstract | M/M |
| D10 | Onboarding upgrade — multi-step, delightful, optional sample data | Stronger first 5 minutes | M/M |

---

## Recommended sequence (cross-level, top 10)

- **Do now (P0/quick + high value):** D1 (mobile nav) · A1 (AI cost caps) · C1 (edit) · D3 (skeletons) · A7 (error monitoring)
- **Then (foundational):** A3 (`@types/react`) → A4 (tests) · D2 (theme/tokens) · A2 (server prompts) · C2 (trends)
- **Bets:** A8 (CI/CD + merge) · C3/C4 (scheduled reports + push) · A5 (Storage) · D6 (full RTL)

## Guardrails honored (unchanged non-goals)

No multi-caregiver/collaboration, no external image-generation API, no third-party
analytics scripts, parchment-editorial design intent.

---

## Implementation status (2026-06-02)

Shipped end-to-end (typechecked + built + tested + deployed):

| Track | Done |
| :--- | :--- |
| **App** | A1 AI cost cap · A2 server-owned language · A3 @types/react · A4 front-end tests (+tz fix) · A6 log pagination · A7 error monitoring · A8 deploy CI workflow · A9 vendor chunking |
| **Capabilities** | C1 edit · C2 trends · C5 routines · C6 goals · C7 global search · C8 scholar "apply to my child" · C9 daily check-in · C10 memory view |
| **Design** | D1 mobile nav (P0) · D2 token layer + Card · D3 load skeletons · D4 modal/toast a11y · D6 Hebrew RTL content · D7 microcopy · D8 directional tabs |
| **Covered by existing** | D5 empty states (added across tabs) · D9 generative SVG story illustrations · D10 onboarding (V2-B) |

### Deferred — infrastructure-heavy (need deliberate setup; documented, not rushed)

| ID | Status & remaining work |
| :--- | :--- |
| **A5 Photo → Storage** | **Code-complete with graceful fallback.** `lib/storage.ts` uploads downscaled thumbnails to `users/{uid}/children/{childId}/photos/…`; `storage.rules` (owner-only, 5MB cap) + `firebase.json` are in place; the log photo input uploads to Storage and **falls back to inline base64** if Storage is unavailable. **One activation step left:** click "Get Started" at console.firebase.google.com → Storage (a region/ToS step like Auth), then `firebase deploy --only storage`. Until then it transparently uses base64 — no regression. |
| **A11 Listener consolidation** | 8+ `onSnapshot` listeners per child. Remaining: lazy-subscribe per active tab (or a shared subscription registry). Performance/cost optimization; low user value, moderate refactor risk — do with profiling. |
| **C3 Server-scheduled weekly report + email** | Reports generate client-side today (auto on open + on demand, with history). Remaining: port report generation to a server endpoint, add a Cloud Scheduler job hitting it weekly, and an email transport (e.g. SendGrid). Larger server effort + new infra. |
| **C4 Background push (FCM)** | Reminders fire in-app today. Remaining: VAPID key, SW push handler, token registration/storage per user, and a server send path. Significant; needs FCM setup. |

Recommendation: schedule the four deferred items as a dedicated "infra hardening"
iteration with the GCP console steps done deliberately (each can hit an
initialization wall), rather than folded into a feature sweep.
