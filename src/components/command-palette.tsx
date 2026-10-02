import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { NAV_DASH } from "@/lib/catalog";
import { useTenant } from "@/lib/data";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useTenant();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const groups = useMemo(() => {
    const pages = NAV_DASH.flatMap((g) => g.items.map((i) => ({ to: String(i.to), label: i.label, hint: i.to as string })));
    const builds = (data?.builds ?? []).slice(0, 25).map((b) => ({ to: `/dashboard/builds/${b.id}`, label: `Build #${b.id} · ${b.project} · ${b.status}`, hint: b.commit }));
    const projects = (data?.projects ?? []).map((p) => ({ to: "/dashboard/projects", label: `Project · ${p.name}`, hint: p.repo }));
    const pkgs = (data?.quarantine ?? []).slice(0, 25).map((q) => ({ to: "/dashboard/quarantine", label: `Package · ${q.name}@${q.version}`, hint: q.decision ?? "pending" }));
    const finds = (data?.findings ?? []).slice(0, 25).map((f) => ({ to: "/dashboard/findings", label: `Finding · ${f.title}`, hint: f.severity }));
    const site = [{ to: "/", label: "Marketing site", hint: "/" }, { to: "/docs", label: "Docs", hint: "/docs" }];
    return [["Pages", pages], ["Builds", builds], ["Projects", projects], ["Packages", pkgs], ["Findings", finds], ["Site", site]] as const;
  }, [data]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/30 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <Command className="bb-shadow w-full max-w-xl overflow-hidden rounded-lg border border-line bg-elev" onClick={(e) => e.stopPropagation()}>
        <Command.Input autoFocus placeholder="Search builds, projects, packages, findings, pages…" className="h-12 w-full border-b border-line bg-transparent px-4 text-sm outline-none" />
        <Command.List className="max-h-80 overflow-auto p-2">
          <Command.Empty className="px-3 py-6 text-sm text-dim">No matches.</Command.Empty>
          {groups.map(([g, items]) => (
            <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-dim">
              {items.map((i, n) => (
                <Command.Item key={g + n + i.label} value={`${g} ${i.label} ${i.hint}`} onSelect={() => { void navigate({ to: i.to }); setOpen(false); }} className="flex cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm text-ink aria-selected:bg-paper-2">
                  <span className="truncate">{i.label}</span>
                  <span className="shrink-0 font-mono text-2xs text-dim">{i.hint}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

export function openCommandPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}
