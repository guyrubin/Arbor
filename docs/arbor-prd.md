# Arbor — Parenting AI Platform PRD

**Version:** 1.1 (2026-05-31 — added Capability Backlog v1.1; see end of document)
**Product type:** AI-powered child-development, parenting, co-therapy, and school-support platform
**Age range:** Birth to 12
**Markets:** Israel, Netherlands, Belgium, later broader EU

## Executive Summary

Arbor is not a parenting chatbot. Arbor is a longitudinal child-development intelligence operating system for parents, children, schools, therapists, clinics, and care organizations.

The platform combines AI parenting guidance, child memory, developmental milestone tracking, behavior analytics, personalized intervention plans, language-transition support, autism/ADHD observation support, medical safety guardrails, personalized story generation, professional co-therapy workflows, school collaboration, and B2B/B2G dashboards.

The moat is not the AI model. The moat is longitudinal child memory plus expert-reviewed developmental knowledge plus structured parent workflows plus professional collaboration.

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
