import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-teal-deep px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white",
        className,
      )}
      {...props}
    />
  );
}
