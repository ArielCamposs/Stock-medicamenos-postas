import Image from "next/image";

import { cn } from "@/lib/utils";

/** Logo compacto para cabeceras dentro de la app. */
export const DESAM_LOGO_SRC = "/desam.png";
export const DESAM_LOGO_WIDTH = 217;
export const DESAM_LOGO_HEIGHT = 232;

type DesamLogoProps = {
  variant?: "header-sm" | "header-md";
  className?: string;
  priority?: boolean;
};

const variantClass: Record<NonNullable<DesamLogoProps["variant"]>, string> = {
  "header-sm": "h-7 w-auto max-w-full object-contain",
  "header-md": "h-8 w-auto max-w-full object-contain",
};

export function DesamLogo({
  variant = "header-sm",
  className,
  priority = false,
}: DesamLogoProps) {
  return (
    <Image
      src={DESAM_LOGO_SRC}
      alt="Logo desam"
      width={DESAM_LOGO_WIDTH}
      height={DESAM_LOGO_HEIGHT}
      unoptimized
      priority={priority}
      className={cn(variantClass[variant], className)}
    />
  );
}
