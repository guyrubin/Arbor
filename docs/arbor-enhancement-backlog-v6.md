# Arbor — Enhancement Backlog v6 (The Agentic Developmental Ecosystem)

**Date:** 2026-06-04
**Basis:** Full functional review of the shipped v2 app + in-depth market
research (June 2026). Grounded in code and in the competitive landscape.
**Supersedes/integrates:** v3 (breadth, shipped), v4 (AI depth: scholars,
evidence base, safety), v5 (multimodal interaction). v6 is the **architecture
that makes them one system** — a team of agents, built around a defined-profile
scholar council and an ambient logging agent, where every feature feeds the
others instead of sitting in a tab.

---

## 1. Market context (why this, why now)

The parenting-app market is **~$1.06B (2025) → ~$5.5B (2034), ~20% CAGR**
([Business Research Insights](https://www.businessresearchinsights.com/market-reports/parenting-apps-market-113806),
[Coherent](https://www.coherentmarketinsights.com/industry-reports/global-parenting-apps-market)).
It is crowded with low entry barriers, so **retention — not features — is the
battle** ([Coherent](https://www.coherentmarketinsights.com/industry-reports/global-parenting-apps-market)).

**What parents actually want** (ranked): health/development tracking (≈58% cite as
most valuable), **personalized guidance tuned to the individual child**,
community/belonging, behavioral monitoring — and **~40% are hesitant to share
child data over privacy fears**
([Business Research Insights](https://www.businessresearchinsights.com/market-reports/parenting-apps-market-113806)).

**The competitive map:**

| Competitor | What it is | What it owns | Where it's beatable |
|---|---|---|---|
| **Era (Parent Lab)** | Attachment-theory + behavioral-science reflection; temperament/attachment quizzes; daily 5-min check-ins ([openPR](https://www.openpr.com/news/3383388/parent-lab-revolutionizes-parenting-with-era-an-ai-enhanced)) | "Theory-grounded reflective parenting." The closest philosophical competitor to Arbor's scholar lenses. | Still **manual check-ins**, single reflective voice, reflection-not-action, no multimodal, no professional handoff. |
| **Maple** | Family-ops AI agent: turns school emails into tasks/events automatically ([trymaple.ai](https://www.trymaple.ai/)) | "Ambient agent for family logistics." Proves parents accept an agent that *acts for them*. | Logistics only — no developmental/behavioral intelligence. |
| **Huckleberry / Glow / BabyMind** | Tracking + AI tips; sleep/feeding/cry analysis, mostly 0–3 | Habitual daily logging for infants. | Tracking-first, thin guidance, narrow age, no theory, no care coordination. |

**The two structural trends that decide the next 24 months:**

1. **From manual logging → ambient capture.** The AI documentation/ambient-agent
   wave shows that *removing the logging burden* is the single biggest lever on
   engagement and burnout ([ambient-AI burnout study](https://www.medrxiv.org/content/10.1101/2024.07.18.24310656.full.pdf)).
   Every tracking app's retention dies on the manual form. **The winner logs *for*
   the parent.**
2. **From reactive chatbot → proactive + personalized agents.** Research is explicit:
   *proactivity alone ignores preferences; personalization alone lacks initiative;
   the optimum is proactive **and** personalized — recommend the right thing at the
   right moment, unprompted*
   ([ProPerSim, arXiv](https://arxiv.org/pdf/2509.21730);
   [agent interfaces](https://medium.com/agenticais/redesigning-ai-agent-interfaces-for-proactive-interaction-dc91d7d26676)).

**Arbor today is on the wrong side of both:** a request-response chatbot
(`/chat` only acts when asked) fed by **manual multi-field forms**
(`BehaviorsTab`), with a single blended "Integrated Balanced" voice. It has a
*better developmental spine than anyone* (the 6-domain framework, scholar cards,
governed memory, safety contract) but ships it as forms-and-chat. v6 turns that
spine into the thing the market is moving toward — and that no competitor has:
**a personalized team of developmental agents that watches with you, logs for
you, and does the work.**

---

## 2. The thesis — Arbor becomes a team, not a chatbot

> Define the child once. Then a team of developmental agents — each a named
> scholar with a real profile — watches the child's timeline, logs what happens
> for you, deliberates on what it means, and proactively brings you the one next
> step. Every agent feeds the next; the parent approves, not types.

This is the user's brief made literal: **"define a profile, the AI automatically
inputs logs, and it feeds out of each other."** It is also the exact intersection
the market rewards — ambient capture + proactive-personalized agents + a
theory-grounded developmental core — and it leapfrogs Era (manual, single-voice,
reflection-only) on its own turf.

---

## 3. The architecture — an Agentic Developmental Ecosystem

Arbor already has the **seeds** of this and doesn't use them as agents:
- a **4-route model router** (`coach_high_stakes`, `creative_low_risk`,
  `analysis_structured`, `handoff_structured`) — task routing without agency
  (`ai/modelRouter.ts`);
- an **event-sourced memory ledger** — a perfect shared bus, used only for memory
  (`memory/memoryService.ts`);
- **scholar cards + a framework** — agent knowledge, used as static text
  (`knowledge/framework/scholars/*`).

v6 promotes these into a team:

```
                         ┌─────────────────────────────┐
   Ambient capture  ─────▶   ORCHESTRATOR (planner)     │  reads timeline,
   (voice/photo/chat/      │   - safety triage first     │  routes, composes,
    calendar/routine)      │   - picks which agents      │  proactively pings
                          │     to consult, in what order│
                           └───────┬─────────────────────┘
                                   │ consults
        ┌──────────────┬───────────┼───────────┬──────────────┬───────────┐
        ▼              ▼           ▼           ▼              ▼           ▼
   SCHOLAR COUNCIL   LOGGER     PLANNER     MEMORY        HANDOFF      SAFETY
   (Vygotsky,        agent      agent       STEWARD       agent        agent
    Bowlby, …        auto-      turns       proposes/     compiles     screens
    each a profile)  drafts     answers→    expires       recipient-   every
    deliberate &     logs from  plan steps  facts         ready briefs in/out
    a lead synthesizes signals  & tracks                              + escalates
        │              │           │           │              │           │
        └──────────────┴───────────┴───────────┴──────────────┴───────────┘
                                   │ all read/write
                         ┌─────────▼─────────────┐
                         │  CHILD SIGNAL TIMELINE │  (event-sourced bus:
                         │  one append-only stream │   logs, photos, voice,
                         └────────────────────────┘   coach turns, outcomes,
                                                       milestones, memory)
```

**The defining properties (what "feeds out of each other" means concretely):**
- One **append-only signal timeline** is the only source of truth; every agent
  reads from and writes to it (generalizes the existing memory ledger).
- The **Logger agent** converts ambient captures into *draft* structured logs the
  parent one-taps to confirm — manual forms become the exception.
- The **Scholar Council** is N defined agent profiles that each produce a lensed
  take; a lead agent synthesizes — replacing the single bare-string lens.
- The **Orchestrator** runs safety first, decides which agents to invoke, and —
  critically — runs **proactively** on new signals to surface the next step before
  the parent asks.
- Specialists (Planner/Memory/Handoff) consume each other's outputs: a coach
  answer → plan steps → outcomes logged → memory facts → handoff brief, with no
  re-typing.

---

## 4. Functional review — what each surface becomes when agentic

| Area (today) | Today's reality (code) | In the ecosystem |
|---|---|---|
| **Onboarding / Profile** | Static fields; `riskLevel` defaults "Low" | **Define the child + the council**: temperament/attachment intake (Era-parity) that *configures which scholar agents lead* for this child. |
| **Behaviors** | Manual multi-field form; photo decorative | **Logger agent** auto-drafts logs from voice/photo/chat; form is the fallback. |
| **Ask Arbor (Coach)** | Single text box → markdown wall; lens = bare string | **Council deliberation** rendered as a card stack with attributed scholar voices + a synthesized step. |
| **Scholar Frameworks** | Static info grid; lens ignored by retrieval | **Agent roster**: each scholar a profile (expertise, domains, persona, cards) you can foreground; council shows who weighed in. |
| **Growth Plans** | Kanban + one-shot generator | **Planner agent** turns answers/patterns into plans and tracks outcomes back to the timeline. |
| **Child Memory** | Real ledger; expiry never runs | **Memory steward agent** proposes, ages out, and curates facts; the council reads approved memory. |
| **Milestones** | Manual checkboxes; "mastery" framing | Observations the Logger can propose from photos/notes; status not score (v4 ART-4). |
| **Weekly Insight** | Data + report gen | **Orchestrator retro**: "here's what the team noticed, what we tried, what worked, next experiment." |
| **Handoff / Reports** | Templates from data | **Handoff agent** compiles recipient-ready briefs from the timeline on request or proactively before an appointment. |
| **Care Network / Appointments** | Scaffold/sample data | Shepherd hand-offs the agents prepare for: prep packet in, recommendations → plan steps out. |
| **Hero Journeys / Academy** | Real story engine; scaffolded academy | Child-facing practice the council recommends and the timeline records (values, language phrases). |
| **Safety** | Real screen; placeholder resources | **Safety agent** runs on every signal/modality; real market-specific resources (v4 SAFE). |
| **Today's Focus / Home** | Hardcoded lens; dead-end | **The proactive surface**: the Orchestrator's single next best step, sourced from real signals. |

---

## 5. The backlog (real value to implement)

Priority **P0** now / **P1** next / **P2** later. V/E = Value/Effort (H/M/L · S/M/L).
Each epic notes the **market rationale**. v4/v5 item IDs are referenced where they
become a building block (do those first where noted).

### A0 — The bus: one child signal timeline *(enables everything)*

| ID | Item | Pri | V/E |
|---|---|---|---|
| **ECO-1** | **Generalize the memory ledger into a typed signal timeline.** Extend the append-only event store to carry every signal type (`log`, `photo`, `voice`, `coach_turn`, `plan_outcome`, `milestone`, `memory`, `escalation`) with source + child + timestamp. One read/write API all agents share. | **P0** | H/M |
| **ECO-2** | **Timeline read API for context assembly**: "recent N signals for child X, typed/filtered" — the single context source every agent uses (replaces ad-hoc prop passing). | P0 | H/M |
| **ECO-3** | **Retire lossy hand-offs** (the `replace(/[#*]/g,"")`+truncate dumps): agents pass structured signals, not stripped prose. | P0 | M/S |

### A1 — The Logger agent (ambient logging — the retention moat)

> Market: removing the manual-logging burden is the #1 retention/burnout lever; no
> developmental competitor logs *for* the parent.

| ID | Item | Pri | V/E |
|---|---|---|---|
| **LOG-1** | **Capture → draft log.** A voice memo / photo / quick line (v5 MM-1/2, VIS-1) is parsed by the Logger into a *draft* structured log (type, intensity, context, trigger, response) the parent confirms in one tap. | **P0** | H/M |
| **LOG-2** | **Coach-conversation → log proposals.** After a coach turn about a real incident, the Logger proposes the matching log automatically (today "Log this" dumps prose). | P0 | M/S |
| **LOG-3** | **Pattern watch.** The Logger flags emerging patterns from the timeline ("3rd morning-transition refusal this week") and hands them to the Orchestrator. | P1 | H/M |
| **LOG-4** | **Routine/calendar-aware prompts** (opt-in): around known hard windows (school dropoff, bedtime) offer a 1-tap "how did it go?" capture. | P2 | M/M |

### A2 — The Scholar Council (defined agent profiles — the differentiator)

> Market: Era owns "attachment-theory reflection" with one voice. A *named,
> multi-expert council you can configure per child* is a category Arbor can own.
> (Builds on v4 SCH-1…7 — do those first.)

| ID | Item | Pri | V/E |
|---|---|---|---|
| **SAGE-1** | **Scholar agent profiles.** Promote each scholar (v4 canonical registry) into an agent definition: expertise, domains, age fit, system persona, backing cards, "use when". | **P0** | H/M |
| **SAGE-2** | **Council deliberation.** The Orchestrator selects the 1–3 most relevant scholar agents for a question (by domain/age/profile), each contributes a lensed take, a lead agent synthesizes one coherent answer. Replaces the bare-string lens. | **P0** | H/M |
| **SAGE-3** | **Attributed answers.** The answer shows which scholars weighed in and why, with the synthesized step on top (transparency + the multi-expert wow). | P1 | M/S |
| **SAGE-4** | **Per-child council config from intake.** A temperament/attachment onboarding (Era-parity) sets which scholar agents lead for *this* child. | P1 | H/M |
| **SAGE-5** | **Lens-true grounding.** Each scholar agent is constrained to its method via its cards (v4 SCH-3/5) and evaluated (v4 KB-5) so "Bowlby" actually reasons like Bowlby. | P0 | H/M |

### A3 — The Orchestrator (proactive + personalized)

> Market: the research-optimal pattern is proactive **and** personalized. This is
> the agent that makes Arbor feel alive.

| ID | Item | Pri | V/E |
|---|---|---|---|
| **ORC-1** | **Safety-first routing.** Every request and every new ambient signal runs the Safety agent before anything else (extends `screenForImmediateEscalation` to all modalities; v5 VIS-5). | **P0** | H/S |
| **ORC-2** | **Request orchestration.** Given a question, decide which agents to consult and in what order, assemble timeline context, compose the structured answer. (Formalizes today's single `/chat`.) | **P0** | H/M |
| **ORC-3** | **Proactive next-best-step.** On meaningful new signals, the Orchestrator computes *one* next step and surfaces it on Home/Today (v4 ART-5) and optionally as a notification — unprompted, personalized. | **P1** | H/M |
| **ORC-4** | **Weekly orchestrated retro.** The Orchestrator narrates the week from the timeline (what the team noticed / tried / worked) and proposes next week's experiment. | P1 | M/M |
| **ORC-5** | **Transparency & control.** A visible "what the team is doing / why" trace and a global off-switch for proactivity (trust; privacy-sensitive market). | P1 | M/S |

### A4 — Specialist agents (the work gets done, hand to hand)

| ID | Item | Pri | V/E |
|---|---|---|---|
| **SPC-1** | **Planner agent.** Coach answers and flagged patterns become plan steps with scripts + success signals; outcomes write back to the timeline (closes the loop with data, not navigation). | **P0** | H/M |
| **SPC-2** | **Memory steward agent.** Owns propose → approve → **age-out** (enforce v4 SAFE-3 expiry) → curate; supplies approved memory to the council. | P1 | M/M |
| **SPC-3** | **Handoff agent.** Compiles teacher/clinician briefs from the timeline; proactively assembles a prep packet before a known appointment. | P1 | M/M |
| **SPC-4** | **Language/Practice agent.** Recommends and tracks daily phrase/skill practice (Language Lab, Hero Journeys) and records outcomes to the timeline. | P2 | M/M |

### A5 — Multimodal & generative surface (how the parent experiences the team)

> Builds directly on **v5**: capture is how signals enter; cards are how agents speak.

| ID | Item | Pri | V/E |
|---|---|---|---|
| **UX-1** | **Multimodal prompt parts** (v5 VIS-1) — enabling change for ambient capture + vision. | **P0** | H/S |
| **UX-2** | **Capture-the-moment entry** (v5 MM-1/2) feeding the Logger agent. | **P0** | H/M |
| **UX-3** | **Generative answer cards** (v5 GUI-1/3): render the council's structured output as an actionable, attributed card stack; delete regex `parseRisk`. | **P0** | H/M |
| **UX-4** | **"Say this aloud"** script card + **realtime voice coach** (v5 GUI-2, RT-1) for hands-free moments. | P1 | M/M–H/L |
| **UX-5** | **Document intelligence** (v5 DOC-1): snap a school report → timeline signals → memory/handoff. | P1 | H/M |

### A6 — Trust, privacy & belonging (retention + the 40% privacy-hesitant)

> Market: belonging drives retention; ~40% won't share child data without trust.

| ID | Item | Pri | V/E |
|---|---|---|---|
| **TRB-1** | **Real crisis resources + Dutch detection** (v4 SAFE-1/2) — ship first, non-negotiable. | **P0** | H/S |
| **TRB-2** | **Agent-data transparency**: per-agent "what it can see," enforced memory/sharing expiry (v4 SAFE-3/4), one-screen data control. Privacy as a *feature*. | P1 | H/M |
| **TRB-3** | **Co-parent shared timeline**: invite a second caregiver with scoped roles; the team serves both (belonging + the household graph Maple proves parents want). | P1 | H/L |
| **TRB-4** | **Curated professional shepherd network** (not a gig directory): the human hand-off the agents prepare for. | P2 | H/L |

---

## 6. Recommended sequence — build the nervous system, then the team

**Phase 0 — non-negotiable safety (hours):** TRB-1 (v4 SAFE-1/2).

**Phase 1 — the bus + the senses (P0):**
ECO-1/2/3 (timeline) · UX-1 (multimodal parts) · UX-2 (capture) · LOG-1/2 (Logger
drafts logs) · UX-3 (generative cards). → *Arbor logs for the parent and speaks in
cards. The retention moat and the premium feel land together.*

**Phase 2 — the brain (P0→P1):**
SAGE-1/2/5 (scholar council, grounded) · ORC-1/2 (safety-first orchestration) ·
SPC-1 (planner closes the loop). → *Arbor reasons as a grounded, multi-expert team
and turns answers into tracked action.*

**Phase 3 — proactive + personalized (P1):**
ORC-3 (next-best-step) · SAGE-4 (per-child council from intake) · ORC-4 (weekly
retro) · LOG-3 (pattern watch) · SPC-2/3 (memory steward, handoff). → *Arbor acts
unprompted, personalized to the child — the research-optimal pattern Era lacks.*

**Phase 4 — depth & network (P1→P2):**
UX-4/5 (voice, documents) · SAGE-3/ORC-5 (attribution, transparency) · TRB-2/3/4
(privacy, co-parent, professionals) · SPC-4.

### The five moves that take Arbor to the next level
1. **ECO-1 (signal timeline)** — the bus that makes everything feed everything. Without it, agents can't compose.
2. **LOG-1 (ambient logging)** — log *for* the parent. The single biggest, market-validated retention lever; no developmental competitor has it.
3. **SAGE-1/2 (scholar council)** — a configurable, named, multi-expert team. The category Arbor can own against Era's single voice.
4. **ORC-3 (proactive next step)** — proactive + personalized = the research-optimal, alive-feeling product.
5. **UX-3 (generative cards)** — the team speaks in an actionable interface, not a markdown wall.

---

## 7. Why this guarantees success (strategic logic)

- **Retention** (the only metric that matters in a crowded, low-barrier market):
  ambient logging removes the form that kills every tracker; proactive next-steps
  give a daily reason to open the app; co-parent + belonging compound it.
- **Differentiation that's defensible:** a *configurable team of named developmental
  experts that watches the timeline and acts* is something neither the trackers
  (no theory), Maple (logistics only), nor Era (manual, single-voice, reflective)
  can quickly copy — and Arbor already has the developmental spine to build it.
- **Built on assets already paid for:** multimodal models, a 4-route router, an
  event-sourced ledger, scholar cards, a safety contract. v6 wires what exists into
  a team; it is mostly **integration, not net-new infrastructure**.
- **Privacy as a wedge:** with ~40% of parents data-hesitant, agent-level
  transparency + enforced expiry turns the market's top objection into Arbor's
  trust story.

---

## 8. Guardrails (unchanged, extended to agents)

Non-diagnostic on every agent and modality; safety agent runs first and on every
signal; no child-facing autonomous AI (realtime voice is parent-facing); proactivity
is opt-in and explainable; parent approves every log, memory, and share; child
media is sensitive — on-device downscale, parent-approved upload, enforced expiry.

---

## 9. One-paragraph brief

The market is moving from manual-logging trackers and reactive chatbots to ambient,
proactive, personalized agents — and the data is blunt: removing the logging burden
is the top retention lever, and "proactive + personalized" is the winning pattern.
Era already owns theory-grounded reflection with a single voice; the trackers own
manual infant logs; Maple proved parents will let an agent act for them. Arbor has
the best developmental spine of any of them and ships it as forms-and-chat. v6 turns
that spine into a team: one signal timeline as the bus, a Logger agent that captures
and drafts logs *for* the parent, a configurable council of named scholar agents
that deliberate and synthesize, and an Orchestrator that runs safety-first and
brings the one next step unprompted — each agent feeding the next, the parent
approving rather than typing. Build the timeline, then the Logger, then the council,
then proactivity. That is a defensible, retention-first, premium product built
almost entirely from capability Arbor already owns.

**Sources:**
[Parenting Apps Market — Business Research Insights](https://www.businessresearchinsights.com/market-reports/parenting-apps-market-113806) ·
[Coherent Market Insights](https://www.coherentmarketinsights.com/industry-reports/global-parenting-apps-market) ·
[Era / Parent Lab (openPR)](https://www.openpr.com/news/3383388/parent-lab-revolutionizes-parenting-with-era-an-ai-enhanced) ·
[Maple](https://www.trymaple.ai/) ·
[Ambient-AI & burnout (medRxiv)](https://www.medrxiv.org/content/10.1101/2024.07.18.24310656.full.pdf) ·
[Proactive + personalized assistants (ProPerSim, arXiv)](https://arxiv.org/pdf/2509.21730)

---

## 10. Implementation status (2026-06-06)

**Shipped to production** (Cloud Run `arbor-api` **rev 00010** + Firebase Hosting
`arborprd-westeu`, commits `8292d9c`/`fea697f`; site 200, `/api/*` 401 without a
token, auth gate enforced):

| ID | Item | Notes |
|---|---|---|
| **ECO-1/2** | Signal timeline ("Story") | One read-model folding logs + milestones + plans + memory + coach into a typed stream. **Live.** |
| **VZ-1** | Visual growth timeline | Soft-Daylight day-grouped rail + momentum strip. **Live.** |
| **ORC-3** | Proactive next-best-step | Client-derived nudge on Story/Home that routes into the coach. **Live.** |
| **UX-3 / GUI-1·2·3** | Generative answer cards | Ask Arbor renders the structured contract as an attributed, actionable card stack (hypotheses, "Try today" checklist, "Say this" + TTS, Avoid/Watch/Escalate). **Live.** |
| **SF-2** | Six-Frame chips | Frame routing rendered as labelled chips on each answer. **Live.** |
| **SCH-6** | Scholar attribution | Answers show the active lens + domains. **Live.** |
| **ECO-3** | Structured hand-offs | Card actions carry real data into Plans / Behaviors / Handoff (no prose-dumping). **Live.** |
| **LOG-1** | Ambient AI logging | `POST /api/extract-log` drafts a structured behavior log from a free-text/voice description; one-tap confirm. Safety-screened, graceful fallback. **Live.** |
| **TS-1** | Computed risk | TrustSafetyBar reads `contract.riskLevel` directly. **Live.** |

**Remaining (major future programs, infra-heavy):**

| ID | Item | Why it's a dedicated program |
|---|---|---|
| UX-1 / VIS-2 | Multimodal vision (camera → model sees it) | Vertex image-part wiring + image safety gate + live-model verification. |
| RT-1 | Realtime voice coach | Gemini Live streaming session + audio UX. |
| UX-5 / DOC-1 | Document intelligence (school report → data) | OCR pipeline + structured extraction + review. |
| SAGE-2 | Full multi-agent scholar council | Server orchestration of N scholar calls + synthesis (today: single grounded call + attribution). |
| ORC-1/2/4/5 | Formal orchestrator + weekly retro + transparency | Server agent graph over the timeline. |
| TRB-3 / CAP-13 | Co-parent shared timeline | Multi-caregiver accounts, roles, permissions (auth infra). |
| SAFE-4 | Sharing-grant expiry enforced | Server share store (pairs with v3 CAP-9). |

The core v6 thesis — *capture in the moment, the AI drafts the log, the answer is
a living attributed workspace, and every feature feeds the next via one timeline*
— is now live. The remaining items are the multimodal + realtime + multi-account
programs, each a deliberate iteration with its own infra.

---

## 11. Multimodal shipped (2026-06-06, rev 00011)

**Arbor can now see, read, and talk** — deployed to production (Cloud Run
`arbor-api` rev 00011 + Hosting, commit `8539c93`):

| ID | Item | Notes |
|---|---|---|
| **VIS-1** | Multimodal prompt parts | Model router accepts inline image parts on @google/genai + Vertex Gemini. **Verified live** against `gemini-2.5-flash` (the model saw a generated image and named its colour — `scripts/vision-smoke.mts`). |
| **VIS-2** | Camera coaching | "Show Arbor a photo" → the model sees the moment/room/drawing → non-diagnostic observations, possible meanings, try-today, avoid. `POST /api/vision` (observe). |
| **DOC-1** | Document intelligence | "Scan a document" → OCR a school report/form → documentType, summary, key points, suggested memory, questions for the professional, handoff note. `POST /api/vision` (document). |
| **Image safety gate** | — | Image-only MIME, 6 MB cap, accompanying text safety-screened, and a model `offTopic` refusal for anything outside child care. |
| **RT-1/2** | Realtime voice coach | Hands-free loop in the coach: listen (SpeechRecognition) → ask → speak the parent script + today step (SpeechSynthesis) → listen again, with Listening/Thinking/Speaking status and one-tap stop. |

Capture is on-device-downscaled (`lib/image.ts`) before upload, and every vision
result feeds the loop (discuss in Arbor / log the moment / use in a handoff). The
Coach is now the multimodal hub: **Photo · Document · Talk**.

---

## 12. Agentic + multimodal program shipped (2026-06-07)

Deployed to production across Cloud Run rev 00011–00013 + Hosting (auth-gated):

| Goal item | Status | Evidence |
|---|---|---|
| **Multimodal vision** (camera → model sees photo) | ✅ Live | `POST /api/vision` (observe); image parts verified against live `gemini-2.5-flash` (`vision-smoke.mts`); image safety gate (MIME, 6MB, offTopic, text screen). |
| **Document intelligence** (report → OCR → data) | ✅ Live | `/api/vision` (document) → documentType/summary/keyPoints/suggestedMemory/questions/handoff; **fixed** the 250kb body limit that blocked document photos (now 12mb for `/api/vision`). |
| **Full multi-agent scholar council** | ✅ Live | `POST /api/council` selects N scholar agents → parallel lensed calls → synthesis; **verified live** that Bowlby/Vygotsky/Winnicott each return distinct lens-true takes (`council-smoke.mts`). UI shows "the council weighed in · N voices". |
| **Co-parent sharing + server-enforced expiry** | ✅ Live | `shares` store (Firestore/local); `POST/GET/DELETE /api/shares` + `GET /api/shared-with-me`; expiry enforced on every read (8 unit tests); TrustedSharing UI: invite co-parent/viewer/professional by email, scopes + duration, instant revoke, inbound view. |
| **Realtime voice coach** | ✅ Live (working) | Hands-free browser loop (STT → streaming `/chat` → TTS) shipped and functional. |
| **— Gemini Live streaming (HD voice)** | ⚙️ Implemented + deployed, gated | `POST /api/live/token` (ephemeral token) + `lib/geminiLiveClient.ts` (browser PCM in/out, dynamically imported, 310KB chunk loaded only when available); CoachTab prefers Live, falls back to the working loop. **Blocked by API access**: the available key returns close code **1008 — "not supported for bidiGenerateContent"**; enabling Gemini Live on the project/key activates HD voice with no further code change. |

Net: vision, documents, the multi-agent council, and co-parent/expiry sharing are
fully live and verified. Realtime voice works today; the specific Gemini Live HD
path is implemented, deployed, and gated — it lights up the moment Live API access
is provisioned on the project.

---

## 13. Realtime voice coach — now FUNCTIONING (2026-06-07, rev 00014)

The literal Gemini **Live bidi** API is blocked at the account level on every
reachable path (verified: WebSocket close **1008** across the Developer API,
Vertex ADC in us-central1/us-east5/europe-west4, and a freshly-minted key on the
billed `arborprd-westeu` project — the Live models simply aren't on this account's
allowlist; not grantable from code).

So the realtime voice coach now **functions on the Gemini STREAMING API**, which
*is* entitled here — a genuine low-latency, hands-free, eyes-free voice loop:

| Piece | Detail |
|---|---|
| `modelProvider.streamText()` | Plain-text token stream (Gemini dev + Vertex Gemini). |
| `POST /api/voice` (SSE) | Streams a concise, spoken-friendly, lens-grounded, non-diagnostic reply token-by-token; safety-screened. |
| `streamVoice()` + CoachTab | Listen (STT) → stream the answer → **speak each sentence the moment it completes** (sentence-streamed TTS queue) → resume listening. Real-time, not wait-then-speak. |

**Verified live** against Vertex `gemini-2.5-flash`: streamed a coherent spoken
reply (`scripts/voice-smoke.mts`). The Gemini Live **HD** path (`/api/live/token`
+ `geminiLiveClient.ts`) stays implemented and gated — it lights up the instant
Live API access is granted on the account, no code change.

**Net:** all five goal items are implemented and live. Vision, documents, the
multi-agent council, and co-parent/expiry sharing are fully verified. The realtime
voice coach functions today via Gemini streaming; the literal Live-bidi upgrade is
built and one Google account-grant away.

---

## 14. AR-CAP market-derived enhancement delta (2026-07-22)

**Research source:** `PAI/projects/arbor/CAPABILITY-MAP.md` (feature-level official-source refresh).
**Rule:** these items extend the shipped system; they do not revive superseded v2–v5 backlogs. AI-platform work stays in the canonical AR-AI ledger. Existing shipped seams must be reused where named.

Prioritization uses **RICE-like relative scoring**: Reach (R), user Impact (I), evidence Confidence (C), Effort (E), each 1–5 except C as 0.5/0.8/1.0. Score = `R × I × C ÷ E`. Scores are sequencing aids, not promises.

| ID | P | Outcome / build item | Market reference | Acceptance criteria | R/I/C/E | Score | Gate |
|---|:--:|---|---|---|---:|---:|---|
| **AR-CAP-01** | P0 | **Universal capture composer → confirmed signal** across Today, Journal, Behaviors, Coach, milestone, and document entry | Huckleberry AI logging | One text/voice/photo/document entry; typed draft with source, confidence, edit/discard/confirm; no draft enters memory before confirm; median internal task ≤20s; all existing capture paths converge on one contract | 5/5/1/2 | **12.5** | child-data guard |
| **AR-CAP-02** | P0 | **Close recommendation → action → outcome → adaptation** | Kinedu completion loop; Bend measurement loop | Every accepted “try today” can create a bounded action; lightweight done/skipped/helped/didn’t-help outcome; duplicate-safe; next recommendation can cite the outcome; parent can remove it | 5/5/1/2 | **12.5** | clinical copy |
| **AR-CAP-03** | P0 | **Progress narrative dashboard: what changed / evidence / next** | Huckleberry reports; Lingokids Progress Center | One child-level view combines confirmed observations, activities, outcomes, milestones, strengths, and next action; no peer percentile; every inference links to source signals; HE/EN and mobile pass | 5/4/1/2 | **10.0** | clinical firewall |
| **AR-CAP-04** | P0 | **Separate caregiver identities and family alignment view** over the shipped sharing seam | Good Inside Family Plans | Invite creates distinct adult identity, not shared credentials; shared child profile and plan; private adult AI history by default; role/scopes/revoke; content/action handoff; audit events; migration test for existing shares | 4/5/1/3 | **6.7** | GDPR/DPIA |
| **AR-CAP-05** | P0 | **Professional reverse-channel v0** | Little Otter; Bend; Kinedu Educators | Parent-approved professional can assign one focus/action; family accepts/declines; outcome returns; professional comments/closes; scope/expiry/revoke enforced; facts vs inference preserved; no autonomous send | 3/5/1/3 | **5.0** | clinical + Guy Tier-C |
| **AR-CAP-06** | P1 | **Top-100 guided activity layer** | Kinedu; Lovevery | Each priority activity has ≤90s video/animation, setup, adaptations, safety, “what to notice,” and outcome prompt; selected by child state, materials, time, and prior response; helpfulness/completion instrumented | 4/4/1/3 | **5.3** | content review |
| **AR-CAP-07** | P1 | **Governed content graph and publishing contract** | Good Inside coherent method; Lovevery course system | Schema includes age/band, moment, concern, domain, action, evidence, reviewer, locale, safety class, version, review date; search/recommendation use it; stale or unreviewed clinical content fails promotion | 5/4/1/3 | **6.7** | clinical content review |
| **AR-CAP-08** | P1 | **Illustrated milestone evidence and uncertainty flow** | CDC Milestone Tracker | Every milestone supports observable example media; Yes / Not sure / Not yet; corrected-age handling where appropriate; “not sure” guidance; packet preserves response and provenance; explicit screening disclaimer | 3/4/1/2 | **6.0** | licensed/source media |
| **AR-CAP-09** | P1 | **Concern packs v1: routines/sleep, emotion regulation, language, transitions/attention** | Huckleberry; Good Inside; Otsimo | Each pack has reviewed pathway, daily actions, content, progress/outcome definition, escalation boundary, locale coverage; opt-in; never labels a condition | 4/4/0.8/3 | **4.3** | clinical board |
| **AR-CAP-10** | P1 | **Warm referral and local resource registry** | Brightline/Bend right-care routing; CDC Act Early | Versioned provider/resource records by market, age, concern, language, access and urgency; parent initiates; acknowledgement/follow-up state; expired records hidden; crisis path bypasses marketplace UX | 3/5/1/4 | **3.8** | market owner + clinical |
| **AR-CAP-11** | P1 | **Published bounded curriculum maps** for literacy, language, and practice | Duolingo ABC; Khan Kids | Explicit sequence, prerequisites, target skill, activity mapping, mastery evidence, adaptation and exit; parent sees purpose/progress; no streak penalties; content coverage tests | 3/4/1/3 | **4.0** | education review |
| **AR-CAP-12** | P1 | **Product outcomes and efficacy program** | Duolingo ABC; Bend | Define primary/guardrail outcomes; consented cohort design; baseline and follow-up; analysis plan registered before results; attrition/adverse-event reporting; claims require evidence gate | 3/5/1/4 | **3.8** | ethics/privacy/clinical |
| **AR-CAP-13** | P2 | **Parent-capacity check and action sizing** | Soula; Good Inside | Optional ≤10s check; affects action size/timing only; no diagnosis or emotion inference; can disable/delete; measures acceptance and completion vs control | 4/3/0.8/2 | **4.8** | parent-wellbeing copy |
| **AR-CAP-14** | P2 | **Child-relevant school/admin intake** | SchoolParent and family-assistant archetype | Forward/upload document or message → proposed event, question, task, and child signal; each independently confirmable; source retained; no general-purpose family inbox in v1 | 3/3/0.8/3 | **2.4** | connector/privacy |
| **AR-CAP-15** | P2 | **Printable/keepsake experiments, not physical inventory** | Lovevery physical ecosystem | Test printable play cards and annual hero/milestone keepsake with preorder/POD; no stock; parent approves content; child media/data retention documented; explicit kill threshold | 2/3/0.8/3 | **1.6** | Guy Tier-C money/vendor |

### AI dependencies (link, do not duplicate)

- **AR-CAP-01/02/03** depend on AR-AI-06–09 (answer/action contract, review, confirmed memory, evidence inspector).
- **AR-CAP-05** composes with AR-AI-11 (continuity-of-care pack) but owns the human reverse channel.
- **AR-CAP-13** extends routing context; it must not create a parent diagnosis or inferred emotional profile.
- Provider/model routing, receipts, evals, voice, and child-AI controls remain AR-AI-01–13.

### Recommended delivery sequence

1. **Loop foundation:** AR-CAP-01 → AR-CAP-02 → AR-CAP-03.
2. **Trust and family:** AR-CAP-04 plus AR-AI-09; then AR-CAP-05 plus AR-AI-11.
3. **Content depth:** AR-CAP-07 → AR-CAP-06/08 → AR-CAP-09/11.
4. **Proof and access:** instrument AR-CAP-12 from wave 1; build AR-CAP-10 after the first-market registry owner exists.
5. **Experiments:** AR-CAP-13/14/15 only after loop metrics show repeated use.

### Explicit non-goals

- Do not chase Khan/Lingokids library scale.
- Do not build a diagnostic or therapy product to match Little Otter/Bend.
- Do not copy streaks, hearts, penalties, open-ended child companionship, or engagement-maximizing AI.
- Do not build inventory-heavy Lovevery-style kits before demand is proven.
- Do not open an unvetted professional marketplace.

---

## 15. The next 10 feature enhancements - locked shortlist (2026-07-22)

> **Execution note — 2026-07-22:** Wave 1 of AR-CAP-02/13 is implemented in the Today journey: one daily child-scoped action, explicit 2/5/10-minute sizing, parent-reported Helped/A little/Not today outcome, removal, export/erase registration, and outcome-aware next-focus input. Browser QA passed the full action loop, reload persistence, 390px containment, and Hebrew RTL. Wave 2 now adds the AR-CAP-03 progress narrative, the typed-capture review/confirm seam for AR-CAP-01, the AR-CAP-07 publishing contract, and all 25 bilingual AR-CONT-01 hard-moment card drafts. The content pack is intentionally blocked from publication until a named clinical reviewer stamps approval and review dates; no fabricated review provenance is permitted. Canonical journey spec: `docs/ARBOR-CONTINUITY-JOURNEY-2026-07-22.md`.

This is the decision list derived from the feature-level benchmark. It deliberately excludes shipped capability, low-confidence bets, physical inventory, broad family administration, and feature-volume work. The underlying AR-CAP rows above remain the acceptance source.

| Rank | ID | Feature enhancement | Why it survives the cut | Start condition |
|---:|---|---|---|---|
| 1 | **AR-CAP-01** | Universal capture composer | Highest-frequency friction; unifies already-built capture seams rather than adding a new module | current capture inventory verified |
| 2 | **AR-CAP-02** | Action-to-outcome adaptation loop | Converts longitudinal memory from stored context into compounding product value | confirmed-signal contract stable |
| 3 | **AR-CAP-03** | Progress narrative dashboard | Makes the loop understandable: what changed, evidence, next | outcome events available |
| 4 | **AR-CAP-04** | Separate caregiver identities + alignment | Good Inside-level family collaboration without leaking private adult history | sharing/auth migration design approved |
| 5 | **AR-CAP-05** | Professional reverse channel v0 | Completes continuity; bounded assignment/response, not a full clinical platform | role/scopes and clinical workflow approved |
| 6 | **AR-CAP-08** | Illustrated milestone evidence + uncertainty | Closes a trust/usability gap against the CDC without peer scoring | media licensing/source plan approved |
| 7 | **AR-CAP-10** | Warm referral + local resource registry | Makes escalation actionable in the first pilot market | named registry owner + freshness SLA |
| 8 | **AR-CAP-11** | Bounded curriculum maps | Turns existing literacy/language/practice into visible progression | education reviewer and target bands selected |
| 9 | **AR-CAP-12** | Outcomes/effectiveness instrumentation | Required for retention learning and institutional credibility | measures, consent and analysis plan approved |
| 10 | **AR-CAP-13** | Parent-capacity action sizing | Small, differentiated adherence lever; adapts effort without diagnosing | copy/privacy review; A/B design |

**Not in the next 10:** AR-CAP-06/07/09 are delivered through the content backlog below; AR-CAP-14 family-admin intake is outside the child-continuity wedge; AR-CAP-15 keepsakes remain a demand test only. No replacement item is added merely to fill space.

## 16. The next 10 content enhancements for capabilities already live

These are content products, not new software modules. Each must use the governed content schema in AR-CAP-07, work in English and Hebrew unless explicitly piloted in one locale, include a review owner/date, and reuse current surfaces. “Publish” means pass clinical/safety/localization gates and instrument helpfulness plus follow-through.

| Rank | ID | Content enhancement | Existing capability enhanced | Definition of done | Gate |
|---:|---|---|---|---|---|
| 1 | **AR-CONT-01** | **Top 25 hard-moment action cards**: tantrum, refusal, hitting, sibling conflict, separation, bedtime, transitions | Ask Arbor + Today + Behaviors | Each moment has do-now, say-this, avoid, observe, escalation boundary, age adaptation, EN/HE; selected from real top intents | clinical copy |
| 2 | **AR-CONT-02** | **Top 50 guided play activities** | Playbank + Growth Plans | 50 highest-use activities receive setup, household materials, 60-90s demonstration, easier/harder variation, what-to-notice, outcome prompt | child-safety + media rights |
| 3 | **AR-CONT-03** | **Emotion regulation pathway** | Feelings Lab + Growth Plans + Today | Four-week parent-child pathway by age band; co-regulation scripts, play, reflection, outcome checks; explicitly non-diagnostic | clinical review |
| 4 | **AR-CONT-04** | **Transitions and attention pathway** | Practice + Behaviors + Today | Morning, school, stopping play, homework and bedtime routines; visual scripts, rehearsal games, parent capacity variants | clinical review |
| 5 | **AR-CONT-05** | **Language growth pathway** | Language Lab + speech scorer + Growth Plans | Listening, turn-taking, vocabulary, narrative and articulation-support activities by band; clear boundary to SLP referral | SLP review; child-voice gate for scoring |
| 6 | **AR-CONT-06** | **Sleep and routine micro-pack** | Day Windows + Journal + Today | Bedtime routine builder, wake/nap context, wind-down scripts, two-week experiment and outcome review; no sleep-clinic claims | pediatric/sleep review |
| 7 | **AR-CONT-07** | **Illustrated milestone example set** | Milestones + Development Map | Priority milestone examples use licensed illustration/video, Yes/Not sure/Not yet guidance, prematurity note where relevant, and doctor-question prompt | CDC/AAP alignment + rights |
| 8 | **AR-CONT-08** | **Co-parent alignment mini-course** | Family Formation + sharing + plans | Five 5-minute lessons: shared aim, scripts, roles, disagreement repair, weekly alignment; each creates an optional shared agreement/action | family/clinical review |
| 9 | **AR-CONT-09** | **Professional-visit preparation packs** | Care + handoff + appointments | Pediatrician, teacher, SLP and behavioral-health versions: what changed, evidence to bring, questions, consent/redaction checklist, follow-up outcome | professional reviewer per audience |
| 10 | **AR-CONT-10** | **Hero story spine expansion: 12 reusable therapeutic-adjacent themes** | Hero Journeys + Comics + Journal | 12 non-clinical spines (courage, repair, waiting, belonging, trying again, asking for help, etc.) with age/locale variants and memory-safe personalization slots | content safety + localization |

### Content sequencing

1. Ship AR-CONT-01 first because it upgrades the highest-frequency parent job with no new platform dependency.
2. Build AR-CONT-02 and AR-CONT-07 as the visual guidance wave; reuse one production pipeline and rights ledger.
3. Build AR-CONT-03/04/05/06 as governed pathways, one at a time, based on observed demand - not all four in parallel.
4. Add AR-CONT-08/09 when caregiver identity and professional reverse-channel work begins.
5. AR-CONT-10 is the differentiated retention layer and follows stable character consistency/voice, not before.

### Content non-goals

- No generic article-volume program.
- No diagnostic condition courses or treatment claims.
- No attempt to match Khan, Lingokids or Kinedu by catalog size.
- No AI-generated content may publish without schema validation, review ownership and safety/localization gates.
