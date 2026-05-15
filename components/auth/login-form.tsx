"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function mensajeErrorCodigo(code: string | undefined) {
  switch (code) {
    case "sin_perfil":
      return "No hay perfil vinculado a esta cuenta. Solicita ayuda al administrador para crear tu fila en perfiles_usuario.";
    case "sin_posta":
      return "Tu perfil es de encargado de posta pero no tiene posta_id. Solicita al administrador que te asigne la posta.";
    case "perfil_inconsistente":
      return "El rol de administración general no debe tener posta asignada (posta_id debe quedar vacío en la base de datos). Solicita que corrijan tu fila en perfiles_usuario.";
    case "perfil_inactivo":
      return "Tu usuario tiene perfil pero está marcado como inactivo (activo = false). Solicita al administrador que active tu cuenta en perfiles_usuario.";
    case "credenciales":
      return "Credenciales inválidas.";
    default:
      return null;
  }
}

type Props = {
  redirectTo: string;
  errorCodigo?: string;
};

export function LoginForm({ redirectTo, errorCodigo }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() =>
    errorCodigo ? mensajeErrorCodigo(errorCodigo) : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message ?? "Credenciales inválidas.");
      return;
    }

    // Esperar a que la sesión quede persistida en cookies (PKCE + chunks): si
    // navegamos antes, el RSC/middleware pueden no ver al usuario aún.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      setErrorMsg(
        "Sesión no disponible después de iniciar sesión. Intenta otra vez o recarga la página."
      );
      return;
    }

    // Navegación completa para que la siguiente petición lleve ya las cookies
    // al middleware y a los Server Components (evita pantalla en blanco / bucles).
    window.location.assign(redirectTo);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl tracking-tight">Iniciar sesión</CardTitle>
        <CardDescription>
          Acceso interno a inventario por postas. Ingresa con tu correo y contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMsg ? (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {errorMsg}
          </p>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground flex-col gap-2 items-start">
        <span>
          El alta de usuarios la realiza normalmente quien tiene rol de administración general.
          Si no puedes iniciar sesión pero tu cuenta existe, revisa con esa persona tu
          rol y posta.
        </span>
      </CardFooter>
    </Card>
  );
}
