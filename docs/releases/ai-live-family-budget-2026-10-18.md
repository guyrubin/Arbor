# B-AIOPS-02 — Shared-family Live allowance (18 October 2026)

Builds on the 15 October Live usage observation slice. Accepted intent (GA backlog, Interpretation): Free 3 minutes, Plus and Family 20 minutes of realtime voice per family per day, shared across every parent, session and device.

## What is enforced

- `POST /api/live/token` reserves a slice of the family's daily allowance **before** the provider is touched. Family and plan are server-resolved (`ensureFamilyForUser`, `resolveEntitlement`); the client supplies nothing.
- A reservation is at most 5 minutes (`LIVE_RESERVATION_MINUTES`, capped) and is **non-refundable**. The provider token's `expireTime` is the reservation end, and `newSessionExpireTime` is one minute, so a minted token cannot be parked and spent later.
- Overlapping mints from any member of the family serialize on one Firestore document per family-day (`aiQuota/live_family_{familyId}_{YYYY-MM-DD}`, UTC day, the same boundary the observation slice splits on). Two parents cannot exceed the allowance together.
- Renewal is the next mint: it reserves the next slice only if allowance remains; a remainder under 30 seconds is treated as spent. The allowance resets at UTC midnight.
- Exhaustion returns a typed `429 { code: "live_resting", retryable: false }` with `X-Live-Quota-*` headers and **no `Retry-After`**. Nothing is minted. The client shows a calm "voice is resting" card (EN/HE), turns voice off, keeps the typed composer, draft and crisis path, and never reloads or falls back into a loop.
- A provider mint failure releases the reservation (server fact). A reservation-store failure refuses the mint (503), never fails open.
- Reconciliation: `/live/usage` reports (open/heartbeat/close) are recorded beside the reservation. They **never** credit the budget. By default an expired reservation is charged in full. `LIVE_RECONCILE_CREDIT=observed` (off) would charge observed time instead, bounded by the slice, only after provider expiry, and only for complete telemetry (clean close, no heartbeat gap).
- Admin/comp families (`ARBOR_FAMILY_*`, `ARBOR_PLUS_*`) resolve through the existing entitlement path to the paid 20-minute allowance. No new bypass exists.

## Data

Family-level usage only: parent uids, millisecond counts and timestamps in `aiQuota`. No child data, audio, transcripts or names. `aiQuota` has no client rules match (Admin SDK only) and the existing TTL field `expireAt` applies. Account deletion already clears uid-keyed `aiQuota` meters; a family-day document outlives a member only as a count and is removed with the family-day TTL.

## Not proved by this slice (B-GA-26)

- Provider-billed audio minutes versus reserved minutes; the reservation bounds spend, it does not measure it.
- The browser STT/TTS fallback loop is metered by its own hourly and TTS caps, not by this family allowance.
- Live production exercise of the 429 card on a signed-in EN/HE device, and whether Gemini closes an in-progress session at `expireTime` (SDK documents "may preemptively close"); the reservation is charged either way.
- No alert fires on exhaustion rates (B-AIOPS-03).
