import { PageHeader, Button, Chip } from "arbor-private-beta-app";
import { Plus, Share2 } from "lucide-react";

export function Default() {
  return (
    <div style={{ minWidth: 560, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <PageHeader
        title="Mia's growth"
        subtitle="A gentle, non-diagnostic picture of how Mia is developing across speech, motor, and social skills — built from the moments you capture."
      />
    </div>
  );
}

export function WithAction() {
  return (
    <div style={{ minWidth: 560, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <PageHeader
        title="Milestones"
        subtitle="22 months · 14 milestones tracked this quarter"
        action={
          <Button variant="primary">
            <Plus size={16} /> Add observation
          </Button>
        }
      />
    </div>
  );
}

export function ReportHeader() {
  return (
    <div style={{ minWidth: 560, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <PageHeader
        title="This month in review"
        subtitle="June 2026 · A summary you can share with family or bring to your next check-up."
        action={
          <Button variant="secondary" size="sm">
            <Share2 size={14} /> Share
          </Button>
        }
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Chip tone="mint">3 new words</Chip>
        <Chip tone="sky">Climbing stairs</Chip>
        <Chip tone="lav">Shares toys</Chip>
      </div>
    </div>
  );
}
