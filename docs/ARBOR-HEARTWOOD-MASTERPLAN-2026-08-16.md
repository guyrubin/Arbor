# ARBOR — PROJECT HEARTWOOD
## One Job · One Move · One Thread — the plan of record

**Date:** 2026-08-16 · **Status:** v1.0 — for Guy's L3 ratification of §2 defaults; everything else executes
**Supersedes:** Canopy v3 (Qwen) *as plan* — demoted to market/inventory reference. Canopy's fact-check is `ARBOR-CANOPY-V4-REVIEW-AND-SPINE-2026-08-16.md`; nothing here relies on a claim that review did not verify against `main` `710b05bc`.
**Absorbs by reference:** `ARBOR-UI-MASTERPLAN-2026-08-11.md` (the defect + wiring canon — cited below as **M0.x–M5.x**; its items are NOT restated, they are scheduled), the Kid-Mode Viral plan's deferred P2–P4, and the AI-Excellence waves in flight.
**Name:** Canopy was the foliage — everything visible, all addition. Heartwood is the structural core of the tree: what everything else hangs on.

---

## 0. Thesis — one paragraph

Every external reviewer said the same two sentences: *"I can't tell what Arbor wants me to do"* and *"nothing connects."* Both are cured by the same three-law spine, not by new product. **Law 1** caps what a screen may ask of a parent. **Law 2** makes the one thing it asks feel instantly worth doing. **Law 3** makes every one of those moments land in a single visible thread — the child's record — so the product accrues instead of scattering. The repo already prototyped all three (Rule A on Today; the celebration/compositor primitives; `signalTimeline` + the Since-strip). Heartwood generalises them from one screen to all 43, then spends the delight budget where it compounds.

**North star:** supported moments per family per week = accepted Today actions + captured moments + parent-confirmed kid sessions + co-reads + pro-shares. **THE driver metric:** week-2 return (M§9). **Guard row (must stay flat, per release):** eval pass 100% · clinical-firewall 0 · kid-lock 0 · 0 new child-data egress fields · HE parity · p95 ≤ today.

---

## 1. The Three Laws

### Law 1 — One Job, One Move
Every surface declares **one job** (one sentence, parent language), offers **exactly one primary move**, and holds a **hard module budget**. Everything else earns a slot or is demoted somewhere it still lives. Enforced in code, not in review:

```ts
// app/src/lib/surfaceContract.ts — beside routes.ts; the second half of the one manifest
export type SurfaceContract = {
  route: ActiveTab;
  hub: HubId;
  depth: 0 | 1;                       // 0 = hub, 1 = tool. There is no depth 2.
  job: string;                        // one sentence, no jargon
  primaryMove: string;                // the single action id this surface exists to produce
  moduleBudget: number;               // top-level sibling modules, hard cap
  demotionTarget: ActiveTab | "disclosure";
  threadWrite: SignalSource | "consented" | "none";  // Law 3 hook (see below)
};
```

Guards, mirroring `todayModules.ts` + `todayConsolidation.test.ts` (the proven prototype — including its hard-won lesson: **budgets count modules that actually render, never a proxy or a governance gate**):
- **SC-1 completeness:** every `ROUTE_IDS` entry has exactly one contract; a new route without a job fails the build. Kills three-file drift permanently.
- **SC-2 budget:** ≤ `moduleBudget` rendered siblings and exactly one `data-primary-move` element per surface, from real render conditions.
- **SC-3 no orphan demotion:** every demoted module resolves to a live entry (`check:floors` F1–F18 re-expressed per module).
- **SC-4 thread integrity:** every contract's `primaryMove` maps to a real `buildTimeline` source, or declares `"consented"`/`"none"` with a one-line justification in the contract literal. No silent dead-ends.

### Law 2 — Felt Response
The primary move produces a **visible consequence within one second, on the same screen, without navigation** — and that consequence is where the entire delight budget lives. Celebration caps stand: ≤800ms, ≤12 particles, reduced-motion static fallback, never countdowns/🔥/"in a row". Simple-but-dead fails this law exactly as hard as cluttered does.

### Law 3 — The Golden Thread
**Every primary move writes a line the parent can see again**: instantly in place (Law 2), then in the Journal timeline, then eligible for the Since-strip and the weekly recap. One record, four altitudes: *this second → today → this week → over the months.* Mechanically this is `signalTimeline` (6 sources today, +6 kid collections per M1.4) + `SinceLastVisit` + `server/digest.ts` — all built; Law 3 makes feeding the thread a **contract obligation** instead of a per-feature accident. Two deliberate exceptions, encoded not implied:
- **Coach turns are private by default** (`threadWrite: "consented"`). The thread hook is explicit: a **"Keep this"** action on any coach answer writes a Journal row with provenance. Consent-clean, and it converts the coach from a vending machine into a contributor to the record.
- **Kid-session signals are parent-facing celebration only** — never child-facing pressure (M1.4 provenance class `"child"`).

The thread is also the honest answer to "how does everything connect": SpineRibbon mounts on hubs + first-run + trust center per M1.5 — never on Today (Rule A).

---

## 2. Decisions — resolved with defaults (Guy can reverse any line; each is one PR)

| # | Decision | Default taken | Why |
|---|---|---|---|
| D1 | Hub count | **9 hubs, evolved from the shipped 8** — no AR-IA W7 cutover | Preserves the live spine and 43 route ids (zero regression, zero deep-link breakage); the AR-IA goal ("one job per hub") is achieved by contract + two moves below, not by rebuild. W7 cutover is retired, not deferred. |
| D2 | Academy | **Split along the register seam**: LEARN (parent learning) / STORIES (child-starring stories) | Two jobs were stacked; the seam is also the parent/kid register line, so one split fixes an IA smell and a design-law smell. |
| D3 | Practice Studio | **Promoted to depth-0 hub** | A 10-world suite was hiding behind a Growth pill; the discoverability fix that motivated the pill (IA canon) is completed, not undone, by promotion. |
| D4 | Kid Mode | **Finish deferred P2–P4 before any new game** | `KidDashboard.tsx`'s own header lists what's missing: theme registry, bounded quest, parent-mediated share. New game types wait until every existing world passes its contract. |
| D5 | Mobile bar | **Today · Journal · Ask weighted, Growth, More** (M2.7 progressive disclosure) | "More" lists the remaining *hubs*, quietly — it is navigation, never a services/tools grid (that drawer stays rejected). |
| D6 | Icons | **Remains Guy's open GD** (M4.4) | Prod drifted to Material Symbols against the lucide lock; ratify or reverse explicitly — not buried in a discipline pass. |
| D7 | Rive/Lottie | **Cut.** `motion@12` + the canvas compositor carry the identity moat | Revisit only after H3 with a measured gap. |
| D8 | Canopy monetization | MON-1 professional tier stays (H5 design work); **MON-2 HMO pilot parked behind proven D30**; MON-3 post-native | B2B2C before retention is proven is a distraction with a compliance tail. |

## 3. The IA — nine hubs, every route homed

Chrome (outside hubs): topbar **Safety life-ring** (persistent, canon), child switcher, Kid-Mode hero door (kid-lock suite re-runs on any nav change). `timeline` stays the density-toggle alias inside Journal; `attribution` stays admin-gated.

| Hub | Job (the contract sentence) | Routes (depth-1 tools in parens) |
|---|---|---|
| **TODAY** | "One thing to do now — and what changed since you left." | overview (day-windows, smart-reminders, **weekly**) |
| **ASK** | "Help me right now." | coach (scholar — lens library stays here per canon) |
| **JOURNAL** | "Catch the moment before it's gone." | journal (timeline = in-surface density toggle) |
| **BEHAVIORS** | "Log what happened; see the pattern form." | behaviors (plans) |
| **GROWTH** | "Watch her record grow." | development (milestones, language, screening, daily-play, copilot→"The Full Picture", gated per M1.7) |
| **PRACTICE** ⬆ | "Play the games that grow her." | practice (speech, mimic, feelings, journey, adventures + the 10 worlds) |
| **STORIES** ✂ | "Tonight's story — starring her." | stories (bedtime-stories, comics) |
| **LEARN** ✂ | "Something useful in three minutes." | masterclasses (learn, family, science → trust-center home per M3.3) |
| **CARE** | "Bring in a pro without losing control." | consult (find-pro, care-team, appointments, sharing, reports, handoff, school-brief) — one flow: find → share → track |
| **MY CHILD** | "Who she is — and what Arbor remembers." | profile (memory, strengths, safety, attribution) |

Weekly recap is re-homed under Today deliberately: it is a **ritual**, not a settings page, and the Since-strip is its doorway (M2.1). Nothing is deleted; 43 routes and every deep link survive (SC-3).

---

## 4. Per-hub engagement spec — simplify each feature to its most engaging form

The format *is* the method: **Job → the one Move → the Felt response (≤1s) → the Thread line → what gets Subtracted.** This table is the answer to "simplify each feature to make it the most engaging" — engagement is the felt consequence of one clear move, compounding in one visible record.

| Hub | The one move | Felt response (≤1s, same screen) | Thread line | Subtract / discipline |
|---|---|---|---|---|
| **TODAY** | Do the offered action | It checks off **and** the Since-strip gains a line in the same frame — the action visibly became part of the record | action-outcome signal | Ratify budget 5 (already law). Guaranteed-action chain M1.2: AI focus → promptBank prompt → Daily Play pick — **every open ends in one offered action, even day-0/offline.** Canopy's five-zone queue: rejected. |
| **ASK** | Ask | **"Say this" script first**, honest statuses, hypotheses collapsed (AI-Excellence W2) | `"consented"` — "Keep this" on an answer writes a Journal row w/ provenance | Heaviest surface in the app (25 handlers). Budget 3: composer · answer · history-as-record-rows. Coach memory ships only as M1.3 (same-thread turns + explicit toggle + TrustPanel + eval bump, one PR). |
| **JOURNAL** | Capture (voice/photo/text) | The row appears in the timeline **before any AI runs**, provenance chip attached | it *is* the thread | Mount promptBank: 3 rotating prompts above the triad (M2.6) — kills empty-page paralysis. Budget 3. |
| **BEHAVIORS** | Log what happened | Pattern echo — *"third morning this week"* — a **count observation, never a verdict** | behavior signal | **Kill `effectivenessRating` (M0.4): the app must never grade a parent at 2am.** After 3 similar logs, one contextual CTA earns Plans its traffic: "turn this pattern into a plan." |
| **GROWTH** | Notice a milestone | Count moves + the tree gains a leaf, same frame | milestone-crossing | Screening → neutral counts, single tone + regression test (M0.3). Copilot promotes only through the M1.7 gate (chips → counts) as "The Full Picture" card. Months layer = monotonic cumulative only (M1.8). |
| **PRACTICE** | Start a world | World opens in the kid register; on exit, the parent's strip gains *"Mia played 2 speech adventures"* (M1.4) | practice signals (`"child"` class) | Promotion PR = nav only, zero surface rewrites. Per-world monotonic day counts (KID-6 pattern) — never streaks. |
| **STORIES** | Read tonight's story | One dominant personalized cover (compositor — her avatar, ~50ms, cached); page one is a tap away | co-read logged | Evening = one pick, not a library. Wow-onboarding comic becomes the timeline's first artifact (M5): day-0 already shows a remembered moment. |
| **LEARN** | Open today's 3-minute pick | Marked done → thread line; next pick **echoes the parent's own report** — "*you said* the calming game helped" (M2.5), never an AI efficacy claim | learn-done signal | Age-band filter default ON (M0.7 — the exact Kinedu criticism). Provenance chip on every card (M3.4, fail-closed pre-GD-10). De-jargon sweep (M3.5). |
| **CARE** | Build & send the packet | Redaction preview **visibly applied** before anything leaves; appointment chips requested/confirmed/done | share-event | Six surfaces → one flow (find → share → track); Reports stays the deep export; `ClinicalLanguageError` fail-closed scan survives every merge (canon must-hold). |
| **MY CHILD** | Approve a memory | "Arbor remembers *n* things" count increments; coach contract panel reflects it immediately | approved-fact | Memory facts: view/edit/delete always. Weekly recap moves out (→ Today). Settings stays a modal. |
| **KID MODE** | Finish today's quest | Star arcs into the meter (600ms, monotonic); **golden leaf lands in the parent register too** — one moment, two registers | mission-record (parent-confirmed) | Ship the deferred P2–P4: `kidThemes.ts` registry · bounded daily quest (one/day, deterministic seed, terminal "see you tomorrow" — no refill) · parent-mediated share (post-gate, ≤1 prompt/session, dismissable-forever, provenance-carrying pipeline). **Build the two firewalls Canopy hallucinated:** `cosmeticsFirewall` (earned-only, no purchase/trade/expiry paths compile) + `comicCopyFirewall` (onomatopoeia whitelist EN+HE) — as tests, since neither exists. |
| **SAFETY** (chrome) | Call for help | `tel:` dials — **the current screen cannot place a call at all** | none (deliberate) | M0.2 ships first, before everything: helplines + tel: + full HE pass + loading state. |

**The recap ritual (Today tool, H2):** auto-generate on first open of a new ISO week (M2.1), 3–5 story cards, **last card = exactly one recommendation, tap = accepted into Today** — the thread folding back into Law 1. Email digest v1 (M2.2) makes the loop non-circular; counts-only, firewall applies to email too. Continuity = `totalDays` cumulative only; lapse → welcome-back, zero guilt (M2.3).

---

## 5. Sequencing — six waves, each exits only with the guard row flat

Backbone = the 08-11 masterplan's order (it survived a 3-lens verification panel; Canopy's did not), with the spine inserted before subtraction and the kid/craft work merged where it belongs. Rename H* to avoid colliding with M-wave numbers.

| Wave | Wks | Contents (PR-granular) | Exit criteria |
|---|---|---|---|
| **H0 — Truth** | 0–1 | M-Wave-0 verbatim: 0.2 safety tel:+i18n · 0.4 kill effectivenessRating · 0.5+0.6 error-vs-empty + offline (additive; 18-screen screenshot sweep) · 0.7 age filter · 0.3 screening tones · 0.8 **KPI instrumentation** · 0.9 kid-lock audit close. Plus **AI-01: unblock `eval:judge`** (the one honest red pin). | 0 red pins. KPIs live — nothing after this is otherwise measurable. |
| **H1 — Spine + wiring** | 1–3 | Track A: `surfaceContract.ts` + SC-1..4, all 43 contracts declared, violation list published (**no UI changes** — the list is a fact, not an opinion). Track B (parallel): M-Wave-1 = Since-strip · guaranteed action · coach memory (consent-gated, M1.3 as ONE PR) · kid signals→thread (M1.4) · SpineRibbon on hubs · first-run promise · copilot gate · months layer · mobile search entry. | Every route has a declared job; a returning parent sees ≥1 change in 2s; every open ends in one offered action with a why-line. |
| **H2 — Subtract + ritual** | 3–6 | Nine hub PRs enacting §3/§4, each bringing its surface under budget (D2 split, D3 promotion, Care collapse, Ask thinning). **ContentActionBar (M4.2) + record-row grammar pulled forward** — subtraction needs the shared primitive, so it ships here, with the affordance inventory + 9-surface screenshot sweep. M-Wave-2: recap ritual + email digest + `totalDays` + promptBank + search index. | All hubs pass SC-2; taps re-measured vs H0 baseline; recap reaches 100% of active parents **with a channel**; zero resettable counters. |
| **H3 — Felt response + trust** | 6–9 | Law-2 column per hub: motion pass (M4.5 — kill the double entrance animation), state triad (M4.3), celebration caps in CI, snapshot baselines EN+HE × light/night × motion/reduced. M-Wave-3: required why-line slot · TrustPanel everywhere due · trust center on Science · provenance · de-jargon · free-vs-Plus clarity. | Every primary move has a ≤1s same-screen consequence; 20-family playtest ≥4.5/5 delight, ≤10% overstim; 100% of recommendation cards carry a why-line. |
| **H4 — Craft + kid** | 9–12 | M4.1 token-leak declare-only (GD-2 honored) · M4.4 discipline (icon GD → Guy, D6) · M4.6 perf budget (cold-open TTI, route-split audit) · M4.7 dead-weight purge. Kid P2–P4 + the two new firewalls (§4). | Guard row flat; Lighthouse ≥90 mobile; kid egress test still empty; purge executed against the H1 triage list. |
| **H5 — Delight + reach** | 12–16 | M-Wave-5: celebration chain (PrideMomentCard/CelebrationMoment) · wow→story seed · teach-empty-states. Native shell (Capacitor) beta with kid-lock re-penetration on native back · store prep · MON-1 design · I-02 brand ("one tree, two worlds"). | D30 trending to ≥40; NPS ≥50; store-ready builds green. **Pre-declared cut line: H5 delight first, then M4.4/M4.6 — never H0–H2.** |

**Effort, honestly:** best case ~10 weeks single-track; **expected 12–14** — priced in: Guy-gate serialization across waves, M1.3's eval+consent work, the 9-surface ActionBar migration, and this repo's demonstrated freeze risk. Every wave = green branch → PR → Guy promotes (prod deploy stays Level-3 gated; merges auto-deploy — no merge without the gate).

---

## 6. Metrics — one page, all instrumented in H0

| Layer | Metric | Target |
|---|---|---|
| North star | Supported moments / family / week | ≥6 by H5 |
| **THE driver** | Week-2 return rate | up and to the right from H2; D1 60 / D7 45 / D30 40 by H5 (habit-class, not social-class) |
| Law 1 | % opens ending in an accepted action · time-to-first-action | 100% offered; median <60s |
| Law 2 | Playtest delight ≥4.5/5 · overstim ≤10% · INP <200ms | per H3 |
| Law 3 | % opens showing a since-visit delta · recap open → accept rate · capture→action <24h median | measured from H1 |
| Guard row | eval 100% · firewalls 0 · kid-lock 0 · egress 0 · HE parity · crash-free ≥99.5% | flat, every release |

## 7. What this plan does NOT do

Inherits M§8 in full: no palette retint (GD-1/GD-2) · no clinical-review claims or devScore values pre-GD-10 · no icon migration pre-GD (D6) · no caregiver identity (GD-9) · no child-facing streaks/timers/shares or resettable counters, ever · no unconsented coach data · landing page stays MKT. Plus the Heartwood cuts: no AR-IA W7 cutover (D1 retires it) · no "More" services grid · no Rive/Lottie (D7) · no new kid game types before P2–P4 + contracts (D4) · no Story Seasons before `kidThemes.ts` exists · MON-2 parked (D8) · no ads, no data sale, safety never paywalled, kid cosmetics never purchasable.

## 8. Risks → standing mitigations

Subtraction breaks a workflow → SC-3 + zero-regression floors + per-hub screenshot sweeps · thread becomes surveillance-feeling → counts-only firewall extends to strip/recap/email; kid signals celebration-framed; coach opt-in · scope re-bloats → SC-1 makes every new surface declare its job at build time; any new Today module must name what it replaces (Rule A clause) · two-week freeze risk → house rule: uncommitted work = same-day branch+push · overstim → caps + wind-down + the H3 playtest bar.

## 9. First three PRs (this week)

1. **M0.2** — Safety screen: helplines + `tel:` + HE + loading state. *(The app must be able to call for help before it does anything else.)*
2. **M0.4 + M0.3** — remove `effectivenessRating`; screening to neutral counts + regression test.
3. **SC skeleton** — `surfaceContract.ts` + SC-1 with the 10 hub contracts declared; SC-2/3/4 land as the remaining 33 fill in. From this PR on, every surface argues with a test instead of a reviewer.

---

**Bottom line.** Heartwood does three things Canopy could not: it subtracts before it adds, it schedules against what is actually in the tree, and it gives every feature the same engagement law — *one job, one move, a felt response, a line in the thread* — enforced by four tests that generalise a mechanism this codebase already proved on its best screen. The parent side becomes a calm room where one thing asks to be done and visibly matters; the kid side becomes a hero's daily quest that ends, on purpose, with "see you tomorrow"; and both registers write the same golden thread — which is the product.
