# AI backlog: Hebrew name redaction — 15 October 2026

## Backlog provenance

Claude's original AI integration backlog is
`docs/architecture/ai-integration-backlog-2026-06-29.md` (introduced with
`ef51b7d9371080d038d130b98e7630de2a76dea7`). Its historical implementation
status is not today's release status. Current work is consolidated in
`guyrubin/ROS/PAI/projects/arbor/ARBOR-PARENT-BACKLOG.md`, with GA dependencies
in `ARBOR-GA-BACKLOG.md` and model decisions in
`reference/ai-model-allocation-2026-10-10.md`.

## B-AI-17

The current shared redactor uses ASCII word boundaries, leaving Hebrew names
in prompts. This change uses Unicode word boundaries and preserves attached
Hebrew prefixes (up to three prefix letters) outside the replacement alias.
JSON-escaped newline/tab/carriage-return boundaries are covered too. Longer
words are preserved; the existing single-character-name exclusion remains.
This is literal matching of the supplied name, not general named-entity
recognition or transliteration detection.

Tests cover Unicode and compound names, Hebrew prefixes, serialized profiles,
round-trip restoration, and actual `/chat` and `/voice` handlers with stub
providers, including private voice. These prove deterministic redaction, not
real model quality or audible playback. No prompt version or model routing
changes are included.

## Remaining AI work

- B-PROV-05: voice pins and read-aloud recovery shipped in PR #140; actual
  signed-in EN/HE playback and synthesis-log evidence remain outstanding.
- B-GA-26: PR #142 meters observed Live connection time; PR #143 improves
  text/cache prices. Verified billable audio, family plan caps, fallback
  accounting and operational alerts remain unfinished.
- B-PROV-08, B-AI-09 and B-AI-11 require live model evaluation evidence.
  Evaluation run 38754249258 and its retry failed with the deployment
  identity missing `aiplatform.endpoints.predict`. No model flip is justified
  by deterministic tests alone.
- B-PROV-11 requires the approved OpenAI EU project provisioning and the
  EN/HE audio bake-off. B-PROV-09 depends on that provider decision.
- B-VOICE-01/02/03/04 remain feature work with meter/cap and evaluation
  dependencies. B-VOICE-08 needs the phone gesture-to-microphone flow proved.
- B-AI-18 remains council perspective work with its context and live-eval
  dependencies. The older backlog's child Live experiment is superseded by
  later decisions and must not be revived by bulk-merging historical work.

This release is not completion of the entire AI backlog. Release checks and
the production SHA are recorded in the associated pull request.
