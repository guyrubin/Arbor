# Parent handback and feedback lifetimes

B-PROG-16 / B-BOOK-66 preparation and B-KID-143 / B-BOOK-47 family integrity:

- Parent notifications retire before paint on account/child changes and family
  unmount. Both visible and Kids-queued messages are cleared. Old callbacks and
  detached actions cannot restore or act on another visit's text. The outgoing
  Motion tree is retired immediately rather than animating private text out.
- The existing dark next-day handback remounts for its owner and child, rejects
  unknown hosted auth and collection errors, and keeps dismissals owner-scoped.
  Unattributable legacy dismissal keys are not imported.
- Save locks synchronously, retains the parent's words on false/rejected writes,
  and unlocks for retry. Dismiss/edit wait during persistence. Journal saves use
  the existing acknowledged/idempotent retry seam; stale cards cannot dismiss a
  new card. No child choice or inferred observation is added.

`scripts/parent-handback-browser.mjs` exercises the real React/Motion provider,
scope boundary, handback view and translations in the existing release viewport
matrix. Isolated synthetic writes cover account and sibling changes, A→B→A,
logout, queued feedback, late retries, duplicate Save, false/rejected saves and
late completion. The no-retirement negative control retains the prior owner's
toast. Network is blocked; this is not signed-in or physical-device evidence.

The canonical handback catalogue, feature flag and content remain unchanged.
Owned-cover rendering, Together filtering, reviewed David acts, native Hebrew /
clinical review and signed-in next-day acceptance remain open. No prompt/model,
billing contract, practitioner disclosure or paid production is changed.
