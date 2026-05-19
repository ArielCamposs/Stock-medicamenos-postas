/** Ping liviano para detectar red real (sin caché del SW). */
export async function GET() {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
