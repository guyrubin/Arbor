import { useCallback, useEffect, useState } from "react";
import { readPushPermission, type PushPermission } from "../lib/pushPriming";

/**
 * B-GROWTH-03 — the push-reminder state that used to live inline in
 * DevelopmentTab (ENG-23), extracted so the card can live where reminders are
 * set (#/smart-reminders). Behaviour unchanged: the card ALWAYS renders and
 * states the truth of this build — `pushCapable()` is false without a VAPID
 * key, and then the card says Arbor sends nothing instead of showing a switch
 * that cannot deliver. lib/push is lazily imported so firebase/messaging never
 * enters the main bundle.
 */
export interface PushPrimingState {
  capable: boolean;
  permission: PushPermission;
  registered: boolean;
  pending: boolean;
  onToggle: () => Promise<void>;
}

export function usePushPriming(): PushPrimingState {
  const [capable, setCapable] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [registered, setRegistered] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPermission(readPushPermission());
    let alive = true;
    void import("../lib/push.js").then(({ pushCapable }) => {
      if (!alive) return;
      const ok = pushCapable();
      setCapable(ok);
      setRegistered(ok && readPushPermission() === "granted");
    });
    return () => { alive = false; };
  }, []);

  const onToggle = useCallback(async () => {
    const { pushCapable, registerPush, unregisterPush } = await import("../lib/push.js");
    if (!pushCapable()) return;
    const apiBase = (window as unknown as { __ARBOR_API_BASE__?: string }).__ARBOR_API_BASE__ || "/api";
    setPending(true);
    try {
      if (registered) {
        await unregisterPush(apiBase);
        setRegistered(false);
      } else {
        const result = await registerPush(apiBase);
        setRegistered(result === "granted");
      }
      setPermission(readPushPermission());
    } finally {
      setPending(false);
    }
  }, [registered]);

  return { capable, permission, registered, pending, onToggle };
}
