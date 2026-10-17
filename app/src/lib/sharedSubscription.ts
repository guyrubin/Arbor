/** Reference-counted read sharing. No data survives the last subscriber and
 * late callbacks from a retired transport cannot repopulate a new lifetime. */
export function createSharedSubscription<T>() {
  type Entry = { listeners: Set<(value: T) => void>; hasValue: boolean; value?: T; stop?: () => void };
  const entries = new Map<string, Entry>();
  return (key: string, start: (emit: (value: T) => void) => () => void, listener: (value: T) => void): (() => void) => {
    // Each subscription is a distinct lease, even when callbacks are reused.
    const notifyListener = (value: T) => listener(value);
    let entry = entries.get(key);
    if (!entry) {
      entry = { listeners: new Set(), hasValue: false };
      entries.set(key, entry);
      entry.listeners.add(notifyListener);
      const current = entry;
      try {
        current.stop = start(value => {
          if (entries.get(key) !== current) return;
          current.hasValue = true; current.value = value;
          for (const notify of [...current.listeners]) {
            if (current.listeners.has(notify)) notify(value);
          }
        });
      } catch (error) { entries.delete(key); throw error; }
    } else {
      entry.listeners.add(notifyListener);
      if (entry.hasValue) listener(entry.value as T);
    }
    const current = entry;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      current.listeners.delete(notifyListener);
      if (!current.listeners.size && entries.get(key) === current) {
        entries.delete(key);
        current.stop?.();
      }
    };
  };
}
