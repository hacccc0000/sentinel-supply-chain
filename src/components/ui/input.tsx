import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-sm border border-line bg-elev px-3 text-sm text-ink outline-none placeholder:text-dim focus:border-navy/40 focus:ring-2 focus:ring-navy/15",
        className,
      )}
      {...props}
    />
  );
}
