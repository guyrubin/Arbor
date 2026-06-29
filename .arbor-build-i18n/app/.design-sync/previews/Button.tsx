import { Button } from "arbor-private-beta-app";
import { Sparkles, ArrowRight, Plus } from "lucide-react";

export function Primary() {
  return <Button variant="primary">Start today's check-in</Button>;
}

export function Secondary() {
  return <Button variant="secondary">Maybe later</Button>;
}

export function Ghost() {
  return <Button variant="ghost">Skip for now</Button>;
}

export function WithIcon() {
  return (
    <Button variant="primary">
      <Sparkles size={16} /> Ask Arbor
    </Button>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Button size="sm" variant="secondary">
        Small
      </Button>
      <Button size="md" variant="primary">
        Medium <ArrowRight size={16} />
      </Button>
    </div>
  );
}

export function Disabled() {
  return (
    <Button variant="primary" disabled>
      <Plus size={16} /> Saving…
    </Button>
  );
}
