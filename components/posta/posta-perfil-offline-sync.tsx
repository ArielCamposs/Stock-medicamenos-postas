"use client";

import { useEffect } from "react";

import { perfilOfflineCookieHeader } from "@/lib/auth/perfil-offline-cookie";
import type { PerfilUsuarioRow } from "@/lib/auth/types";

type Props = {
  profile: PerfilUsuarioRow;
};

/** Guarda el perfil en cookie para que el servidor pueda autorizar recargas sin red. */
export function PostaPerfilOfflineSync({ profile }: Props) {
  useEffect(() => {
    try {
      document.cookie = perfilOfflineCookieHeader(profile);
    } catch {
      /* quota / modo privado */
    }
  }, [profile]);

  return null;
}
