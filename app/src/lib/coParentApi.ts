import { authHeaders } from "./api";
import type { ShareGrant } from "../types";
import type { CoParentWorkspace } from "../sharing/coParentTypes";

export class CoParentError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/co-parent/${path}`, { method: body === undefined ? "GET" : "POST", headers: await authHeaders(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new CoParentError(response.status, result.error ?? "unavailable");
  }
  return response.json() as Promise<T>;
}
export const coParentApi = {
  invite: (childId: string, childName: string, recipientEmail: string) => request<ShareGrant>("invitations", { childId, childName, recipientEmail }),
  invitations: () => request<{ shares: ShareGrant[] }>("invitations"),
  accept: (id: string) => request<ShareGrant>(`${encodeURIComponent(id)}/accept`, {}),
  workspace: (id: string) => request<CoParentWorkspace>(`${encodeURIComponent(id)}/workspace`),
  note: (id: string, text: string, requestId: string) => request<{ saved: true }>(`${encodeURIComponent(id)}/workspace/moments`, { text, requestId }),
  complete: (id: string, activityId: string) => request<{ saved: true }>(`${encodeURIComponent(id)}/workspace/complete`, { activityId }),
};
export const coParentLink = (id: string) => `${window.location.origin}/?join=${encodeURIComponent(id)}`;
