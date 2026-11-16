import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { routeHash } from "../../lib/routes";
import { milestonesV10Copy } from "./milestonesV10Copy";

/**
 * v10.1 — the Map / List switch on My child › Milestones. Two links (the map
 * is #/development, the list is #/milestones); the current one is marked for
 * assistive tech. Same words on desk and phone.
 */
export default function MilestonesViewSwitch({ current }: { current: "development" | "milestones" }) {
  const { uiLang } = useLanguage();
  const copy = milestonesV10Copy(uiLang);
  const link = (route: "development" | "milestones", label: string) => (
    <a className={current === route ? "on" : undefined} href={`#${routeHash(route)}`} aria-current={current === route ? "page" : undefined} data-testid={`ms-view-${route}`}>
      {label}
    </a>
  );
  return (
    <nav className="vseg" aria-label={copy.viewLabel}>
      {link("development", copy.map)}
      {link("milestones", copy.list)}
    </nav>
  );
}
