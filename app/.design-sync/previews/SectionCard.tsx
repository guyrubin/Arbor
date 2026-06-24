import { SectionCard, Chip, Button } from "arbor-private-beta-app";
import { Sprout, ArrowRight, Heart } from "lucide-react";

export function Default() {
  return (
    <div style={{ maxWidth: 520, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <SectionCard
        title="This week's growth"
        tone="mint"
        icon={<Sprout size={18} />}
        action={
          <Button variant="ghost" size="sm">
            View all <ArrowRight size={14} />
          </Button>
        }
      >
        <p style={{ color: "var(--arbor-muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Mia is forming two-word phrases and pointing to name objects — right on track for 22 months.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Chip tone="mint">Language ↑</Chip>
          <Chip tone="lav">Motor steady</Chip>
          <Chip tone="coral">New: pretend play</Chip>
        </div>
      </SectionCard>
    </div>
  );
}

export function WarmTone() {
  return (
    <div style={{ maxWidth: 520, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <SectionCard title="A moment to savor" tone="coral" icon={<Heart size={18} />}>
        <p style={{ color: "var(--arbor-muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          "Said 'love you Dada' unprompted at bedtime." Captured 2 days ago — your most-revisited memory this month.
        </p>
      </SectionCard>
    </div>
  );
}
