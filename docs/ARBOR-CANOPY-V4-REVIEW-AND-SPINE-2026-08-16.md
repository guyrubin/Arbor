# Canopy v3 — Deep Review, and the Missing Spine (v4)

**Date:** 2026-08-16 · **Reviewer:** Claude (ROS/PAI) · **Subject:** "PROJECT CANOPY v3 · Multi-Agent Edition" (Qwen, 16 Aug)
**Method:** every load-bearing claim tested against the working tree at `main` `710b05bc`. Claims that could not be verified are marked as such rather than repeated.
**Verdict in one line:** Canopy v3 is a good *inventory* and a bad *plan* — it adds ~40 initiatives to a product whose own diagnosed disease is having too much, and it never deletes anything.

---

## 1. Verdict first

Canopy v3's analysis is largely sound and its safety instincts are right. But three structural faults make it unsafe to execute as written:

1. **It is purely additive.** Count the verbs: adopt, add, ship, build, extend, mount. There is no subtraction ledger, no surface it retires, no capability it merges. The in-repo masterplan of 2026-08-11 diagnosed the actual disease — *"I can't tell what Arbor wants me to do"* — and prescribed a budget rule to cure it. Canopy quotes the symptom and prescribes more product.
2. **It re-plans work that already shipped.** Wave W2 "Hero HQ" (weeks 4–9) is scheduled to build a comic kid dashboard that is live in `KidDashboard.tsx` today, star counter and all.
3. **It cites two guards that do not exist.** `cosmeticsFirewall` and `comicCopyFirewall` appear nowhere in the repository. Canopy treats one as a shipped blocker-fix and the other as an active CI enforcement mechanism. Both are load-bearing in its argument that the kid side is already safe.

Guy's instinct is the correct one and it is the thing the document is missing: **the UI needs a simplification law per feature, not a richer feature list.** §4–§6 below turn that instinct into an enforceable mechanism that already has a proven prototype in this codebase.

---

## 2. What Canopy gets right — keep these

| Item | Why it survives |
|---|---|
| North star = *supported moments per family per week* | Better than DAU; counts the thing the product claims to do. Adopt. |
| Guard metrics that must stay flat (eval, firewall, kid-lock, egress, HE parity, p95) | Correct framing: enhancement is only real if the guard row doesn't move. Adopt verbatim. |
| Record-row grammar (§3.3) — one scannable row shape for every AI output, memory, report | The single best *design* idea in the document, and it is a simplification, not an addition. Promote to P0. |
| Interaction-cost table (§3.4) | The right unit of measure. Its targets are the discipline; its "taps now" column is estimated, not measured — measure before using it as a baseline. |
| Retention targets set as habit-class (D30 ≥40), not social-class | Honest benchmarking. Keep. |
| Dark-pattern ban list as CI law | Already the house rule; formalising it in CI is right. |
| Deferring live per-scene AI art to v1.1 | Correct call, and it matches the in-repo kid plan's own reasoning. |
| Ethics wall on monetization (safety never paywalled, cosmetics earned-only) | Non-negotiable and correctly stated. |

---

## 3. Fact-check — six load-bearing claims tested

| # | Canopy claim | Tested | Verdict |
|---|---|---|---|
| 1 | Kid-plan blockers "all three fixed on `main` (monotonic streaks, `cosmeticsFirewall`)" | `git grep cosmeticsFirewall` → 0 hits repo-wide. Monotonic counters real (`KID-6`, `HeroArcade.tsx:160`, `JourneyTab.tsx:58`, `SinceLastVisit.tsx:231`). | **HALF FABRICATED.** Streak fix real; the cosmetics firewall does not exist. Do not treat kid cosmetics as guarded. |
| 2 | Onomatopoeia whitelist "enforced by `comicCopyFirewall`" (§4.2) | 0 hits repo-wide. | **FABRICATED.** This is a build item, not an existing guard. |
| 3 | W2 (weeks 4–9) builds K-01 comic dashboard, K-03 celebration, K-04 wind-down | `KidDashboard.tsx` (396 lines) ships greeting, 4 growth-adventure tiles, 8-game grid, animated monotonic star counter. Its own header names what is *still* deferred: theme registry (P2), bounded daily quest + levels (P3), parent-mediated share (P4). | **STALE.** K-01 is done. The real remaining work is P2–P4 of the existing kid plan — roughly a third of what Canopy budgets five weeks for. |
| 4 | "Adopt the committed Masterplan law (8 L1 categories)" plus a 5+More mobile bar plus the AR-IA target of 6–7 job hubs | `navigation.ts` → 8 sections, `routes.ts` → 43 route ids (not 45; the 45-route floor comment is stale). AR-IA targets 6–7 hubs. | **CONFLICT NOT RESOLVED, ONLY STACKED.** Canopy claims to arbitrate in §10.1 but then keeps all three shapes. 8 ≠ 6–7, and "More opens a services grid" re-creates the TOOLS drawer Guy rejected outright. |
| 5 | Rive for the hero puppet, Lottie for decorative loops | `package.json` → `motion@^12`, no Rive, no Lottie. | **TRUE BUT UNDERPRICED.** This is two new runtime dependencies plus an art pipeline and a licence, presented as a styling choice. Needs its own decision, not a bullet. |
| 6 | "2,991 tests green" | 233 test files present; suite not run in this review. | **UNVERIFIED.** Plausible; do not quote it as a fact. |

Also silently absent from Canopy: the entire **Wave 0 defect list** of the 2026-08-11 masterplan — safety screen with no `tel:` links, `effectivenessRating` grading the parent, error-indistinguishable-from-empty on ~18 screens, age filtering. Those are file-and-line verified, cheap, and worth more than any initiative Canopy proposes.

---

## 4. The missing notion, named

> **One Job, One Move.** Every surface declares one job, offers exactly one primary move, and holds a hard cap on how many modules may compete for attention. Anything else earns its slot or is demoted to a place it still lives.

This is not a style preference. It is the direct cure for the two sentences every external reviewer said about Arbor: *"I can't tell what Arbor wants me to do"* and *"nothing connects."* Both are overload symptoms. Canopy responds to overload by adding a status strip, a needs-attention list, a dominant action, an upcoming list and a quick-actions grid — five zones — to the one screen that already has a five-module cap.

**And the second half, which matters as much: simplification alone produces something clean and dead.** A surface stripped to one move is only engaging if that move *visibly does something*. So the law has two clauses, and the second is where the delight budget goes.

---

## 5. Mechanism A — the Surface Contract (generalise Rule A)

The codebase already solved this problem once, correctly, for one screen. `app/src/components/overview/todayModules.ts` encodes the Today budget: max 5 modules, one primary action, an explicit priority order, and a rule that demoted modules must *land somewhere* rather than vanish. It even encodes the lesson from its own first failed attempt — **the budget counts modules that actually render, never a proxy or a content-governance gate.**

That file is the prototype for the missing spine. Generalise it:

```ts
// app/src/lib/surfaceContract.ts — one entry per ActiveTab
export type SurfaceContract = {
  route: ActiveTab;
  job: string;              // ONE sentence, parent language, no jargon
  primaryMove: string;      // the single action id this surface exists to produce
  moduleBudget: number;     // top-level sibling modules, hard cap
  demotionTarget: ActiveTab | "disclosure";  // where losers land — never nowhere
  depth: 0 | 1;             // 0 = hub, 1 = tool. There is no depth 2.
};
```

**CI guards (three tests, mirroring the shape of `todayConsolidation.test.ts`):**

- **SC-1 completeness** — every id in `ROUTE_IDS` has exactly one contract. A new route without a declared job fails the build. This also kills the three-parallel-files drift permanently, since the contract sits beside `routes.ts` as the second half of one manifest.
- **SC-2 budget** — each surface renders ≤ `moduleBudget` top-level modules and **exactly one** element carrying `data-primary-move`. Counted from real render conditions, per the `todayModules.ts` lesson.
- **SC-3 no orphan demotion** — every demoted module resolves to a live entry point. This is the existing zero-capability-regression law (`check:floors`, F1–F18) expressed per-module instead of per-route.

**Why this is cheap:** one new file, three tests, and a contract literal per surface. It changes no behaviour on day one — it *reveals* which surfaces are over budget, and every subsequent PR has to argue with a test instead of with a reviewer. It is the same "rivet" pattern that already works elsewhere in ROS: encode the rule where it is checked, not where it is written down.

---

## 6. Mechanism B — the Felt-Response rule (so simple ≠ sparse)

Pair every contract with a response obligation. A surface passes only if its primary move produces a **visible consequence within one second, on the same screen, without navigation.**

| Surface | The one move | The felt response |
|---|---|---|
| Today | Do the offered action | It checks off *and* the Since-strip gains a line — the action visibly became part of the record |
| Journal | Capture a moment | The row appears in the timeline immediately, with its provenance chip, before any AI runs |
| Ask | Ask | The "Say this" script leads; hypotheses stay collapsed until asked for |
| Growth | Notice a milestone | The count moves and the tree gains a leaf, in the same frame |
| Behaviors | Log a challenge | The pattern line updates ("third time this week, all before 8am") — an observation, never a verdict |
| Care | Share with a pro | The packet preview renders with the redaction visibly applied |
| Kid | Finish a mission | Star arcs into the meter; the golden leaf lands in the parent's register too |

That last column is the entire delight budget, and it costs almost nothing because the celebration primitives, the canvas compositor and the motion tokens already exist. **Delight goes into the consequence of the one move, not into new modules.** This is the difference between an app that is calm and an app that is empty — and it is the clause Canopy's §3.2 queue design has no equivalent of.

---

## 7. The subtraction ledger — apply the law to what exists

43 routes across 8 sections. Density measured by rendered component tags / distinct `onClick` handlers per hub file:

| Hub | Capabilities | Density | Verdict |
|---|---|---|---|
| **Today** | 1 (+2 tools) | 12 tags / 4 clicks | **Model citizen.** Contract already exists. Ratify it, do not add Canopy's five zones. |
| **Journal** | 1 | 17 / 2 | **Model citizen.** The Journal/Story collapse into one density-toggled surface is the pattern to copy everywhere. |
| **Ask** | coach | 32 / 25 | **Heaviest control surface in the app.** Job = "help me right now." Contract: budget 3, primary move = ask, script-first answer. The 25 handlers are the work item. |
| **Behaviors** | behaviors + plans | 28 / 29 | Two jobs wearing one name. Contract: job = "log what happened"; Action Plans stays a demoted tool (correctly already is). Kill `effectivenessRating` here — the app grades the parent at `BehaviorsTab.tsx:704`. |
| **Growth** | 3 primary + 4 tools = 7 | 18 / 8 | **Over budget by construction.** Seven capabilities cannot share one job. Split: Growth = the record (development · milestones · language). Practice Studio is its own depth-0 hub — it is a 10-world suite hiding as a pill. |
| **Academy** | 3 primary + 3 tools = 6 | — | **Two jobs stacked:** parent learning (masterclasses, learn) and child stories (stories, bedtime, comics). Split along that seam; it is also the parent/kid register line, so the split fixes a design-law smell at the same time. |
| **Care** | 6 | — | One job ("share with a pro"), six surfaces. Collapse to one flow with steps: find → share → track. Reports stays the deep export. |
| **Profile** | identity, settings, weekly, memory, strengths | — | Weekly recap is a *ritual*, not a settings page. Promote it out; leave Profile as identity + settings. |
| **Kid Mode** | 4 adventures + 8 games = 12 tiles | — | Same law, kid register: budget the dashboard, then finish the *deferred* P2–P4 (theme registry, bounded daily quest, parent-mediated share). Do not add Canopy's new game builds until the existing 10 worlds each pass a contract. |

**Net effect:** 8 sections → 8 hubs with one job each, ~43 routes unchanged (zero capability regression holds — nothing is deleted, things are *re-homed*), and every surface acquires a cap it currently lacks.

---

## 8. Corrected roadmap

Canopy's 16 weeks assume a mostly-unbuilt product. The tree says otherwise. Reordered against what is actually true:

| Wave | Weeks | Contents | Exit |
|---|---|---|---|
| **W0 — Debt & truth** | 0–1 | The 2026-08-11 Wave-0 list Canopy dropped: safety `tel:` links + i18n · remove `effectivenessRating` · error-vs-empty on ~18 screens · age filtering · KPI instrumentation. Plus AI-01 (unblock the judge tier — the one honest red pin). | Zero red pins; KPIs instrumented, because everything after this is otherwise unmeasurable |
| **W1 — The spine** | 1–3 | `surfaceContract.ts` + SC-1/2/3. Declare all 43 contracts. Publish the over-budget list. **No UI changes yet.** | Every route has a declared job; the violation list is a fact, not an opinion |
| **W2 — Subtract** | 3–7 | Execute §7 per hub, one PR per hub, each PR bringing its surface under budget. Record-row grammar (Canopy §3.3) rolls out as the shared row primitive during this wave. | Every hub passes SC-2; taps table re-measured against W0 baseline |
| **W3 — Felt response** | 6–9 | §6 column three, per surface. Motion tokens, celebration budget (≤800ms / ≤12 particles), reduced-motion matrix, snapshot CI. Kid P2–P4. | Every primary move has a ≤1s on-screen consequence; 20-family playtest ≥4.5/5 delight, ≤10% overstim |
| **W4 — Depth** | 9–13 | JITAI nudges, content contract + age-band gaps, TTS prod flip, native shell, the real `cosmeticsFirewall` and `comicCopyFirewall` (build them, since they don't exist) | Guard row flat; nudge opt-out <5% |
| **W5 — Launch** | 13–16 | Stores, brand, partnerships, MON-1 | D30 ≥40%, guard row still flat |

The change that matters: **W1 and W2 come before any new feature.** Canopy's W1 "Clarity" mixes IA work with new modules, which is how a clarity wave becomes a complexity wave.

---

## 9. What I would cut from Canopy

- **The "More" services grid.** It is the TOOLS drawer, re-skinned. Guy rejected it outright; the in-repo IA canon records that. Overflow belongs in the hub that owns it.
- **Rive.** Two new dependencies and an art pipeline for hero puppet states, when `motion@12` plus the existing canvas compositor already carry the identity moat. Revisit after W3 with a measured gap, not before.
- **MON-2 (HMO/employer pilot) at P2.** A B2B2C channel before D30 is proven is a distraction with a compliance tail. Park it behind the retention target.
- **The 9-agent method section.** Provenance is fine; nine mandates in a document nobody assigns work from is theatre. One owner per wave.
- **"Story Seasons" as new content velocity.** The five `heroJourneys` PACKS already exist and the theme registry that would unify them (`kidThemes.ts`) is still unbuilt. Finish the registry before commissioning seasons.

---

## 10. Open decisions for Guy

1. **Hub count.** 8 with one job each (my recommendation — it preserves the shipped spine and needs no cutover), or the AR-IA target of 6–7 with the W7 cutover you have been holding? These are mutually exclusive; Canopy pretends they aren't.
2. **Academy split.** Splitting parent-learning from child-stories adds a ninth hub but resolves a register violation. Split, or keep six capabilities in one hub with a hard budget?
3. **Practice Studio promotion.** Promote to a depth-0 hub (it is a 10-world suite behind a pill), or leave it as a Growth tool?
4. **Kid P2–P4 vs new games.** Finish the deferred theme registry / bounded quest / share loop first — my recommendation — or build the new game types Canopy proposes?

**Recommendation if you defer all four:** 8 hubs, split Academy, promote Practice Studio, finish P2–P4 before any new game. That is the configuration §7 and §8 are written against.

---

**Bottom line.** Canopy v3 is worth keeping as a market-and-inventory document, and its record-row grammar and guard-metric framing should be lifted wholesale. But as a plan it prescribes addition for a disease of excess, re-budgets five weeks for a dashboard that shipped, and rests part of its safety case on two guards that do not exist. The missing spine is the one this codebase already prototyped on a single screen: **one job, one move, a hard budget, and a felt response** — generalised from Today to all 43 surfaces, enforced by three tests, and executed as subtraction before anything new is built.
