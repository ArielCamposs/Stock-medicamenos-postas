import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export type MiddlewareSessionResult = {
  response: NextResponse;
  user: User | null;
};

/**
 * Actualiza/refresca la sesión JWT en middleware.
 * Llama también a getUser para forzar refresco ante expiración próxima.
 */
export async function updateSession(request: NextRequest): Promise<MiddlewareSessionResult> {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}
