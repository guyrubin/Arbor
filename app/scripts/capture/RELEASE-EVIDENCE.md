# Final Parent release evidence

The final-candidate workflow is separate from the historical offline/fallback
capture and the small mobile evidence workflow. It publishes no site, release,
container image, font binary, app bundle, credentials or real family records.
Only PNG screenshots and explicit evidence JSON/summary files are uploaded.

## Run sequence

1. Integrate the final reviewed UI source and these harness scripts on a dedicated
   candidate branch. A capture from another source commit is not final evidence.
2. Review and push `codex/parent-final-ask-diagnostic` for one mobile-EN Ask pass.
   This attempts launcher/composer readiness and a real local mock response first,
   then separately full-loads the supported `#/coach` route and tests its composer
   and a fresh mock response. Direct-route success never passes a failed launcher. API-error/consent/report fixtures are labeled
   separately. A fixture response is never evidence that the mock request worked.
3. After the UI and Ask readiness are settled, review and push the exact final
   candidate to `codex/parent-final-capture`. The matrix has eight independent jobs:
   four base passes (43 canonical route IDs each, EN/HE at 375×812 and 1280×800)
   and four focused interaction passes using the same viewport/language matrix.
   At most four jobs run in parallel, and failure does not cancel other jobs.
4. Review `release-summary.json`, each shard's JSON and actual PNGs. Green coverage
   is not a visual-quality sign-off. The user-facing result must say which errors,
   layout assertions or unreachable states remain, rather than merely count PNGs.

The workflow records both the checked-out commit SHA and `HEAD:app/src` tree SHA.
The aggregate refuses mismatched identities, missing jobs, incomplete base cells,
missing required interactions or PNGs without actual custom-font glyph evidence.
Aliases/retired IDs stay in the canonical load inventory, with their real final
hash recorded; they are not represented as additional distinct screens.

## Isolation and exact fonts

Dependency/Chromium installation happens before app source is copied into the
image. Only the existing exact Google source stylesheet/WOFF2 URLs are fetched in
an explicitly disposable font-preparation container. The cache is content-hashed
and tied to source CSS and Chromium; no font file leaves that local CI image.

All seed, Vite build, server and browser work happens in `docker --network none`,
checked again by the runtime before app imports. The runner replaces the inherited
environment with an allowlist: mock model, local memory, no Firebase credentials,
no live voice, no cloud ASR/TTS and no real records. `NODE_ENV=production` selects
the existing static server handler, while `ARBOR_ENV=local` preserves the sandbox
API/data/auth gates. The client is built directly with the already installed Vite;
no npm lifecycle, provider, deployment or network task runs at this stage.

The browser has no permissions and external requests are denied. The existing
font hook fulfills only verified public resources in memory. `navigator.onLine`
is explicitly set to true before app startup, while the transport remains offline.
The existing `VITE_HAS_GEMINI_API` display flag suppresses the sandbox notice; it
supplies no key and changes no provider gate. Those choices are recorded in JSON.

## Bounded and honest output

The runtime enforces separate seed/build/readiness budgets, followed by a 12-minute
base-pass deadline, a 10-minute focused-pass deadline or a 4-minute narrow Ask
capture deadline. Every completed cell is saved immediately. The parent runner
reports safe progress every 15 seconds, kills the capture process group at its
budget and keeps partial evidence. CI exit/signal traps copy existing artifacts.
No raw server/browser logs, request payloads or environment dumps are uploaded.

Every base route has the same four-way locale/viewport matrix. The historical
sweep's single-route Hebrew-desktop exception is gone. Seed verification matches
the real locale-aware hydration marker (`version@time@language`). Full mobile PNGs
are supplemental; the primary viewport PNG remains required for each route cell.

## Local verification limits

Only source contracts and direct installed Vitest run locally with the offline
network guard. Do not launch a browser, provider or full sweep on a denied host.
A passing source test does not establish rendered behavior. The actual final
screenshots and interactions must be collected in the dedicated CI container.

## Surface readiness and focused regressions

Coach and Scholar base evidence requires an actually visible composer. A mounted
background Today page or the conversation Suspense fallback is not a ready cell;
a real conversation error boundary is recorded but remains rejected evidence.
Exceptions export only bounded enum categories, allowlisted JavaScript error
names and up to five local static-module frame paths with line/column positions.
No raw exception messages, stacks, function names or URL queries leave the classifier.

Together's normal return waits for the real destination content; a separate early
Back state preserves the interrupted-transition focus requirement. If the capture
misses that brief transition window it records the named unobserved-window failure,
not a pass. Now and Together test the final actionable content at maximum scroll
against the actual sticky/fixed launcher and navigation, including a hit test.
Together's “How to begin” opens the real activity preview and checks its context,
exact Say this text and separate Try/Keep controls without saving an observation.

Structured-report fixtures target the reviewed disclosure layout: the first step
and Say this lead, every optional section is photographed closed and open, and
all supplied display prose is counted once only with every section exposed.
Separate states preserve urgent help ahead of the first step, ungated text-only
explanations, the footer and the real optional action controls without invoking
provider, plan, sharing or memory writes. These are labeled renderer fixtures;
they never stand in for either independently verified real mock response.
