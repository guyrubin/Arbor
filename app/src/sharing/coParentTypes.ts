/** Deliberately small projection of the existing child's ledgers. */
export interface CoParentWorkspace {
  childId: string;
  childName: string;
  ownerEmail: string | null;
  activity: { id: string; text: string; acceptedAt: string; completedAt: string | null } | null;
  moments: { id: string; text: string; at: string; addedByYou: boolean }[];
}
