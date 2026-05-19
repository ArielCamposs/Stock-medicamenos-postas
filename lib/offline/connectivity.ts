const PROBE_URL = "/api/connectivity";
const PROBE_MS = 4_000;
const POLL_MS = 12_000;

type Listener = () => void;

const listeners = new Set<Listener>();

/** null = aún no hay resultado de sondeo en esta sesión */
let serverReachable: boolean | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let probeInFlight = false;
let listenersBound = false;

function emit() {
  for (const fn of listeners) {
    fn();
  }
}

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

function externalProbeUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/auth/v1/health`;
}

async function probeUrl(
  url: string,
  timeoutMs: number,
  sameOrigin: boolean
): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        credentials: sameOrigin ? "same-origin" : "omit",
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

/**
 * Comprueba red real: API de la app y, en localhost, también Supabase
 * (en local el servidor Next sigue respondiendo sin internet WAN).
 */
export async function canReachServer(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!navigator.onLine) return false;

  const localOk = await probeUrl(PROBE_URL, PROBE_MS, true);
  if (!localOk) return false;

  if (isLocalDevHost()) {
    const ext = externalProbeUrl();
    if (ext) return probeUrl(ext, PROBE_MS, false);
  }

  return true;
}

export function markServerUnreachable() {
  if (serverReachable === false) return;
  serverReachable = false;
  emit();
}

export function markServerReachable() {
  if (serverReachable === true) return;
  serverReachable = true;
  emit();
}

export async function runConnectivityProbe(): Promise<boolean> {
  if (typeof window === "undefined") return true;

  if (!navigator.onLine) {
    markServerUnreachable();
    return false;
  }

  if (probeInFlight) {
    return serverReachable ?? navigator.onLine;
  }

  probeInFlight = true;
  try {
    const ok = await canReachServer();
    if (ok) {
      markServerReachable();
    } else {
      markServerUnreachable();
    }
    return ok;
  } finally {
    probeInFlight = false;
  }
}

function bindWindowListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  const onOffline = () => markServerUnreachable();
  const onOnline = () => {
    void runConnectivityProbe();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      void runConnectivityProbe();
    }
  };

  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
}

function startPolling() {
  if (pollTimer !== null) return;
  pollTimer = setInterval(() => {
    void runConnectivityProbe();
  }, POLL_MS);
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function subscribeConnectivity(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  bindWindowListeners();
  startPolling();
  void runConnectivityProbe();

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      stopPolling();
    }
  };
}

/** Para el indicador «En línea»: navigator.offline o sondeo fallido al servidor. */
export function getConnectivitySnapshot(): boolean {
  if (typeof navigator === "undefined") return true;
  if (!navigator.onLine) return false;
  if (serverReachable === null) return navigator.onLine;
  return serverReachable;
}

export function getConnectivityServerSnapshot(): boolean {
  return true;
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
