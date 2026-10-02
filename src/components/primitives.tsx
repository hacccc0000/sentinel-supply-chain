import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <div className="mb-2 text-2xs font-bold tracking-[0.16em] text-navy uppercase">{eyebrow}</div>
        )}
        <h1 className="text-[28px] font-medium leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  trend,
  icon,
  tone = "ink",
}: {
  label: string;
  value: string | number;
  trend?: string;
  icon?: ReactNode;
  tone?: "ink" | "success" | "danger" | "warn";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warn"
          ? "text-warn"
          : "text-ink";
  return (
    <div className="rounded-md border border-line bg-elev p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-dim">
          {icon}
          <span className="text-2xs font-bold tracking-[0.14em] uppercase">{label}</span>
        </div>
        {trend && <span className={cn("text-2xs font-semibold", color)}>{trend}</span>}
      </div>
      <div className={cn("mt-2.5 text-[28px] leading-none tracking-tight tabular-nums", color)}>{value}</div>
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const color =
    status === "online" || status === "passed"
      ? "bg-success"
      : status === "degraded" || status === "warned" || status === "update"
        ? "bg-warn"
        : status === "offline" || status === "blocked" || status === "failed"
          ? "bg-danger"
          : "bg-dim";
  return <span className={cn("inline-block size-1.5 rounded-full", color, status === "online" && "shadow-[0_0_6px_var(--bb-success)]")} />;
}

export function Sev({ level }: { level: string }) {
  const color =
    level === "critical"
      ? "bg-danger"
      : level === "high"
        ? "bg-brand-red/70"
        : level === "medium"
          ? "bg-warn"
          : level === "low"
            ? "bg-info"
            : "bg-dim";
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold capitalize">
      <span className={cn("size-2 rounded-[2px]", color)} />
      <span className="text-muted">{level}</span>
    </span>
  );
}

export function Pill({
  kind,
  children,
}: {
  kind: "success" | "warn" | "block" | "info" | "muted" | "navy";
  children: ReactNode;
}) {
  return <Badge kind={kind}>{children}</Badge>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-md border border-line bg-elev", className)}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-dim">{hint}</span>}
    </label>
  );
}
