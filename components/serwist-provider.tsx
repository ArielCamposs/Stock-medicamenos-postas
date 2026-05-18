"use client";

import { SerwistProvider } from "@serwist/next/react";

type Props = { children: React.ReactNode };

/**
 * En desarrollo Serwist no genera `public/sw.js` (ver next.config).
 * Registrar el SW ahí produce 404 en consola.
 */
export function AppSerwistProvider({ children }: Props) {
  if (process.env.NODE_ENV === "development") {
    return children;
  }

  return <SerwistProvider swUrl="/sw.js">{children}</SerwistProvider>;
}
