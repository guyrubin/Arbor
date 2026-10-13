import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import Icon from "../ui/Icon";
import { TrustLink } from "../trust/TrustLink";
import { NOW_COPY } from "./nowViewCopy";

/**
 * v3 F-NOW-1 r2: the plan card's one body under every lead — its time and
 * size in words, then the always-visible Picked line with How Arbor decides.
 * The family's question is quoted only when the pick was made for it (a
 * library idea matched to its area, or a step chosen under it), never on an
 * AI pick the model made without it. The name and the question are the only
 * isolated runs (Law 8: a bdi takes its own direction; the line keeps the
 * page's). Never a count, a ratio or a verdict about the child.
 */
export default function NowPlanBody({ why, time, size, name, ageText, question }: {
  why: string;
  time?: string | null;
  size?: string | null;
  name?: string;
  ageText?: string;
  question?: string | null;
}) {
  const { t, uiLang } = useLanguage();
  const copy = NOW_COPY[uiLang === "he" ? "he" : "en"];
  return <>
    {(time || size) && <ul className="now-guide-meta">
      {time && <li><Icon name="schedule" size={16} />{time}</li>}
      {size && <li><Icon name="task_alt" size={16} />{size}</li>}
    </ul>}
    <div className="now-picked" data-testid="now-picked-because">
      <Icon name="auto_awesome" size={17} />
      <p><b>{copy.pickedBecause}</b> {question ? <>{copy.pickedQuestion} <bdi>{t("elev.loop.ms.quoted", { text: question })}</bdi> · </> : null}{name && ageText ? <><bdi>{name}</bdi>, {ageText} · </> : null}{why}</p>
      <TrustLink surface="today-focus" />
    </div>
  </>;
}
