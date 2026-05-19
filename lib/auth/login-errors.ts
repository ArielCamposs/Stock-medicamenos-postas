import type { CorreoLoginEstado } from "@/lib/auth/verificar-correo-login";

/** Mensaje solo para lectores de pantalla (sin texto visible en UI). */
export type LoginFieldError = {
  fields: ("email" | "password")[];
  a11yMessage: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarCamposLogin(email: string, password: string): LoginFieldError | null {
  const trimmed = email.trim();

  if (!trimmed) {
    return {
      fields: ["email"],
      a11yMessage: "Ingresa tu correo.",
    };
  }

  if (!EMAIL_RE.test(trimmed)) {
    return {
      fields: ["email"],
      a11yMessage: "El correo no tiene un formato válido.",
    };
  }

  if (!password) {
    return {
      fields: ["password"],
      a11yMessage: "Ingresa tu contraseña.",
    };
  }

  return null;
}

/** Tras verificar correo en servidor; solo errores de usuario/cuenta (campo correo). */
export function mapCorreoVerificado(estado: CorreoLoginEstado): LoginFieldError | null {
  switch (estado) {
    case "ok":
      return null;
    case "correo_invalido":
      return {
        fields: ["email"],
        a11yMessage: "El correo no tiene un formato válido.",
      };
    case "no_encontrado":
      return {
        fields: ["email"],
        a11yMessage: "No existe una cuenta con este correo.",
      };
    case "sin_perfil":
      return {
        fields: ["email"],
        a11yMessage:
          mensajePerfilAccesible("sin_perfil") ??
          "No hay perfil vinculado a esta cuenta.",
      };
    case "inactivo":
      return {
        fields: ["email"],
        a11yMessage:
          mensajePerfilAccesible("perfil_inactivo") ??
          "Tu cuenta está inactiva.",
      };
    case "sin_posta":
      return {
        fields: ["email"],
        a11yMessage:
          mensajePerfilAccesible("sin_posta") ??
          "Tu perfil no tiene posta asignada.",
      };
    case "perfil_inconsistente":
      return {
        fields: ["email"],
        a11yMessage:
          mensajePerfilAccesible("perfil_inconsistente") ??
          "Tu perfil tiene una configuración inconsistente.",
      };
    default:
      return {
        fields: ["email"],
        a11yMessage: "No se pudo verificar el correo.",
      };
  }
}

type AuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

export function mapSupabaseLoginError(error: AuthErrorLike): LoginFieldError {
  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();

  if (
    code === "invalid_credentials" ||
    code === "invalid_grant" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid email or password") ||
    msg.includes("correo o contraseña")
  ) {
    // El correo ya fue verificado antes; solo puede fallar la contraseña.
    return {
      fields: ["password"],
      a11yMessage: "Contraseña incorrecta.",
    };
  }

  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return {
      fields: ["email"],
      a11yMessage: "Debes confirmar tu correo antes de ingresar.",
    };
  }

  if (code === "user_banned" || msg.includes("user is banned")) {
    return {
      fields: ["email", "password"],
      a11yMessage: "Esta cuenta está bloqueada. Contacta al administrador.",
    };
  }

  if (
    code === "too_many_requests" ||
    error.status === 429 ||
    msg.includes("too many")
  ) {
    return {
      fields: ["email", "password"],
      a11yMessage: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    };
  }

  if (msg.includes("email") && (msg.includes("invalid") || msg.includes("valid"))) {
    return {
      fields: ["email"],
      a11yMessage: "El correo no es válido.",
    };
  }

  return {
    fields: ["password"],
    a11yMessage: "No se pudo iniciar sesión. Revisa tu contraseña.",
  };
}

export function mensajePerfilAccesible(code: string | undefined): string | null {
  switch (code) {
    case "sin_perfil":
      return "No hay perfil vinculado a esta cuenta. Solicita ayuda al administrador.";
    case "sin_posta":
      return "Tu perfil no tiene posta asignada. Solicita ayuda al administrador.";
    case "perfil_inconsistente":
      return "Tu perfil tiene una configuración inconsistente. Solicita ayuda al administrador.";
    case "perfil_inactivo":
      return "Tu cuenta está inactiva. Solicita al administrador que la active.";
    case "credenciales":
      return "Correo o contraseña incorrectos.";
    default:
      return null;
  }
}
