import React from "react";
import AskSpecialist from "../sections/AskSpecialist";

/* Care › Consult — one verb for "get expert input". The former three facets
   (Ask a specialist / AI handoff brief / Find a professional) and the hidden
   handoff door are collapsed into a single linear flow (b3): a parent-redacted
   packet from the child's record with one action bar — Copy / Download /
   Export as PDF / Send to a professional. The flow itself lives in
   AskSpecialist (the warm-handoff spine); reports and the directory fold in as
   actions, not separate doors. Shell already lazy-loads + Suspense-wraps this
   tab, so it renders the spine directly with no HubTabs sub-nav. */

export default function ConsultTab() {
  return <AskSpecialist />;
}
