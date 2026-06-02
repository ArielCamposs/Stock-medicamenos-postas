import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

/** Refresca la sesión JWT en cookies (uso interno del SessionKeeper). */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
