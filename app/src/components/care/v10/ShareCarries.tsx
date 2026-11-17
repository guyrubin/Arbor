import React from "react";
import { Fig } from "../../../design/primitives";
import { Icon } from "../../ui/Icon";
import { WEEK_SHARE_SCOPES } from "../../../lib/shareScopes";
import type { CarePeopleCopy } from "./careV10Copy";

/* Care › People, section 3 (design V77, N-People-D/M): what each kind of share
   carries — the week share (exactly WEEK_SHARE_SCOPES, read only, until you
   stop it) and a custom share (one person, the scopes you tick, the
   durations and roles the wizard offers). Words only about the grants
   production makes; nothing about the child. */

export default function ShareCarries({ name, copy, durations, roles }: {
  name: string;
  copy: CarePeopleCopy;
  /** The wizard's duration choices, in the reader's words. */
  durations: string[];
  /** The wizard's role choices, in the reader's words. */
  roles: string[];
}) {
  return (
    <div className="care-carries" data-testid="people-carries">
      <section className="vt care-carry" aria-labelledby="people-carry-week">
        <h3 id="people-carry-week" className="h3">{copy.carryWeekTitle(name)}</h3>
        <Fig n={WEEK_SHARE_SCOPES.length} size="md" unit={copy.carryWeekUnit} sub={copy.carryWeekSub} />
        <ul className="care-carry-list">
          <li><Icon name="visibility" size={18} /> {copy.carryReadsWeekly}</li>
          <li><Icon name="visibility" size={18} /> {copy.carryReadsStory}</li>
          <li><Icon name="lock" size={18} /> {copy.carryReadOnly}</li>
        </ul>
        <p className="small">{copy.carryYouSend}</p>
      </section>
      <section className="vt care-carry" aria-labelledby="people-carry-custom">
        <h3 id="people-carry-custom" className="h3">{copy.carryCustomTitle}</h3>
        <Fig n={1} size="md" unit={copy.carryCustomUnit} sub={copy.carryCustomSub} />
        <ul className="care-carry-list">
          <li><Icon name="visibility" size={18} /> {copy.carrySeesTicked}</li>
          <li><Icon name="calendar_month" size={18} /> <span className="care-carry-tags">{durations.map((d) => <span key={d} className="tagc">{d}</span>)}</span></li>
          <li><Icon name="person" size={18} /> {roles.join(" · ")}</li>
        </ul>
      </section>
    </div>
  );
}
