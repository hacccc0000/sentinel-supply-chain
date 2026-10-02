import { Loader2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInvalidate } from "@/lib/data";
import { errMsg } from "@/lib/utils";
import type { BuildStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: BuildStatus | string }) {
  const kind = status === "blocked" ? "block" : status === "warned" || status === "overridden" ? "warn" : status === "failed" ? "muted" : status === "running" ? "info" : "success";
  return (
    <Badge kind={kind}>
      {status === "running" && <Loader2 className="size-2.5 animate-spin" />}
      {status}
    </Badge>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-1 text-sm font-semibold">{title}</div>
      {body && <p className="mb-4 max-w-md text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-10 text-sm text-dim">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

/** Run a server action with toast feedback, refreshing the tenant data afterwards. */
export function useRun() {
  const invalidate = useInvalidate();
  return async function run<T>(fn: () => Promise<T>, success?: string | ((r: T) => string | undefined)): Promise<T | undefined> {
    try {
      const r = await fn();
      await invalidate();
      const msg = typeof success === "function" ? success(r) : success;
      if (msg) toast.success(msg);
      return r;
    } catch (e) {
      toast.error(errMsg(e));
      return undefined;
    }
  };
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label={title}>
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close" onClick={onClose} />
      <div className={`bb-shadow relative max-h-[90dvh] w-full overflow-auto rounded-lg border border-line bg-elev ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-dim hover:text-ink"><X className="size-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ title, body, confirmLabel = "Confirm", danger, onConfirm, onClose }: { title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="mb-5 text-sm text-muted">{body}</div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "default"} onClick={async () => { await onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export function Table({ heads, children, min = 720 }: { heads: string[]; children: ReactNode; min?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: min }}>
        <thead className="text-2xs font-bold tracking-wider text-dim uppercase">
          <tr>{heads.map((h) => <th key={h} className="px-3.5 py-3">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<[T, string]>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex overflow-x-auto border-b border-line" role="tablist">
      {tabs.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} type="button" onClick={() => onChange(k)} className={`shrink-0 px-4 py-3 text-sm font-medium ${value === k ? "border-b-2 border-navy text-ink" : "text-dim hover:text-ink"}`}>{l}</button>
      ))}
    </div>
  );
}

export const Select = (p: React.ComponentProps<"select">) => (
  <select {...p} className={`h-10 rounded-sm border border-line bg-elev px-2.5 text-sm outline-none focus:border-navy/40 ${p.className ?? ""}`} />
);

export const Textarea = (p: React.ComponentProps<"textarea">) => (
  <textarea {...p} className={`w-full rounded-sm border border-line bg-elev px-3 py-2 font-mono text-xs outline-none placeholder:text-dim focus:border-navy/40 focus:ring-2 focus:ring-navy/15 ${p.className ?? ""}`} />
);

export function CopyBox({ text, label }: { text: string; label?: string }) {
  return (
    <div className="relative rounded-sm border border-line bg-paper-2 p-3.5 font-mono text-xs leading-6 break-all whitespace-pre-wrap text-muted">
      <button type="button" className="absolute top-2 right-2 rounded-sm border border-line bg-elev px-2 py-1 text-2xs font-sans font-semibold text-ink" onClick={() => { void navigator.clipboard.writeText(text); toast.success(label ? `${label} copied` : "Copied"); }}>Copy</button>
      {text}
    </div>
  );
}
