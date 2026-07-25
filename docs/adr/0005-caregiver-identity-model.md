# ADR 0005: Caregiver Identity Model (AR-CAP-04) — Design Only

## Status

**Proposed — blocked on GD-9 (Guy gate).** This ADR is the gated design deliverable for AR-CAP-04 (CARE-9, wave 3 of the 2026-07-23 next-level slate). Per the firewall CONDITIONS ruling, this document ships with **zero app code**. Implementation of any part of it — schema, invite flow, migration, rules — must not begin until Guy explicitly approves or rejects this design (GD-9). GDPR/DPIA sign-off is a co-requisite gate (backlog v6, AR-CAP-04 gate column).

## Context

### What exists today (verified in-tree, 2026-07-25)

1. **Sharing is email-string grants against a single owner account.** `app/src/sharing/shares.ts` defines `ShareGrant { ownerUid, recipientEmail, role: co_parent|viewer|professional, scopes, expiresAt, revokedAt }` stored in the top-level `shares` collection. The recipient is an *email string*, not an identity: `GET /api/shared-with-me` (routes/api.ts) matches `actorOf(req).email` against `recipientEmail`. There is no distinct adult identity, no role migration, and the co-parent seat is only a plan-gated grant count (`POST /shares`, routes/api.ts — 402 when `entitlement.limits.coParentSeats` is exhausted; Free/Plus = 0, Family = 1).
2. **Three hardened seams already exist and MUST be reused, not replaced:**
   - **CARE-3 fail-closed scopes** (`lib/shareScopes.ts`): stable `ShareScopeId`s; unrecognized legacy strings resolve to *nothing*, never a broader default (`normalizeScopes`).
   - **CARE-2 single egress** (`server/sharedPacket.ts` → `resolveSharedPacket`): the only recipient-facing read path; scope-exact, server-enforced expiry/revocation, forbidden-token + clinical-term egress scans.
   - **CARE-6 grant-history-as-audit** (`shares.ts` `ListByOwnerOptions.includeInactive`, `GET /api/shares?history=1`): the grant records themselves (createdAt/expiresAt/revokedAt) are the sharing audit trail.
3. **Two parallel family data models exist.** Server-side, `families/{familyId}/members/{uid}` + top-level `children/{childId}.familyId` already exist (`families/familyService.ts`) and back the fail-closed `requireChildOwnership` middleware (`server/requireChildOwnership.ts` — non-member or lookup error → 403). Client-side, all child data lives under the **owner's tree**: `users/{ownerUid}/children/{childId}/{subcollection}` for the 28 sinks in `CHILD_SUBCOLLECTIONS` (`lib/childData.ts`), guarded by `childData.subcollections.test.ts` for GDPR export/erase completeness.
4. **Adult AI history is not private.** Coach conversations persist in the `conversations` child subcollection under the *owner's* uid (`ArborContext.tsx` `useChildCollection(childProfile.id, "conversations")`). Any adult using the owner's credentials — the only way two adults can share an account today — sees every AI conversation. AR-CAP-04's market reference (Good Inside Family Plans) requires private adult AI history by default.
5. **Auth today** (`context/AuthContext.tsx`): Firebase Auth with Google popup and email/password. One account = one family owner.

### What AR-CAP-04 requires (backlog v6 §14, row AR-CAP-04 — the seven acceptance bullets)

1. Invite creates **distinct adult identity**, not shared credentials.
2. **Shared child profile and plan.**
3. **Private adult AI history** by default.
4. **Role/scopes/revoke.**
5. **Content/action handoff.**
6. **Audit events.**
7. **Migration test for existing shares.**

Plus the GDPR/DPIA gate. Section "Acceptance mapping" below ties every design element back to these seven bullets by number.

## Decision

### D1. Identity model — one Firebase Auth account per adult (bullet 1)

Every adult in a family authenticates with their **own Firebase Auth account** (multi-auth per adult: Google and/or email-password providers linked to a single `uid` via Firebase's standard provider linking — credentials are never shared between adults). The adult's `uid` is the identity key everywhere; email is display/contact metadata only, never an authorization key after migration (D4).

- No password sharing, no owner-credential handoff, no "log in as the family".
- An adult's account may belong to at most one family in v1 (matches `FamilyService.ensureFamilyForUser`'s existing collectionGroup lookup). Multi-family membership (e.g. separated co-parents each with their own family) is explicitly out of scope for v1 and listed under Consequences.

### D2. Membership model — promote `families/{familyId}/members/{uid}` to authoritative (bullets 2, 4)

The existing server-side family model becomes the single authorization root:

```txt
families/{familyId}
families/{familyId}/members/{uid}     ← authoritative membership record
families/{familyId}/audit/{eventId}   ← NEW append-only audit log (D6)
families/{familyId}/invites/{inviteId} ← NEW invite records (D3)
children/{childId}.familyId           ← already exists (FamilyService.ensureChild)
```

Member document (extends the existing `{ userId, role: "parent" }` shape — additive, no rewrite of existing member docs required):

```ts
type FamilyMember = {
  userId: string;
  role: "owner" | "co_parent" | "viewer" | "professional";
  /** CARE-3 stable ShareScopeIds. Owner/co_parent = all scopes implicitly;
   *  viewer/professional = exactly the listed scopes, resolved through
   *  normalizeScopes — fail-closed, same as grants today. */
  scopes: ShareScopeId[] | "all";
  status: "active" | "revoked";
  invitedBy: string | null;     // uid of the inviting adult
  joinedAt: string;             // ISO
  revokedAt: string | null;     // ISO — revocation mirrors ShareGrant semantics
  /** Set only when this membership was migrated from a legacy email grant (D4). */
  migratedFromGrantId: string | null;
};
```

- **Shared child profile and plan (bullet 2):** the child profile, plan/entitlement, and all *confirmed child signals* (behavior logs, milestones, action loops, playLogs, …) are family-scoped: readable/writable by `owner` and `co_parent` members, readable per-scope by `viewer`/`professional`. The billing entitlement stays attached to the owner's account and is *resolved* family-wide (`resolveEntitlement` gains a family lookup — co-parents inherit the Family plan, they do not buy a second one). The existing `coParentSeats` limit now counts **active co_parent members + active co_parent grants combined**, so the seat can never be double-occupied during migration.
- **Role/scopes/revoke (bullet 4):** revoke = set `status: "revoked"` + `revokedAt` (never delete — the member record is audit history, exactly like CARE-6 grants). All read paths check `status === "active"` server-side, mirroring `isShareActive`. Scope changes and revocations are owner-only actions and each writes an audit event (D6).
- `requireChildOwnership` continues to work unchanged: it already resolves `children/{childId}.familyId → members/{uid}` and fails closed. Membership rows for viewers/professionals are **excluded** from `ownsChild` (write authorization) — `ownsChild` gains a role check: only `owner`/`co_parent` own; `viewer`/`professional` read through the CARE-2 packet egress and D5 handoff seam only, never raw subcollections.

### D3. Invite flow (bullet 1)

1. Owner (or co_parent, if Guy approves that in the gate — default: **owner only**) creates an invite: `{ inviteId, familyId, email, role, scopes, expiresAt (7 days), createdBy, status: "pending" | "accepted" | "expired" | "cancelled", token: single-use random UUID }`.
2. Recipient receives a link, signs in **with their own Firebase account** (any provider). Acceptance requires: token valid + unexpired + `status === "pending"` + the authenticated account's verified email equals the invite email (case-normalized, same as `buildGrant`'s `recipientEmail` normalization). Any mismatch → reject, no partial state.
3. Acceptance atomically (transaction): creates the `FamilyMember` doc, marks the invite `accepted`, writes an `invite_accepted` audit event. The invite's plaintext email is purged from the invite doc on acceptance/expiry (retained only in the audit event, D6/D7).
4. Co-parent invites pass the same `coParentSeats` 402 gate as grants do today (routes/api.ts POST /shares) — seat check at *invite creation* and re-checked at *acceptance* (the plan may have changed in between; fail closed with a clear message).

### D4. Fail-closed grant→membership migration (bullets 1, 7 — firewall CONDITION)

**Principle: legacy grants never silently widen.** An email-string `ShareGrant` is a scoped *read* credential; a membership is a *write-capable identity*. No automated process may turn the former into the latter.

- **Viewer and professional grants NEVER migrate to membership.** They remain grants, served exclusively through the CARE-2 packet egress, until they expire or are revoked. (A professional identity model is AR-CAP-05's problem, explicitly out of scope here.)
- **Co-parent grants migrate only through a double-confirmation upgrade:**
  1. System flags eligible grants (role `co_parent`, `isShareActive` true) to the **owner** — nothing happens without the owner initiating.
  2. Owner explicitly converts the grant into an **invite** (D3) carrying: the same email, role `co_parent`, and scopes = `grantScopes(grant)` (the CARE-3 fail-closed resolution — unrecognized legacy scope strings drop, exactly as today; the ADR-level rule is *intersection, never union*: the resulting membership starts with **at most** what the grant resolved to; anything wider is a separate, fresh owner action after migration).
  3. Recipient accepts per D3 (own account, verified matching email).
  4. On acceptance, the original grant is **revoked in the same transaction** (`revokedAt` set, `migratedFromGrantId` set on the member doc) and a `grant_migrated` audit event links the two. One grant → at most one membership, ever.
- **Fail-closed at every step:** owner never initiates → grant behaves exactly as today; recipient never accepts → invite expires at 7 days, grant untouched; email mismatch → rejected, grant untouched; revoked/expired grants are ineligible; a migration transaction failure leaves grant active and no member doc (transactionality is the invariant the migration tests assert, D8).
- The legacy `/api/shared-with-me` + packet path stays fully functional for all unmigrated grants throughout — there is no flag-day.

### D5. Private-adult-history data boundary (bullets 3, 5 — firewall CONDITION)

**Boundary rule: AI conversations belong to the authoring adult; confirmed child signals belong to the family.** Concretely:

- **Conversations move to an author-rooted path:** `users/{authorUid}/children/{childId}/conversations` — which is *already* where they live for the owner today (`CHILD_SUBCOLLECTIONS` includes `conversations`). The change is that each adult's conversations live under **their own** uid, and no cross-adult read path exists: no API route, no Firestore rule, no packet scope exposes adult A's conversations to adult B. Private by default; v1 offers **no** sharing toggle for AI history (simplest boundary; a future opt-in share is a separate gated decision).
- **What crosses the boundary is only the confirmed-signal contract:** the AR-CAP-01 capture seam (requestCapture → confirm) is the *only* way conversation content becomes family-visible — a parent explicitly confirms a typed draft, which writes a child signal (behaviorLogs etc.) into the shared child tree. The AI context builders (`useTodaysFocus`, chat memory) already consume confirmed signals; the rule this ADR fixes is: **AI context for adult B never includes adult A's raw conversation text** — only confirmed child signals, which carry no author-private content.
- **GDPR consequences (feeds D7):**
  - *Export (Art. 15/20):* a child-data export executed by adult X includes the shared child tree + **only X's own** conversations. Another adult's conversations are that adult's personal data, not the requester's.
  - *Erasure (Art. 17):* child erasure must sweep the shared child tree **and fan out across every member's** `users/{uid}/children/{childId}/…` conversations for that child (membership index makes the fan-out enumerable). The `CHILD_SUBCOLLECTIONS` guard test extends to assert the fan-out covers all members — deleting a child removes every adult's AI history *about that child* while leaving each adult's account intact.
  - *Member leaves/revoked:* their conversations remain under their own uid (their personal data); they lose all access to the child tree instantly (`status: "revoked"` checked server-side). They may erase their own conversations independently.
- **Content/action handoff (bullet 5):** handoff between adults happens through *family-scoped objects only* — the AR-CAP-02 action loop (`actionLoops`) and shared content saves, both already in `CHILD_SUBCOLLECTIONS`. v1 adds an `assignedTo: uid | null` field on the accepted Today action (design only here) so one adult can hand an action to the other; outcome reporting stays with whoever completed it. No new capture path — the handoff writes through the existing action-loop seam.

### D6. Audit event schema — extending CARE-6 (bullet 6)

CARE-6 established that *records are the audit trail* (grants carry created/expired/revoked). Memberships keep that property (revoked member docs are never deleted), and **transitions** get an explicit append-only log, because membership has multi-actor transitions that a single record can't self-describe:

```ts
type FamilyAuditEvent = {
  id: string;                 // uuid
  familyId: string;
  at: string;                 // ISO
  type:
    | "invite_created" | "invite_accepted" | "invite_expired" | "invite_cancelled"
    | "member_role_changed" | "member_scopes_changed" | "member_revoked"
    | "grant_migrated";       // links legacy grant → membership (D4)
  actorUid: string;           // who did it
  subjectUid: string | null;  // affected member (null pre-acceptance)
  subjectEmail: string | null;// invite-stage subject, before a uid exists
  grantId: string | null;     // set on grant_migrated
  before: { role?: string; scopes?: string[] } | null;
  after:  { role?: string; scopes?: string[] } | null;
};
```

- Stored at `families/{familyId}/audit/{eventId}`; **append-only** (no update/delete route; Firestore rules deny client writes entirely — server-only writes, same posture as grants).
- Owner-visible in the existing Sharing history UI (CARE-6's `?history=1` section gains membership events — one merged, dated list).
- Included in data export; retention follows `docs/compliance/data-retention-policy.md` (audit events retain `subjectEmail` as the lawful record of who was invited — noted in the DPIA, D7).
- Grant lifecycle events for *unmigrated* grants stay exactly as CARE-6 shipped them (the grant record itself) — no duplicate event stream.

### D7. DPIA notes (gate co-requisite)

To be folded into the formal DPIA before implementation (with `docs/compliance/privacy-notes.md` and `dpa-outline.md`):

1. **New processing activities:** (a) adult identity linkage across a family (membership graph); (b) invite email processing (transient — purged from invite docs on acceptance/expiry, retained in audit events as the record of the invitation); (c) cross-adult visibility of child data under explicit roles/scopes.
2. **Lawful basis:** Art. 6(1)(b) contract for members' own use; the *owner's* invitation is the family-internal authorization for sharing child data with the invitee (both hold parental responsibility in the co-parent case; viewer/professional access stays scope-limited and time-boxed as today).
3. **Data minimization:** membership stores uid/role/scopes/timestamps only; no profile enrichment. Invite tokens single-use, 7-day expiry. Adult AI history never crosses adults (D5) — this is the headline privacy property of the whole design.
4. **Data-subject rights:** per-adult export/erasure of their own conversations; child erasure fans out across members (D5); a revoked member's residual personal data = their own conversations + audit events naming them (audit retention justified as Art. 17(3)(b)/(e) record-keeping — DPIA to confirm retention period).
5. **Risks and mitigations:** account takeover of any member → mitigated by per-adult credentials (no shared passwords — strictly better than status quo), revocation, audit trail; over-broad migration → structurally impossible by D4 (fail-closed, intersection-only, double-confirmed); child-data leakage to ex-members → `status` checked server-side on every read, packet egress unchanged.
6. **No new child-data categories** are created; the child-data GDPR allow-list (`CHILD_SUBCOLLECTIONS`) remains the single completeness authority and its guard test extends to the fan-out (D5).

### D8. Rollout / rollback

Phased, each phase independently reversible; the legacy grant path stays live throughout:

- **Phase 0 — dark schema.** Ship member-doc shape, audit collection, Firestore rules, and all tests behind a server flag (`CAREGIVER_IDENTITY=off`). No UI. Rollback: delete flag; zero user-visible surface.
- **Phase 1 — invites for NEW co-parents.** Invite flow live for new invitations only (owner UI offers "invite" where it offers a co_parent grant today). Legacy grants untouched. Rollback: flag off → pending invites expire naturally; created memberships set `status: "revoked"` by a single admin script (member docs retained as audit); recipients fall back to nothing (they never had grant access).
- **Phase 2 — offered migration.** Owners see the D4 upgrade offer on eligible co_parent grants. Rollback: withdraw the offer; migrated memberships revoke via the same script, and because the original grant was revoked *at* migration, rollback includes re-instating (`revokedAt: null`) exactly those grants whose `migratedFromGrantId` links survive — the audit event holds the linkage; migration is thus fully reversible with no access widening in either direction.
- **Phase 3 — membership-first reads.** Client child-tree reads resolve family membership (co-parent sees the shared child). Only after phases 0–2 soak. Rollback: revert read path to owner-rooted; memberships stay dormant.
- **Kill criteria:** any cross-adult conversation read found in test or telemetry (D5 violation) halts rollout at the current phase; any grant found widened by migration (scope diff audit query) halts and triggers Phase-2 rollback.

### D9. Migration test plan (bullet 7 — named plan)

New test module `app/src/sharing/grantMigration.test.ts` plus extensions to `shares.test.ts`, `sharedPacket.test.ts`, `requireChildOwnership.test.ts`, and `childData.subcollections.test.ts`. The named cases:

1. **No-touch default:** a legacy co_parent grant with no owner action behaves byte-identically pre/post deploy (`listByRecipient`, packet resolution, expiry).
2. **Never-widen:** migrated membership scopes ⊆ `grantScopes(grant)` for every legacy-scope fixture, including pre-CARE-3 English-label grants and unrecognized junk strings (which resolve to `[]` → migration of a junk-scoped grant yields a membership with **no** scopes beyond role defaults, never all-scopes).
3. **Role fence:** viewer and professional grants are ineligible — the migration API rejects them; no code path constructs a membership from them.
4. **Liveness fence:** revoked and expired grants are ineligible (`isShareActive` false → reject).
5. **Identity fence:** acceptance with a verified email ≠ grant `recipientEmail` (case/whitespace-normalized) fails closed; no member doc, grant untouched.
6. **Atomicity:** simulated transaction failure mid-migration leaves the grant active, no member doc, no audit event (all-or-nothing).
7. **One-shot:** a migrated grant (revokedAt set, `grant_migrated` audit present) cannot migrate again; replaying the accept token is a no-op 4xx.
8. **Audit completeness:** every transition in D6's type union writes exactly one event with correct before/after; the audit list reconstructs the full membership history.
9. **Seat conservation:** during migration, active co_parent members + active co_parent grants never exceed `coParentSeats`; the 402 fires at invite creation *and* acceptance.
10. **Privacy boundary:** adult B (migrated co-parent) cannot read adult A's `conversations` through any route; child export by B excludes A's conversations; child erasure sweeps both adults' conversation trees (guard-test extension from D5).
11. **Packet parity:** `resolveSharedPacket` output for an unmigrated grant is unchanged by the presence of the membership system (CARE-2 regression fence).

## Consequences

- Arbor gets Good Inside-level family collaboration without the class of leak the benchmark warns about: adult AI history is structurally private (no read path), not policy-private.
- The CARE-2/CARE-3/CARE-6 seams are reused as-is; grants remain the correct tool for time-boxed external viewers/professionals. Membership is only for co-parents in v1 — deliberately narrow.
- Billing: co-parents consume the Family entitlement rather than owning one; account-merge and multi-family membership are explicitly deferred (separated-parents topology needs its own design + DPIA delta).
- Client data layer keeps the owner-rooted `users/{uid}/children/{childId}` tree in v1 (Phase 3 reads resolve through membership); a physical re-root of child data to `children/{childId}/…` is a later, separate migration and is NOT required for any of the seven bullets.
- Cost of the fail-closed migration: some legacy co-parents will simply never be migrated (owner never acts). That is the intended trade — access never widens without two explicit human confirmations.

## Alternatives

- **Auto-migrate co_parent grants on recipient sign-in (email match only).** Rejected: silently converts a read credential into a write identity — exactly the "legacy grants never silently widen" violation the firewall CONDITION forbids.
- **Shared-credential "family login" or owner-issued sub-passwords.** Rejected: indistinguishable adults, no private AI history, no per-adult revocation or audit; also contradicts Firebase Auth's account model.
- **Custom-claims-only membership (no member docs).** Rejected: claims are not enumerable/auditable, complicate revocation latency (token TTL), and cannot carry scopes history; Firestore member docs + server checks match the existing `requireChildOwnership` posture.
- **Immediate re-root of all child data under `children/{childId}`.** Rejected for v1: touches all 28 `CHILD_SUBCOLLECTIONS` sinks and the GDPR guard machinery for zero bullet coverage; membership-resolved reads deliver bullet 2 without a data migration.
- **Per-conversation share toggles for adult AI history.** Deferred: v1 ships private-by-default with *no* cross-adult path — the simplest boundary to verify and the one the DPIA can sign. An opt-in share is a future gated decision.

## Acceptance mapping (AR-CAP-04's seven bullets → design sections)

| # | Acceptance bullet | Design |
|---|---|---|
| 1 | Invite creates distinct adult identity, not shared credentials | D1, D3, D4 |
| 2 | Shared child profile and plan | D2 |
| 3 | Private adult AI history by default | D5 |
| 4 | Role/scopes/revoke | D2 |
| 5 | Content/action handoff | D5 (action-loop seam) |
| 6 | Audit events | D6 |
| 7 | Migration test for existing shares | D4, D9 |

Gate: GD-9 (approve/reject this design) + GDPR/DPIA sign-off (D7). Until both land, implementation is blocked.
