import type { CSSProperties } from "react";
import { ChoiceTile } from "arbor-private-beta-app";

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 12,
  maxWidth: 360,
};

export function Idle() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <div style={grid}>
        <ChoiceTile emoji="🐄" label="Cow" />
        <ChoiceTile emoji="🐈" label="Cat" />
        <ChoiceTile emoji="🐶" label="Dog" />
        <ChoiceTile emoji="🐑" label="Sheep" />
      </div>
    </div>
  );
}

export function Answered() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <div style={grid}>
        <ChoiceTile emoji="🐄" label="Cow" state="correct" />
        <ChoiceTile emoji="🐈" label="Cat" state="dim" />
        <ChoiceTile emoji="🐶" label="Dog" state="dim" />
        <ChoiceTile emoji="🐑" label="Sheep" state="dim" />
      </div>
    </div>
  );
}

export function GentleMiss() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <div style={grid}>
        <ChoiceTile emoji="🍎" label="Apple" state="wrong" />
        <ChoiceTile emoji="🍌" label="Banana" />
      </div>
    </div>
  );
}

export function WordsOnly() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <div style={grid}>
        <ChoiceTile label="Happy" state="correct" />
        <ChoiceTile label="Sad" />
      </div>
    </div>
  );
}
