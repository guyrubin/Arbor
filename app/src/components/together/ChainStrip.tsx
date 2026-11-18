import React from "react";
import { Icon } from "../ui/Icon";
import type { Composition } from "../../design/useComposition";

/**
 * The chain strip that opens each Together tab: what you noted or your focus,
 * then what Arbor suggests, then what the child plays or hears, then what comes
 * back. Each node is bound to real data by the screen; a node without data is
 * simply not passed (the handback and routine-to-story matching are not built
 * yet, so the strip never invents them). Fewer than two nodes: no strip.
 */
export type ChainNode = {
  kind: "you" | "arbor" | "kid" | "back";
  tag: React.ReactNode;
  text: React.ReactNode;
  sub?: React.ReactNode;
  link?: React.ReactNode;
  /** The text is the parent's own words (rendered in the editorial face). */
  said?: boolean;
};

function Arrow() {
  return (
    <span className="chn-a" aria-hidden="true">
      <svg viewBox="0 0 18 12">
        <path d="M1 6h14M11 1.5L16 6l-5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function ChainStrip({ nodes, label, composition, line = false }: {
  nodes: ChainNode[];
  label: string;
  composition: Composition;
  /** Compact form (short viewports): the same links in one wrapping line. */
  line?: boolean;
}) {
  if (nodes.length < 2) return null;
  if (line) {
    return (
      <section className="chn-line" aria-label={label} data-testid="together-chain" data-compact="true">
        {nodes.map((node, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icon name="arrow_forward" size={15} className="chn-line-a rtl:-scale-x-100" />}
            <span className={`chn-li ${node.kind}`} data-chain={node.kind}>
              <span className="chn-tag">{node.kind === "arbor" && <Icon name="edit" size={12} />}{node.tag}</span>
              <span className={node.said ? "chn-tx ds-said" : "chn-tx"} dir="auto">{node.text}</span>
              {node.sub != null && <span className="chn-sub">· {node.sub}</span>}
              {node.link}
            </span>
          </React.Fragment>
        ))}
      </section>
    );
  }
  const phone = composition === "phone";
  // On a phone the last "back" node takes its own row under the others.
  const inRow = phone && nodes[nodes.length - 1].kind === "back" ? nodes.slice(0, -1) : nodes;
  const columns = inRow.map(() => "minmax(0,1fr)").join(phone ? " 12px " : " 22px ");
  return (
    <section className={phone ? "chn m" : "chn"} aria-label={label} data-testid="together-chain">
      <div className="chn-row" style={{ gridTemplateColumns: columns }}>
        {nodes.map((node, i) => (
          <React.Fragment key={i}>
            {i > 0 && i < inRow.length && <Arrow />}
            <div className={`chn-n ${node.kind}`} data-chain={node.kind}>
              <span className="chn-tag">
                {node.kind === "arbor" && <Icon name="edit" size={12} />}
                {node.tag}
              </span>
              <span className={node.said ? "chn-tx ds-said" : "chn-tx"} dir="auto">{node.text}</span>
              {node.sub != null && <span className="chn-sub">{node.sub}</span>}
              {node.link}
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
