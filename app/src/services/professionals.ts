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

// Never expose seed identities as real or Arbor-verified. This remains empty
// until records arrive from the verified provider store.
export const ARBOR_PROFESSIONALS: Professional[] = [];
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
