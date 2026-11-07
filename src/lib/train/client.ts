"use client";
import { api, ClientApiError } from "@/lib/client/api";

/** Client wrapper for /api/train/* — returns {data, meta} and marks login-required errors. */
export async function trainApi<T>(path: string, params: Record<string, string | number | undefined | null> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  return api<{ data: T; meta: { retrieved_at: string; source: string } }>(`/api/train${path}${qs.size ? `?${qs}` : ""}`);
}

export const needsLogin = (e: unknown) => e instanceof ClientApiError && e.status === 401;
