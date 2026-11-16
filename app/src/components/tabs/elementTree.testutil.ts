import React from "react";

/** Every React element under a node, element first, for tests that render a
 *  component function by hand and inspect what it returned. Walks children
 *  and every other prop that holds elements (a slot such as `heading`, or a
 *  plain object of slots such as AskSpecialist's `layout.props` and `parts`),
 *  in prop order, so a part a screen places in its own section is still found. */
export function treeElements(node: unknown, seen: WeakSet<object> = new WeakSet()): React.ReactElement<Record<string, any>>[] {
  if (Array.isArray(node)) return node.flatMap((n) => treeElements(n, seen));
  if (React.isValidElement<Record<string, any>>(node)) {
    const out: React.ReactElement<Record<string, any>>[] = [node];
    for (const [key, value] of Object.entries(node.props)) {
      if (key === "children") out.push(...React.Children.toArray(value as React.ReactNode).flatMap((n) => treeElements(n, seen)));
      else out.push(...treeElements(value, seen));
    }
    return out;
  }
  if (node && typeof node === "object" && Object.getPrototypeOf(node) === Object.prototype && !seen.has(node)) {
    seen.add(node);
    return Object.values(node).flatMap((v) => treeElements(v, seen));
  }
  return [];
}
