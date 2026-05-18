"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "amber" | "sky";

const variantClass: Record<Variant, string> = {
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-950 dark:text-sky-100",
};

type Props = {
  storageKey: string;
  variant: Variant;
  children: React.ReactNode;
};

export function DismissibleBanner({ storageKey, variant, children }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(storageKey) !== "1");
    } catch {
      setVisible(true);
    }
  }, [storageKey]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* modo privado */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className={cn("border-b", variantClass[variant])}>
      <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-xs">
        <div className="min-w-0 flex-1">{children}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-current hover:bg-black/5 dark:hover:bg-white/10"
          onClick={dismiss}
          aria-label="Cerrar aviso"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
