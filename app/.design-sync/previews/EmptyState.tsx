import { EmptyState, Button } from "arbor-private-beta-app";
import { Sprout, Plus } from "lucide-react";

export function Default() {
  return (
    <div style={{ maxWidth: 460, background: "var(--arbor-paper-elevated)", borderRadius: 24, boxShadow: "0 10px 30px rgba(41,51,63,0.06)" }}>
      <EmptyState
        icon={<Sprout size={40} />}
        headline="No observations yet"
        body="Jot down a moment from today — a new word, a wobbly step, a big feeling. Arbor turns small notes into a growth story."
        action={
          <Button variant="primary">
            <Plus size={16} /> Add first note
          </Button>
        }
      />
    </div>
  );
}

export function Minimal() {
  return (
    <div style={{ maxWidth: 460, background: "var(--arbor-paper-elevated)", borderRadius: 24, boxShadow: "0 10px 30px rgba(41,51,63,0.06)" }}>
      <EmptyState headline="All caught up" body="No new milestones to review. We'll nudge you when there's something worth a look." />
    </div>
  );
}
