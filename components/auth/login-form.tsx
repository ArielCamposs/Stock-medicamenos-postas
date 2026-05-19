"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  mapCorreoVerificado,
  mapSupabaseLoginError,
  mensajePerfilAccesible,
  validarCamposLogin,
  type LoginFieldError,
} from "@/lib/auth/login-errors";
import { verificarCorreoLogin } from "@/lib/auth/verificar-correo-login";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type ShakeTarget = "email" | "password" | "form";

type Props = {
  redirectTo: string;
  errorCodigo?: string;
};

export function LoginForm({ redirectTo, errorCodigo }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [formError, setFormError] = useState(false);
  const [a11yMessage, setA11yMessage] = useState<string | null>(null);
  const [shakeTarget, setShakeTarget] = useState<ShakeTarget | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const perfilErrorHandled = useRef(false);

  const runShake = useCallback((target: ShakeTarget) => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShakeTarget(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShakeTarget(target);
        shakeTimer.current = setTimeout(() => setShakeTarget(null), 520);
      });
    });
  }, []);

  const applyFieldError = useCallback(
    (err: LoginFieldError) => {
      setA11yMessage(err.a11yMessage);
      setFormError(false);
      setEmailError(err.fields.includes("email"));
      setPasswordError(err.fields.includes("password"));

      const target: ShakeTarget =
        err.fields.length === 2
          ? "form"
          : err.fields[0] === "email"
            ? "email"
            : "password";
      runShake(target);
    },
    [runShake]
  );

  const applyFormError = useCallback(
    (message: string) => {
      setA11yMessage(message);
      setEmailError(false);
      setPasswordError(false);
      setFormError(true);
      runShake("form");
    },
    [runShake]
  );

  const clearErrors = useCallback(() => {
    setEmailError(false);
    setPasswordError(false);
    setFormError(false);
    setA11yMessage(null);
    setShakeTarget(null);
  }, []);

  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (perfilErrorHandled.current || !errorCodigo) return;
    const msg = mensajePerfilAccesible(errorCodigo);
    if (!msg) return;
    perfilErrorHandled.current = true;

    if (errorCodigo === "credenciales") {
      applyFieldError({ fields: ["password"], a11yMessage: msg });
    } else {
      applyFormError(msg);
    }
  }, [errorCodigo, applyFieldError, applyFormError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();
    setLoading(true);

    const validation = validarCamposLogin(email, password);
    if (validation) {
      setLoading(false);
      applyFieldError(validation);
      return;
    }

    const verificacion = await verificarCorreoLogin(email);
    if ("error" in verificacion) {
      setLoading(false);
      applyFormError(verificacion.error);
      return;
    }

    const errorCorreo = mapCorreoVerificado(verificacion.estado);
    if (errorCorreo) {
      setLoading(false);
      applyFieldError(errorCorreo);
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      applyFieldError(mapSupabaseLoginError(error));
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      applyFormError(
        "Sesión no disponible después de iniciar sesión. Intenta otra vez o recarga la página."
      );
      return;
    }

    window.location.assign(redirectTo);
  }

  return (
    <Card
      className={cn(
        "w-full max-w-md",
        formError && "login-card-error",
        shakeTarget === "form" && "login-field-shake"
      )}
    >
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl tracking-tight">Iniciar sesión</CardTitle>
        <CardDescription>
          Acceso interno a inventario por postas. Ingresa con tu correo y contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p aria-live="assertive" className="sr-only">
          {a11yMessage ?? ""}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div
            className={cn(
              "space-y-2",
              shakeTarget === "email" && "login-field-shake"
            )}
          >
            <Label
              htmlFor="email"
              className={cn(emailError && "text-destructive font-medium")}
            >
              Correo
            </Label>
            <Input
              id="email"
              type="text"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              aria-invalid={emailError}
              className={cn(emailError && "login-input-error")}
              onChange={(ev) => {
                setEmail(ev.target.value);
                if (emailError) setEmailError(false);
              }}
            />
          </div>
          <div
            className={cn(
              "space-y-2",
              shakeTarget === "password" && "login-field-shake"
            )}
          >
            <Label
              htmlFor="password"
              className={cn(passwordError && "text-destructive font-medium")}
            >
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={passwordError}
              className={cn(passwordError && "login-input-error")}
              onChange={(ev) => {
                setPassword(ev.target.value);
                if (passwordError) setPasswordError(false);
              }}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
