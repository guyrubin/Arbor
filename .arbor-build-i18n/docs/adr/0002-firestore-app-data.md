# ADR 0002: Firestore App Data

## Status

Accepted.

## Context

Issue #6 requires Arbor to replace the local JSON memory ledger with a production source of truth. Arbor needs parent-approved child memory, append-only memory events, co-parent and professional access patterns, and later longitudinal analytics for design partners.

## Decision

Arbor will use Firestore Native mode as the application database. The production schema will center on families and children, including `families/{familyId}/children/{childId}` or equivalent child-scoped collections, with memory events, behavior logs, milestones, plans, follow-ups, handoffs, consents, and safety reviews under explicit family/child access control.

BigQuery streaming/export is the longitudinal analytics layer, not the transactional app database.

## Consequences

`MEMORY_ADAPTER=firestore` is required in production. Local JSON remains dev-only. Firestore rules must enforce family, co-parent, and professional scopes. Deleted, rejected, expired, and edited memory events remain auditable but cannot be injected into coach context unless approved and active.

## Alternatives

JSON files were rejected for production. A relational database was deferred because Firestore better matches the hierarchical family/child access model and Firebase Auth path for M1.
