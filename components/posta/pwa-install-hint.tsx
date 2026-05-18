"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "pwa_install_hint_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferred) return null;

  async function instalar() {
    if (!deferred) return;
    await deferred.prompt();
    setVisible(false);
    setDeferred(null);
  }

  function cerrar() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    setDeferred(null);
  }

  return (
    <div className="border-b border-primary/25 bg-primary/5 px-4 py-2.5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex items-center gap-2 text-foreground">
          <Download className="size-4 shrink-0 text-primary" aria-hidden />
          Puedes instalar esta app en el dispositivo para usarla sin abrir el navegador.
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void instalar()}>
            Instalar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cerrar} aria-label="Cerrar aviso">
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
