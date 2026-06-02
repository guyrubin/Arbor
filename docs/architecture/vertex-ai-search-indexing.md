# Arbor Vertex AI Search Indexing

## Current state

Arbor AI Wiki content is markdown in Git.

## Target state

Vertex AI Search indexes exported source cards, but Git remains the source of truth.

## Rebuild plan

1. Validate markdown front matter.
2. Export cards to JSONL.
3. Upload JSONL to Cloud Storage.
4. Rebuild or refresh the Vertex AI Search data store.
5. Record source card ids in eval outputs.
