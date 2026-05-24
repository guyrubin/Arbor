# Arbor Developmental AI Operating Model

This document turns Arbor's child-development theory into product behavior. The rule is simple: no framework is allowed to remain decorative. Every developmental idea must map to data captured, guidance produced, safety rules, memory fields, and evaluation tests.

## Source Anchors

- [CDC developmental milestones](https://www.cdc.gov/act-early/milestones/index.html): milestones cover how children play, learn, speak, act, and move; CDC also states that milestone resources are not a substitute for validated screening tools.
- [CDC developmental monitoring and screening](https://www.cdc.gov/act-early/about/developmental-monitoring-and-screening.html): monitoring is for families and caregivers; formal screening is for trained professionals, with general developmental screening commonly at 9, 18, and 30 months and autism screening at 18 and 24 months.
- [Harvard Center on the Developing Child serve and return guide](https://developingchild.harvard.edu/resource-guides/guide-serve-and-return/): serve-and-return interactions and responsive relationships are core early-development mechanisms.
- [OpenAI safety best practices](https://developers.openai.com/api/docs/guides/safety-best-practices): high-stakes outputs should use human review where possible, prompt constraints, structured outputs, and safety identifiers.
- [OpenAI agent safety guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety): agentic systems should constrain data flow with structured outputs and evaluate safety and performance with targeted evals.

## Developmental Framework

Arbor should model the child across seven domains. Each parent concern should be routed to one or more domains, then converted into a practical parent action.

| Domain | What Arbor Tracks | Parent Guidance Output | Safety Boundary |
|---|---|---|---|
| Attachment and regulation | Separation, repair, comfort-seeking, recovery time, parent response | Co-regulation script, repair script, transition ritual | Escalate severe distress, regression, self-harm language, or sustained functional impairment |
| Language and communication | Expressive language, receptive language, multilingual exposure, school phrases | Daily phrase practice, serve-and-return prompts, teacher notes | No speech-delay diagnosis; route persistent concern to screening/professional advice |
| Cognition and executive function | Attention, planning, flexibility, working memory, problem-solving | Next best challenge, visual routine, step-down task | Avoid labeling the child; distinguish skill gap from willful behavior |
| Social development | Peer play, turn-taking, empathy, conflict, social confidence | Play script, social story, exposure ladder | Escalate isolation, bullying, aggression, or sudden social withdrawal |
| Independence and adaptive skills | Sleep, toileting, dressing, eating, chores, transitions | Independence ladder, prepared environment, responsibility step | Avoid shame or coercive plans; watch for medical or sensory explanations |
| Sensory and motor patterns | Sound, texture, movement, fatigue, fine/gross motor observations | Sensory-aware routine, environment change, observation log | Observation only; professional referral for persistent sensory or motor concerns |
| Ecosystem and stressors | Family routines, school context, languages, moves, illness, conflict, caregiver stress | Context-aware plan, co-parent alignment prompt, handoff summary | Do not assign blame; route safety, abuse, or crisis concerns to appropriate help |

## Age-Band Logic

Arbor should never answer a parent concern without first considering the child's age band and developmental task.

| Age Band | Core Developmental Task | Product Behavior |
|---|---|---|
| 0 to 12 months | Trust, regulation, caregiver responsiveness | Emphasize serve-and-return, feeding/sleep observation, parent reassurance, pediatric escalation for red flags |
| 12 to 36 months | Autonomy, language growth, frustration tolerance | Offer simple choices, visual routines, naming feelings, safe limits, milestone monitoring |
| 3 to 5 years | Initiative, play, school readiness, emotional language | Generate scripts, social stories, transition rituals, practice games, teacher handoff notes |
| 6 to 8 years | Industry, competence, routines, peer belonging | Build responsibility ladders, problem-solving scripts, school collaboration, confidence tracking |
| 9 to 12 years | Identity seeds, agency, executive function, social complexity | Use collaborative planning, family council prompts, habit design, privacy-respecting reflection |

## Theory-to-Feature Mapping

| Framework | Arbor Feature | Required Output |
|---|---|---|
| CDC milestones and monitoring | Milestone-aware concern routing | Age-band expectation, monitoring checklist, and screening boundary |
| Harvard serve and return | Interaction coach | Parent notices the serve, responds, names it, waits, and repeats |
| Vygotsky zone of proximal development | Next Best Challenge Engine | One task that is neither too easy nor too hard, with scaffold and fade plan |
| Bowlby attachment theory | Attachment and repair coach | Safety, connection, boundary, and reconnection script |
| Erikson psychosocial stages | Developmental arc | Stage-aware explanation of what the moment may be forming |
| Bronfenbrenner ecological systems | Child ecosystem map | Family, school, language, culture, routine, and stressor context |
| Montessori practical life | Independence planner | Prepared environment plus child-owned step |
| Baumrind parenting styles | Warmth and structure balancer | Parent response that is both connected and boundaried |
| Executive function science | Self-regulation builder | Plan, inhibit, remember, flex, and recover micro-skill practice |
| Trauma-informed development | Stress and resilience monitor | Stabilizing routine, predictability, and escalation threshold |

## AI Enhancement Layer

Arbor should use a multi-step AI pipeline. The parent should see one calm answer, but the system should do more disciplined work behind it.

1. **Intent and domain classifier** - identify concern type, child age band, involved domains, and urgency.
2. **Safety triage classifier** - classify routine, monitor, professional advice, urgent care, or emergency guidance.
3. **Developmental formulation generator** - produce two or three non-diagnostic hypotheses with uncertainty labels.
4. **Plan generator** - produce same-day action, parent script, avoid list, observation target, and follow-up prompt.
5. **Memory proposal generator** - suggest only parent-approved facts to save, with source and retention label.
6. **Handoff generator** - create audience-specific summaries for teacher, therapist, pediatrician, or co-parent.
7. **Evaluation logger** - store anonymized eval signals: risk classification, helpfulness, parent confidence, and follow-up outcome.

## Structured Output Contract

Every AI coaching response should be generated as structured data first, then rendered into parent-friendly UI. This keeps safety, evals, and exports reliable.

```json
{
  "riskLevel": "routine | monitor | professional_advice | urgent | emergency",
  "ageBand": "0-12m | 12-36m | 3-5y | 6-8y | 9-12y",
  "domains": ["attachment_regulation", "language", "executive_function"],
  "nonDiagnosticHypotheses": [
    {
      "label": "transition stress",
      "confidence": "low | medium | high",
      "rationale": "brief parent-visible reason"
    }
  ],
  "todayPlan": ["one concrete action"],
  "parentScript": "exact words a parent can say",
  "avoid": ["one thing to avoid"],
  "observe": ["specific signal to track"],
  "escalateIf": ["clear threshold"],
  "memoryProposals": [
    {
      "fact": "Dylan struggles with rushed kindergarten drop-off",
      "source": "parent intake",
      "retention": "review in 30 days"
    }
  ],
  "handoffNotes": {
    "teacher": "short classroom-safe summary",
    "professional": "more detailed clinical-context summary"
  }
}
```

## Knowledge and Memory Design

- Use source cards with `title`, `sourceUrl`, `reviewedBy`, `reviewDate`, `ageRange`, `countryApplicability`, `riskLevel`, and `allowedUses`.
- Separate child memory from knowledge. Child memory is parent-approved child context; knowledge is expert-reviewed developmental guidance.
- Save observations, not labels. Store "cried at drop-off three times this week," not "has separation anxiety."
- Time-box sensitive memories. Prompt parents to review stale concerns after 30, 90, or 180 days.
- Exports must use audience-specific disclosure rules.

## Evals and Quality Gates

| Eval Area | Test Cases | Pass Criteria |
|---|---|---|
| Safety triage | Fever, regression, self-harm language, abuse disclosure, developmental delay concern | Correct escalation and no unsafe reassurance |
| Developmental fit | Same concern across toddler, preschool, and school-age child | Age-appropriate explanation and plan |
| No diagnosis | Autism, ADHD, anxiety, speech delay concerns | Observation and referral language, no diagnosis claim |
| Practicality | Tantrum, school refusal, sleep, screen conflict, sibling aggression | Parent can do the plan today in under 10 minutes |
| Memory hygiene | Parent shares sensitive details | Saves only approved, factual, minimal memory |
| Handoff quality | Teacher vs pediatrician export | Correct audience detail level and no oversharing |

## Beta AI Enhancements To Prioritize

1. Pattern detection across repeated logs: trigger, time, setting, recovery, parent response.
2. Developmental-domain dashboard: regulation, language, independence, social, executive function, ecosystem.
3. Next Best Challenge Engine: one scaffolded task and one parent fade step.
4. Serve-and-return coach: parent-child interaction prompts for young children and language development.
5. Memory review inbox: approve, edit, expire, or delete proposed memories.
6. Human expert review console: queue high-risk cases and evaluate model outputs before scaling.
