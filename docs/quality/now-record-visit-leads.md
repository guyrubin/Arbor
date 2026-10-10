# Now record and visit lead slice

Base: ba8d1543afbf463b0fe26cae755b22e7c5b89ebd. Separate follow-on to PR122.

Canonical source: B-TODAY-28 ([P1-NEXTLEVEL lines 22–42](https://github.com/guyrubin/ROS/blob/main/PAI/projects/arbor/execution/2026-10-01--one-backlog/packs/P1-NEXTLEVEL.md#L22-L42)) and B-TODAY-34 ([P4-PLACES lines 607–658](https://github.com/guyrubin/ROS/blob/main/PAI/projects/arbor/execution/2026-10-01--one-backlog/packs/P4-PLACES.md#L607-L658)). Latest all-Parent/Kids authorization overrides the generic historical freeze, without restoring PR110 or the retired Overview design.

Current-shell adaptation:
- Reuse selectFromRecord, FromRecordCard/Receipt, actionLoops writes, useCompanionOffer's existing appointments subscription and offer ledger, and the existing Consult editor.
- The one-lead arbiter preserves open chosen outcomes, an in-flight/retry record answer, a current confirmed visit within +2 local calendar days, the existing safe Tonight decision, a record opener/receipt, and existing practice/notice/program/library fallbacks.
- The current loop's practice-shown safety still governs Tonight. An unseen practice does not earn a retrospective question. Impressions move to the actual visible practice.
- Existing say-back remains in More for today. Record answers and say-back cannot overwrite one another's daily row. No new collection, inferred profession, clinical grade, count, provider, credentials, or model call is introduced.
- Current module budget remains 3. The old pack's budget of 4 is superseded by current three-place architecture. Weekly reflection remains its existing secondary door, never a lead.
- Consult target is resolved from the active child's appointments only. Missing/expired targets do not silently select a different visit; untargeted callers retain existing nearest-visit behavior.

Inspected broad integration dependency: confirmedVisits, FollowUpEditor and appointmentMutations concern after-visit writes/privacy and are not necessary for selecting an upcoming appointment or preselecting Consult. None is imported.

Verification boundaries: serial offline unit/SSR/lifecycle tests only once the shared slot is granted. No local tsc, browser, provider/network calls or publication. Independent review, exact-source CI/type/build and real rendered EN/HE/mobile/desktop evidence remain release gates.

## Truthful acknowledgement and source ownership

- `useChildCollection` gains two opt-ins: `trackConfirmation` listens to metadata-only transitions, and `upsert(..., { awaitServer: true })` waits for the underlying write promise. Existing callers retain queued-write behavior. Local sandbox acknowledgement still requires successful localStorage persistence.
- New visit promotion and explicitly targeted Consult require loaded, non-error, server/current/non-pending appointment snapshots. Cached, optimistic, and error-fallback rows cannot promote a visit or unlock that targeted packet. Untargeted Consult's pre-existing behavior is unchanged.
- Daily record/say-back answers wait for the initial confirmed answer ledger, share one deterministic daily-row write, retain pending/error state across route re-entry, and show a receipt only after acknowledgement. Failed optimistic echoes do not block retry. Say-back remains its existing disclosure.
- Only Now's amended chosen-outcome receipt opts into strict outcome acknowledgement. Pending locks are per action; scope leases prevent child/topic A→B→A callbacks from reviving old receipts. The original action remains pinned through a pending write or retry.
- The manual Tonight door remains usable above automatic step/visit priority, while pending/retry answers retain ownership. Visit navigation makes one history entry and respects the existing Kid Mode guard.

## Local evidence

- True baseline red captured before implementation: missing selector/clock/record hook, absent record and visit leads, wrong/missing Consult target handling, record card control/stamp, shared daily-row collision, and unawaited record writer.
- Final source: 280 passing tests in 22 files. Each file ran in a separate serial Vitest process with `--maxWorkers=1`, `MODEL_PROVIDER=mock`, and the offline network preload. Coverage includes morning/afternoon/evening, +2 local days, expired hours, empty/child-switch data, saved profession, repeated taps, delayed rejection/retry, metadata cache/pending/error transitions, initial answer-ledger gating, unmount, ABA, the explicit Tonight click, single-entry visit navigation, and retained Consult editor identity across transient source loss.
- React source review preserved unconditional hook order, stable child/target ownership, localized status/alert content, existing ≥44 px controls, and extracted a pure appointment label instead of importing the Appointments screen into Now.
- Diff check passes with existing CRLF convention recognized (`core.whitespace=cr-at-eol`).

Limits: Firestore acknowledgements, metadata transitions, interrupted lifecycles, and navigation are tested with offline fixtures/SSR or actual callbacks executed in controlled hook hosts. No real remote persistence, rules, cross-device race, browser history engine, layout, keyboard/focus, CI/type/build or deployment is certified by these tests. No local tsc, browser, network/provider request or publication ran. Independent review and exact-source rendered/CI gates remain required.

Consult draft correction: a previously confirmed target retains its editor at the same React type/key/tree position, hidden and inert while the target source is pending, stale, errored or deleted. First-unconfirmed targets still mount no editor. The child/target owner key retires drafts on navigation to another child or target. A dedicated test failed on the previous early-return implementation (editor became null), then passed after retention. This proves element identity and blocked-control structure in the actual component's hook fixture; real browser draft typing/reconciliation still belongs to rendered verification.
