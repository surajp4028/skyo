"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errMsg, ClientApiError } from "@/lib/client/api";

/** Small data hook for admin tables. Redirects to agent login when the session expires. */
export function useFetch<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({ url: null, data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    const c = new AbortController();
    api<T>(url, { signal: c.signal })
      .then((data) => setState({ url, data, error: null }))
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        if (e instanceof ClientApiError && e.status === 401) {
          window.location.replace("/login?as=agent");
          return;
        }
        setState((s) => ({ url, data: s.data, error: errMsg(e) }));
      });
    return () => c.abort();
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, error: state.error, loading: !!url && state.url !== url, reload };
}
