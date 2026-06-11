# Backlog Implementation — 2026-06-11

One session against the full outstanding development backlog. Every item that is implementable in code is implemented, tested, and committed; items that require money, lawyers, content, or hiring are scaffolded to the seam where those plug in. Commits: `c6f19e1` (backend), `0bf3751` (client), plus the ops commit containing this doc.

Status legend: ✅ done · 🟡 scaffolded (code seam ready, external piece missing) · ⏸ needs Guy / external (not a code task).

## 1. Monetization & revenue
| Item | Status | Notes |
| --- | --- | --- |
| Billing / checkout (Stripe/RevenueCat) | 🟡 | Whole entitlement layer built (`src/server/entitlements.ts`). The billing webhook only has to write `entitlements/{uid} = {plan:"plus"}` — nothing else changes. Needs a Stripe account + product decision. |
| Free vs Plus enforcement | ✅ | Decided and wired: free = 10 coach msgs/day (`FREE_COACH_MESSAGES_PER_DAY`), 1 child, no professional reports / advanced plans. Coach 402 → inline upsell; AddChild gates multi-child; Settings shows real plan + usage. **OFF by default** (`ENFORCE_ENTITLEMENTS=false`) so the beta keeps full access — flipping one env var turns the paywall on. |
| Professional intro/booking transaction | ✅ (v1) | "Request consultation" is now a real flow: durable `consultRequests` record + structured note + preferred mode + optional intro email via `CONSULT_INTAKE_EMAIL`. Directory-vs-invite decision still open (business). |
| B2B clinician/school portal | ⏸ | Not started — a product of its own. Trusted Sharing's server-enforced grants remain the foundation. |

## 2. Retention mechanics
| Item | Status | Notes |
| --- | --- | --- |
| Weekly digest "{child}'s week" | ✅ in-app / 🟡 push-email | `/api/digest`: deterministic truthful stats + AI narrative (graceful fallback). Weekly Insight tab is now "{child}'s week". The payload already carries `subject`/`preheader` — when email/push infra exists it's a transport job only. |
| Push notifications | ⏸ | Needs FCM/email infra decision; no code yet. |

## 3. Content
| Masterclasses, Family Formation cards, verified pro dataset | ⏸ | Content/business work — cannot be coded. Pro directory still runs on seed data behind the same API contract a real provider table would use. |

## 4. Screening & clinical credibility
| Item | Status | Notes |
| --- | --- | --- |
| EU MDR / health-claims legal gate | ⏸ | Counsel opinion required — blocking for named-condition screeners. |
| Clinical advisor | ⏸ | Recruiting/business. |
| Condition-specific screeners + licensing | ⏸ | Gated on the legal opinion. |
| Age-banded item bank expansion | ⏸ | Advisor-reviewed content work. |

## 5. Product/UX
| Item | Status | Notes |
| --- | --- | --- |
| "My Child" full unification | ✅ | Development Profile is one scrolling narrative (identity → right now → milestones → strengths → language → memory → next step) with jump links into the deep tools. |
| Scholar Frameworks value pass | ✅ | "Use this lens when…" on every scholar card and under the active lens picker; removed lingering hardcoded "Dylan" example prompts. |
| Appointments booking/payment/video | ⏸/🟡 | Consult-request v1 covers the intro transaction; full booking/payment remains future. |
| Co-parent shared workspace | ⏸ | Not built (large). Sharing grants + recipient API exist as foundation. |
| Onboarding → coach seeding | ✅ | The "what's on your mind" concern pre-fills the Ask Arbor composer on first session (storage bridge across the provider boundary). |

## 6. Trust, privacy & compliance
| Item | Status | Notes |
| --- | --- | --- |
| Child PII unredacted to LLM (P0) | ✅ | `src/server/redaction.ts`: name/email/phone redacted at every model-call seam (chat, council, voice incl. streaming restore, extract-log, vision, plans, stories, hero journeys, analysis, handoff, digest); responses restored losslessly. |
| GDPR erasure + export | ✅ code / ⏸ DPIA | Real `/api/privacy/erase` (hard-deletes memory ledger + share grants) wired into child deletion; `/api/privacy/export` merged into the JSON export. The DPIA itself is a legal document — still needed. |
| Regex-only safety screen | ✅ | Output-side screen added: always-on lexical floor (diagnosis/medication/treatment-directive) + env-gated semantic LLM classifier (`ENABLE_OUTPUT_SAFETY_CLASSIFIER`). Blocked responses get a calm, parent-facing replacement. |
| CSP disabled | ✅ | Tightened CSP re-enabled for dev/stage/prod (self + Google fonts + Firebase auth/Firestore + Gemini Live HTTPS/WSS); local dev exempt for Vite HMR. |

## 7. Engineering / security / ops
| Item | Status | Notes |
| --- | --- | --- |
| WIF migration | 🟡 | Workflow is WIF-ready: set `GCP_WIF_PROVIDER` + `GCP_DEPLOY_SA` repo variables and the key path is skipped. One-time GCP commands + key-retirement checklist: `docs/ops/wif-migration.md`. Running the gcloud setup + deleting the key needs project IAM access. |
| Observability | ✅ | Structured JSON logs (Cloud Logging/Error Reporting format), request ids (`X-Request-Id`), method/path/status/latency on every request; all route `console.error` replaced. Sentry optional later. |
| Rate/cost caps in-memory | ✅ | Counters moved to Firestore (`aiQuota` collection, TTL-ready `expireAt`), shared across Cloud Run instances; in-memory for local. Fails open with logging. |
| Single-region / DR | ⏸ | Infra decision; unchanged. |

## 8. Quality & accessibility
| Item | Status | Notes |
| --- | --- | --- |
| Accessibility | ✅ (major items) | Modal focus trap + focus restore + `aria-labelledby` + Escape; drawer Escape + dialog roles; portals keep token/focus-ring scope; removed app-wide `select-none` (parents can copy scripts). Focus-visible + reduced-motion already existed. Full-app contrast sweep still worth a dedicated pass. |
| Automated tests | ✅ | 27 new unit tests (redaction incl. stream-split alias, output screen, entitlements, digest stats, counter store, share erasure). 105 passing; build, safety eval, framework check green. True browser e2e (Playwright) still absent. |
| Empty/loading/error states | 🟡 | New surfaces shipped with real empty/fallback states; an app-wide rubric pass remains. |
| Mobile parity sweep | ⏸ | Manual QA. |

## New environment flags
`ENFORCE_ENTITLEMENTS`, `FREE_COACH_MESSAGES_PER_DAY`, `ARBOR_PLUS_UIDS`, `ARBOR_PLUS_EMAILS`, `ENABLE_OUTPUT_SAFETY_CLASSIFIER`, `CONSULT_INTAKE_EMAIL` — all documented in `app/.env.example`, all default to current (beta) behavior.
