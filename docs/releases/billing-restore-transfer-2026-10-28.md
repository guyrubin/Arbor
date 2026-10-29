# Restore across accounts — B-GA-20 (28 Oct 2026)

Branch `claude/privacy-ga-2026-10-28`. This is the restore half of B-GA-20. The device half is still open: run a sandbox purchase, restore and cancel on each platform once B-GA-16 and B-GA-17 land.

## What changed

Before, RevenueCat's `TRANSFER` event was acknowledged and never written. That event is sent when a store purchase is restored on another Arbor account. As a result, the new account stayed locked and the old one kept Plus.

The webhook (`app/src/server/billing.ts`, `transferWritesFromRevenueCat`) now does the following:

- **Move:** the billed subscription goes to `transferred_to`, and `transferred_from` drops to Free. A subscription can no longer unlock two families.
- **Stale guard:** every write carries the TRANSFER's own id and timestamp. A resend writes nothing, and an older event that arrives late cannot unlock the old account again.
- **Left alone:** a comp month, or another store's subscription, stays where it is. The receiving account also keeps a live subscription of its own when it lasts at least as long.
- **Ignored:** anonymous RevenueCat ids.
- **Write order:** grants are written before removals, so a retry finishes a move that only half applied.
- **Sandbox rule unchanged:** native-store sandbox events still apply in production (App Review); web sandbox events never do.

Evidence: `app/src/server/billing.test.ts`, the "B-GA-20 restore across accounts" block, runs the real mapping and the real router.

## Guy's steps

1. In the RevenueCat dashboard, open the `arbor` project's settings and set **Restore Behavior** to the transfer option ("Transfer to new App User ID"). With "Keep with original App User ID", a restore on a second account is refused and no TRANSFER is ever sent.
2. Before native launch, on each platform, buy in the sandbox on account A, then restore on account B. Confirm in Firestore that `entitlements/{B}` is Plus and `entitlements/{A}` is Free. Then cancel and confirm both accounts follow the store.
