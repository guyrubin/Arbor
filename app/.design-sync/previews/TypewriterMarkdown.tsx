import { TypewriterMarkdown } from "arbor-private-beta-app";

export function StreamingAnswer() {
  const text = `## Why the sudden clinginess?

Around 22 months, separation worry often **spikes again** — not a regression, a sign she's grasping that you exist when you're out of sight.

### What helps
- A short, consistent goodbye ritual
- Naming it: "You're sad I'm leaving. I always come back."
- Keep partings calm and brief`;
  return (
    <div style={{ maxWidth: 480, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <TypewriterMarkdown text={text} enabled={false} />
    </div>
  );
}

export function ShortStream() {
  const text = `Two-word phrases by 24 months are a lovely sign — Mia is **right on track**. Keep narrating your day and pausing for her to fill in.`;
  return (
    <div style={{ maxWidth: 420, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <TypewriterMarkdown text={text} enabled={false} />
    </div>
  );
}
