import { MarkdownBlock } from "arbor-private-beta-app";

export function CoachAnswer() {
  const text = `## What's happening at 22 months

Mia pointing-and-naming is a strong **receptive language** signal. Two-word phrases ("more milk", "Dada up") show she's combining ideas — right on track.

### Try this week
- Narrate as you go: "We're **washing** the red cup."
- Pause after questions so she fills the gap.
- Echo and extend: she says "doggy", you say "**big** doggy".`;
  return (
    <div style={{ maxWidth: 480, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <MarkdownBlock text={text} />
    </div>
  );
}

export function ShortNote() {
  const text = `That bedtime "love you Dada" is exactly the kind of **unprompted affection** that blooms around this age. Nothing to do here — just savor it.`;
  return (
    <div style={{ maxWidth: 420, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <MarkdownBlock text={text} />
    </div>
  );
}

export function ChecklistSummary() {
  const text = `### This month's focus
- **Pretend play** — feeding a doll, "talking" on a toy phone
- **Following two-step requests** — "Get your shoes and bring them here"
- **Naming a body part** when asked

We'll flag any of these the moment you note them.`;
  return (
    <div style={{ maxWidth: 460, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <MarkdownBlock text={text} />
    </div>
  );
}
