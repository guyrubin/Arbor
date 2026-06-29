import { PlayButton } from "arbor-private-beta-app";
import { Play, Check, RotateCcw, Sparkles } from "lucide-react";

export function Primary() {
  return (
    <PlayButton variant="primary" tone="clay">
      <Play size={18} /> Start the game
    </PlayButton>
  );
}

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <PlayButton variant="primary" tone="lav">
        <Check size={18} /> That's it!
      </PlayButton>
      <PlayButton variant="soft" tone="lav">
        <RotateCcw size={18} /> Try again
      </PlayButton>
      <PlayButton variant="ghost">Skip</PlayButton>
    </div>
  );
}

export function Tones() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <PlayButton variant="soft" tone="clay">Clay</PlayButton>
      <PlayButton variant="soft" tone="sky">Sky</PlayButton>
      <PlayButton variant="soft" tone="yellow">Yellow</PlayButton>
      <PlayButton variant="soft" tone="peach">Peach</PlayButton>
      <PlayButton variant="soft" tone="pink">Pink</PlayButton>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <PlayButton size="md" variant="soft" tone="sky">
        <Sparkles size={16} /> Medium
      </PlayButton>
      <PlayButton size="lg" variant="primary" tone="clay">
        <Sparkles size={18} /> Large
      </PlayButton>
    </div>
  );
}

export function Disabled() {
  return (
    <PlayButton variant="primary" tone="clay" disabled>
      <Check size={18} /> Saving…
    </PlayButton>
  );
}
