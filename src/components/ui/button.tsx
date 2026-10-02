import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40",
  {
    variants: {
      variant: {
        default: "bg-navy text-on-navy hover:bg-navy-deep",
        secondary: "bg-elev text-ink border border-line hover:bg-paper-2",
        ghost: "bg-transparent text-ink hover:bg-paper-2",
        danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
        outline: "border border-line bg-transparent text-ink hover:bg-paper-2",
      },
      size: {
        default: "h-10 px-3.5",
        sm: "h-8 px-2.5 text-xs",
        lg: "h-11 px-5",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
