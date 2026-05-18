/** Errores típicos cuando no hay red o el host de Supabase no responde. */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  const msg =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";

  const lower = msg.toLowerCase();

  return (
    name === "AuthRetryableFetchError" ||
    name === "AbortError" ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("etimedout") ||
    lower.includes("timeout") ||
    lower.includes("aborterror") ||
    lower.includes("load failed")
  );
}
