# ADR 0003: AI Wiki Knowledge Base

## Status

Accepted.

## Context

Issue #6 makes Arbor’s knowledge layer a strategic asset. The product needs source-grounded, reviewable developmental content that clinicians and product agents can edit without hiding canonical knowledge inside prompts, databases, or vector indexes.

## Decision

Arbor’s authoritative knowledge store is a Karpathy-pattern, Git-backed markdown corpus. Knowledge pages use structured front matter for id, type, domains, age bands, Six Frame, risk level, language, review status, allowed uses, and evidence strength.

Vertex AI Search is allowed later as a derived retrieval index. It is not the source of truth. Firestore stores child memory and operational events; Git stores developmental knowledge.

## Consequences

Codex and Antigravity should treat `knowledge/` as the canonical Arbor AI Wiki. Retrieval modules must return source card ids. Evals should be able to assert which source cards were used. Clinician review can happen as markdown review and pull request workflow.

## Alternatives

Prompt-only knowledge was rejected because it is hard to audit and review. Vector-store-as-source was rejected because indexes are derived infrastructure, not durable editorial source.
