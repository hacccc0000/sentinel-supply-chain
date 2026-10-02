import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, FolderGit2, FileSignature, Hammer, History, KeyRound, LayoutDashboard, ListChecks, LogOut, Menu, PackageX, Puzzle, ScrollText, Search, ServerCog, Settings2, ShieldAlert, Sliders, Users, X } from "lucide-react";
import { useState, type ComponentType } from "react";
import { toast } from "sonner";
import { LogoLink } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading, Modal } from "@/components/helpers";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/primitives";
import { changePassword, clearSampleData, logoutFn, markNotificationsRead } from "@/lib/server/api";
import { useInvalidate, useTenant, can } from "@/lib/data";
import { NAV_DASH } from "@/lib/catalog";
import { cn, errMsg, timeAgo } from "@/lib/utils";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "layout-dashboard": LayoutDashboard, hammer: Hammer, "server-cog": ServerCog, "folder-git-2": FolderGit2, "package-x": PackageX, sliders: Sliders,
  "list-checks": ListChecks, "shield-alert": ShieldAlert, "file-signature": FileSignature, "scroll-text": ScrollText, history: History, users: Users, puzzle: Puzzle, "settings-2": Settings2,
};

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useTenant();
  const badges: Record<string, number> = {
    "/dashboard/quarantine": data?.stats.pendingQuarantine ?? 0,
    "/dashboard/findings": data?.findings.filter((f) => f.status === "open" && (f.severity === "critical" || f.severity === "high")).length ?? 0,
  };
  return (
    <nav className="flex-1 overflow-auto px-2.5 py-3" aria-label="Main">
      {NAV_DASH.map((g) => (
        <div key={g.title} className="mb-4">
          <div className="px-2 pb-2 text-2xs font-bold tracking-[0.14em] text-dim uppercase">{g.title}</div>
          {g.items.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active = item.to === "/dashboard" ? path === "/dashboard" : path.startsWith(item.to);
            const n = badges[item.to] ?? 0;
            return (
              <Link key={item.to} to={item.to} onClick={onNavigate} className={cn("mb-0.5 flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] text-muted transition-colors hover:bg-paper-2 hover:text-ink", active && "bg-navy/8 text-ink")}>
                <Icon className={cn("size-3.5 shrink-0", active ? "text-navy" : "text-dim")} />
                <span className="flex-1">{item.label}</span>
                {n > 0 && <span className="rounded-full bg-warn/15 px-1.5 py-0.5 text-2xs font-bold text-warn">{n}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserMenu() {
  const { data } = useTenant();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const me = data?.me;
  const initials = (me?.name ?? "?").split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="relative">
      {open && <button type="button" className="fixed inset-0 z-30" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left hover:bg-paper-2" aria-haspopup="menu">
        <div className="flex size-7 items-center justify-center rounded-full bg-navy text-2xs font-bold text-on-navy">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{me?.name ?? "…"}</div>
          <div className="text-2xs text-dim capitalize">{me?.role}</div>
        </div>
      </button>
      {open && (
        <div role="menu" className="bb-shadow absolute bottom-full left-0 z-40 mb-1 w-56 rounded-md border border-line bg-elev p-1.5">
          <div className="truncate px-2.5 py-2 text-2xs text-dim">{me?.email}</div>
          <button role="menuitem" type="button" className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-xs hover:bg-paper-2" onClick={() => { setOpen(false); setPw(true); }}><KeyRound className="size-3.5" />Change password</button>
          <button role="menuitem" type="button" className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-xs text-danger hover:bg-paper-2" onClick={async () => { await logoutFn(); qc.clear(); await nav({ to: "/login" }); }}><LogOut className="size-3.5" />Sign out</button>
        </div>
      )}
      {pw && <PasswordModal onClose={() => setPw(false)} />}
    </div>
  );
}

export function PasswordModal({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Change password" onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try { await changePassword({ data: { current: cur, next } }); toast.success("Password updated"); onClose(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
      }}>
        <Field label="Current password"><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" /></Field>
        <Field label="New password" hint="At least 10 characters, letters and numbers."><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} autoComplete="new-password" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>Update password</Button></div>
      </form>
    </Modal>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useTenant();
  const name = data?.tenant.tenant_name ?? "";
  return (
    <>
      <div className="border-b border-line px-4 py-5">
        <LogoLink to="/dashboard" size="sm" />
        <div className="mt-3.5 flex items-center gap-2 rounded-sm border border-line bg-elev px-2.5 py-2">
          <div className="flex size-6 items-center justify-center rounded-[5px] bg-paper-2 text-2xs font-bold">{name.slice(0, 2).toUpperCase() || "··"}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">{name || "Workspace"}</div>
            <div className="text-2xs text-dim">{data?.tenant.region ?? ""}</div>
          </div>
        </div>
      </div>
      <NavItems onNavigate={onNavigate} />
      <div className="border-t border-line p-3">
        <ThemeToggle />
        <div className="mt-2"><UserMenu /></div>
      </div>
    </>
  );
}

function Notifications() {
  const { data } = useTenant();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const n = data?.notifications ?? [];
  return (
    <div className="relative">
      <Button variant="ghost" size="icon" aria-label={`Notifications${data?.unread ? ` (${data.unread} unread)` : ""}`} onClick={async () => { setOpen((o) => !o); if (!open && data?.unread) { await markNotificationsRead(); setTimeout(() => void invalidate(), 1500); } }}>
        <Bell className="size-4" />
        {!!data?.unread && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger" />}
      </Button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-30" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="bb-shadow absolute right-0 z-40 mt-1 w-[min(92vw,380px)] rounded-md border border-line bg-elev">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold">Notifications</div>
            <div className="max-h-[60dvh] overflow-auto">
              {n.length === 0 && <div className="px-4 py-8 text-center text-sm text-dim">Nothing yet. Build verdicts and quarantine alerts show up here.</div>}
              {n.map((x) => (
                <Link key={x.id} to={(x.link ?? "/dashboard") as "/dashboard"} onClick={() => setOpen(false)} className="block border-b border-line/70 px-4 py-3 last:border-0 hover:bg-paper-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-1.5 rounded-full", x.severity === "critical" ? "bg-danger" : x.severity === "warn" ? "bg-warn" : x.severity === "success" ? "bg-success" : "bg-info")} />
                    <span className="flex-1 text-xs font-semibold">{x.title}</span>
                    <span className="text-2xs text-dim">{timeAgo(x.created_at)}</span>
                  </div>
                  <div className="mt-0.5 pl-3.5 text-xs text-muted">{x.body}</div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SampleBanner() {
  const { data } = useTenant();
  const invalidate = useInvalidate();
  const [dismissed, setDismissed] = useState(false);
  if (!data || data.sampleCount === 0 || dismissed) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-info/30 bg-info/8 px-4 py-2.5 text-xs text-muted md:px-8">
      <Badge kind="info">Sample data</Badge>
      <span className="flex-1">This workspace includes the bundled NorthBank sample estate so every screen has something to show. Your own projects, builds and findings are real.</span>
      {can(data.me.permissions, "settings.manage") && (
        <Button size="sm" variant="secondary" onClick={async () => { if (!window.confirm("Remove all sample records (NorthBank projects, builds, findings, workers)? Your own data is kept.")) return; try { await clearSampleData(); await invalidate(); toast.success("Sample data cleared"); } catch (e) { toast.error(errMsg(e)); } }}>Clear sample data</Button>
      )}
      <button type="button" className="text-dim hover:text-ink" onClick={() => setDismissed(true)} aria-label="Dismiss"><X className="size-3.5" /></button>
    </div>
  );
}

export function DashboardShell() {
  const [open, setOpen] = useState(false);
  const { data, isError, error, refetch } = useTenant();
  const healthy = !isError;
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-side lg:flex"><SidebarInner /></aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[min(84vw,280px)] flex-col bg-side">
            <button type="button" className="absolute top-3 right-3 size-10" onClick={() => setOpen(false)} aria-label="Close"><X className="size-4" /></button>
            <SidebarInner onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-[var(--bb-nav)] px-4 py-2.5 backdrop-blur md:px-8">
          <button type="button" className="inline-flex size-10 items-center justify-center rounded-sm border border-line lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-4" /></button>
          <label className="relative min-w-0 max-w-md flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-dim" />
            <input readOnly onFocus={(e) => { e.currentTarget.blur(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })); }} placeholder="Search builds, projects, packages, findings…" className="h-9 w-full rounded-sm border border-line bg-elev pr-12 pl-8 text-xs outline-none" />
            <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[3px] border border-line px-1.5 py-0.5 font-mono text-2xs text-dim">⌘K</kbd>
          </label>
          <span className="hidden flex-1 sm:block" />
          <Notifications />
          <span className="hidden items-center gap-1.5 text-2xs text-dim sm:inline-flex" title={healthy ? "Control plane responding" : "Cannot reach the control plane"}>
            <span className={cn("size-1.5 rounded-full", healthy ? "bg-success shadow-[0_0_6px_var(--bb-success)]" : "bg-danger")} />
            {healthy ? `${data?.stats.online ?? 0} worker${data?.stats.online === 1 ? "" : "s"} online` : "Reconnecting…"}
          </span>
        </header>
        <SampleBanner />
        {isError ? (
          <div className="px-4 py-10 md:px-9"><div className="rounded-md border border-danger/30 bg-danger/5 p-5 text-sm"><div className="mb-1 font-semibold text-danger">Could not load the workspace</div><div className="mb-3 text-muted">{errMsg(error)}</div><Button size="sm" onClick={() => void refetch()}>Retry</Button></div></div>
        ) : !data ? <Loading label="Loading workspace…" /> : <main className="mx-auto w-full max-w-[1400px] px-4 py-7 md:px-9"><Outlet /></main>}
      </div>
      <CommandPalette />
    </div>
  );
}
