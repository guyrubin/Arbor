# Arbor — Enhancement Backlog v4 (Real Value Behind the AI)

**Date:** 2026-06-04
**Basis:** Read of the shipped v2 code (`PPPPtherapy-/app`), the on-disk knowledge
base (`knowledge/framework/**`), and Cortex's external review
(`Arbor_Claude_Backlog_Handoff.md`). Grounded in code, not memory.
**Relationship to prior docs:**
- v3 (`arbor-enhancement-backlog-v3.md`) wired the **breadth** — six-capability IA,
  URL routing, single token source, Child Memory → backend, reports/handoffs,
  trusted sharing. Most of that shipped.
- **Cortex's handoff** is a strong *product-UX* pass (quick-log, milestone
  reframing, recipient-led reports, memory governance) — largely complementary
  and folded in below where it adds substance.
- **v4 is the depth pass.** It targets the one thing neither doc closed: the gap
  between what the AI *looks like it knows* and what it *actually receives*. The
  app projects a deep multi-scholar developmental engine; the model currently
  gets a scholar's **name as a bare string** and a thin, often-unmatched
  knowledge card. v4 makes the developmental framework and the scholars
  **load-bearing**, not decorative.

---

## 1. Thesis — close the substance gap, not add features

> Do not add breadth. Put real value behind what already renders.

Arbor's architecture is genuinely strong and ahead of the Cortex review's
assumptions: a server-owned `framework.json` (6 domains × 5 age bands × Six
Frames), a non-diagnostic contract, schema-enforced coach output, an
append-only governed memory ledger, safety pre-screening, model routing
(Claude for high-stakes, Gemini for creative/analysis), and a markdown
knowledge-card RAG layer. The bones are excellent.

The **noise** the product owner feels is real and locatable: several headline
features are *presentational shells over a thin core*. The clearest, highest-value
example is the **Scholar layer** — the thing the brand sells ("multi-theory
developmental system") and the thing that is least actually wired to the AI.

v4 = make four things substantively true:

1. **Scholars are real lenses, not labels.** Selecting a scholar must change what
   authoritative knowledge the model receives and how it reasons.
2. **The knowledge base is an evidence base, not a stub.** 11 draft cards / 5
   scholars / one-sentence bodies cannot back a credible "Knowledge Cards Used"
   citation.
3. **The Six Frames and risk are computed and surfaced**, not free-text the model
   invents and a banner that always says "Low".
4. **Every AI artifact is structured, consistent, and reusable** — Cortex's
   "answers convert into artifacts" insight, enforced by schema (already half-built
   server-side).

---

## 2. The substance gap — what I verified in code

| # | Finding | Evidence | Impact |
|---|---|---|---|
| **G1** | **Scholar lens is cosmetic.** The selected lens is passed to the model as a bare string and **never influences knowledge retrieval.** Picking "Bowlby" does not inject the Bowlby card. | `routes/api.ts:151` (`Active Scholar Lens/Concept: ${scholarLens}`); `routes/api.ts:130` `retrieveKnowledgeCards` filters only `ageBand` + `domains` + `allowedUse`. | The flagship differentiator is a placebo. The model gets a name, not the scholar's actual method. |
| **G2** | **No canonical scholar id.** The lens string is set free-form in ~10 places — "Bowlby's Attachment Model", "Vygotskian Scaffolding", "Lev Vygotsky", "Bowlby's Attachment Model". Even naive string-matching a card would fail. | `BehaviorsTab.tsx:519`, `MilestonesTab.tsx:276`, `ArborContext.tsx:236/277`, `ScholarTab.tsx:40`. | Impossible to join lens → card → eval; analytics on lens usage are noise. |
| **G3** | **Catalog mismatch.** UI lists 6 scholars (Vygotsky, Bowlby, Winnicott, Montessori, Bronfenbrenner, Piaget). Disk has 5 cards (bowlby, bronfenbrenner, erikson, vygotsky, winnicott). **Montessori & Piaget have no card; Erikson card is orphaned (no UI).** No shared key (`id: vygotsky-zpd` vs `slug: vygotsky`). | `initialData.ts:150`; `knowledge/framework/scholars/*.md`. | Two of the six advertised lenses have zero authoritative backing. |
| **G4** | **Knowledge base is a stub.** 11 cards total, bodies are 1–3 sentences, `review_status: draft`. Surfaced to parents as "Knowledge Cards Used" with citation authority. | `knowledge/framework/scholars/vygotsky-zpd.md` (single-paragraph body); `wiki.ts` slices `body.slice(0,900)`. | Citations imply an evidence base that doesn't exist yet. Trust risk. |
| **G5** | **Six Frames are free-text, ungrounded.** `frameRouting` (aim/twoAxes/story/shadow/marriage/shepherd) is required output but the model invents it with no scholar/framework constraint, and it's rendered as a flat block, not made actionable. | `contracts/coach.ts:15`, `:156`; no validation against `framework.json`. | The "Six Frames" depth is asserted, not enforced or useful. |
| **G6** | **Risk/Trust is static.** `TrustSafetyBar` is a reassurance banner taking a `note` prop; child `riskLevel` defaults to "Low" at creation and is never recomputed from logs/answers. | `ui/kit` `TrustSafetyBar`; `OnboardingFlow.tsx:42`, `AddChildModal.tsx:52`. | Confirms v3 TS-1 still open: trust is asserted, not computed. |
| **G7** | **Memory proposals are generated but invisible.** The coach already returns `memoryProposals` and the server appends them to the ledger (`appendMemoryProposals`), but the coach UI does not surface a one-tap "approve this memory" moment. | `routes/api.ts:181`; `memoryService.ts`. | The moat half-works server-side; the parent never feels it. (Cortex P0.4 / v3 CAP-2.) |

These are not bugs — they're **half-built depth**. The fix is to finish the
connections, not rebuild.

---

## 3. Maturity scorecard — depth axis (today)

| Capability | Looks like | Actually is | Rating |
|---|---|---|---|
| **Scholar Frameworks** | A 6-theory developmental engine you can steer the AI with | A static info grid + a free-text string the model ignores for retrieval | ●○○○○ |
| **Arbor AI Wiki / cards** | A cited evidence base | 11 draft cards, 5 scholars, one-line bodies, retrieved by age/domain only | ●●○○○ |
| **Six Frames** | A structured formation lens on every answer | Model-invented free text, unvalidated, flat render | ●●○○○ |
| **Non-diagnostic coach** | Strong — schema-enforced 9-part contract exists server-side | Real; needs the structured blocks surfaced + lens grounding | ●●●●○ |
| **Governed memory** | Parent-approved moat | Real ledger + proposals; approval UX not surfaced in the loop | ●●●○○ |
| **Dynamic risk** | Computed safety | Static banner + creation-time default | ●●○○○ |

---

## 4. Strategic bets (epics)

| Epic | One-liner | Closes |
|---|---|---|
| **D1 — Scholars become load-bearing** | A canonical scholar registry that maps every lens → scholar card(s) → domains → Six Frame, and makes lens selection *force-inject* that scholar's method into retrieval and reasoning. | G1, G2, G3 |
| **D2 — Real evidence base** | Turn the 5-card stub into a curated, reviewed, age-banded card library (scholars + interventions + escalation), with provenance, and gate citations on `review_status`. | G4 |
| **D3 — Six Frames + risk, computed** | Validate `frameRouting` against the framework, surface frames as actionable chips, and compute per-answer risk that drives `TrustSafetyBar` and escalation. | G5, G6 |
| **D4 — Answers become artifacts (enforced)** | Surface the existing 9-part schema as labeled blocks with one-tap "save to plan / approve memory / add to handoff / ask professional" — Cortex P0.4, finished. | G7 |

---

## 5. Backlog

Priority: **P0** now / **P1** next / **P2** later. V/E = Value/Effort (H/M/L · S/M/L).

### D1 — Scholars become load-bearing (the headline fix)

| ID | Item | Pri | V/E |
|---|---|---|---|
| **SCH-1** | **Canonical scholar registry.** One source of truth (`scholars.ts`) keyed by stable `scholarId` (`vygotsky`, `bowlby`, …) holding: display name, parent-facing label (Cortex P2.2: "Next doable challenge" — Vygotsky), concept, primary domains, default Six Frame, "use this when", and the **card ids** that back it. UI `scholarsInfo` and card frontmatter both reference this id. | P0 | H/S |
| **SCH-2** | **Add `scholar:` frontmatter** to every scholar card; backfill the 5 existing cards; **write the 2 missing** (Montessori, Piaget) and wire the **orphaned Erikson** into the UI. Every advertised lens has ≥1 reviewed card. | P0 | H/S |
| **SCH-3** | **Lens-aware retrieval.** Plumb `scholarLens` (now a `scholarId`) into `retrieveKnowledgeCards`: when a lens is active, **guarantee** the scholar's card(s) are injected and boosted, alongside age/domain matches. | P0 | H/S |
| **SCH-4** | **Replace the free-text lens string with `scholarId`** everywhere it's set (the ~10 call sites in G2) so selection is canonical and analytics-clean. Keep "Integrated Balanced" as a first-class id. | P0 | M/S |
| **SCH-5** | **Scholar-grounded prompt block.** Inject the selected scholar's *method* (from the card, not just the name) into the coach prompt: "Apply {scholar}'s {concept}: {method summary}. Ground today's plan in this lens." | P0 | H/S |
| **SCH-6** | **Scholar attribution in the answer.** Render which lens/scholar shaped the response and which card(s) backed it (real, not the current always-on "No card attached" fallback). | P1 | M/S |
| **SCH-7** | **Multi-lens blend (Integrated).** Define what "Integrated Balanced" deterministically does — e.g. attachment + ZPD + ecosystem as a fixed triad — so the default isn't "no lens". | P1 | M/M |

### D2 — Real evidence base

| ID | Item | Pri | V/E |
|---|---|---|---|
| **KB-1** | **Card review gate.** Only inject and cite cards with `review_status: reviewed`; draft cards never reach parents as "Knowledge Cards Used". | P0 | H/S |
| **KB-2** | **Deepen the scholar cards** from one-liners to structured, reviewed entries: when-to-use, the method in 3–5 steps, age-band nuances, what-to-avoid, escalation boundary, and a public-source provenance line (CDC / ZERO TO THREE / AAP / Harvard CDC) — matching the milestone source standard already in `lib/milestoneReferences.ts`. | P0 | H/M |
| **KB-3** | **Card provenance + evidence_strength surfaced.** Each card carries and displays its source and strength; weak/teaching cards are visually distinct from sourced ones. | P1 | M/S |
| **KB-4** | **Card coverage map + authoring loop.** A `framework-check` extension that reports domain × age-band × scholar coverage gaps so the library grows deliberately (extends `scripts/framework-check.mjs`). | P1 | M/M |
| **KB-5** | **Eval set tied to cards.** Golden Q→expected-domain/scholar/escalation cases (extends `scripts/safety-eval.mjs`) so card/prompt changes are regression-tested. | P1 | H/M |

### D3 — Six Frames + risk, computed

| ID | Item | Pri | V/E |
|---|---|---|---|
| **TS-1** | **Per-answer risk classification** drives `TrustSafetyBar` and the child `riskLevel` (recomputed from logs + answers), replacing the static banner and creation-time default. (Carries v3 TS-1.) | P0 | H/M |
| **SF-1** | **Validate `frameRouting`** against `framework.json` Six Frames; reject/repair empty or off-framework frames (this class of empty-phase bug already bit `generate-plan` — same guard). | P1 | M/S |
| **SF-2** | **Make frames actionable.** Render each frame as a chip with its own action — Shepherd → "add professional question / start handoff"; Marriage → "co-parent alignment note"; Story → "pick a Hero Journey". | P1 | H/M |
| **SF-3** | **Escalation directory by market** when risk is high (NL/BE first): surface real local guidance + Care Network professionals. (v3 TS-3.) | P2 | M/M |

### D4 — Answers become artifacts (Cortex P0.4, enforced)

| ID | Item | Pri | V/E |
|---|---|---|---|
| **ART-1** | **Surface the 9-part schema as labeled blocks** in the coach answer (what/why/today/script/avoid/observe/escalate/memory/handoff) instead of one markdown blob. The contract already produces these fields. | P0 | M/S |
| **ART-2** | **One-tap artifact actions per answer:** Save script → plan step; Approve memory (the already-generated proposal, G7); Add to handoff/professional question; Add to weekly insight. Never auto-approve memory. | P0 | H/M |
| **ART-3** | **Quick Log from an answer / from Home** (Cortex P0.2): ≤4 required inputs, <45s, appears in patterns immediately; full fields behind "Add details". | P1 | H/M |
| **ART-4** | **Milestone reframing** (Cortex P0.3): retire "TOTAL MASTERY"; status model (Observed / Emerging / Not seen yet / Unsure); non-diagnostic microcopy; migrate booleans safely. | P1 | M/M |

---

## 6. Recommended sequence

**Now (P0 — make the scholars and the AI real):**
SCH-1 → SCH-2 → SCH-3 → SCH-4 → SCH-5 (the whole scholar chain, ~1 focused
iteration) · KB-1 (review gate) · KB-2 (deepen cards) · ART-1 + ART-2 (structured
answer + artifact actions) · TS-1 (computed risk).

**Next (P1):**
SCH-6/7 · KB-3/4/5 (provenance, coverage, evals) · SF-1/2 (frames validated +
actionable) · ART-3 (quick log) · ART-4 (milestone reframe).

**Later (P2):**
SF-3 (escalation directory) · the remaining v3 platform/marketplace epics
(Care Network backend, recipient portal, co-parent, notifications).

### Top 5 highest-leverage moves
1. **SCH-1→SCH-5** — turn the flagship Scholar layer from a label into a real,
   retrieval-changing lens. *This is the single biggest "now it has real value"
   jump and the direct answer to the brief.*
2. **KB-1 + KB-2** — make the cited evidence base real before citing it.
3. **ART-1 + ART-2** — every answer becomes reusable data (Cortex's core insight).
4. **TS-1** — trust becomes computed, not asserted.
5. **KB-5** — evals so depth changes don't silently regress safety.

---

## 7. Guardrails / non-goals

Non-diagnostic always; no unsupervised child-facing AI; parent-approved memory
only; **never cite a card that isn't reviewed**; scholar lenses inform method,
never credentials or diagnosis; curated professionals, never a gig directory;
privacy and escalation first. Do not expand breadth until the depth above is real.

---

## 8. One-paragraph brief for the product owner

The app is architecturally strong, but its headline differentiator — the
multi-scholar developmental engine — is currently a name passed to the model and
ignored by retrieval, backed by 11 draft cards (two advertised scholars have
none). That is the "noise": impressive surface, thin core. v4 fixes it in one
focused chain: a canonical scholar registry, lens-aware retrieval that injects
the chosen scholar's actual method, a reviewed evidence base gated before it's
cited, computed risk, and answers that turn into reusable plan/memory/handoff
artifacts. Ship the P0 chain and "Scholar Frameworks" stops being a brochure and
starts being the product.
