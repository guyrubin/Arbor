import React from "react";
import { Token, TokenLegend, type TokenState } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import type { ShareGrant } from "../../../types";
import { Icon } from "../../ui/Icon";
import type { CarePeopleCopy } from "./careV10Copy";

/* Care › People (design V77, N-People-D/M): who sees what. One lane per
   adult — you first, then every live share the family holds — and one
   column per thing a share can carry. Solid = sees it now; outline =
   invited, not joined yet; dashed = would see it once you invite. Built from
   the existing share grants (no new storage); nothing here is about the
   child, only about the adults the parent chose. */

export const LANE_COLUMNS = ["activity", "moments", "week", "custom", "visit"] as const;
export type LaneColumn = (typeof LANE_COLUMNS)[number];
export type LaneCell = "see" | "open" | "none" | null;

export type Lane = {
  id: string;
  kind: "you" | "grant" | "placeholder";
  /** An email for a grant (its own direction), copy for you and placeholders. */
  name: string;
  sub: string;
  cells: Record<LaneColumn, LaneCell>;
};

const WEEK = new Set(["weekly_insight", "story_timeline"]);
const CUSTOM = new Set(["behavior_patterns", "milestones", "home-program-adherence"]);

/** What one grant carries, by column. */
export function grantColumns(g: Pick<ShareGrant, "scopes" | "accessMode">): Set<LaneColumn> {
  const cols = new Set<LaneColumn>();
  if (g.accessMode === "family_workspace") {
    cols.add("activity");
    cols.add("moments");
  }
  for (const raw of g.scopes ?? []) {
    const s = (raw ?? "").trim();
    if (WEEK.has(s)) cols.add("week");
    else if (s.startsWith("report_")) cols.add("visit");
    else if (CUSTOM.has(s)) cols.add("custom");
  }
  return cols;
}

const empty = (): Record<LaneColumn, LaneCell> => ({ activity: null, moments: null, week: null, custom: null, visit: null });

export function peopleLanes(liveGrants: readonly ShareGrant[], copy: CarePeopleCopy, roleLabel: (g: ShareGrant) => string): Lane[] {
  const lanes: Lane[] = [
    { id: "you", kind: "you", name: copy.you, sub: copy.youSees, cells: { activity: "see", moments: "see", week: "see", custom: "see", visit: "see" } },
  ];
  const sorted = [...liveGrants].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const carried = new Set<LaneColumn>();
  for (const g of sorted) {
    const cols = grantColumns(g);
    cols.forEach((c) => carried.add(c));
    // A family-workspace invite is joined once accepted; a read share is in effect from the day it was made.
    const waiting = g.accessMode === "family_workspace" && !g.acceptedAt;
    const cells = empty();
    cols.forEach((c) => { cells[c] = waiting ? "open" : "see"; });
    const status = g.accessMode === "family_workspace" ? (waiting ? copy.invited : copy.joined) : null;
    lanes.push({ id: g.id, kind: "grant", name: g.recipientEmail, sub: [roleLabel(g), status].filter(Boolean).join(" · "), cells });
  }
  if (!carried.has("week")) {
    lanes.push({ id: "placeholder-week", kind: "placeholder", name: copy.weekNobody, sub: copy.notInvited, cells: { ...empty(), week: "none" } });
  }
  if (!carried.has("visit")) {
    lanes.push({ id: "placeholder-visit", kind: "placeholder", name: copy.careTeam, sub: copy.careTeamSub, cells: { ...empty(), visit: "none" } });
  }
  return lanes;
}

const STATE: Record<Exclude<LaneCell, null>, TokenState> = { see: "solid", open: "open", none: "none" };

function SeeMark({ cell, copy, size }: { cell: Exclude<LaneCell, null>; copy: CarePeopleCopy; size: "sm" | "lg" }) {
  const label = cell === "see" ? copy.seesNow : cell === "open" ? copy.invited : copy.wouldSee;
  return (
    <Token kind="neutral" state={STATE[cell]} size={size} label={label} className="see">
      <Icon name="visibility" size={size === "lg" ? 22 : 14} />
    </Token>
  );
}

function Who({ lane }: { lane: Lane }) {
  return (
    <span className="care-lane-who">
      {lane.kind === "placeholder"
        ? <span className="avq" aria-hidden="true"><Icon name="person" size={18} /></span>
        : lane.kind === "you"
          ? <span className="av" aria-hidden="true"><Icon name="person" size={18} /></span>
          : <span className="av" aria-hidden="true">{lane.name.trim().charAt(0).toUpperCase()}</span>}
      <span className="care-lane-name">
        {lane.kind === "grant" ? <bdi dir="ltr">{lane.name}</bdi> : lane.name}
        {lane.sub && <small>{lane.sub}</small>}
      </span>
    </span>
  );
}

export default function PeopleLanes({ composition, lanes, copy, childName }: {
  composition: Composition;
  lanes: Lane[];
  copy: CarePeopleCopy;
  childName: string;
}) {
  const desk = composition === "desk";
  const legend = (
    <TokenLegend
      className="care-lanes-legend"
      items={[
        { token: <SeeMark cell="see" copy={copy} size="sm" />, label: copy.seesNow },
        { token: <SeeMark cell="open" copy={copy} size="sm" />, label: copy.invited },
        { token: <SeeMark cell="none" copy={copy} size="sm" />, label: copy.wouldSee },
      ]}
    />
  );
  if (desk) {
    return (
      <div className="care-lanes" data-testid="people-lanes">
        <table className="care-lanes-table">
          <caption className="sr-only">{copy.lanesLabel(childName)}</caption>
          <thead>
            <tr>
              <td />
              {LANE_COLUMNS.map((c) => (
                <th key={c} scope="col">{copy.col[c].title}<small>{copy.col[c].sub}</small></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lanes.map((lane) => (
              <tr key={lane.id} data-testid="people-lane" data-lane={lane.kind} className={lane.kind === "you" ? "me" : undefined}>
                <th scope="row"><Who lane={lane} /></th>
                {LANE_COLUMNS.map((c) => {
                  const cell = lane.cells[c];
                  return <td key={c} data-col={c} data-cell={cell ?? ""}>{cell ? <SeeMark cell={cell} copy={copy} size="lg" /> : null}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {legend}
      </div>
    );
  }
  return (
    <div className="care-lanes" data-testid="people-lanes">
      <ul className="care-lanes-list" aria-label={copy.lanesLabel(childName)}>
        {lanes.map((lane) => (
          <li key={lane.id} data-testid="people-lane" data-lane={lane.kind} className="care-lane-row">
            <Who lane={lane.kind === "you" ? { ...lane, sub: "" } : lane} />
            <span className="care-lane-chips">
              {LANE_COLUMNS.filter((c) => lane.kind !== "you" && lane.cells[c]).map((c) => (
                <span key={c} className="care-lane-chip" data-col={c} data-cell={lane.cells[c] ?? ""}>
                  <SeeMark cell={lane.cells[c]!} copy={copy} size="sm" />
                  {copy.col[c].title}
                </span>
              ))}
              {lane.kind === "you" && (
                <span className="care-lane-chip" data-col="all" data-cell="see"><SeeMark cell="see" copy={copy} size="sm" />{copy.youSees}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {legend}
    </div>
  );
}
