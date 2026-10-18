# B-GROWTH-44 — Notice today as one Parenting object

## Scope and selected design target

This implements Guy's 18 October request to turn the disconnected indication input into a complete, integrated Arbor Parenting object and deploy it. The selected reference is the shipped Parenting V3 at `8fad8f1e732f1aa60ef086ad60e8ba8546b39be4`: Now's existing visual/action frame, My child's editorial parent words, and Moments' authentic dated evidence. Existing Now, My child, Moments and Together surfaces were captured from that revision before implementation. The baseline captures use fallback text fonts in this runner; they document composition and navigation, not a font comparison. The final dedicated captures below load Arbor's actual English and Hebrew fonts.

The implementation extends the existing milestone and keepsake records, Observation read model, `SegmentedAnswers`, `Receipt`, detail sheets, practice selection and reviewed Talk/Care routes. It introduces no observation collection, clinical guidance, AI prompt, paid generation on reading/saving, navigation hub or Kids change.

## Object anatomy and parent value

| Region | Actual source | Value for the parent |
| --- | --- | --- |
| Subject face | Shipped `SHELF_ART`, canonical shelf glyph and label | Recognise the area before reading; approved guidance art remains distinct from a family photograph. |
| Observable statement | Current milestone title, concrete example and existing source/age wording | Understand what to notice without an inferred deficit or child score. |
| Three neutral answers | Current child-scoped milestone response | Record Seen it, Not yet or Not sure with the same visual treatment; unanswered stays distinct. |
| Evidence | Exact matching keepsake or parent-confirmed original moment | See authentic words, a parent-selected date and optional photograph; imported wording retains its provenance. |
| Receipt and controls | Acknowledgement of the corresponding write | Know what saved, retry just the failed operation, change the answer or undo without losing separately kept evidence. |
| Connected action | Exact source IDs or an eligible existing shelf practice | Open the actual record, choose an activity, or review selected information for Talk/Care. |

Lead cards keep the existing Now frame and module budget. Compact rows preserve subject, response and destination. The shared responsive detail adds evidence and controls in the existing sheet pattern. The same identity is used across Now, My child, Journal and Moments. Parent words use the established editorial treatment; metadata stays quiet; the active content surfaces are opaque. The styles use effective Parenting V3 tokens, current display/body fonts, logical RTL spacing, restrained depth and the existing icon subset.

## Connected journeys

| Surface | Result |
| --- | --- |
| Now / Notice today | Await the actual answer/evidence write, then open the same child-scoped object. Preserve the originating return route. |
| My child / Growth / Milestones | Inspect and edit the same response, range, date and evidence. An incoming child ID never switches the active child. |
| Moments / Journal | Open the exact original record and link back to the canonical object. Not yet and Not sure remain neutral responses and do not become observed-event counts. |
| Together / Tonight | Offer the eligible existing shelf practice and an explicit choice for today. The follow-up uses the existing acknowledged capture path. Activity completion does not mark a milestone achieved. |
| Talk | Review exact selected source fields, remove fields, and explicitly send. Source edits, deletion or account/child changes revoke approval; the guard is checked again after asynchronous authentication and before request dispatch. |
| Care | Reuse the existing packet selection, preview, consent and export path for the exact chosen source. Changed source content invalidates approval. |

Date-only evidence remains the parent's chosen calendar day, including in a time zone west of UTC. Approximate or unknown observation ranges require an explicit evidence date; an old response is not relabelled as a new observation today. New direct parent answers carry parent provenance; historical source-less records retain their honest unknown-source label.

## State and lifecycle verification

| State or edge | Verification |
| --- | --- |
| Unanswered; each neutral answer; Seen with/without words; dated editor; connected controls | Rendered in EN/HE at 375×812 and 1280×800 in `rendered/`. |
| Answer acknowledgement, answer failure, note-only failure and same-document retry | Handler-level lifecycle tests with controlled write completion. No success receipt before acknowledgement; retained drafts on failure. |
| Duplicate tap, Undo of an existing answer, reload and removal | Lifecycle tests and rendered save/reload/removal journey. Separately kept words/date survive removal of the response. |
| Offline/unconfirmed record and later acknowledgement | Firestore subscription/writer tests distinguish cached or pending state from remote confirmation. These are controlled tests, not a claim of a live offline production session. |
| Child/account switch, unmount, permission/source withdrawal | Scoped writer, exact-source subscription and delayed-send regression tests. Old completions cannot write into or approve the new scope. |
| Imported/foreign attachment and parent-confirmed original | Exact document ID + milestone ID and provenance regressions; no lookalike source can supply another record's evidence. |
| Keyboard, RTL and touch | Existing keyboard/focus contracts plus real browser arrow/End/Space operation and 44 px answer targets in both locales. |
| Talk/Care selection, preview, explicit send/export and stale-source invalidation | Four real-browser locale/viewport cells in `handoffs/`; synthetic source records and an intercepted local model request only. |

Focused suites cover the shared card, actual host handlers, persistence, detail/navigation, capture editor, source resolver/subscription, reviewed Talk/Care and delayed-send guard. The complete repository suite, TypeScript, framework/floor checks, safety evaluation, deterministic acceptance checks and production build are release gates. Existing Kids and voice checks remain in the normal CI pipeline.

## Rendered evidence and reproduction

- [Selected baseline compositions and original sweep](baseline/)
- [Object states and browser report](rendered/report.json)
- [English mobile object](rendered/mobile-en-with-words.png)
- [Hebrew mobile object](rendered/mobile-he-with-words.png)
- [English desktop object](rendered/desktop-en-with-words.png)
- [Hebrew desktop object](rendered/desktop-he-with-words.png)
- [English connected controls](rendered/mobile-en-connected-actions.png)
- [Hebrew connected controls](rendered/mobile-he-connected-actions.png)
- [Talk/Care browser report](handoffs/report.json)

The browser fixtures run against the ordinary local mock server and synthetic demo family. Run from `app/` with that server on `http://localhost:3000`:

```sh
NODE_USE_ENV_PROXY=1 TZ=UTC node scripts/notice-object-browser.mjs
NODE_USE_ENV_PROXY=1 TZ=UTC node scripts/notice-handoff-browser.mjs
TZ=UTC npm test
npm run lint
TZ=UTC npm run build
```

The runner's Chrome certificate store cannot load Google Fonts directly. Both fixtures use the repository's strict public-font URL/body validator and Node's configured trusted TLS chain to return the unchanged public CSS/font bytes to Chrome. No certificate check is disabled. The reports retain the public font resource hashes. The fixtures do not substitute a font, alter application CSS or bypass an application access check.

## Release evidence boundary

The local rendered evidence proves the implemented UI and synthetic end-to-end interactions. Controlled Firestore and authentication tests prove the relevant acknowledgement and scope contracts. The normal production pipeline must pass on the exact merged commit, then verify the matching Hosting stamp, service worker and live API SHA. A public production check does not establish a signed-in real-family journey; no production family data or credential was used for these captures. The canonical Parent backlog review records the resulting commit, workflow and any remaining acceptance evidence separately.
