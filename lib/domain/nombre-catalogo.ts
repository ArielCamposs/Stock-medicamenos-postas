/** Guarda el nombre sin espacios sobrantes al inicio, final o entre palabras. */
export function sanitizarNombreCatalogo(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ");
}

/** Normaliza nombre de catálogo para comparar sin duplicar por mayúsculas o espacios. */
export function normalizarNombreCatalogo(nombre: string): string {
  return sanitizarNombreCatalogo(nombre).toLowerCase();
}

export function nombresCatalogoEquivalentes(a: string, b: string): boolean {
  return normalizarNombreCatalogo(a) === normalizarNombreCatalogo(b);
}
