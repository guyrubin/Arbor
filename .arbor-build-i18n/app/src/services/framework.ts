import { readFileSync } from "fs";
import path from "path";

export type FrameworkDefinition = {
  domains: {
    id: string;
    label: string;
    tracks: string;
    guidanceOutput: string;
    safetyBoundary: string;
    milestoneAliases: string[];
  }[];
  ageBands: { id: string; label: string; coreTask: string; productBehavior: string }[];
  sixFrames: { id: string; label: string; description: string }[];
};

export const loadFramework = () => {
  const frameworkPath = path.join(process.cwd(), "src", "framework.json");
  return JSON.parse(readFileSync(frameworkPath, "utf8")) as FrameworkDefinition;
};

export const buildDevelopmentalFrameworkPrompt = (framework: FrameworkDefinition) => `
DEVELOPMENTAL FRAMEWORK:
- Domains:
${framework.domains.map((domain) => `  * ${domain.id} (${domain.label}): tracks ${domain.tracks}; outputs ${domain.guidanceOutput}; boundary ${domain.safetyBoundary}.`).join("\n")}
- Age bands:
${framework.ageBands.map((band) => `  * ${band.id} (${band.label}): ${band.coreTask}; product behavior ${band.productBehavior}.`).join("\n")}
- Six Frames:
${framework.sixFrames.map((frame) => `  * ${frame.label}: ${frame.description}.`).join("\n")}
- AI pipeline: classify intent/domain, safety triage, non-diagnostic hypotheses, same-day plan, parent script, observation target, memory proposal, audience handoff.
- Return domain ids exactly as listed above, not display labels or milestone aliases.
`;
