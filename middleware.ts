import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";

function siguienteRutaSeguraParaLogin(nextParam: string | undefined) {
  if (
    typeof nextParam !== "string" ||
    !nextParam.startsWith("/") ||
    nextParam.startsWith("//")
  ) {
    return "/";
  }

  return nextParam;
}

export async function middleware(request: NextRequest) {
  if (!hasSupabasePublicEnv()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[supabase] Definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local para refrescar sesión en middleware."
      );
    }

    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  if (pathname === "/login") {
    if (user) {
      // Si hay ?error=… no mandar a /. Sin perfil/posta la app redirige aquí desde `/`;
      // si volvemos a `/` el usuario sigue autenticado y se forma un bucle infinito.
      const errorCode = request.nextUrl.searchParams.get("error");
      if (errorCode) {
        return response;
      }

      const siguiente = siguienteRutaSeguraParaLogin(
        request.nextUrl.searchParams.get("next") ?? undefined
      );

      return NextResponse.redirect(new URL(siguiente, request.url));
    }

    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);

    if (pathname !== "/" && pathname !== "") {
      loginUrl.searchParams.set("next", pathname);
    }

    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
