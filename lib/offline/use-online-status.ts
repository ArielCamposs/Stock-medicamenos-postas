"use client";

import { useSyncExternalStore } from "react";

import {
  getConnectivityServerSnapshot,
  getConnectivitySnapshot,
  subscribeConnectivity,
} from "@/lib/offline/connectivity";

/**
 * Estado de red para la UI: `navigator.onLine` + sondeo al servidor
 * (detecta WiFi sin internet; en localhost también prueba Supabase).
 */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeConnectivity,
    getConnectivitySnapshot,
    getConnectivityServerSnapshot
  );
}
