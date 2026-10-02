import { Link, useNavigate } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, PageHeader } from "@/components/primitives";
import { Empty, Loading, Select, StatusBadge, Table, useRun } from "@/components/helpers";
import { can, useTenant } from "@/lib/data";
import { runProtectedBuild } from "@/lib/server/api";
import { timeAgo } from "@/lib/utils";

export function BuildsListPage() {
  const { data } = useTenant();
  const run = useRun();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [project, setProject] = useState("all");
  const rows = useMemo(() => (data?.builds ?? []).filter((b) => (status === "all" || b.status === status) && (project === "all" || b.project_id === project) && (!q || `${b.id} ${b.project} ${b.commit} ${b.branch} ${b.author}`.toLowerCase().includes(q.toLowerCase()))), [data, q, status, project]);
  if (!data) return <Loading />;
  const canRun = can(data.me.permissions, "builds.run");
  const go = async (pid: string) => {
    const r = await run(() => runProtectedBuild({ data: { project_id: pid } }));
    if (r && !r.ok) return void (await import("sonner")).toast.error(r.error);
    if (r?.ok) void nav({ to: "/dashboard/builds/$buildId", params: { buildId: r.id } });
  };
  return (
    <>
      <PageHeader eyebrow="Pipeline" title="Builds" subtitle="Every protected build with its verdict, evidence and trigger." actions={canRun && data.projects.length > 0 && (
        <Select aria-label="Run build for project" value="" onChange={(e) => e.target.value && void go(e.target.value)}>
          <option value="">▶ Run build for…</option>
          {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      )} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input className="max-w-xs" placeholder="Search id, project, commit, author…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search builds" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
            <option value="all">All statuses</option>
            {["running", "passed", "warned", "blocked", "overridden", "failed"].map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project filter">
            <option value="all">All projects</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        {rows.length === 0 ? (
          <Empty title={data.builds.length ? "No builds match these filters" : "No builds yet"} body={data.builds.length ? undefined : "Register a project, then run a protected build — or call the CI scan API from your pipeline."} action={!data.builds.length && <Link to="/dashboard/projects"><Button><Play className="size-4" />Go to projects</Button></Link>} />
        ) : (
          <Table heads={["Build", "Project", "Source", "Trigger", "Findings", "Duration", "When", "Status"]} min={900}>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-line hover:bg-paper-2">
                <td className="px-3.5 py-3 font-mono text-xs"><Link to="/dashboard/builds/$buildId" params={{ buildId: b.id }} className="font-semibold text-navy hover:underline">#{b.id}</Link></td>
                <td className="px-3.5 py-3 font-medium">{b.project}</td>
                <td className="px-3.5 py-3 font-mono text-xs text-muted">{b.branch}@{b.commit}</td>
                <td className="px-3.5 py-3 text-xs text-muted">{b.trigger}{b.requested_by ? ` · ${b.requested_by}` : ""}</td>
                <td className="px-3.5 py-3 tabular-nums">{b.findings}</td>
                <td className="px-3.5 py-3 font-mono text-xs text-muted">{b.duration}</td>
                <td className="px-3.5 py-3 text-xs text-dim">{timeAgo(b.created_at)}</td>
                <td className="px-3.5 py-3"><StatusBadge status={b.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
