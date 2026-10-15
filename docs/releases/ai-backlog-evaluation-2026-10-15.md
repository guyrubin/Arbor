# AI backlog evaluation and accounting — 15 October 2026

Scope: the approved AI model allocation in ROS, 10 October, with M1–M5 approved in the 11 October decision log. This receipt does not close the full backlog.

## Accounting changes

- Exact model-family pricing prevents TTS, Cyber, or unknown successors from silently inheriting a text-model price. Numeric snapshots remain supported.
- Add the approved Flash-Lite, Haiku 5.5 and Sonnet 5.5 EU prices; correct Sonnet 5. Include Haiku's >100k input tier and the published January 2027 Flash price change.
- Normalize Gemini cache reads and audio inputs; Claude cache reads and 5m/1h writes. Include cached Claude input in the input totals exactly once. Unsupported cache/modality combinations stay unpriced.
- Prices verified against https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing on 15 October. These are standard token estimates, excluding cache storage, failed attempts with no usage response, Live billing, and provider invoice reconciliation.

## Executed live gate

GitHub Actions run https://github.com/guyrubin/Arbor/actions/runs/38754249258 used the existing deployment identity with local synthetic stores, no production family reads. Four matrix jobs attempted Haiku 5.5, Gemini 3.8 Flash, Sonnet 5.5 and Flash-Lite analysis. Google authentication succeeded but model/judge inference returned HTTP 403, IAM_PERMISSION_DENIED, missing aiplatform.endpoints.predict. No live quality pass is claimed. No model pins or production route models change in this release.

The reusable manual workflow runs these bounded synthetic suites and preserves per-run evidence. An administrator must grant an appropriate evaluation identity model invocation access; this change does not alter IAM or impersonate another identity.

## Remaining release requirements

| Row | Outstanding evidence/work |
| --- | --- |
| B-GA-26 | Provider-billed Live audio and retry reconciliation, fallback accounting, shared-family 3/20 minute budgets, alerts, invoice reconciliation. Current observed connection telemetry is not a billable meter. |
| B-PROV-08 | Per-ID live suites after inference access, routine winner selection, routing implementation, pinned green evidence before production switch. |
| B-PROV-11 / 09 | Approved OpenAI EU project/DPA/ZDR/payment setup, 20-utterance EN/HE audition with actual bill. Adapter is conditional on Hebrew bakeoff win. |
| B-GA-06 | Authenticated EU Live mint and 10-turn session; no global fallback may be silently relabelled EU. |
| B-BOOK-64 / 67 | New image and performed narration models need EU generation, avatar consistency, and EN/HE narration evidence before migration/rerender. |
| B-PROV-05 / B-SHELL-40 | Signed-in real-device English/Hebrew playback and mic handoff remain unverified. |

A direct-to-provider Live token remains usable until its provider expiry. Refunding a budget solely on a browser close report would let a modified client keep spending that token. A hard family cap therefore needs server-owned session control or nonrefundable expiring reservations with a carefully tested renewal path; an honest-client countdown is not sufficient proof. Crisis directions and typed support must remain accessible at exhaustion.
