import { DevelopmentalDomainId } from "../types";

/** Curated, reputable research references per developmental domain. */
export const DOMAIN_REFERENCES: Record<DevelopmentalDomainId, { label: string; url: string }> = {
  attachment_regulation: {
    label: "ZERO TO THREE — social-emotional",
    url: "https://www.zerotothree.org/resource/social-emotional-development/",
  },
  language_communication: {
    label: "CDC — language milestones",
    url: "https://www.cdc.gov/ncbddd/actearly/milestones/index.html",
  },
  cognition_executive_function: {
    label: "Harvard — executive function",
    url: "https://developingchild.harvard.edu/science/key-concepts/executive-function/",
  },
  social_development: {
    label: "CDC — developmental milestones",
    url: "https://www.cdc.gov/ncbddd/actearly/milestones/index.html",
  },
  independence_adaptive_skills: {
    label: "AAP HealthyChildren — ages & stages",
    url: "https://www.healthychildren.org/English/ages-stages/Pages/default.aspx",
  },
  sensory_motor_patterns: {
    label: "CDC — movement & physical",
    url: "https://www.cdc.gov/ncbddd/actearly/milestones/index.html",
  },
  ecosystem_stressors: {
    label: "Harvard — toxic stress",
    url: "https://developingchild.harvard.edu/science/key-concepts/toxic-stress/",
  },
};
