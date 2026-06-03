export type RolUsuarioDb =
  | "ADMIN_GENERAL"
  | "BODEGA_FARMACIA"
  | "POSTA_MANAGER"
  | "READ_ONLY";

export type PerfilUsuarioRow = {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: RolUsuarioDb;
  posta_id: string | null;
  activo: boolean;
};
