import React, { useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { keptDay, type KeptThing } from "../../lib/kept/keptThings";
import { SendSheet } from "../share/SendSheet";
import Icon from "../ui/Icon";
import "./kept.css";

export function keptDateLabel(at: string, lang: "en" | "he"): string {
  const day = keptDay(at);
  return day ? new Date(`${day}T12:00:00Z`).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
}

export function keptTextLanguage(language?: string): string {
  const codes: Record<string, string> = { english: "en", hebrew: "he", arabic: "ar", russian: "ru", french: "fr", spanish: "es" };
  const value = (language ?? "").trim().toLowerCase();
  return codes[value] ?? (/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(value) ? value : "und");
}

export const keptItemText = (item: KeptThing, name: string, lang: "en" | "he") =>
  `${keptDateLabel(item.at, lang)} — ${name}: ${item.kind === "said" ? `“${item.text}”` : item.text}`;

const icons: Record<string, string> = { talking: "chat_bubble", moving: "directions_run", hands: "front_hand", thinking: "psychology", playing: "group", feelings: "favorite", body: "spa", family: "diversity_3" };

/** The same paper row for parent-kept words and firsts. Nothing is sent until
 * the parent reviews the existing SendSheet and chooses its destination. */
export default function KeptItem({ item, childName, disabled = false, beforeExport }: { item: KeptThing; childName: string; disabled?: boolean; beforeExport: () => boolean }) {
  const { t, uiLang } = useLanguage();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const lang = uiLang === "he" ? "he" : "en";
  return <article className="kept-item" data-testid="kept-item">
    <time dateTime={keptDay(item.at) ?? item.at}>{keptDateLabel(item.at, lang)}</time>
    <p className="kept-words"><bdi dir="auto" lang={keptTextLanguage(item.language)}>{item.text}</bdi></p>
    <div className="kept-item-footer">
      <p><Icon name={icons[item.area ?? ""] ?? "bookmark"} size={16} />{t("kept.noted")}</p>
      <button type="button" disabled={disabled} className="kept-text-button" data-testid="kept-item-send" onClick={() => { if (beforeExport()) setOpen(true); }}>{t("kept.send")}</button>
    </div>
    {open && !disabled && <SendSheet open onClose={() => setOpen(false)} text={keptItemText(item, childName, lang)} artifact="growth_card" surface="kept_item" beforeSend={beforeExport} />}
  </article>;
}
