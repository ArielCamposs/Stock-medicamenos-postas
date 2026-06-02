"use client";

import { useState, useTransition } from "react";
import type { VariantProps } from "class-variance-authority";

import { signOutAction } from "@/app/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  title?: string;
  description?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  wrapperClassName?: string;
  fullWidth?: boolean;
};

export function SignOutButton({
  label = "Cerrar sesión",
  confirmLabel = "Cerrar sesión",
  cancelLabel = "Cancelar",
  title = "¿Cerrar sesión?",
  description = "Saldrás de la aplicación en este dispositivo. Para volver a usarla tendrás que ingresar otra vez con tu correo y contraseña.",
  variant = "outline",
  size = "sm",
  className,
  wrapperClassName,
  fullWidth = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <>
      <div className={wrapperClassName}>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(fullWidth && "w-full", className)}
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleConfirm}
            >
              {pending ? "Cerrando sesión…" : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
