import React from "react";
// AP-059: Weekly missions calendar strip — rendered at the TOP of the
// child-facing Learning Studio, above the arcade. Reads existing
// missionRecords; no new write path.
import WeeklyMissionsStrip from "./WeeklyMissionsStrip";
import HeroArcade from "./HeroArcade";

/* Grow › Practice — the Hero Arcade. The child's hero picks a themed "world"
   (each a skill drill); the world opens the existing game tab as its panel.
   Replaces the flat HubTabs strip with the comic-book arcade home.
   AP-059 weekly missions strip is preserved above the arcade. */

export default function PracticeHubTab() {
  return (
    <div className="space-y-4">
      {/* AP-059: 7-day weekly missions progress strip — DISTINCT from the daily-goal
          ring (this is a weekly cadence layer; the ring shows today's circular
          progress and lives in separate components/overview surfaces). */}
      <WeeklyMissionsStrip />
      <HeroArcade />
    </div>
  );
}
