import { Spinner, Button } from "arbor-private-beta-app";

export function Default() {
  return (
    <span style={{ color: "var(--arbor-clay)" }}>
      <Spinner />
    </span>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", color: "var(--arbor-clay)" }}>
      <Spinner className="w-4 h-4" />
      <Spinner className="w-6 h-6" />
      <Spinner className="w-8 h-8" />
    </div>
  );
}

export function InlineLoading() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--arbor-muted)", fontSize: 14, fontWeight: 700 }}>
      <span style={{ color: "var(--arbor-clay)" }}>
        <Spinner className="w-4 h-4" />
      </span>
      Reading Mia's notes…
    </div>
  );
}

export function InButton() {
  return (
    <Button variant="primary" disabled>
      <Spinner className="w-4 h-4" /> Saving milestone…
    </Button>
  );
}
