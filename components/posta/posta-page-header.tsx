import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function PostaPageHeader({ title, description, className, children }: Props) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <div className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}
