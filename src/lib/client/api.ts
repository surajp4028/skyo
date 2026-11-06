"use client";

export type ApiErrorShape = { code: string; message: string; field?: string; retryAfter?: number; attemptsLeft?: number };
export class ClientApiError extends Error {
  constructor(public status: number, public info: ApiErrorShape) {
    super(info.message);
  }
}

/** Fetch wrapper: same-origin cookies + anti-CSRF header + typed errors. */
export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: { "X-Requested-With": "skyo", ...(opts.body ? { "Content-Type": "application/json" } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  });
  let json: { ok?: boolean; error?: ApiErrorShape } & Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {}
  if (!res.ok || json.ok === false) {
    throw new ClientApiError(res.status, json.error || { code: "NETWORK", message: "Network error. Please try again." });
  }
  return json as T;
}

export const errMsg = (e: unknown) => (e instanceof ClientApiError ? e.info.message : "Something went wrong. Please try again.");
