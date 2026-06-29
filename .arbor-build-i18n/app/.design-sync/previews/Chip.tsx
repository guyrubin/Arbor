import { Chip } from "arbor-private-beta-app";
import { TrendingUp, Heart, Sparkles, MessageCircle, Footprints, Moon } from "lucide-react";

export function Tones() {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Chip tone="mint">Language ↑</Chip>
      <Chip tone="coral">New skill</Chip>
      <Chip tone="lav">Motor steady</Chip>
      <Chip tone="yellow">Worth a look</Chip>
      <Chip tone="pink">Big feelings</Chip>
      <Chip tone="sky">Sleep improving</Chip>
    </div>
  );
}

export function WithIcons() {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Chip tone="mint" icon={<TrendingUp size={12} />}>On track · 22 mo</Chip>
      <Chip tone="coral" icon={<Sparkles size={12} />}>Pretend play</Chip>
      <Chip tone="lav" icon={<MessageCircle size={12} />}>Two-word phrases</Chip>
      <Chip tone="pink" icon={<Heart size={12} />}>Saved memory</Chip>
    </div>
  );
}

export function Milestones() {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Chip tone="sky" icon={<Footprints size={12} />}>First steps</Chip>
      <Chip tone="mint" icon={<MessageCircle size={12} />}>Says 10+ words</Chip>
      <Chip tone="yellow" icon={<Moon size={12} />}>Self-settles</Chip>
    </div>
  );
}
