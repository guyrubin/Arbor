/** A callback belongs to one open capture and one request in that capture.
 * Closing, changing child, or starting a replacement request retires it. */
export function createCaptureSession() {
  let generation = 0;
  let scope = "";
  let active = false;
  const requests = new Map<string, number>();
  const invalidate = () => { generation++; requests.clear(); };
  return {
    sync(childId: string, open: boolean) {
      if (scope !== childId || active !== open) invalidate();
      scope = childId;
      active = open;
    },
    invalidate,
    retire(channel: string) { requests.set(channel, (requests.get(channel) ?? 0) + 1); },
    lease(channel: string) {
      const epoch = generation;
      const request = (requests.get(channel) ?? 0) + 1;
      requests.set(channel, request);
      return () => active && generation === epoch && requests.get(channel) === request;
    },
  };
}
