# ADR 0001: Vertex AI On GCP

## Status

Accepted.

## Context

Issue #6 moves Arbor from prototype to private-beta architecture. Production Arbor needs an enterprise trust boundary for model calls, auditability, regional controls, and a clean path to Model Garden optionality. The current local app can use the consumer Gemini developer API, but that path is not the production platform.

## Decision

Arbor production model calls will run through Vertex AI on GCP in `europe-west4`, with EU Data Boundary posture where available. Local development may keep a Gemini developer fallback, but `ARBOR_ENV=prod` must require `MODEL_PROVIDER=vertex`.

This closes re-litigation of the platform choice for M0/M1. GCP project, region, service account, IAM, and secrets belong in deployment docs and environment configuration.

## Consequences

Arbor must keep model access behind a provider/router abstraction. Production deployment work must configure Vertex AI, service accounts, and least-privilege IAM. Evals and logs should assume enterprise audit and compliance needs.

## Alternatives

Consumer Gemini API was rejected for production because it does not provide the desired enterprise trust boundary. Multi-cloud orchestration was rejected for M1 because it adds complexity before beta signal.
