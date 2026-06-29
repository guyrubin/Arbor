import { HeroCrest, Avatar } from "arbor-private-beta-app";

const sproutFrame = {
  id: "sprout-frame",
  kind: "frame" as const,
  label: "Sprout",
  emoji: "🌱",
  requirement: "Try your first activity",
};

const bloomFrame = {
  id: "bloom-frame",
  kind: "frame" as const,
  label: "Bloom",
  emoji: "🌸",
  requirement: "Complete 10 activities",
};

const explorerBadge = {
  id: "explorer-badge",
  kind: "badge" as const,
  label: "Explorer",
  emoji: "🧭",
  requirement: "Play across 3 areas in a week",
};

const allrounderBadge = {
  id: "allrounder-badge",
  kind: "badge" as const,
  label: "All-rounder",
  emoji: "🌈",
  requirement: "Play across all 5 areas in a week",
};

const steadyBadge = {
  id: "steady-title",
  kind: "badge" as const,
  label: "Steady",
  emoji: "🪴",
  requirement: "Practice 3 days in a row",
};

export function Earned() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 28, borderRadius: 24, display: "flex", justifyContent: "center" }}>
      <HeroCrest size={104} frame={bloomFrame} badges={[explorerBadge, steadyBadge]}>
        <Avatar name="Mia Levi" size={104} />
      </HeroCrest>
    </div>
  );
}

export function FirstFrame() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 28, borderRadius: 24, display: "flex", justifyContent: "center" }}>
      <HeroCrest size={96} frame={sproutFrame} badges={[]}>
        <Avatar name="Noa Cohen" size={96} />
      </HeroCrest>
    </div>
  );
}

export function FullyDecorated() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 28, borderRadius: 24, display: "flex", justifyContent: "center" }}>
      <HeroCrest size={112} frame={bloomFrame} badges={[explorerBadge, allrounderBadge, steadyBadge]}>
        <Avatar name="Eli Roth" size={112} />
      </HeroCrest>
    </div>
  );
}

export function BareHero() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 28, borderRadius: 24, display: "flex", justifyContent: "center" }}>
      <HeroCrest size={96} frame={null} badges={[]}>
        <Avatar name="Yael Bar" size={96} />
      </HeroCrest>
    </div>
  );
}
