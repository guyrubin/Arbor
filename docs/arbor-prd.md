# Arbor — Parenting AI Platform PRD

**Version:** 1.3 (2026-06-29 — Evidence-base enrichment: added "Developmental Frameworks (Evidence Base)", a "Capability Depth" pass on under-specified modules, and a "Sibling product: Arbor Third Age" cross-reference. Additive only — no prior content removed. See changelog below.)
**Product type:** AI-powered child-development, parenting, co-therapy, and school-support platform
**Age range:** Birth to 12
**Markets:** Israel, Netherlands, Belgium, later broader EU

### Changelog

- **1.3 (2026-06-29)** — Enrichment pass closing the thin-PRD gaps identified in the cross-product investigation. Added three new sections without deleting or rewriting existing content: (1) **Developmental Frameworks (Evidence Base)** — grounds each capability in child-development science (attachment, Piaget/Vygotsky, emotional co-regulation, executive-function development, milestone evidence, red-flag screening rigor) with a per-framework evidence base, age-band content, and decision logic; (2) **Capability Depth** — specifies the under-specified modules (medical guardrail evidence base, screening-instrument strategy, engagement/avatar surface, consent/capacity model, eval gate, age-band engine, life-stage abstraction layer); (3) **Sibling product: Arbor Third Age** — cross-reference to `PAI/projects/arbor-third-age/SPEC.md`. Version history below preserved verbatim.
- **1.2 (2026-06-03)** — Information Architecture v2: six-capability model (see "Information Architecture v2" below).

## Executive Summary

Arbor is not a parenting chatbot. Arbor is a longitudinal child-development intelligence operating system for parents, children, schools, therapists, clinics, and care organizations.

The platform combines AI parenting guidance, child memory, developmental milestone tracking, behavior analytics, personalized intervention plans, language-transition support, autism/ADHD observation support, medical safety guardrails, personalized story generation, professional co-therapy workflows, school collaboration, and B2B/B2G dashboards.

The moat is not the AI model. The moat is longitudinal child memory plus expert-reviewed developmental knowledge plus structured parent workflows plus professional collaboration.

---

## Information Architecture v2 (Six-Capability Model)

> Added 2026-06-03. This supersedes the flat, ten-module sidebar. It is a **strategic
> architecture refactor, not a redesign** — every prior capability is preserved and
> re-homed, nothing is deleted. The visual language (the live "Soft Daylight"
> system: warm, calm, premium; green = trust/growth, coral = AI/action; rounded
> cards, editorial Baloo headings) is preserved.

### The problem it solves

The previous sidebar exposed ten feature modules at equal weight (Overview, Parent
Coach, Behavior Tracker, Milestones, Action Plans, Bedtime Stories, Weekly Report,
Scholar Academy, School Handoff, Safety). Equal weighting made a serious platform
feel scattered and hid its maturity. v2 groups capabilities into **six strategic
sections** that tell one story.

### The strategic story (and the capability model shown on Home)

Arbor **understands** the child, **guides** the parent, **builds** growth,
**coordinates** care, and **forms** the family over time.

| Verb | Section | Promise |
|---|---|---|
| Understand | **Child Intelligence** | "Understand Dylan's patterns, milestones, and progress." |
| Guide | **Ask Arbor** | "Get calm guidance and exact scripts." |
| Grow | **Growth Plans** | "Build routines, responsibility, and resilience." |
| Connect | **Care Network** | "Find trusted professionals and coordinate support." |
| Learn | **Arbor Academy** | "Stories and lessons for long-term formation." |

Home is the daily command center — the sixth section — answering *"What matters for
Dylan today?"* and surfacing this capability model as the navigational backbone.

### Top-level navigation (exactly six items)

1. **Home** — daily command center; child card, today's insight, active plan, recent
   pattern, next milestone, weekly snapshot, the capability model, primary CTA *Ask
   Arbor*.
2. **Ask Arbor** — AI guidance layer. Structured response: *what may be happening →
   why → what to do today → exact parent script → what not to do → what to observe →
   when to escalate → save to child memory? → create handoff summary?* Fast-start
   scenarios (Morning Refusal, iPad Dispute, Sibling Clash). Trust & Safety embedded
   in every answer.
3. **Child Intelligence** — child-development memory & insight. Sub-nav: Development
   Profile · Development Milestones · Behavior Patterns · Language & Communication ·
   Strengths & Challenges · Weekly Insight · Child Memory. (Milestone % lives here,
   not in the sidebar.)
4. **Growth Plans** — turns guidance into progress. Active Growth Plans, Routines,
   Responsibility Ladder, Sleep / Screen-Time / School Adaptation / Behavior Reset
   plans, Progress Review, Follow-Up Logs. (Active-plan count lives here.)
5. **Care Network** — professional marketplace + handoff + coordination. Sub-nav:
   Find a Professional · My Care Team · School & Care Handoff · Reports ·
   Appointments · Trusted Sharing. Curated and Arbor-verified — never "marketplace"
   in parent UI.
6. **Arbor Academy** — parent education & child formation. Sub-nav: Story Journeys ·
   Parent Masterclasses · Scholar Frameworks · Family Formation.

**Safety & Guardrails is intentionally not a top-level item.** It becomes the *Trust
& Safety layer* embedded across Ask Arbor responses, reports, sharing, and handoffs
(risk level, no-diagnosis boundary, escalation guidance, what-to-observe).

### Current-to-new mapping (no capability lost)

| Old module | New home |
|---|---|
| Overview Dashboard | Home |
| Parent Coach | Ask Arbor |
| Behavior & Emotion Tracker | Child Intelligence › **Behavior Patterns** |
| Milestones Tracker | Child Intelligence › **Development Milestones** |
| Action Plans | Growth Plans › **Active Growth Plans** |
| AI Bedtime Stories / Hero Journeys | Arbor Academy › **Story Journeys** |
| Weekly Report | Home › Weekly Snapshot + Child Intelligence › **Weekly Insight** (PDF export keeps the word "Report") |
| Scholar Academy | Arbor Academy › **Scholar Frameworks** |
| Language Lab | Child Intelligence › Language & Communication (+ Care Network handoff note) |
| School Handoff Hub | Care Network › **School & Care Handoff** |
| Safety & Guardrails | Embedded Trust & Safety layer (removed from sidebar) |

### Naming system (parent-friendly surface, professional depth underneath)

Insight > Report · Patterns > Tracker · Growth > Action · Care Network > Connect ·
Ask Arbor > Parent Coach · Story Journeys > Hero Journeys / Bedtime Stories · Scholar
Frameworks > Scholar Academy · Trust & Safety Layer > Safety & Guardrails · "Find a
Professional" never "Marketplace" · no technical AI-engine names in normal parent
navigation.

### AI Engines panel — two modes

The right-side capability panel is repositioned as an internal/professional/demo
surface, not primary parent navigation.

- **Parent mode (default):** subtle trust indicators only — *developmental fit
  checked · safety guidance applied · child memory considered · next step generated.*
- **Professional / demo mode:** the full panel, renamed and expanded to eight
  engines: Parent Guidance Engine · Case Summary Engine · Pattern Intelligence Engine
  · Risk & Safety Classifier · Story Formation Engine · **Handoff Generator** ·
  **Memory Proposal Engine** · **Care Matching Engine**.

### Elevations beyond the source brief

1. **Cross-capability loop made explicit:** Child Intelligence *detects* → Ask Arbor
   *recommends* → Growth Plans *operationalizes* → Follow-Up Logs *feed back* into
   Child Intelligence. Every section links to the next logical action.
2. **Child Memory positioned as the moat surface:** parent-approved only, editable,
   deletable, source-linked, time-stamped, and time-boxed when sensitive — with a
   visible pending-review queue.
3. **Trust & Safety as a reusable UI primitive** (`TrustSafetyBar`) embedded on
   guidance, memory, sharing, and reports rather than a destination.
4. **Care Network framed as curated, verified, premium** (Verified-by-Arbor),
   deliberately not a gig-style directory.
5. **Section sub-navigation** keeps six clean primary items while exposing depth on
   demand — maturity without clutter.

### No-regression requirements

PDF export, AI log analysis, quick-fill scenarios, Scholar cards, the AI Engines
panel, School Handoff, and Safety logic are all preserved. The app must not flatten
into generic SaaS, become childish, or look clinical-cold.

### Acceptance criteria

1. Sidebar has exactly six primary items. ✓
2. No existing feature is lost; all legacy views remain reachable. ✓
3. Behavior logging lives under Child Intelligence › Behavior Patterns. ✓
4. Milestones live under Child Intelligence › Development Milestones. ✓
5. Weekly Report → Weekly Insight, still exportable as PDF. ✓
6. Action Plans → Growth Plans. ✓
7. Bedtime Stories / Hero Journeys → Story Journeys. ✓
8. Scholar Academy → Scholar Frameworks inside Arbor Academy. ✓
9. School Handoff → School & Care Handoff inside Care Network. ✓
10. Care Network includes Find a Professional, My Care Team, School & Care Handoff,
    Reports, Appointments, Trusted Sharing. ✓
11. Safety removed from sidebar but embedded throughout. ✓
12. AI Engines preserved for professional/demo mode and expanded with Handoff,
    Memory, and Care Matching engines. ✓
13. Visual language remains mature, warm, premium. ✓
14. The product feels more strategic, not thinner. ✓
15. The end-state story is obvious on Home. ✓

### Implementation status (2026-06-03)

Shipped in the app: six-section sidebar + mobile nav (`lib/navigation.ts`), section
sub-navigation in `Shell`, capability model on Home, renamed views, new capability
pages (`components/sections/*`: Development Profile, Child Memory, Strengths,
Find a Professional, My Care Team, Appointments, Trusted Sharing, Reports,
Masterclasses, Family Formation), AI Engines parent/professional modes, and the
embedded `TrustSafetyBar`. New pages with no backend yet (Care Network directory,
sharing, appointments, masterclasses, family formation) are scaffolded with real
structure and sample data; wiring them to live data is tracked in the Capability
Backlog.

---

## Vision

To become the most trusted AI companion for parenting and child development — giving every parent practical, personalized, evidence-informed support from birth to age 12.

Arbor should feel like Jordan Peterson Academy in seriousness, Netflix in production value, Duolingo in habit formation, NotebookLM in knowledge synthesis, TinyEYE in professional co-therapy infrastructure, and Apple Health in privacy and calm UX.

---

## Target Users

### Parents

Parents are the primary users. Segments include new parents, preschool parents, primary-school parents, expat families, multilingual families, parents of children with behavioral challenges, and parents exploring autism, ADHD, language delay, or sensory concerns.

### Children

Children are the subject of the system, not unsupervised account owners in the MVP. The child profile includes age, language exposure, milestones, emotional patterns, school context, health context, strengths, challenges, and professional involvement.

### Professionals

Professional users include child psychologists, speech therapists, occupational therapists, educational consultants, parenting coaches, pediatric professionals, special-needs coordinators, and school/kindergarten staff.

### Organizations

Institutional customers include schools, kindergartens, therapy clinics, municipal youth-care providers, insurers, employers offering family-support benefits, and government-subsidized care programs.

---

## Product Principles

1. **Safety first** — never diagnose, prescribe, or replace professionals.
2. **Personalized, not generic** — adapt to child age, stage, language, school, culture, and history.
3. **Practical over theoretical** — every answer should explain what is happening, what to do today, what to avoid, and when to escalate.
4. **Longitudinal memory is the moat** — the app improves because it remembers the child over time.
5. **Parent confidence, not parent guilt** — the tone should reduce panic and shame.

---

## Product Philosophy — The Six Frames

Every feature in Arbor must inherit from an articulated aim. Tracking is not the goal. Formation is the goal. The platform is organized into six frames; each frame is a coherent cluster of features filling a specific gap that purely-clinical or purely-tracking products leave open. No feature ships that does not map to a frame.

### Frame 1 — The Aim
What the child is being formed into. Without this frame the rest of the product is rudderless.

- **Family Charter** — three to five parent-authored values that define what kind of human this family is raising. Generated in onboarding, revisited annually. Every AI response is calibrated against it. *MVP.*
- **Developmental Arc** — Eriksonian view (trust, autonomy, initiative, industry, identity) replacing the milestone checklist. Each band carries the developmental task and what the parent's response shapes. *MVP.*
- **The Reckoning** — quarterly parent examen. What kind of parent have you been? What have you avoided? What do you owe? Hard mirror not soft mirror. *Phase 1 Q3.*

### Frame 2 — The Two Axes
Restore the paternal half. The clinical scaffolding is maternal: attunement, co-regulation, soothing. Necessary but insufficient. Children also need structure, expectation, productive resistance.

- **Responsibility Ladder** — age-banded ladder of what the child should be carrying, and which risks the parent should stop intervening on. *Phase 1 Q4.*
- **Productive Friction Scripts** — how to say no, hold the line, let a child fail at the right size, deliver an unwelcome truth. *MVP.*
- **The Hard Thing** — standing weekly prompt: what age-appropriate hard thing did your child do this week that they did not want to do. Absence is a flag. *Phase 1 Q2.*

### Frame 3 — The Story
Meaning, ritual, transmission. Children are shaped by narrative more than by behavior modification.

- **Family Story Canon** — curated, age-calibrated sequence of texts the family reads together. Not a content library; a deepening canon with discussion scaffolding. *Phase 2.*
- **Ritual Architecture** — daily, weekly, seasonal, and milestone rituals with templates and adaptation logic. *Phase 1 Q3.*
- **Generational Memory** — capture and transmit family narrative across generations; voice memos, photos, written fragments with age-gated release schedules. *Phase 2.*
- **Truth Practice** — helps parents notice and repair their own dishonesties with the child. Spine of long-run trust. *Phase 1 Q4.*

### Frame 4 — The Shadow
Let the dark in. Childhood includes fear, death, anger, envy, cruelty, loss. The product walks parents into these, not around them.

- **The Hard Conversations** — age-banded scripted library: death, divorce, illness, friend moves away, money trouble, parent job loss, sex, drugs. Each with weeks-long follow-up arc. *Phase 2.*
- **The Dark Emotions** — parent guidance for acknowledging and integrating anger, envy, hatred, jealousy in the child rather than suppressing them. *Phase 2.*

### Frame 5 — The Marriage
The foundation under the child. The single best predictor of child outcomes is the quality and stability of the parental partnership. Treating the parent as one entity is the wrong abstraction.

- **Partner Pair** — two distinct accounts with a shared child profile. *MVP architectural prerequisite; UI Phase 1 Q3.*
- **Parenting-Style Conflict** — structured workflow when partners disagree on bedtime, screens, discipline, school choice. *Phase 1 Q4.*
- **Repair After Rupture** — scripts for repairing in front of the child after parental disagreement. *Phase 1 Q4.*

### Frame 6 — The Shepherd
One integrator, not five specialists. Replaces the atomized care marketplace with a persistent mentor relationship.

- **Family Shepherd** — one senior clinician or developmental coach assigned to the family for years. Holds the whole picture. Specialists feed the Shepherd, not the parent directly. *Phase 2.*
- **Family Council** — for children aged eight and up, structured monthly meeting where the child is heard as a developing agent. *Phase 2.*

### Feature-to-frame discipline

Every roadmap proposal from this point forward must declare which Frame it belongs to and which feature within the frame it extends. Proposals that do not map to a frame are rejected or sent back for re-framing. This is the discipline that prevents Arbor from drifting back into a feature factory of disconnected capabilities.

---

## Core Product Modules

### 1. Parent AI Coach

The central AI assistant for parenting questions. Supports behavior, tantrums, sleep, food, anxiety, toilet training, school refusal, sibling conflict, screen time, routines, boundaries, language transition, and scripts.

Standard output:

1. What may be happening
2. Why it may be happening
3. What to do today
4. Parent script
5. What not to do
6. What to observe
7. When to escalate

### 2. Child Development Profile

A longitudinal profile covering emotional regulation, language, social interaction, motor development, cognition, executive function, independence, sensory processing, sleep, nutrition, school readiness, learning skills, and risk flags.

### 3. Developmental Milestone Tracker

Tracks age-based milestones, parent check-ins, delay indicators, progress scoring, watch/wait versus seek-advice guidance, milestone history, and professional export.

### 4. Behavior & Emotion Tracker

Logs tantrums, aggression, anxiety, school refusal, food refusal, toilet accidents, sensory overload, parent response, trigger, time, setting, intensity, duration, and recovery. Generates weekly insights and pattern detection.

### 5. Personalized Action Plans

Creates structured plans for tantrums, sleep, morning routine, toilet training, screen-time reset, kindergarten adaptation, language transition, anxiety, sibling conflict, food exposure, bedtime independence, social skills, and school readiness.

### 6. Medical Guidance Guardrail Layer

Provides basic symptom education, doctor escalation guidance, urgent-care thresholds, fever guidance, sleep/nutrition/hydration basics, medication disclaimers, and red-flag detection. The product must never provide unsafe diagnosis or treatment advice.

### 7. Autism, ADHD & Special Needs Support

Supports structured observation, not diagnosis. Includes autism signs by age, speech delay tracker, sensory profile questionnaire, executive-function checklist, social communication observations, meltdown vs tantrum guidance, visual routine generator, social story generator, and professional report export.

### 8. Language Learning & Multilingual Support

Supports children moving between languages and education systems. Includes Hebrew-English-Dutch transition support, daily vocabulary practice, school phrase cards, emotional language cards, AI conversation practice, parent scripts, and teacher handoff notes.

### 9. AI Story & AR Content Generator

Generates bedtime stories, school-transition stories, emotional-regulation stories, language-learning stories, moving-country stories, toilet-training stories, and confidence-building stories. Requires parent-controlled generation and image consent.

### 10. Professional Co-Therapy Platform

For therapists, clinics, schools, and municipalities. Includes professional dashboard, assigned child profiles, parent logs, AI case summaries, intervention templates, session prep, homework plans, progress tracking, secure messaging, reports, and multi-professional collaboration.

### 11. School & Kindergarten Collaboration

Includes teacher handoff notes, parent-school summaries, kindergarten adaptation plan, school behavior observations, language-support notes, school-readiness checklist, meeting preparation, and IEP-style support notes where relevant.

### 12. Parent Education Academy

Premium content library with masterclasses, short explainers, parent scripts, playbooks, interactive courses, worksheets, audio guidance, expert interviews, and country-specific guides.

---

## Scholar-Inspired Capability Layer

Arbor should operate as a multi-theory child-development engine.

The framework is not a content library. Every capability must map to:

1. A child-development domain
2. An age-band expectation
3. A parent-visible intervention
4. A child-memory field
5. A safety or escalation rule
6. An evaluation scenario

| Scholar / School | Capability | Product Value |
|---|---|---|
| Vygotsky | Next Best Challenge Engine | Finds the child's learning edge and scaffolds practice |
| Bowlby | Attachment & Repair Coach | Builds secure connection and conflict recovery |
| Harvard Serve & Return | Interaction Trainer | Coaches back-and-forth caregiver interaction |
| Bronfenbrenner | Child Ecosystem Map | Maps family, school, language, culture, routines, and stressors |
| Piaget | Stage-Aware Activity Generator | Adapts expectations to the child's cognitive stage |
| Montessori | Independence Planner | Builds practical life skills and prepared environments |
| Reggio Emilia | Curiosity Project Generator | Turns child interests into project-based learning |
| Erikson | Psychosocial Stage Coach | Supports autonomy, initiative, confidence, and industry |
| Baumrind | Parenting Style Analyzer | Balances warmth and structure |
| Winnicott | Good Enough Parent Coach | Reduces guilt and supports repair |
| Bandura | Modeling Coach | Helps parents model the behavior they want to see |
| Skinner | Behavior Design Studio | Builds rewards, habit loops, and consequence plans |
| Gardner | Strengths Discovery Dashboard | Detects strengths and preferred learning modalities |
| Executive Function Science | Self-Regulation Builder | Builds planning, inhibition, working memory, and flexibility |
| Trauma-Informed Development | Family Stress & Resilience Monitor | Tracks stressors and recommends stabilizing routines |

### Developmental Domains

Arbor's MVP should route every concern through one or more of these domains: attachment and regulation, language and communication, cognition and executive function, social development, independence and adaptive skills, sensory and motor patterns, and child ecosystem/stressors.

### Age-Band Operating Logic

The same issue should produce different guidance for different ages. A toddler refusing a transition, a five-year-old refusing school entry, and a ten-year-old avoiding schoolwork require different explanations, scripts, responsibility levels, and escalation thresholds.

The detailed implementation model lives in `docs/developmental-ai-operating-model.md`.

---

## Developmental Frameworks (Evidence Base)

> **Added 2026-06-29 (v1.3).** This section converts the 15-scholar × one-line mapping
> table above from a name-drop into a *build- and eval-able clinical operating manual*.
> For each framework it specifies the evidence base (what is known and how strongly),
> the age-band content (what changes by age and why), the decision logic (how it routes
> an actual concern), the firewall rule (what is shown vs. hidden), and the escalation
> source. The discipline is deliberate: a longitudinal child-development OS that asserts
> theory without grounding it cannot be evaluated, defended to a clinician, or extended
> to an adjacent population. **No existing capability is removed — this deepens the
> Scholar-Inspired Capability Layer and the Six Frames, it does not replace them.**

### The firewall the whole product hangs on (formation framing)

Child-Arbor's load-bearing dignity rule is that **milestone *deficit* scores are never
shown to a parent as a verdict, percentile, or "your child is behind" number.** Bars are
milestone *counts* and *what-to-observe* prompts, never a normed deficit. A parent must
never be able to reduce a child to a falling number. This is the formation-side analogue
of the sibling product's decline firewall (see "Sibling product: Arbor Third Age"). Every
framework below is specified so its *signal* can inform guidance while its *score* stays
on the clinician/observation side.

### F1 — Attachment & co-regulation (Bowlby · Ainsworth · Harvard Serve & Return)

- **Evidence base.** Attachment theory (Bowlby/Ainsworth Strange Situation) is among the
  most replicated constructs in developmental psychology; security predicts later
  emotional regulation and relationship quality. Harvard Center on the Developing Child's
  "serve and return" operationalizes it into coachable contingent interaction. *Strong,
  multi-decade evidence; load-bearing.*
- **Age-band content.** 0–18mo: contingent responsiveness, soothing, predictable
  caregiving (builds the secure base). 18mo–3y: secure base for autonomy/exploration;
  rupture-and-repair around boundary testing. 3–7y: co-regulation → emerging
  self-regulation, naming feelings. 7–12y: relationship as the channel for harder truths
  and felt-safety under stress.
- **Decision logic.** A regulation concern routes to: validate the emotion → restore
  felt-safety BEFORE correction → repair after rupture (Bowlby Repair Coach) →
  observe contingency quality, not "compliance." Never "ignore the tantrum to extinguish
  it" as a first move; co-regulate first.
- **Firewall / escalation.** Never label a child "insecurely attached" to a parent.
  Persistent dysregulation + a stressor cluster (loss, fear, withdrawal) → "worth a
  professional conversation," routed via the safety classifier, never a diagnosis.

### F2 — Cognitive stage & the learning edge (Piaget · Vygotsky)

- **Evidence base.** Piaget's stage sequence (sensorimotor → preoperational → concrete
  operational) is directionally robust even where exact ages are now seen as softer than
  Piaget claimed; Vygotsky's Zone of Proximal Development + scaffolding is one of the
  best-supported instructional principles in education research. *Strong as direction;
  use stages as soft bands, not hard gates.*
- **Age-band content.** Sensorimotor (0–2): object permanence, cause-effect. Preoperational
  (2–7): symbolic play, egocentrism, magical thinking — explains why a 4-year-old "lies"
  without intent to deceive. Concrete operational (7–11): logic about concrete things,
  conservation, rule-fairness. The Next-Best-Challenge engine targets the ZPD: just beyond
  current independent capacity, scaffolded then faded.
- **Decision logic.** A "won't / can't" concern routes to: is the expectation
  stage-appropriate? → set the task at the learning edge → scaffold → fade support.
  Reframes "defiance" that is actually a developmentally-impossible demand.
- **Firewall / escalation.** No IQ-style scoring shown to parents. A sustained gap below
  the soft band across domains → observation prompt + professional-conversation route.

### F3 — Psychosocial formation (Erikson · the Developmental Arc)

- **Evidence base.** Erikson's psychosocial stages are a *framing* model (high construct
  validity, lower measurement rigor) — used here exactly as the PRD already uses them: as
  the formation telos behind the milestone ladder, not as a score. *Canonical framing,
  not an instrument.*
- **Age-band content (the Developmental Arc, already in Frame 1).** Trust vs mistrust
  (0–1) · autonomy vs shame (1–3) · initiative vs guilt (3–6) · industry vs inferiority
  (6–12). Each band carries the developmental task and "what the parent's response
  shapes." This is the spine the milestone checklist serves, not replaces.
- **Decision logic.** Calibrate guidance to the band's task: protect autonomy at 2,
  protect initiative at 4, protect competence/industry at 8. The Family Charter (Frame 1)
  is the per-family overlay on this universal arc.
- **Firewall / escalation.** Formation framing is never a "life-coherence score." This is
  the formation-side hinge that the sibling product inverts to integrity-vs-despair.

### F4 — Emotional co-regulation → self-regulation (affective neuroscience · trauma-informed)

- **Evidence base.** The shift from external co-regulation to internal self-regulation is
  well-supported; trauma-informed development (felt-safety, window-of-tolerance, the
  stress-response) has strong clinical grounding for stabilizing routines under stress.
  *Strong for the mechanism; "dose" of any single technique is softer.*
- **Age-band content.** Toddler: borrowed regulation (the parent IS the regulator).
  Preschool: naming/labeling affect, simple strategies. School-age: independent strategies,
  perspective-taking, recovery time. Across all: a meltdown is a stress-response, not
  manipulation.
- **Decision logic.** Routes the Behavior & Emotion tracker: log trigger → intensity →
  recovery, and read "parent-response effectiveness" as *did co-regulation shorten
  recovery*, not "did the child comply." The Family Stress & Resilience monitor watches
  the stressor load, not just the child's behavior.
- **Firewall / escalation.** Acute self-harm language, regression after a trauma trigger,
  or a sharp stressor spike → safety-classifier red-flag path, never a soothing platitude.

### F5 — Executive-function development (Self-Regulation Builder)

- **Evidence base.** EF (working memory, inhibitory control, cognitive flexibility) has a
  well-mapped developmental trajectory (prefrontal maturation into the 20s) and is a strong
  predictor of school and life outcomes; targeted scaffolding has evidence, generic
  "brain-training" far-transfer claims do **not**. *Strong for the developmental model;
  use scaffolds, not commercial brain-training claims.*
- **Age-band content.** 3–5: emerging inhibition (waiting, turn-taking), 1–2 step
  instructions. 6–8: working memory for multi-step tasks, planning with support. 9–12:
  flexible problem-solving, self-monitoring, initiating without prompts. The Responsibility
  Ladder (Frame 2) is EF scaffolding operationalized: hand over what the child's EF can now
  carry.
- **Decision logic.** "Won't follow instructions / forgets / can't switch" routes to: is
  this an EF-load mismatch? → reduce steps, externalize memory (visual routines), build the
  skill one rung at a time. Reframes EF-immaturity as not-yet, not won't.
- **Firewall / escalation.** EF profile is observation, never an ADHD label. A persistent,
  cross-setting EF gap with functional impact → structured-observation export +
  professional route (see Capability Depth: screening-instrument strategy).

### F6 — Milestone evidence & red-flag screening rigor (the clinical hard edge)

- **Evidence base.** Milestone content is anchored to recognized public-health references
  (CDC "Learn the Signs. Act Early." 2022 revision; WHO motor milestones) and validated
  screeners (ASQ-3 general development; M-CHAT-R/F autism 16–30mo; Vanderbilt ADHD;
  CSHQ sleep). These are **published, validated, and (critically) licensed instruments** —
  their use is a clinical and licensing decision, not a UI default (see Capability Depth).
  *Guideline-grade where the instrument is used as validated; misuse (re-norming, partial
  administration, scoring outside license) is both a safety and a regulatory risk.*
- **Age-band content.** Milestones are read as *windows*, not pass/fail dates; "not yet"
  inside the window is monitoring, "not yet" past the window is a watch/seek-advice signal.
  Bands follow the CDC age checkpoints (2, 4, 6, 9, 12, 15, 18mo; 2, 3, 4, 5y) with the
  4-year checkpoint added in the 2022 revision.
- **Decision logic (the `escalateIf` boundary).** Each red flag carries: a documented
  clinical source, a watch-vs-seek-advice threshold, and a "worth a professional
  conversation" copy that never diagnoses. The boundary is asserted in the PRD today; the
  governance to make it defensible (source, reviewer sign-off, threshold validation) is
  specified in Capability Depth → "Safety-threshold governance."
- **Firewall / escalation.** **Months matter** for early-childhood neurodevelopment — the
  bias is toward an earlier professional conversation, never toward false reassurance — but
  the product **screens and routes; it never diagnoses.** Adult-grade cognitive screening
  (the sibling product) crosses the medical-device line more clearly; resolving the
  child-side instrument strategy now de-risks both.

### Strongest-evidence "build/eval first"

Attachment/serve-and-return, Piaget/Vygotsky ZPD scaffolding, executive-function
scaffolding (NOT brain-training), and CDC/WHO-anchored milestone windows are the
best-evidenced spine — build and eval these to a demonstrated bar first. Erikson and the
Six Frames are the *framing* layer (use as telos, never as a score). Any framework used as
a lens rather than an instrument must be labeled as such and never over-claimed to a parent.

---

## Capability Depth (under-specified modules, specified)

> **Added 2026-06-29 (v1.3).** The original Core Product Modules and AI architecture are
> correct but several modules are specified only to a one-paragraph "what it does" level —
> too thin to build, eval, or defend. This pass deepens the specific modules the
> investigation flagged as under-specified. **Each subsection extends an existing module;
> none replaces it.**

### CD-1 — Medical Guidance Guardrail Layer (clinical-evidence base + reviewer model)

Extends Core Module 6. The guardrail must move from "never give unsafe advice" (a
principle) to an enforceable, sourced layer:

- **Two firewalls, kept distinct** (ported pattern, child-tuned): (a) a **real-time
  red-flag router** — deterministic, pre-generation, fail-closed — for the acute path
  (child self-harm language, high fever in an infant, dehydration, suspected abuse
  disclosure, ingestion/poisoning, breathing difficulty) that bypasses the LLM and emits
  locale-correct emergency copy + escalation; and (b) a **hardened no-diagnosis/no-dosage
  output screen** applied server-side before any output reaches the user, regardless of
  phrasing — no dosing numbers, no drug-interaction verdicts, no diagnostic labels.
- **Grounding requirement.** Health-adjacent answers draw from a vetted source-card layer
  (the AI-Wiki), not free generation, and always carry "this isn't medical advice — check
  with your pediatrician" + one-tap professional handoff.
- **Reviewer model.** A clinical reviewer (pediatric advisor) signs off the red-flag item
  set and thresholds; high-risk outputs are human-reviewed during beta. This is the
  child-side instance of the Advisory-Board clinical-governance artifact below.

### CD-2 — Screening-instrument strategy (Autism/ADHD/Special-Needs + Milestones)

Extends Core Modules 3 and 7. The PRD names ASQ-3 / M-CHAT-R/F / Vanderbilt / CSHQ but
defers the hard questions. Resolve them explicitly:

- **License-aware use.** Each instrument is used only as licensed and as validated —
  correct age window, full administration, scoring inside the license. Where a license or
  full administration is not in place, Arbor does **structured observation** mapped to the
  instrument's *domains* and routes to a professional who can administer the validated
  tool — it does not present a re-normed or partial score as if it were the instrument.
- **Non-diagnostic boundary.** Output is always "these observations are worth a
  professional conversation," never "your child has autism/ADHD." Screening positivity
  routes to the Care Network handoff, not to a label.
- **Regulatory note.** Developmental screening sits near the EU MDR line; the classification
  decision (Class I vs IIa) and the validated-instrument strategy are a named legal/clinical
  gate, not an engineering default (see CD-5).

### CD-3 — Engagement / child-facing surface (the avatar & kid-mode surface, documented in-PRD)

The deepest-built engagement surface (MimicStudio, HeroArcade, WorldScene, FeelingsLab,
Cognitive Adventures, Child-ASR, and the viral gamified redesign) is currently documented
in the AI spec and a separate redesign plan but **not in this PRD**. Documented here so the
PRD is complete:

- **What it is.** A parent-mediated, avatar-led child surface (classic-comic worlds, hero
  journeys, feelings labs, themed cognitive adventures) plus a Child-ASR phoneme-scoring
  seam for pronunciation/language practice. Engagement is gamified (themes, hero arcs) but
  governed by the clinical firewall: no deficit scores, no dark-pattern streaks that shame
  (the "🔥 7 days in a row" streak title is a flagged dark-pattern to remove).
- **Register/aesthetic abstraction.** The engagement engine is specified as a *re-skinnable
  register*, not hard-wired to comic worlds and streaks — so the same engine can present a
  different aesthetic for a different population, and the **Child-ASR seam (`server/childAsr.ts`
  + `lib/speechScorer.ts`, pluggable Gemini/Whisper) is documented as a reusable
  pronunciation/speech-rehab seam**, not a child-only feature. This abstraction is what lets
  the engagement surface and the ASR seam port to the sibling product without a rewrite.
- **Consent.** All child-facing AI is parent-mediated; no unsupervised child chat in MVP
  (unchanged).

### CD-4 — Consent & capacity model (capacity-state machine + "subject-is-also-a-user")

Extends the Child Memory moat and the Compliance section. Today the whole memory/sharing
model assumes a single mode: **guardian-consents-for-a-non-agentic-child** (COPPA-shaped).
Generalize it without weakening the child default:

- **Capacity-state machine.** Model consent as a state machine, not a fixed binary. For the
  child product the default state is `guardian-over-minor` (parent is root of consent,
  parent-approved memory, pending-review queue — all unchanged). Add a **`subject-is-also-a-user`**
  mode and a **proxy/delegation path** as first-class states the architecture can represent.
- **Why now.** This future-proofs the **teen / young-adult transition** inside the child
  product (a 12→16 year old gains agency over their own record) and is the exact primitive
  the sibling senior product needs (a self-sovereign adult with a capacity-aware proxy/POA
  path). Building the abstraction once, here, avoids a later rewrite of the moat.
- **Invariant.** For minors, the parent remains the root of consent and nothing is shared
  about the child without it; the new states extend the model, they do not loosen the
  child-protection default.

### CD-5 — Safety-threshold governance (advisory-board clinical-governance artifact)

Extends the AI Enhancement Architecture and the red-flag layer. Every `escalateIf`
threshold, red-flag trigger, and "worth a professional conversation" boundary must carry:

- a **documented clinical source** (which guideline/instrument/evidence the threshold comes
  from);
- a **named reviewer + sign-off** (pediatric/clinical advisor approves the item set and the
  thresholds before ship);
- **threshold validation** (the red-flag set is tested against a labeled corpus and
  red-team scenarios; false-negatives on acute items are the binding failure mode).

This artifact is the answer to the open question "who signs off on the item set and
thresholds?" and is a **ship-blocker** for any change to the safety layer.

### CD-6 — Eval gate (from asserted-safe to demonstrated-safe)

Extends the AI quality acceptance criteria. Today safety/age-fit/non-diagnostic behavior is
*asserted*. Wire the existing `ai-eval-harness` to live routes and make it a ship gate:

- **Test corpus + pass-rate baselines** per safety-critical route (coach, red-flag router,
  milestone guidance, handoff generator), with documented pass-rate floors.
- **Red-team scenario suite** (jailbreak attempts to extract a diagnosis/dose; phrasing that
  tries to bypass the output screen; ambiguous acute clusters that must escalate).
- **Ship-blocker.** No prompt/model change to a safety-critical route ships below its
  pass-rate floor. (Mandatory; the same gate becomes non-negotiable for the higher-stakes
  sibling product.)

### CD-7 — Age-band engine (parameterized, with an extension mechanism)

Extends "Age-Band Operating Logic." Today "same issue, different guidance by age" is stated
with a small table but the band content is asserted, the bands are a closed pediatric set,
and there is no extension mechanism. Specify the engine:

- **Parameterized bands.** Each band carries documented per-band content (what changes, why,
  with what evidence) keyed to the framework that governs it (Piaget stage, Erikson task, EF
  trajectory, milestone window).
- **Extension mechanism.** The band set is a registry, not a hard-coded pediatric list, so
  new bands (e.g. teen, or — in the sibling product — young-old / old-old / oldest-old) plug
  in without a rewrite. This is the concrete realization of the life-stage abstraction layer
  below.

### CD-8 — Life-stage abstraction layer (formation / maintenance / decline)

The deepest enrichment, and the one that makes the product a platform rather than a single
app. Today every framework is hard-wired ascending-development ("Birth to 12", milestone
ladder up). Introduce a parameterized **developmental/functional-arc interface**:

- **The interface.** An arc has a *direction* (`formation` | `maintenance` | `decline`), a
  pluggable *staging model* (milestone ladder · steady-state maintenance · decline staging),
  and a firewall rule (which scores are hidden from the subject). Child-Arbor is the
  `formation` instance with the milestone-ladder staging model and the deficit-score
  firewall.
- **Why it matters.** Milestone theory becomes *one instance* of the staging interface, not
  the hard-wired spine — which is precisely what lets an adjacent population (Arbor Third
  Age, `decline`/`maintenance`) reuse the longitudinal-memory engine, the governed safety
  spine, and the firewall pattern without rebuilding them. It also strengthens the child
  product itself by forcing the formation assumptions to be explicit and parameterized
  rather than implicit.

---

## Sibling product: Arbor Third Age

> **Added 2026-06-29 (v1.3). Cross-reference note — not a scope change to this PRD.**

**Arbor Third Age** is a senior-wellbeing OS (ages 65+, B2B2C via Israeli HMOs) that is the
**structural inversion of child-Arbor across a single hinge: the firewall.** Child-Arbor
rests on developmental psychology — a child growing *into* capacity, scaffolded by milestone
theory — and hides milestone *deficit* scores so a parent never reduces a child to a
percentile. Third Age rests on geropsychology/geriatrics — an adult *sustaining* capacity
through continuity and loss — and hides *decline* scores so a senior is never reduced to a
falling number. The same longitudinal-memory engine, the same governed safety/privacy spine,
and the same expert-veto governance port directly; every primitive is re-rooted from
*guardian-over-minor* to *self-sovereign-adult-with-possible-proxy*, and every signal flips
from *skill gained* to *function at risk*.

Several enrichments in v1.3 exist precisely because they make both products possible and
stronger: the **life-stage abstraction layer (CD-8)** turns milestone theory into one
instance of a formation/maintenance/decline interface; the **consent capacity-state machine
(CD-4)** generalizes parent-over-minor consent into a model that also covers a self-sovereign
adult with a capacity-aware proxy; the **register/aesthetic abstraction and Child-ASR seam
(CD-3)** are what let the engagement engine and the speech seam re-skin for a dignified-adult
register and aphasia/dysarthria rehab; and the **mandatory eval gate (CD-6)** and
**safety-threshold governance (CD-5)** become non-negotiable for the higher-stakes senior
cohort.

**Canonical spec:** `PAI/projects/arbor-third-age/SPEC.md` (capability crosswalk,
geropsych/geriatric capability sets, re-targeted AI layer, HMO care-network spec, and the
consolidated dignity-firewall & safety-escalation rules). This PRD remains scoped to the
child product (Birth to 12); the senior product is tracked as a separate sibling under PAI.

---

## Dashboards

### Parent Home Dashboard

Today's insight, active action plan, recent logs, next milestone, AI quick question, recommended activity, weekly snapshot, reminders, professional messages, and school notes.

### Child Profile Dashboard

Overview, developmental domains, strengths, current challenges, milestones, behavior trends, sleep/eating notes, language profile, school context, active plans, professionals, and reports.

### Development Dashboard

Age milestones, completed milestones, monitor list, delayed/attention items, suggested activities, professional escalation indicators, and history.

### Behavior Dashboard

Behavior frequency, intensity trends, trigger analysis, time-of-day heatmap, location pattern, parent response effectiveness, recovery time, and plan success rate.

### Action Plan Dashboard

Active plans, goals, daily tasks, scripts, completion tracking, weekly review, what worked, what failed, and next adjustment.

### Language Dashboard

Target language, daily words, school phrases, story practice, speaking confidence, exposure hours, parent activities, and teacher notes.

### Professional Dashboard

Assigned children, new parent logs, AI summaries, risk flags, active interventions, upcoming sessions, reports to review, parent homework completion, and case notes.

### Organization Admin Dashboard

Active families, professionals, usage metrics, risk escalations, outcomes, engagement, subsidy status, compliance logs, and permissions.

---

## Technical Architecture

Suggested stack:

- Mobile: React Native / Expo
- Web: Next.js
- UI: Tailwind / shadcn
- Backend: FastAPI or Node.js
- Database: PostgreSQL
- Vector search: pgvector or managed vector DB
- Storage: object storage for reports/images
- Auth: Auth0, Supabase Auth, or Firebase Auth
- AI: RAG orchestration, safety classifier, prompt registry, evaluation suite
- Reporting: PDF export service
- Notifications: email, push, optional WhatsApp

### AI Enhancement Architecture

The AI layer should be structured as a disciplined pipeline, not a single free-form chatbot:

1. Intent and developmental-domain classifier
2. Safety triage classifier
3. Developmental formulation generator with uncertainty labels
4. Parent plan generator
5. Parent-approved memory proposal generator
6. Audience-specific handoff generator
7. Evaluation logger for safety, helpfulness, confidence, and outcome signals

Every AI response should be generated as structured data before UI rendering. Required fields include risk level, age band, domains, non-diagnostic hypotheses, today plan, parent script, what to avoid, what to observe, escalation thresholds, memory proposals, and handoff notes.

High-risk outputs require human review during beta. The product should use a prompt registry, source-card knowledge base, red-team scenario suite, and regression evals before changing prompts or models.

---

## Compliance, Privacy & Safety

Requirements:

- GDPR
- Child data minimization
- Explicit parental consent
- Right to deletion
- Data export
- Role-based access control
- Audit logs
- Encryption at rest and in transit
- No sale of child data
- No advertising to children
- No unsupervised child AI chat in MVP
- Human escalation paths
- Expert-reviewed high-risk content

---

## Monetization

### B2C

Free: basic AI Q&A, one child profile, limited logs, limited stories.
Premium: full profile, unlimited AI guidance, action plans, milestones, behavior analytics, stories, reports.
Family Plus: multiple children, advanced insights, school reports, language learning, co-parent access.

### B2B

Professional seats, active family pricing, clinic dashboard, report generation, homework workflows.

### B2G / Subsidized

Per family, per school/kindergarten, per municipal program, outcome-based pilots, subsidized parent access.

---

## MVP Scope

The first release should be a **private-beta parent support product**, not the full Arbor platform. It should prove that parents return because Arbor helps them turn one difficult moment into a safer plan, a calmer script, a useful log, and a better next step.

Build first:

1. Parent onboarding
2. Child profile
3. AI parenting coach
4. Behavior logging
5. Basic milestone tracker
6. Action plan generator
7. Safety classifier
8. Parent dashboard
9. Professional handoff summary
10. Exportable child context

Do not build first:

- Full professional platform
- Full AR experience
- Deep medical engine
- School integrations
- Municipality dashboards
- Complex child-facing interface
- Unsupervised child chat
- Expert marketplace

MVP loop:

**Parent asks → AI gives useful plan → parent logs outcome → platform becomes smarter → parent returns.**

### Private Beta Product Loop

1. **Intake** - parent names the child, age, concern, setting, urgency, and what has already been tried.
2. **Safety triage** - Arbor classifies the situation as routine, monitor, professional advice, urgent care, or emergency guidance, with a clear "not a diagnosis" boundary.
3. **Parent plan** - Arbor returns a brief explanation, a same-day action, an exact parent script, what to avoid, what to observe, and when to escalate.
4. **Child memory update** - parent approves which facts should be saved to the child profile.
5. **Follow-up log** - parent records whether the plan helped, what changed, and what still feels hard.
6. **Handoff** - Arbor can generate a one-page parent, teacher, or professional summary without exposing unnecessary child data.

### MVP Acceptance Criteria

| Capability | Acceptance Criteria |
|---|---|
| Developmental routing | Every parent concern maps to child age band, developmental domain, and practical intervention type. |
| Safety triage | Every AI response includes risk level, escalation guidance, and a no-diagnosis boundary. |
| Parent plan | Every plan includes today action, exact script, avoid list, observation target, and follow-up prompt. |
| Child memory | Saved memories are explicit, editable, time-stamped, and source-linked to parent input. |
| Privacy | Parent can export and delete child data. Child-facing AI is disabled in MVP. |
| Professional handoff | Export includes concern, context, logs, tried interventions, risk level, and parent questions. |
| AI quality | Prompt or model changes require targeted evals for safety, age fit, no-diagnosis behavior, practicality, and handoff quality. |
| Beta readiness | Product can support 20 to 50 invited families with manual expert review of high-risk scenarios. |

---

## Roadmap

| Phase | Scope | Goal |
|---|---|---|
| Phase 0 | Discovery, interviews, market research, regulatory scan, advisory board | Validate problem and risk |
| Phase 1 | Parent MVP, AI coach, child profile, developmental routing, logs, plans, safety | Validate retention |
| Phase 2 | 100–300 family beta, Hebrew/English support, expat use case, professional export, AI eval suite | Validate usage |
| Phase 3 | Therapist dashboard, case summary, homework, clinic workflow | Validate professional value |
| Phase 4 | School support, municipality/insurer pilot, organization dashboard | Validate institutional model |
| Phase 5 | Multilingual expansion, professional marketplace, AR stories, APIs, analytics | Scale |

---

## KPIs

Parent engagement:

- Weekly active parents
- Questions per parent per week
- Logs per child per week
- Action plan completion
- Story generation
- 30/90/180-day retention

Child-development value:

- Milestones tracked
- Behavior improvement trend
- Plan success rate
- Professional referral accuracy
- Parent confidence score

Professional value:

- Time saved per case
- Reports generated
- Homework completion
- Session prep time reduction
- Active cases per professional

Business:

- Free-to-paid conversion
- MRR
- CAC
- Churn
- ARPF
- B2B contract value
- B2G pilot conversion

---

## North Star Metric

**Meaningful Parenting Support Sessions per Child per Month**

A meaningful session is when a parent receives guidance, logs an outcome, starts or updates a plan, generates a child-specific activity, or shares structured context with a professional or school.

Secondary north star:

**Improvement in Parent Confidence Score over 30 days.**

---

## Final Thesis

Arbor should be built as a child-development intelligence layer that sits between parents, children, schools, therapists, and care systems.

The defensible asset is longitudinal child memory, expert-reviewed knowledge, practical intervention workflows, parent engagement data, professional collaboration, country-specific care pathways, and a trustworthy safety architecture.

That is the moat.

---

# Capability Backlog v1.1 (2026-05-31)

> Source: in-depth feature analysis of the shipped, production-deployed app.
> Format: Now / Next / Later. Each capability is outcome-led and has acceptance
> criteria so "done" is unambiguous. Value/Effort/Confidence on H/M/L.

## Central finding

The app surface is mature (10 tabs, AI throughout) but **most parent-generated
data is not yet persisted to the backend** — behavior logs, milestones, action
plans, the story library, and safety contacts live in React state / localStorage.
Only auth, child profiles, and the memory-review queue are Firestore-backed.
Durable, real-time, per-child persistence is the foundation that unblocks ~70% of
the backlog and is therefore the first commitment.

## Outcome themes (the most valuable capabilities)

1. **"My data is safe and with me everywhere"** — durable, real-time, per-child Firestore persistence.
2. **"I can capture the hard moment as it happens"** — voice + offline + 2-tap logging.
3. **"Arbor tells me what matters before I ask"** — proactive insights, reminders, auto weekly report, real pattern detection.
4. **"Arbor speaks my child's languages"** — Hebrew/English bilingual + RTL.
5. **"I can hand off with confidence"** — saved, versioned, clinician-ready exports + GDPR portability.

## NOW — committed

### N1 — Real Firestore persistence (V:H / E:M / Conf:H)
**Outcome:** A parent never loses their child's history and it follows them across devices.
**Definition:** Behavior logs, milestones, action plans, saved stories, and safety
contacts/checklist read and write to `users/{uid}/children/{childId}/…` via real-time
`onSnapshot`. localStorage remains the fallback only in sandbox mode (no Firebase).
**Acceptance:**
- Creating/editing any of the above writes to Firestore and survives reload + second device.
- Two browser tabs reflect each other's changes live (onSnapshot).
- Sandbox mode (no `VITE_FIREBASE_*`) still works against localStorage.

### N2 — Per-child data isolation (V:H / E:S / Conf:H)
**Outcome:** Switching to a second child shows their data, not the first child's.
**Definition:** All collections are keyed by `activeChild.id`; switching profiles re-subscribes.
**Acceptance:** Logs/milestones/plans/stories/safety differ per child and persist independently.

### N3 — AI "Today's Focus", cached 24h (V:M / E:S / Conf:M)
**Outcome:** The parent opens Arbor and instantly knows today's one thing.
**Definition:** Overview "Today's Focus" is a Gemini summary of recent signals, cached in
Firestore with a 24h TTL and regenerated on demand.
**Acceptance:** Card shows an AI insight; repeated opens within 24h read cache, not re-generate.

### N4 — Auto-generated Weekly Report + history (V:H / E:M / Conf:M)
**Outcome:** A real weekly recap lands without the parent asking, and past weeks are browseable.
**Definition:** Reports are generated (on a weekly cadence and on demand), stored at
`…/weeklyReports/{weekId}`, and listed with history.
**Acceptance:** Generating a report persists it; the tab lists prior weeks and reopens them.

### N5 — Quick-win polish (V:M / E:S / Conf:H)
**Outcome:** AI suggestions become one-tap actions; sparse data looks intentional, not broken.
**Definition:** Coach "Log this" pre-fills a real log; "Save to Action Plan" seeds a plan;
Overview chart shows a proper empty state when there are few logs.
**Acceptance:** Those actions create/seed real records; empty states render with a CTA.

## NEXT — planned

| ID | Capability | Outcome | V/E/Conf |
|---|---|---|---|
| X1 | Voice-to-log capture | Log a meltdown by talking, in the moment | H/M/M |
| X2 | Reminders & nudges | Don't forget to log / review milestones / monthly safety check | H/M/M |
| X3 | Bilingual (Hebrew/English) + RTL | The app and its scripts/stories speak the child's languages | H/M/M |
| X4 | Photo attachments on logs | Capture the drawing/setting that triggered an event | M/S/H |
| X5 | Pattern intelligence v2 (correlations) | "Meltdowns spike on low-sleep school mornings," not just counts | H/M/M |
| X6 | Saved & versioned briefs + PDF | Reuse and track what was shared with whom | M/S/M |
| X7 | PWA + offline capture | Log with no signal; sync later | M/M/M |

## LATER — directional

| ID | Capability | Outcome | V/E/Conf |
|---|---|---|---|
| L1 | GDPR data export / delete | Own and take (or erase) the child's full record | M/M/M |
| L2 | Milestone research depth | Each milestone links to credible guidance | M/M/L |
| L3 | Action-plan templates | Start from an expert blueprint, not a blank prompt | M/M/M |
| L4 | Accessibility (WCAG AA) | Works for every parent | M/M/H |
| L5 | Analytics instrumentation | Learn which capabilities help; prioritize with data | M/S/H |

## Dependencies & non-goals

- **Critical dependency:** N1 gates N2–N4 and most of Next/Later. Build it first.
- **Cost/safety:** more AI surface raises Vertex/Gemini spend — add per-user rate/cost caps before the Next tier.
- **Non-goals (unchanged):** no multi-caregiver/sharing/collaboration (single-parent tool),
  no external image-generation API, no third-party analytics scripts, no change to the parchment design system.
