/**
 * Care Network professional directory (CAP-8). Curated and Arbor-verified — a
 * server-served, filterable list, not a crowdsourced marketplace. Seed data
 * today; the same contract backs a real provider table later.
 */
export type Professional = {
  id: string;
  name: string;
  role: string;
  creds: string;
  langs: string;
  city: string;
  mode: string;
  ages: string;
  approach: string;
  handles: string;
  price: string;
  rating: number;
  verified: boolean;
  tone: string;
};

export const ARBOR_PROFESSIONALS: Professional[] = [
  { id: "p1", name: "Dr. Maya Levi", role: "Child Psychologist", creds: "PhD, Clinical Psychology", langs: "Hebrew · English", city: "Tel Aviv · Online", mode: "Online & in-person", ages: "3–10", approach: "Warm, attachment-informed, practical", handles: "Transition anxiety, emotional regulation", price: "₪₪₪", rating: 4.9, verified: true, tone: "sky" },
  { id: "p2", name: "Noa Ben-David", role: "Speech & Language Therapist", creds: "MA, CCC-SLP", langs: "Hebrew · English · Arabic", city: "Remote", mode: "Online", ages: "2–8", approach: "Play-based, bilingual focus", handles: "Bilingual transition, expressive language", price: "₪₪", rating: 4.8, verified: true, tone: "mint" },
  { id: "p3", name: "Dr. Amir Cohen", role: "Pediatrician", creds: "MD, Developmental-Behavioral", langs: "Hebrew · English", city: "Herzliya", mode: "In-person", ages: "0–12", approach: "Evidence-first, calm, parent-partnering", handles: "Developmental screening, sleep, milestones", price: "₪₪₪", rating: 5.0, verified: true, tone: "coral" },
  { id: "p4", name: "Tamar Shapiro", role: "Occupational Therapist", creds: "MSc, Pediatric OT", langs: "Hebrew · English", city: "Ramat Gan", mode: "In-person", ages: "2–10", approach: "Sensory-integration, regulation-first", handles: "Sensory sensitivity, motor skills, self-care", price: "₪₪", rating: 4.7, verified: true, tone: "lav" },
  { id: "p5", name: "Daniel Roth", role: "Parenting Coach", creds: "Certified Parent Educator", langs: "Hebrew · English · Russian", city: "Online", mode: "Online", ages: "1–12", approach: "Boundaries with warmth, script-based", handles: "Defiance, screen-time, routines", price: "₪", rating: 4.6, verified: true, tone: "yellow" },
  { id: "p6", name: "Dr. Lena Adler", role: "Autism / ADHD Specialist", creds: "PhD, Neurodevelopment", langs: "English · German", city: "Online", mode: "Online", ages: "3–12", approach: "Strengths-based, non-deficit framing", handles: "Attention, focus, neurodivergent support", price: "₪₪₪", rating: 4.9, verified: true, tone: "pink" },
];

export type ProfessionalQuery = { specialty?: string; language?: string; mode?: string; q?: string };

export function filterProfessionals(list: Professional[], query: ProfessionalQuery): Professional[] {
  let out = list;
  if (query.specialty) out = out.filter((p) => p.role.toLowerCase().includes(query.specialty!.toLowerCase()));
  if (query.language) out = out.filter((p) => p.langs.toLowerCase().includes(query.language!.toLowerCase()));
  if (query.mode) out = out.filter((p) => p.mode.toLowerCase().includes(query.mode!.toLowerCase()));
  if (query.q) {
    const term = query.q.toLowerCase();
    out = out.filter((p) => `${p.name} ${p.role} ${p.handles} ${p.approach}`.toLowerCase().includes(term));
  }
  return out;
}
