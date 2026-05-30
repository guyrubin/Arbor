# Arbor — Parenting AI Platform PRD

**Version:** 1.1
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

Arbor's professional layer matches clinical workflow standards comparable to SimplePractice, TinyEYE, and Goalbook Toolkit — adapted for child development and built for parent-professional co-delivery. Every professional feature is consent-gated, role-scoped, and GDPR-compliant.

#### 10.1 Professional Account & Caseload

- Credentialed professional registration with role verification step (license number, institution, profession type)
- Supported role types: child psychologist, speech therapist, occupational therapist, parenting coach, educational consultant, pediatrician, social worker, SEN coordinator
- Caseload view: assigned families, active cases, flagged items, pending actions, and upcoming sessions in a single dashboard
- Child profile access is always parent-consent-gated; access automatically expires on case closure or parent revocation

#### 10.2 Structured Intake Workflow

- Professional sends a consent-linked intake invitation to the parent via Arbor
- Parent selects the access scope they approve: logs only, full profile, or profile plus the ability to add notes visible to parent
- AI-generated intake summary delivered to professional within 24 hours of access grant: child age, presenting concern, developmental history, behavior patterns, active plans, language profile, school context, and prior professional involvement
- Intake package is exportable as a structured PDF

#### 10.3 Session Preparation

- Pre-session AI brief: last three parent log entries, behavior trends since the previous session, parent-flagged questions, active action plan progress, and any milestone changes
- Session goal tracking: professionals set measurable goals per session in SMART format (Specific, Measurable, Achievable, Relevant, Time-bound)
- Between-session parent guidance: structured observation prompts the professional assigns for parents to log before the next session

#### 10.4 Session Notes & Progress Documentation

- **SOAP format** (Subjective, Objective, Assessment, Plan) — industry-standard clinical documentation
- **DAP format** (Data, Assessment, Plan) as an alternative for narrative-style practitioners
- Goal progress rating per session on a defined scale from baseline to target
- Outcome measure integration for pre-validated tools: SDQ (Strengths and Difficulties Questionnaire), PEDS, CBCL, Vineland Adaptive Behavior Scales, ASQ, and GARS for autism/ADHD observation
- Session notes are private to the professional by default; the professional may choose to generate a parent-facing plain-language summary

#### 10.5 Treatment & Intervention Planning

- Structured treatment plan fields: presenting issue, measurable goals, intervention approach, frequency, estimated duration, and review date
- Intervention plan templates: behavior support plan, language intervention plan, sensory diet, toilet training protocol, anxiety management plan, and school transition plan
- Plan review cycle: system prompts the professional to update the plan at defined intervals (default: every six sessions or 90 days)
- Treatment plan is shareable with the parent and, with separate explicit consent, with the child's school SEN coordinator

#### 10.6 Parent Homework & Between-Session Coordination

- Professional assigns structured homework tasks linked directly to the child's active Arbor action plan
- Parent logs task completion via the standard behavior and routine log; professional sees completion rate and any parent notes
- Secure in-app messaging between professional and parent — not relayed via email; messages are part of the case record
- Parent can flag an urgent item between sessions; professional receives a timestamped notification

#### 10.7 Multi-Disciplinary Team (MDT) Coordination

- A case can be shared across multiple professionals — for example, a speech therapist, psychologist, and school SEN coordinator — with separate parent consent for each party
- Each professional sees only their own session notes plus the shared child profile summary; no cross-professional note access without explicit disclosure consent
- MDT case conference tool: structured meeting agenda generator producing an action list with named owner and due date
- Lead professional designation: one professional holds the integrator role and serves as the parent's primary point of contact — aligned with Frame 6 (The Shepherd)

#### 10.8 Risk Escalation

- AI monitors parent logs for clinical risk indicators: persistent sleep regression, toileting regression after age four, sustained social withdrawal, escalating aggression, or language plateau — and surfaces flagged items to the assigned professional within 24 hours
- Professional can acknowledge, escalate, or dismiss a flag with a mandatory written note
- Critical flags (child safety indicators, acute mental health risk, abuse indicators) trigger a mandatory human-review gate; AI does not autonomously handle or communicate these

#### 10.9 Reports & Exports

- AI-generated case summary report in narrative format, suitable for sharing with schools or onward professionals with consent
- Progress report: goal status over time, behavior trend summary, intervention response, and parent homework completion rate
- Professional referral letter template: structured onward referral to pediatrician, psychiatrist, or specialist service
- All report exports comply with GDPR Articles 15 and 20 (data access and portability); PDF output includes an audit timestamp, consent scope, and document version

#### 10.10 Discharge & Case Closure

- Structured discharge workflow: goal achievement summary, ongoing parent recommendations, school-facing notes, and onward referral if continued care is needed
- Discharge summary auto-populated from session notes and progress data, with professional review and edit before release
- Child profile is retained in Arbor after case closure; professional access is revoked immediately; parent retains full interaction history

### 11. School & Kindergarten Collaboration

Arbor's school layer matches the information-sharing and support planning standards of ClassDojo, Seesaw, Goalbook Toolkit, and Frontline Special Education — adapted for a parent-held, child-centered model and compliant with Passend Onderwijs (Netherlands), Israeli special education law (ועדת שילוב), and Belgian M-decree inclusive education frameworks.

#### 11.1 School Profile

- Parent creates a school profile for each enrolled child: school name, type (mainstream, SEN, international, Montessori, Steiner, religious), year group, class size, language of instruction, and SEN coordinator contact
- Country-specific fields: Netherlands → Schoolondersteuningsprofiel (SOP) support level (Basic / Extra / Specialist); Israel → integration status and weekly support hours; Belgium → M-decree inclusion type (I / II / III)
- School profile data informs all AI coaching responses — recommendations account for the child's educational environment

#### 11.2 Teacher & SEN Coordinator Accounts

- Parent invites a teacher or SEN coordinator by email; they receive a role-scoped account with limited, consent-defined access
- **Teacher role**: read access to the child profile summary, active behavior and routine logs, language profile, and parent-shared notes; no access to medical records or professional therapy content
- **SEN coordinator role**: teacher-level access plus active support plans and professional co-therapy summaries, each requiring separate consent per professional
- School staff access is time-limited to the academic year and auto-expires at year end; parent can renew or revoke at any time
- All invitations, access grants, scope changes, and revocations are logged with timestamp for audit purposes

#### 11.3 Structured Handoff Notes

Standardized templates comparable to Understood.org school advocate packs and ClassDojo portfolio exports:

- **Start-of-year handoff note** — what this child needs to succeed: communication style, known triggers, regulation strategies, language context, existing support plans, professional involvement summary, and what worked in the prior year
- **Mid-year update note** — progress summary, behavioral changes since September, emerging concerns, and updated classroom strategies
- **End-of-year handoff note** — full-year summary for the receiving teacher, including unresolved concerns and recommended next steps
- **Stage transition handoff** — preschool to primary school, or primary year to year; covers academic readiness, social-emotional profile, language status, and specific recommendations for the receiving teacher or school
- **School-change handoff** — for families relocating or changing schools mid-year; includes everything in the transition handoff plus a parent-authored context note
- All handoff notes are AI-drafted from the child's Arbor profile; parent reviews and approves the content before the document is shared with the school

#### 11.4 Country-Specific Support Plan Documentation

Comparable to Goalbook Toolkit and Frontline Special Education:

- **Netherlands — OPP (Ontwikkelingsperspectiefplan)**: expected developmental trajectory, current functioning level (uitstroomprofiel), support goals, responsible parties, and review date — structured to meet Passend Onderwijs requirements and Zorgplicht obligations
- **Israel — Individual Support Plan (תוכנית תמיכה אישית)**: goals, weekly support hours, integration committee (ועדת שילוב) summary, responsible parties, and reassessment schedule
- **Belgium / EU — Support Level Document**: M-decree classification, reasonable accommodations (redelijke aanpassingen), responsible parties, and review date
- **Generic IEP-style (international schools and other markets)**: present levels of performance, SMART goals, accommodations, supplementary aids, responsible parties, and review cycle
- Plans are co-authored: parent inputs their priorities and concerns; AI drafts the structured document; SEN coordinator or assigned professional can review and co-sign within Arbor

#### 11.5 School Meeting Preparation & Follow-Up

- **Pre-meeting prep**: parent selects meeting type (parent-teacher conference, SEN review, IEP or support plan meeting, school refusal discussion); AI generates an agenda with the parent's top priorities, a child profile summary, and suggested talking points
- **In-meeting notes**: a structured note-capture field for recording key decisions, agreed actions, and unresolved items
- **Post-meeting action tracker**: actions assigned to parent, school, or professional with due dates and automated reminders; linked to the child's Arbor profile

#### 11.6 School Behavior Observations

- Teachers or SEN coordinators with write access can log structured observations in Arbor: setting, trigger, behavior type, intensity, teacher response, and outcome
- School observations are tagged separately from home observations and displayed as a distinct data stream in the behavior dashboard
- AI generates a home-school pattern analysis: compares behavior across contexts and surfaces discrepancies that may indicate environment-specific or relationship-specific triggers

#### 11.7 Language & EAL Support Documentation

- AI generates a language profile document for the school: home language(s), school language proficiency level, EAL stage (using CEFR A1–C2 for EU markets), specific vocabulary and instruction-following challenges, and recommended classroom strategies
- Teacher can add classroom language observations; parent adds home language context; both feed the shared language profile
- Output format is aligned with Common European Framework of Reference (CEFR) for EU markets and the Israeli Ministry of Education language support framework

#### 11.8 School Readiness Assessment

- Structured readiness checklist administered at ages three, four, and five across five domains: cognitive, language, social-emotional, physical, and self-care
- AI generates a readiness report for the parent: domain-level readiness summary, specific strengths, and gaps relative to age-expected benchmarks
- Gap-closing activity plan: four to six weeks of targeted daily activities to address readiness gaps before school enrollment, derived from the scholar capability layer

#### 11.9 School Refusal & Attendance Support

- Dedicated workflow for school refusal: symptom log, trigger identification, anxiety-based versus avoidance-based distinction using established ABSA (Anxiety-Based School Avoidance) criteria used by UK CAMHS and US school psychologists
- Graduated re-entry plan: structured day-by-day return schedule with daily check-ins, parent script, and teacher accommodation script
- School-facing communication template: conveys the child's support needs to the teacher without medical disclosure; includes agreed classroom accommodations for the re-entry period

### 12. Parent Education Academy

Premium content library with masterclasses, short explainers, parent scripts, playbooks, interactive courses, worksheets, audio guidance, expert interviews, and country-specific guides.

---

### 13. Support Handoff Protocol

Arbor operationalizes the structured transfer of child information between parents, professionals, and schools — replacing the current market standard of PDF email attachments and informal verbal handoffs with a consent-managed, AI-assisted handoff workflow. This is a distinct capability layer that sits across Modules 10 and 11 rather than belonging to either one.

#### 13.1 Handoff Types

| Handoff Type | From | To | Trigger |
|---|---|---|---|
| Professional Intake | Parent | Therapist / Clinic | Parent requests referral or professional initiates onboarding |
| Professional Transfer | Outgoing professional | Incoming professional | Case closure, relocation, or professional change |
| Home-to-School | Parent | Teacher / SEN Coordinator | Year start, school change, or ongoing coordination |
| School-Initiated Referral | Teacher / SEN Coordinator | Professional | School flags developmental or behavioral concern |
| MDT Case Transfer | Lead professional | Co-professional | Adding a specialist to an active case |
| Discharge to Parent | Professional | Parent | Case closure; professional involvement ends |

#### 13.2 Handoff Package Contents

Each handoff generates a structured package assembled from the child's Arbor profile. Contents are consent-scoped per recipient type and assembled automatically from live profile data.

**Professional intake package:**
- Child summary: age, presenting concern, developmental history in narrative form
- Active behavior and routine logs (last 90 days, with trigger and response data)
- Milestone status and any flagged delays or regressions
- Active action plans and parent completion rate
- Language profile
- School context and current support plan summary
- Prior professional involvement: role and timing only, unless full disclosure is separately consented

**School transition package:**
- Behavioral profile: strengths, known triggers, and effective regulation strategies
- Language profile and EAL stage
- Active country-specific support plan (OPP / IEP / TTA; see Module 11.4)
- Handoff note (start-of-year, stage transition, or school-change; see Module 11.3)
- Professional involvement summary: role only; no clinical content unless the parent provides separate explicit consent

**Professional transfer package:**
- Full treatment history from outgoing professional's notes — shared only with that professional's explicit export authorization
- Goal progress summary from baseline to current status
- Discharge summary from outgoing professional
- Current active treatment plan
- Parent consent re-signed specifically for the incoming professional before access is granted

**Discharge-to-parent package:**
- Goal achievement summary for each treatment goal
- Ongoing parent recommendations in plain language
- School-facing recommendations (parent may share or withhold)
- Onward referral letter if further professional support is recommended

#### 13.3 Consent Management

- Every handoff requires the parent to explicitly select: what is shared, with whom, and for how long — no default sharing
- Consent is recorded in Arbor's audit log with timestamp, parent identity, scope, and document version
- Default scope is minimum necessary data; parent must actively expand scope to include clinical session notes or professional summaries
- Health and disability data (GDPR Special Category, Article 9) requires a separate explicit consent action, distinct from general profile consent
- Consent can be revoked at any time; all access is removed within 24 hours of revocation and the revocation is logged
- Parents can download a full consent log at any time as part of GDPR Article 15 subject access rights

#### 13.4 Handoff Quality Standards

Market comparators: TinyEYE referral workflow, SimplePractice intake forms, Goalbook transition document templates, Dutch Zorgplicht school-transfer documentation requirements.

Each generated handoff document meets the following standards:

- Structured format readable by the receiving professional or school without requiring an Arbor account
- Exportable as PDF with audit metadata: date, consent scope, document version, and generator identifier
- Plain-language parent-facing version generated alongside any professional-facing version
- No AI-generated clinical conclusions, diagnoses, or risk assessments in handoff documents — only structured factual data and parent-authored observations
- Human review gate required for any handoff document touching child safety, acute mental health content, or abuse indicators; AI does not autonomously release these
- All documents include a visible disclaimer: this document summarizes parent-logged observations and professional records; it does not constitute a clinical assessment or diagnosis

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
