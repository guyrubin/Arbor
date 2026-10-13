import React from "react";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useKidSouvenirs } from "../rewards/useKidSouvenirs";
import { souvenirStrip } from "../rewards/kidSouvenirs";
import { KidSouvenirSticker } from "../rewards/KidSouvenir";
import { sneakFreezeFlagOn } from "../kidWorlds";
import { studioActivityFromLegacy, studioActivityFits, type StudioActivityId } from "./studioCatalog";
import { studioCopy } from "./studioCopy";
import { studioCollectionText } from "./studioProgress";

export function StudioCollection({ onActivity, onBooks, onHome }: { onActivity: (id: StudioActivityId) => void; onBooks: () => void; onHome: () => void }) {
  const { childProfile } = useArbor(); const { uiLang } = useLanguage();
  const ledger = useKidSouvenirs(childProfile.id); const copy = studioCollectionText[uiLang];
  const items = souvenirStrip(ledger.items);
  const button: React.CSSProperties = { minHeight: 56, padding: "12px 20px", borderRadius: 18, color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", border: "2px solid var(--comic-ink)" };
  return <section data-studio-collection="" dir={uiLang === "he" ? "rtl" : "ltr"} style={{ maxWidth: 960, margin: "auto", padding: 24, borderRadius: 28, color: "var(--arbor-ink)", background: "var(--arbor-paper)" }}>
    <button type="button" onClick={onHome} style={button}>{copy.home}</button><h1>{copy.title}</h1>
    {!ledger.loaded ? <p role="status">{copy.loading}</p> : !items.length ? <p>{copy.empty}</p> : <ul style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: 16 }}>{items.map(item => {
      const activity = item.kind === "world" ? studioActivityFromLegacy(item.refId) : undefined;
      const available = item.kind === "book" || !!activity && studioActivityFits(activity.id, childProfile, uiLang, undefined, { sneakEnabled: sneakFreezeFlagOn() });
      const title = item.kind === "book" ? copy.book : activity ? studioCopy(uiLang).activities[activity.id].title : copy.unknown;
      const content = <><KidSouvenirSticker kind={item.kind} refId={item.refId} /><span>{title}</span></>;
      return <li key={item.id}>{available ? <button type="button" style={{ ...button, display: "grid", justifyItems: "center", gap: 10 }} onClick={() => { if (!ledger.isCurrent()) return; if (item.kind === "book") onBooks(); else if (activity) onActivity(activity.id); }}>{content}</button> : <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>{content}</div>}</li>;
    })}</ul>}
    <button type="button" onClick={onBooks} style={button}>{copy.books}</button>
  </section>;
}
export default StudioCollection;
