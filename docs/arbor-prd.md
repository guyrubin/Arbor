# Arbor — Parenting AI Platform PRD

**Version:** 1.0
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

Build first:

1. Parent onboarding
2. Child profile
3. AI parenting coach
4. Behavior logging
5. Basic milestone tracker
6. Action plan generator
7. Story generator
8. Parent dashboard
9. Safety classifier
10. PDF export

Do not build first:

- Full professional platform
- Full AR experience
- Deep medical engine
- School integrations
- Municipality dashboards
- Complex child-facing interface

MVP loop:

**Parent asks → AI gives useful plan → parent logs outcome → platform becomes smarter → parent returns.**

---

## Roadmap

| Phase | Scope | Goal |
|---|---|---|
| Phase 0 | Discovery, interviews, market research, regulatory scan, advisory board | Validate problem and risk |
| Phase 1 | Parent MVP, AI coach, child profile, logs, plans, stories, safety | Validate retention |
| Phase 2 | 100–300 family beta, Hebrew/English support, expat use case, professional export | Validate usage |
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
