import { cn } from "@/lib/utils";

const kinds = {
  success: "bg-success/12 text-success border-success/30",
  warn: "bg-warn/12 text-warn border-warn/30",
  block: "bg-danger/12 text-danger border-danger/30",
  info: "bg-info/12 text-info border-info/30",
  muted: "bg-paper-2 text-dim border-line",
  navy: "bg-navy/10 text-navy border-navy/25",
};

export function Badge({
  kind = "muted",
  className,
  children,
}: {
  kind?: keyof typeof kinds;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-2xs font-semibold tracking-wide uppercase",
        kinds[kind],
        className,
      )}
    >
      {children}
    </span>
  );
}
