const PROBE_URL = "/api/connectivity";
const PROBE_MS = 4_000;

/** Comprueba si la app responde (solo al sincronizar manualmente). */
export async function canReachServer(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!navigator.onLine) return false;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_MS);
    try {
      const res = await fetch(PROBE_URL, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        signal: ctrl.signal,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 8_000
): Promise<Response> {
  const ctrl = new AbortController();
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) {
      ctrl.abort(outer.reason);
    } else {
      outer.addEventListener("abort", () => ctrl.abort(outer.reason), { once: true });
    }
  }
  const timer = setTimeout(() => ctrl.abort(new DOMException("Timeout", "AbortError")), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function isAbortOrNetwork(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /fetch|network|failed|abort|timeout/i.test(err.message)) {
    return true;
  }
  return false;
}
