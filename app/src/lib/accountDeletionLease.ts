/** A pending deletion belongs to an account, not to a mounted dialog. Keep the
 * lease until the request and its local completion steps settle. No auth or
 * deletion work lives here; subscriptions only expose the pending state. */
export function createAccountDeletionLeases() {
  const pending = new Map<string, symbol>();
  const listeners = new Map<string, Set<() => void>>();
  const publish = (uid: string) => { for (const listener of [...listeners.get(uid) ?? []]) listener(); };
  return {
    isPending: (uid: string) => pending.has(uid),
    subscribe(uid: string, listener: () => void) {
      const group = listeners.get(uid) ?? new Set<() => void>();
      listeners.set(uid, group);
      group.add(listener);
      return () => {
        group.delete(listener);
        if (!group.size && listeners.get(uid) === group) listeners.delete(uid);
      };
    },
    acquire(uid: string): { release(): void } | null {
      if (pending.has(uid)) return null;
      const owner = Symbol(uid);
      pending.set(uid, owner);
      publish(uid);
      return {
        release() {
          if (pending.get(uid) !== owner) return;
          pending.delete(uid);
          publish(uid);
        },
      };
    },
  };
}

export const accountDeletionLeases = createAccountDeletionLeases();
