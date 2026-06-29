# Arbor Firestore Data Model

## Current state

Local development can use `.data/memory-ledger.json` through the `LocalMemoryStore`.

## Target state

Firestore is the production source of truth:

```txt
users/{userId}
families/{familyId}
families/{familyId}/members/{userId}
children/{childId}
children/{childId}/memoryEvents/{eventId}
children/{childId}/behaviorLogs/{logId}
children/{childId}/milestones/{milestoneId}
children/{childId}/actionPlans/{planId}
children/{childId}/followUpLogs/{followUpId}
children/{childId}/handoffs/{handoffId}
children/{childId}/consents/{consentId}
aiRuns/{runId}
safetyReviews/{reviewId}
organizations/{organizationId}
organizations/{organizationId}/professionals/{professionalId}
organizations/{organizationId}/cases/{caseId}
```

## Migration path

Use `MEMORY_ADAPTER=local` only for local development. Use `MEMORY_ADAPTER=firestore` in production.

## M1 acceptance gates

- Memory event statuses: `proposed`, `approved`, `rejected`, `edited`, `deleted`, `expired`.
- Only approved active memory is used in future Arbor responses.
- Deleted, rejected, and expired memory remain auditable but are excluded from retrieval.
