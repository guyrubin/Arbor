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
