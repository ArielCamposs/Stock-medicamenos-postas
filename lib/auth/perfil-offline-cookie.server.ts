import { cookies } from "next/headers";

import {
  PERFIL_OFFLINE_COOKIE,
  parsePerfilOfflineCookieValue,
} from "@/lib/auth/perfil-offline-cookie";
import type { PerfilUsuarioRow } from "@/lib/auth/types";

export async function readPerfilOfflineCookie(): Promise<PerfilUsuarioRow | null> {
  const jar = await cookies();
  const raw = jar.get(PERFIL_OFFLINE_COOKIE)?.value;
  if (!raw) return null;
  return parsePerfilOfflineCookieValue(raw);
}
