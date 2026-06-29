# Arbor AI Wiki

## Current state

Framework definitions exist in `app/src/framework.json`.

## Target state

Authoritative Arbor knowledge lives in Git-backed markdown under `knowledge/`.

## Source card schema

```yaml
---
id: vygotsky-zpd
type: scholar
domains: [cognition_executive_function]
age_bands: [12-36m, 3-5y, 6-8y, 9-12y]
six_frame: aim
risk_level: routine
language: en
review_status: draft
allowed_uses: [coach_context, plan_generation, eval]
evidence_strength: medium
---
```

## Migration path

M1 uses local markdown retrieval. Vertex AI Search can index JSONL exports later while Git remains the source of truth.

## M1 acceptance gates

- Source cards are atomic and retrieval-ready.
- `/api/chat` can attach `sourceCardsUsed`.
- Evals can target specific knowledge card ids.
