# PR Verification — Arbor (2026-06-29)

**Reviewer:** Claude Code (Opus 4.8) · multi-agent review (25 agents) + ground-truth build/test
**Against:** Hermes brand/UX/IA backlog (`~/arbor_brand_ux_review/`) P0.1 + P0.2 acceptance criteria
**Two open PRs** (both branch from `origin/main` = `e8e56cd`, neither merged):

| PR | Branch | Scope | Verdict |
|---|---|---|---|
| **A** | `arbor-settings-language-canonical` | Hermes **P0.1** (one language surface) + **P0.2** (sectioned Settings IA) | **Ship** — 2 cheap polish items recommended |
| **B** | `arbor-confirm-p0-waitlist` | Founder email on new waitlist lead (Resend) | **Safe to merge today** (path dormant); **decouple the 502 before arming Resend** |

---

## Ground truth (executed, not inferred)

| Check | Result |
|---|---|
| Both PRs merge into `origin/main` | ✅ clean (PR-A fast-forwards, PR-B `ort` merge, no conflicts) |
| Both PRs merge into **each other** | ✅ clean |
| `tsc --noEmit` on merged result | ✅ **PASS** |
| Targeted tests (`languageSettingsCanonical` + `waitlist`) | ✅ **22/22 pass** |
| `LanguageContext.setUiLang` cascades to `aiLang` | ✅ verified (`setUiLangState(l); setAiLangState(l)`) — Save settles dirty-state correctly |

### ⚠️ Corrected a false alarm from the static review
The review agents flagged a "**byte-identical AddChildModal.tsx double-ship**" and "**stale base d69e467 / rebase onto 8c9fd58**" as merge blockers. **These are phantoms.** There are two divergent `main`s:
- `origin/main` = `e8e56cd` — the **real** PR base
- local `main` = `8c9fd58` — a **divergent** local lineage (mobile-store + wip commits); merge-base `d69e467`

The agents read the on-disk `uc1-layout-foundation` working tree / diffed local `main`, so they "saw" child-profile rewrites that **neither PR contains** relative to `origin/main` (verified: `git diff --name-only origin/main..<branch>` → no `AddChild*`/`LoginScreen*`/`childProfileInput*` in either). **No rebase, no double-ship, no scope-split needed.** Each PR is exactly its clean 4–5 files.

---

## Founder's four questions

### PR-A — language-canonical
1. **Covers everything?** ✅ for its scope. **P0.1 fully met** — EN/עב topbar switch deleted (Shell), Coach AI-lang switch deleted (CoachTab), Settings is the *only* `setUiLang` caller, locked by a guard test. **P0.2 met** — 5 balanced sections, language is 2nd (not buried), sign-out last, Save/Cancel + "Language saved" toast, mobile scroll-safe. *Partial:* admin rows float outside the sections (P0.2 "admin isolated" → see SET-ADMIN below).
2. **Well-developed / functional?** ✅ Clean code, typecheck + tests green. `aiLang` correctly **retained** (still drives he-IL/en-US STT + story/comic/scholar surfaces) — only its *UI toggle* was removed.
3. **No regression?** ✅ Effectively. One narrow, **self-healing** edge: a legacy user who set AI≠UI under the old split keeps a silent split until they open Settings and press Save once. No data loss.
4. **Serves purpose?** ✅ Real IA win — four scattered toggles → one predictable surface. Two judgment calls tracked as backlog (advanced AI-language override; green-in-new-chrome).

### PR-B — waitlist-notify
1. **Covers everything?** ✅ Notifier is correctly env-gated, null-skips cleanly, store `.add` returns the entry (the "undefined entry" worry is **not** a bug).
2. **Well-developed / functional?** ✅ Notifier unit-tested (null-gate, success, throw-on-401). Gaps: no route-level test for the failure path; env vars undocumented.
3. **No regression?** ✅ **today** — the failure path is **dormant** (notifier is null; `RESEND_API_KEY`/notify addresses wired nowhere → behavior == main, save→200). ⚠️ **Latent trap once armed:** on a Resend blip the handler returns **HTTP 502** to the parent whose lead **was already saved** → `LoginScreen` shows "Couldn't record the request" → parent retries → duplicate branch **skips notify** → founder notification **silently lost**.
4. **Serves purpose?** Notify serves growth, but the 502-to-parent is off-brand for a calm product **once armed**. Fully decouplable.

---

## Must-fix list (real, phantoms removed)

**PR-A — before merge (cheap, optional):**
- None block merge. Recommended polish: (1) swap the new Section `<h3>` header off `--arbor-green-ink` to a sapphire/neutral token so it doesn't add to the DUX-008/027 green-paydown debt; (2) wrap the two `isAdmin` rows in an "Operator" section + route their titles through `t()`.

**PR-B — before *arming Resend* (not before merge):**
- **Decouple notify from the parent response:** on notify failure, `logger.error` and still return `200 {ok:true}`; make notify fire-and-forget / enqueue. Never 502 the parent for a request whose lead saved. *(Merging PR-B as-is is safe because the path is dead until the env vars are set.)*
- Add `RESEND_API_KEY` / `WAITLIST_NOTIFY_EMAIL` / `WAITLIST_NOTIFY_FROM` to `.env.example` + deploy runbook; pick one canonical name (drop the `ARBOR_*` alias); add a startup "notifications enabled/disabled" log.
- Add a route-level test: notify-rejects → 200 + entry persisted; resubmit → 200 `duplicate:true` + notify not re-called.

---

## Program-level coverage answer
These two PRs close **only P0.1 + P0.2** of the Hermes brand/UX/IA backlog (~16 items). Still open: **P0.3** (remove/reframe parent "Risk level"), **P0.4** (explicit onboarding completion), **P0.5** (reusable trust/consent pattern), and all **P1.x / P2.x / P3.x**. See `PRODUCT-BACKLOG.md` → "Hermes Brand/UX/IA Program".

**Bottom line:** Both are genuine improvements and both are *ship-with-fixes*, not ship-as-is and not needs-work. PR-A is mergeable now (cheap green/admin polish recommended). PR-B is mergeable now because its risky path is dormant — but decouple the 502 **before** anyone sets `RESEND_API_KEY`.

---

## Execution (2026-06-29) — all fixes landed green

All 8 review fixes were implemented on branch **`claude/arbor-pr-fixes`** (= `origin/main` + both PRs + fixes). **Not pushed** (push/PR/merge = Tier-C, Guy-gated).

**Verification (ground truth, executed):**
- `tsc --noEmit` → **PASS**
- `vitest run` (full) → **1162 passed / 0 failed / 3 skipped** (baseline 1158 + 4 new tests)
- `vite build` (production) → **PASS**

**Landed:** LANG-ADV-OVERRIDE (in-Settings advanced AI-language toggle) · SET-ADMIN (operator section isolated, `t()`-ized) · GREEN-DRIFT-SETTINGS (neutral section eyebrow) · LANG-DEAD-I18N (4 orphan keys removed) · canonical guard test updated + extended · WAITLIST-DECOUPLE (`notifyWaitlistSafely`, no more 502) · WAITLIST-ROUTE-TESTS (3 tests) · WAITLIST-OPS-DOCS (`.env.example` + startup log). LANG-MIGRATE-SPLIT superseded by the override (the split is now a visible setting).

**Remaining (Guy-gated next phase, not in this branch):** Hermes **P0.3** (Risk-level reframe — clinical/product decision), **P0.4** (onboarding completion), **P0.5** (trust pattern), and P1.x+. These are net-new program work, not part of the two verified PRs.
