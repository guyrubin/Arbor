# Arbor eval suites

Each `<suite>.eval.json` is a version-pinned suite; `npm run eval:judge -- <suite>` (app/scripts/eval-judge.mts) runs it live and APPENDS one row to `<suite>.results.jsonl` (src/eval/judge.ts). A row carries the judge model, the resolved route model, the prompt versions in force, and per scenario the scores, safe, pass, rationale and — since coach_chat 1.5.1 — `transcript`: the raw route transcript the judge saw, capped at about 6 KB.

The `transcript` field is SYNTHETIC ONLY: the judge runs on the suites' synthetic eval profiles and never on a real family's data, so a results row never holds a real child's words.
