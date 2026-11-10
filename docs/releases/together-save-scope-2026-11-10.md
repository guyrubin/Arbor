# Together save ownership and acknowledgement

Family-integrity continuation for B-GA-34 and the Parent Together journey:

- Together's preview and kept-activity state remount for the account and child.
  Hosted sign-out or restoring authentication removes the family surface.
- Keeping an away-from-screen activity waits for the existing acknowledged
  Journal write. A synchronous lock prevents repeated pending saves; rejection
  or failure leaves the action available for an idempotent retry.
- A retired account/child cannot show a receipt or emit a completion event.
  Failure from a closed preview cannot appear on a different activity.

`scripts/together-save-browser.mjs` uses the real React/Motion view and
Sheet/Modal in the canonical EN/HE release cells. Its prior-behavior negative
control retains the old account's preview when child IDs collide. The fixed
cases cover pending repeat taps, acknowledged success, rejected/false retries,
late preview failure, account and sibling changes, A→B→A, logout and restoring
authentication. Contexts and writes are synthetic, with network blocked; this
is not authenticated production or physical-device acceptance.

The existing catalogue, navigation, content and canonical-handback flag are
unchanged. No prompt, model, processor, billing contract or paid generation is
introduced.
