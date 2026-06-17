# Wave 0 — Apply Checklist (the human/clean-baseline gates)

**Status:** Wave 0 **authored to completion** by the autonomous run on 2026-06-17 — 13 missions, 23 artifacts + 5 new observability modules, **zero edits to tracked files, no git, no GCP, no deploy.** Everything below is the part an agent physically cannot do: GCP-console/gcloud, GitHub-admin, legal sign-off, and the code-wiring that must wait for a **clean baseline** (the working tree is currently dirty with billing/JITAI/MimicStudio WIP — commit or stash that first).

Nothing here is urgent or destructive. Do the **clean-baseline commit first**, then work top-down.

---

## 0. Unblock everything else (do first)
- [ ] **Get a clean baseline.** The Arbor repo is on `feat/arbor-billing-mon2` with 15 modified + 10 untracked files of unrelated in-flight work. Commit or stash it. Until then, none of the "clean-baseline" wiring steps below should be applied (they'd entangle that WIP). The new files this wave created are all additive and safe to leave in place.

## 1. GCP / gcloud (needs prod project access + the named roles)
> Project: `arborprd-westeu` · region `europe-west4`. Each script is idempotent and was syntax-checked (`bash -n`) but **not executed**.
- [ ] **SEC-4 — Workload Identity Federation.** Edit `artifacts/wif-setup.sh` (set `GITHUB_REPO` to the real `owner/repo`), run it as GCP Owner/IAM-admin, prove a green keyless deploy, **then** re-run with `CONFIRM_DELETE_KEY=yes` to delete `GCP_SA_KEY`. Apply the `arbor-deploy.yml` snippet (runbook §6) by hand on the clean baseline. *(removes standing credential-theft liability)*
- [ ] **REL-1 — Backup/DR.** `gcloud firestore databases update --enable-pitr`; create daily 7-day backup schedule; run the **restore drill** (scratch DB) and fill the RTO numbers in the runbook. *(~few €/mo)*
- [ ] **REL-6 — Firestore TTL.** `gcloud firestore fields ttls update expireAt --collection-group=aiQuota --enable-ttl`. (Indexes auto-ship via deploy once merged — see §4.)
- [ ] **OPS-1 + REL-5 — Monitoring.** Create one email notification channel; create the log-based metrics + alert policies from `artifacts/alert-policies.yaml` / `alert-policies.json`, and the 4 SLOs from `artifacts/slo-definitions.json`. *(AI-success SLI depends on REL-2's `model_call` log line — lands in W1.)*
- [ ] **COST-3 — FinOps.** Edit `BILLING_ACCOUNT_ID` in `artifacts/cost-budget.sh`, run it (budget + Pub/Sub + email alerts), then enable the **BigQuery billing export** in the console (CLI can't toggle it).
- [ ] **CMP-4 — Residency checks (read-only).** Confirm Firestore `locationId` is `europe-west4`/`eur3` (immutable — a US value is launch-blocking), Storage bucket is EU, and Vertex EU serves the models. Record the date.
- [ ] **PERF-2/PERF-1 — Right-sizing (do after W1 ships `/healthz`).** Deploy a dedicated load-test revision, run `artifacts/loadtest.k6.js`, choose CPU/memory/concurrency by the decision rules, then apply the `--min-instances=1` + sizing flags to `cloudbuild.prod.yaml`. **`min-instances=1` is the one deliberate recurring spend — approve it or take the Cloud-Scheduler-warmup lean alt.**

## 2. GitHub admin (repo settings — no code)
- [ ] **OPS-6 — Change gate.** Add `.github/CODEOWNERS` (content in the runbook §4), merge it so the `app-quality-gates` check registers, then create a branch ruleset on `main` (require PR + Code Owner review + status check + block force-push) per runbook §5.
- [ ] **SEC-8 — Supply-chain.** Add the `security:` job to `arbor-ci.yml` (or as standalone `arbor-security-scan.yml`) + new `.github/dependabot.yml`; enable Dependabot alerts / Secret scanning / Push protection in Settings → Code security. Non-blocking first, flip to blocking after one clean release.

## 3. Legal / sign-off (human decision — the B2G paper gate)
- [ ] **CMP-2 — DPIA sign-off.** Controller (Guy; DPO once appointed) completes the §13 sign-off — accept/reduce each Medium residual (R-1 profile-to-LLM, R-9 unsafe output, R-11 breach exec). Stays DRAFT until signed.
- [ ] **CMP-4 — DPAs + IL determination.** Execute Google Cloud DPA (+EU SCCs), confirm Vertex "no training on customer data"; Stripe/RevenueCat DPAs before billing. **IL:** counsel confirms Amendment-13 database-registration + DPO-threshold. **NL:** appoint DPO / Art. 27 rep before any municipality/JGZ/insurer deal.
- [ ] **OPS-5/CMP-6 — Breach wording.** Counsel confirms the IL Amendment-13 serious-incident deadline + the AP datalek portal fields, and a Hebrew-fluent reviewer finalizes the RTL notices.
- [ ] **REL-1 — Single-region risk acceptance** (sign-off block in the DR runbook §6.7).
- [x] **SEC-9 — CMEK.** Decision recorded: **DEFER** (Google-managed keys are compliant); activate only on a B2G contract clause. No action unless triggered.

## 4. Clean-baseline code wiring (only after step 0)
- [ ] **OPS-1 wiring.** Apply the §4 drop-in diffs from `observability/ops-1-observability-design.md` into `app/src/server/requestContext.ts` + `logger.ts` (trace id reaches `ai.usage`+error lines; allow-list preserves `errorMessage`/`totalTokens`). Then `npm run lint && npm test && vite build` green. *(modules + 26 passing tests already on disk; not yet wired)*
- [ ] **REL-6 indexes.** Append the two composites from `artifacts/firestore-indexes.additions.json` into `/firestore.indexes.json` — **keep the existing `memoryEvents (childId ASC, createdAt ASC)` entry verbatim** (removing it breaks the live collection-group query / re-triggers the Gemini outage).
- [ ] **Promote artifacts into the repo tree:** move `artifacts/*.json` → `infra/monitoring/`, scripts → `infra/`; copy the DR runbook → `docs/ops/dr-runbook.md`, SLO doc → `docs/ops/slo.md`, ADR → `docs/adr/0005-coach-model-fitness-review.md`; replace the 451-byte `docs/compliance/incident-response-plan.md` stub.
- [ ] **Assessment back-links + model-router comments** (additive, per each agent's apply step).

---

## Mission ledger (all complete, authored)
| Mission | Artifact | Apply gate |
|---|---|---|
| CMP-2 DPIA | `governance/DPIA.md` | Legal sign-off |
| CMP-4 RoPA+DPA | `governance/records-of-processing-and-DPA.md` | Legal + residency check |
| OPS-5/CMP-6 incident+breach | `runbooks/incident-response-and-breach.md` | Legal (wording) |
| OPS-6 change gate | `runbooks/change-management-and-codeowners.md` | GitHub admin |
| REL-1 backup/DR | `runbooks/backup-dr-rto-rpo.md` | gcloud + sign-off |
| REL-5 SLO/SLI | `slo/slis-slos-error-budget.md` + 3 JSON | gcloud (after REL-2) |
| SEC-9 CMEK | `security/cmek-evaluation.md` | Decided: defer |
| SEC-4 WIF | `security/wif-setup-runbook.md` + `wif-setup.sh` | gcloud + GitHub |
| COST-3 budget | `cost/budget-and-billing-export.md` + `cost-budget.sh` | gcloud + console |
| PERF-2/1 load-test | `perf/load-test-plan.md` + `loadtest.k6.js` | gcloud + spend |
| AI-7 model-fitness | `ai-governance/model-fitness-review-ADR.md` | Promote to ADR |
| OPS-1 observability | `observability/ops-1-observability-design.md` + `app/src/lib/observability/*` | Clean-baseline wiring + gcloud |
| REL-6/SEC-8 infra | `artifacts/firestore-indexes.additions.json`, `ci-security-job.yml` | Clean-baseline merge + GitHub |

**Next wave:** W1 (See & Cap) is **code** on the API spine — it needs the clean baseline (step 0) before it can run without clobbering. Say the word once the tree is clean and I'll execute W1 the same way.
