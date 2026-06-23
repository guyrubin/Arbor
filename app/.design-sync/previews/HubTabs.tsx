import { HubTabs, SectionCard, Chip } from "arbor-private-beta-app";
import { Sprout, MessageCircleHeart, ClipboardList, Calendar, BookHeart } from "lucide-react";

function MilestonesPanel() {
  return (
    <SectionCard title="On the horizon" tone="mint" icon={<Sprout size={18} />}>
      <p style={{ color: "var(--arbor-muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        Mia is combining two words and pointing to name objects — right on track for 22 months.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Chip tone="mint">Language ↑</Chip>
        <Chip tone="lav">Motor steady</Chip>
        <Chip tone="coral">New: pretend play</Chip>
      </div>
    </SectionCard>
  );
}

function PracticePanel() {
  return (
    <SectionCard title="This week's practice" tone="lav" icon={<ClipboardList size={18} />}>
      <p style={{ color: "var(--arbor-muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        Narrate as you go and pause after questions — small invitations for Mia to fill the gap.
      </p>
    </SectionCard>
  );
}

function ConsultPanel() {
  return (
    <SectionCard title="Ask Arbor" tone="sky" icon={<MessageCircleHeart size={18} />}>
      <p style={{ color: "var(--arbor-muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        "Is it normal for her to cling more at drop-off lately?" — get a calm, clinically-grounded answer.
      </p>
    </SectionCard>
  );
}

export function DevelopmentHub() {
  return (
    <div style={{ maxWidth: 520, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <HubTabs
        ariaLabel="Development facets"
        panels={[
          { id: "milestones", label: "Milestones", icon: Sprout, Comp: MilestonesPanel },
          { id: "practice", label: "Practice", icon: ClipboardList, Comp: PracticePanel },
          { id: "consult", label: "Consult", icon: MessageCircleHeart, Comp: ConsultPanel },
        ]}
      />
    </div>
  );
}

function TimelinePanel() {
  return (
    <SectionCard title="Recent moments" tone="coral" icon={<BookHeart size={18} />}>
      <p style={{ color: "var(--arbor-muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        "Said 'love you Dada' unprompted at bedtime." Captured 2 days ago.
      </p>
    </SectionCard>
  );
}

function UpcomingPanel() {
  return (
    <SectionCard title="Coming up" tone="yellow" icon={<Calendar size={18} />}>
      <p style={{ color: "var(--arbor-muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        18-month well-visit in 3 weeks — we'll prep a question list from what you've logged.
      </p>
    </SectionCard>
  );
}

export function MemoryHub() {
  return (
    <div style={{ maxWidth: 520, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <HubTabs
        ariaLabel="Memory facets"
        panels={[
          { id: "timeline", label: "Timeline", icon: BookHeart, Comp: TimelinePanel },
          { id: "upcoming", label: "Upcoming", icon: Calendar, Comp: UpcomingPanel },
        ]}
      />
    </div>
  );
}
