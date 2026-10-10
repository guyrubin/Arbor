# Combined first-run and goal candidate evidence

The additive `first-run-goal-only` scope selects the unchanged existing
`first-run-preview-only` and `single-goal-only` matrices. The existing PR128 workflow
branch `codex/single-goal-capture` now selects this combined scope. The standalone
`single-goal-only` scope remains supported for explicit use. It does not select base routes or any
unrelated full-screen sweep.

- 26 existing first-run states × four variants = 104 required cells
- 49 existing goal states × four variants = 196 required cells
- Eight existing shards and 300 required cells total
- Variants: English and Hebrew at 375×812 and 1280×800

Every shard must carry the same exact commit and app/src tree identities. Each
lane keeps its existing state and required assertion lists, screenshot naming,
exact-font receipts, network boundary and final counters. The aggregate also
requires all 104 distinct canonical first-run primary PNGs. Missing states,
shards, assertions, fonts or source identities remain failures. All old release
scopes remain available. Only PR128’s branch-to-scope selection changes; all
other existing branch mappings and triggers remain intact.

First-run runs only the existing DEV onboarding preview. It does not prove
production ProfileGate, remote empty-account entry or remote acknowledgement.
Goal runs the existing production-build renderer. Both use disposable synthetic
fixtures, the existing mock server and network-none capture runtime. Existing
full-header checks and exact automatic-narration refusals are unchanged; no new
API, media, credential, font or asset admission is introduced.

A clean local merge and offline tests are prerequisites, not release proof.
Independent source review, exact-source cloud CI, all 300 rendered cells and
independent original-PNG review are still required. Neither this scope nor its
passing capture authorizes a merge to main or production deployment.
