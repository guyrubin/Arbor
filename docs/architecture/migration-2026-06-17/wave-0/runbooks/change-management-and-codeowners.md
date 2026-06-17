# Change-Management Gate — framework.json & Safety-Critical Copy

**Mission:** OPS-6 (Spec A — Operational Excellence & DevOps)
**Status:** Wave-0 artifact — drop-in. This document is the primary deliverable plus two apply-step snippets (`.github/CODEOWNERS`, branch protection).
**Owner of the gate:** the safety/clinical owner (GitHub: `@guyrubin` — single-maintainer today; replace with a dedicated safety reviewer or `@guyrubin/safety` team when staffing allows).
**Repo:** `github.com/guyrubin/PPPPtherapy-` · default branch `main`.

---

## 1. Why this gate exists

Arbor is an automated developmental-guidance product for **children**. A small set of files encodes the *decision logic and the words a parent reads* — change one carelessly and you can ship an unsafe claim (e.g. "clinical counselor"), a stale model id, or a framework that no longer matches the published operating model. CI already **runs** the guards; today nothing **forces** a human to look or forces those guards to be required before merge.

The CI guards that already exist (`.github/workflows/arbor-ci.yml`, job `app-quality-gates`, lines 25-26):

| CI step | Script | What it protects |
| :--- | :--- | :--- |
| `npm run check:framework` | `app/scripts/framework-check.mjs` | `app/src/framework.json` stays consistent with `docs/developmental-ai-operating-model.md` — every domain `label`/`id`, every `ageBand.id`, every `sixFrames.label` must appear in the doc; also maps scholar-card review coverage under `knowledge/framework/scholars/`. |
| `npm run eval:safety` | `app/scripts/safety-eval.mjs` | Scans a fixed file set for forbidden phrasing — stale `gemini-3.5-flash`, "clinical counselor", "co-therapy partner/platform", "diagnosis error", "diagnostic-level", "medical certainty … without". Exits non-zero on any hit. |

The gap (per spec OPS-6): **no `CODEOWNERS`** (confirmed — none in repo) and **no branch protection** binding these files to mandatory review + mandatory checks. A branch could merge a `framework.json` edit with zero review and, on a misconfigured ruleset, without those checks being required. OPS-6 closes that with `CODEOWNERS` + branch protection — **governance, not new code**.

---

## 2. Protected paths (the "safety surface")

These are the files whose change must trigger owner review. The list is derived directly from what the two guard scripts actually read, plus the human-authored knowledge the framework depends on.

### 2a. Scanned by `safety-eval.mjs` (forbidden-phrase guard)

- `app/server.ts`
- `app/metadata.json`
- `app/src/App.tsx`
- `app/src/initialData.ts`
- `app/src/types.ts`
- `app/src/routes/api.ts`
- `app/src/safety/escalation.ts`
- `app/src/contracts/coach.ts`
- `app/src/ai/modelRouter.ts`
- `app/src/config/env.ts`

### 2b. Validated by `framework-check.mjs` (framework ↔ doc consistency)

- `app/src/framework.json` (the source of truth for domains / age bands / six frames)
- `docs/developmental-ai-operating-model.md` (the published model the JSON is checked against — drift in **either** breaks the check, so **both** are owned)
- `knowledge/framework/scholars/**` (scholar cards; their front-matter `domains:` + `review_status:` feed the coverage map)

### 2c. Safety-critical UI/prompt copy not yet in the scanner

`safety-eval.mjs` does **not** currently scan these, but they are the words a parent or child sees on the safety path and must get the same review:

- `app/src/safety/outputScreen.ts` (output-screening copy)
- `knowledge/framework/escalation/**` (escalation knowledge)
- `knowledge/framework/age-bands/**`, `knowledge/framework/six-frames/**`, `knowledge/framework/interventions/**` (framework knowledge that informs generated guidance)

> **Action item (tracked, not blocking OPS-6):** add `src/safety/outputScreen.ts` to the `files` array in `app/scripts/safety-eval.mjs` so the forbidden-phrase scan covers it. This is a one-line array addition; out of scope for this Wave-0 doc because it edits a tracked file — capture it as a follow-up (see §7).

---

## 3. The gate (what must be true before a protected file merges)

A pull request that touches **any** path in §2 must satisfy **all** of:

1. **Owner review** — at least one approving review from a `CODEOWNERS` owner of the touched path (GitHub enforces "require review from Code Owners").
2. **Green required checks** — the `app-quality-gates` job must pass. Because that job runs `check:framework` and `eval:safety` (and `lint`, `test`, `build`), a forbidden phrase or a framework/doc drift **fails the required check and blocks merge**.
3. **Up-to-date branch** — PR branch is current with `main` (so the checks ran against the post-merge tree).
4. **EN/HE alignment note** — if the change touches generated/parent-facing copy or `framework.json`, the PR description must confirm the Hebrew (RTL) copy/classifier owner has reviewed in the **same** PR (see IL note, §6). This is a review-checklist item enforced by the owner, not by CI.

Re-running `eval:safety` on every such PR is automatic — it is already a step in `app-quality-gates`, which runs on `pull_request`. OPS-6 only makes that step **required** and adds the **human** owner.

---

## 4. Apply Step A — add `.github/CODEOWNERS`

`CODEOWNERS` does not exist yet. Create it at `.github/CODEOWNERS` with the content below. (GitHub resolves `.github/CODEOWNERS`, `CODEOWNERS`, or `docs/CODEOWNERS`; use `.github/` for convention.)

> **Why `@guyrubin` literally:** single-maintainer repo today. When a second reviewer or a safety team exists, replace each `@guyrubin` on the safety lines with the team handle (e.g. `@guyrubin/safety`) — the rest of the file stays.

```
# .github/CODEOWNERS
# Arbor change-control — OPS-6 (Spec A, Operational Excellence & DevOps).
# Owners listed here are REQUIRED reviewers (paired with branch protection's
# "Require review from Code Owners"). Last matching pattern wins, so the
# safety-surface rules are placed AFTER the broad default.
#
# Replace @guyrubin with @guyrubin/safety (a team) once a dedicated
# safety/clinical reviewer exists.

# ---- Default: any change gets the maintainer's eyes -------------------------
*                                       @guyrubin

# ---- Framework source of truth + the doc it is checked against -------------
# Changing EITHER side can break `npm run check:framework`; both are owned.
/app/src/framework.json                 @guyrubin
/docs/developmental-ai-operating-model.md  @guyrubin

# ---- Human-authored framework knowledge (feeds generated guidance) ---------
/knowledge/framework/                   @guyrubin

# ---- Safety-critical code + copy (scanned by `npm run eval:safety`) ---------
/app/src/safety/                        @guyrubin
/app/src/contracts/coach.ts             @guyrubin
/app/src/routes/api.ts                  @guyrubin
/app/src/ai/modelRouter.ts              @guyrubin
/app/src/config/env.ts                  @guyrubin
/app/metadata.json                      @guyrubin

# ---- The guards themselves (weakening a guard needs review too) ------------
/app/scripts/safety-eval.mjs            @guyrubin
/app/scripts/framework-check.mjs        @guyrubin

# ---- This governance config (don't let the gate be edited unreviewed) ------
/.github/CODEOWNERS                      @guyrubin
/.github/workflows/                      @guyrubin
```

**Apply:**
1. On a branch, create the file at `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/.github/CODEOWNERS` with the content above.
2. Open a PR. GitHub validates `CODEOWNERS` syntax in the PR "Code owners" tab — confirm there are **no parse warnings** (a malformed line silently disables that rule).
3. Merge. From then on, PRs touching the listed paths will auto-request the owner and (after Apply Step B) require their approval.

> **Note on `*` + last-match-wins:** GitHub uses the *last* matching pattern as the effective owner. Here the default and the specific rules resolve to the same `@guyrubin`, so order is harmless today. Keep the safety lines **below** `*` so that when they get a distinct team owner, the specific rule wins for those paths.

---

## 5. Apply Step B — branch-protection / ruleset settings to request

Branch protection is a **repo setting, not a committed file** — it cannot be added by writing to the tree. A human with admin on `guyrubin/PPPPtherapy-` must set it. Use a **Repository Ruleset** (Settings → Rules → Rulesets → New branch ruleset) targeting `main`, or classic Branch protection (Settings → Branches). Exact toggles:

**Target:** branch `main` (default). Enforcement: **Active**.

| Setting | Value | Why |
| :--- | :--- | :--- |
| Require a pull request before merging | **On** | No direct pushes to `main`; everything flows through review. |
| → Required approvals | **1** | One owner approval (raise when the team grows). |
| → Require review from Code Owners | **On** | This is what makes `.github/CODEOWNERS` *binding* for the §2 paths. Without it, CODEOWNERS only auto-requests. |
| → Dismiss stale approvals on new commits | **On** | A push after approval re-opens review so a sneaked-in forbidden phrase can't ride a stale approval. |
| Require status checks to pass before merging | **On** | — |
| → Required checks | **`app-quality-gates`** | The job that runs `lint`, `test`, `check:framework`, `eval:safety`, `build`. Making it required means a framework/doc drift or forbidden phrase **blocks merge**. (Select it by the job name as it appears in the checks list after one CI run on a PR.) |
| → Require branches to be up to date before merging | **On** | Checks ran against the would-be merged tree. |
| Require conversation resolution before merging | **On** | Owner's review comments must be resolved. |
| Block force pushes | **On** | Protects history / audit trail. |
| Restrict deletions | **On** | `main` cannot be deleted. |
| Do not allow bypassing the above settings | **On** (no bypass list, or admins-only and used only for emergencies) | A B2G/DPIA expectation: the gate is not optional for the owner either. If an emergency bypass is granted, it must be logged (see §8). |
| Require signed commits | *Recommended* | Strengthens the audit trail for a children's-data product; optional for OPS-6. |
| Require linear history | *Optional* | Cleaner DORA lead-time signal (Spec A OPS-3); not required for OPS-6. |

**Important sequencing:** the required-check name `app-quality-gates` only appears in the picker **after** the CI workflow has run at least once on a PR. So: (1) merge the `CODEOWNERS` PR (its own CI run registers the check name), then (2) open the ruleset and select `app-quality-gates`, then (3) flip the ruleset to Active.

---

## 6. Market notes (NL / IL)

- **NL (GDPR/AVG + DPIA + B2G):** demonstrable change-control over the automated decision logic affecting children is a DPIA and B2G procurement expectation. This runbook + `CODEOWNERS` + the branch-protection record is the **auditable evidence** that `framework.json` and safety copy cannot change without review and an automated forbidden-phrase + consistency check. No NL-specific source file differs.
- **IL (Amendment 13, Hebrew/RTL live):** the safety-eval and framework copy must stay aligned across EN/HE. When `app/src/framework.json` or any §2 copy changes, the Hebrew safety classifier/copy (owned by the AI specs) must be re-reviewed in the **same PR** — enforced as the §3.4 review-checklist item. The owner should not approve an EN-only safety-copy change without confirming HE parity. Track adding HE copy paths to `CODEOWNERS` once the Hebrew copy files land.

---

## 7. Verification (acceptance test for the gate)

Run after Apply Steps A + B are live:

1. From a **non-owner** branch (or a second account), open a PR editing `app/src/framework.json`. Confirm GitHub **requires** Code Owner review and the PR **cannot merge** without `@guyrubin` approval.
2. In that PR, insert a forbidden phrase the scanner catches — e.g. add the literal string `clinical counselor` to `app/src/contracts/coach.ts` (matched by `safety-eval.mjs` check `clinical counselor claim`, line 20). Confirm `app-quality-gates` goes **red** and merge is **blocked**.
3. Introduce a framework/doc drift — add a domain to `app/src/framework.json` whose `label` is absent from `docs/developmental-ai-operating-model.md`. Confirm `check:framework` fails (`Missing domain in docs: …`) and blocks merge.
4. Revert the bad edits; confirm green CI + owner approval lets it merge.
5. Confirm the `app-quality-gates` check shows as **Required** in the PR's merge box, not merely "expected".

No `tsc`/`vite build`/test impact — this mission adds no application code.

---

## 8. Operating the gate

- **Adding an owner / team:** replace `@guyrubin` on the safety lines in `.github/CODEOWNERS` with the team handle; raise "Required approvals" to 2 if you want two-person review on safety changes.
- **Adding a protected path:** add a line in `.github/CODEOWNERS` (it merges via the gate itself — meta-protected by the `/.github/CODEOWNERS` rule). If the path also contains forbidden-phrase risk, add it to the `files` array in `app/scripts/safety-eval.mjs` (a separate, owner-reviewed PR).
- **Emergency bypass:** if "Do not allow bypassing" must be relaxed for a Sev-1 hotfix, the bypassing maintainer records it in the incident log (OPS-5 `docs/compliance/incident-response-plan.md`) with PR link, reason, and a follow-up PR that restores full review. Bypass is the exception, logged every time.

### Follow-ups deliberately left out of this Wave-0 doc (they edit tracked files)

| Follow-up | File | Why deferred |
| :--- | :--- | :--- |
| Add `src/safety/outputScreen.ts` to the scanned set | `app/scripts/safety-eval.mjs` | Edits a tracked file; do in a clean-baseline PR (one-line array addition). |
| *(Optional)* paths-filtered "needs safety sign-off" reminder job | `.github/workflows/arbor-ci.yml` | Spec marks this optional; `CODEOWNERS` + required checks is the cheaper, sufficient formalization. Skip unless reviewers miss the gate. |

---

## 9. References (real code, grounded)

- `.github/workflows/arbor-ci.yml` — job `app-quality-gates`, lines 22-27 (`lint`/`test`/`check:framework`/`eval:safety`/`build`); runs on `pull_request` and `push` to `main`.
- `app/scripts/safety-eval.mjs` — scanned `files` (lines 5-16); forbidden-phrase `checks` (lines 18-25); non-zero exit on hit (lines 39-43).
- `app/scripts/framework-check.mjs` — `frameworkPath` `app/src/framework.json` (line 6); `docPath` `docs/developmental-ai-operating-model.md` (line 7); domain/age-band/six-frame consistency (lines 14-33); scholar-card coverage from `knowledge/framework/scholars/` (lines 36-48).
- `app/src/framework.json` — domains / age bands / six frames source of truth.
- `app/src/safety/` (`escalation.ts`, `outputScreen.ts`), `app/src/contracts/coach.ts` — safety-critical copy.
- `knowledge/framework/` — `age-bands/`, `escalation/`, `interventions/`, `scholars/`, `six-frames/`.
