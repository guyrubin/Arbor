import { useAuth } from '../../../context/AuthContext';
import { useChildCollection } from '../../../hooks/useChildCollection';
import { CORNER_OBJECTS, type CornerLayout } from './games/gameRules';
import type { NoteId } from './games/adventures/adventureRules';

export type StudioCreation =
  | { kind: 'corner'; layout: CornerLayout; light: 'day' | 'evening' | 'night'; scene: 'treehouse' | 'garden' | 'sky' }
  | { kind: 'melody'; notes: NoteId[]; tempo: number };
export interface SavedStudioCreation { id: string; ownerId: string; childId: string; creation: StudioCreation }
/** Only bounded toy choices are saved. No portrait, photo, feeling, recording,
 * free text, ability score or interaction history is part of this contract. */
export function validStudioCreation(value: unknown): value is StudioCreation {
  if (!value || typeof value !== 'object') return false;
  const v = value as StudioCreation;
  if (v.kind === 'melody') return Array.isArray(v.notes) && v.notes.length > 0 && v.notes.length <= 8 && v.notes.every(n => [0, 1, 2].includes(n)) && [500, 760, 1000].includes(v.tempo);
  if (v.kind !== 'corner' || !['day', 'evening', 'night'].includes(v.light) || !['treehouse', 'garden', 'sky'].includes(v.scene) || !Array.isArray(v.layout) || v.layout.length !== 6) return false;
  const objects = v.layout.filter(v => v !== null);
  return objects.length > 0 && new Set(objects).size === objects.length && objects.every(v => CORNER_OBJECTS.includes(v));
}
export function creationForScope(row: SavedStudioCreation, ownerId: string, childId: string): boolean {
  return row?.ownerId === ownerId && row.childId === childId && row.id === row.creation?.kind && validStudioCreation(row.creation);
}
export function useStudioCreations(childId: string) {
  const { user } = useAuth();
  const ownerId = user?.uid ?? 'local';
  const store = useChildCollection<SavedStudioCreation>(childId, 'studioCreations');
  const items = store.items.filter(item => creationForScope(item, ownerId, childId));
  return {
    items, loaded: store.loaded, error: store.error, isCurrent: store.isCurrent,
    async save(creation: StudioCreation) {
      if (!validStudioCreation(creation) || !store.loaded || store.error || !store.isCurrent()) throw new Error('Creation is not ready to save');
      const clean: StudioCreation = creation.kind === 'melody'
        ? { kind: 'melody', notes: [...creation.notes], tempo: creation.tempo }
        : { kind: 'corner', layout: [...creation.layout], light: creation.light, scene: creation.scene };
      await store.upsert({ id: clean.kind, ownerId, childId, creation: clean });
    },
  };
}
